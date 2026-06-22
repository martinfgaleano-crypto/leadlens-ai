import { NextRequest, NextResponse } from "next/server";
import { searchPeople } from "@/lib/apollo/client";
import type { ApolloLeadResult } from "@/lib/apollo/client";
import { classifyEmail } from "@/lib/quality/email-quality";
import { normalizeTitle, detectSeniority } from "@/lib/quality/title-normalizer";
import { normalizeCompany, extractDomain } from "@/lib/quality/company-normalizer";
import { computeLeadScore, computeConfidenceScore } from "@/lib/quality/scoring";

/**
 * POST /api/process/search/[id]
 *
 * Auto-processing endpoint. Called by the customer dashboard (fire-and-forget)
 * immediately after a lead_search is inserted. Runs the full Apollo pipeline
 * server-side and returns when complete. The browser never awaits the response.
 *
 * Security model:
 *   - Uses service role key for all DB operations.
 *   - Only operates on searches with status = "pending".
 *   - Atomic status transition (pending → processing) prevents double-runs.
 *   - No customer secret required: the worst an unauthenticated caller can do
 *     is trigger processing on an already-pending search (idempotent).
 */

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const searchId = params.id;
  const startMs  = Date.now();

  const client = await db();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  // ── 1. Fetch search (service role — no RLS) ──────────────────────────────────

  const { data: search, error: fetchErr } = await client
    .from("lead_searches")
    .select("*")
    .eq("id", searchId)
    .single();

  if (fetchErr || !search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  // ── 2. Duplicate-run guard: only process pending searches ────────────────────
  // Use an atomic UPDATE with status filter so concurrent calls are safe.

  if (search.status !== "pending") {
    return NextResponse.json({
      skipped: true,
      reason:  `Status is already "${search.status as string}" — not reprocessing.`,
    });
  }

  // Atomic transition: WHERE status='pending' ensures only one process wins.
  const { data: claimed } = await client
    .from("lead_searches")
    .update({
      status:             "processing",
      process_started_at: new Date().toISOString(),
    })
    .eq("id", searchId)
    .eq("status", "pending")   // guard: only claim if still pending
    .select("id");

  if (!claimed || claimed.length === 0) {
    // Another process already claimed it or status changed
    return NextResponse.json({
      skipped: true,
      reason:  "Another process already started this search.",
    });
  }

  // ── 3. Fetch linked ICP ──────────────────────────────────────────────────────

  let icp: Record<string, unknown> | null = null;
  if (search.icp_id) {
    const { data } = await client
      .from("icps")
      .select("*")
      .eq("id", search.icp_id as string)
      .single();
    icp = data ?? null;
  }

  // ── 4. Build Apollo params (search fields take priority over ICP fields) ─────

  const jobTitles      = (icp?.target_job_titles as string[] | null) ?? [];
  const icpCountries   = (icp?.target_countries  as string[] | null) ?? [];
  const icpIndustries  = (icp?.industries         as string[] | null) ?? [];
  const companySizes   = (icp?.company_sizes      as string[] | null) ?? [];
  const keywords       = (icp?.keywords           as string[] | null) ?? [];
  const searchCountries  = (search.countries  as string[] | null) ?? [];
  const searchIndustries = (search.industries as string[] | null) ?? [];

  const apolloParams = {
    job_titles:    jobTitles,
    industries:    searchIndustries.length > 0 ? searchIndustries : icpIndustries,
    company_sizes: companySizes,
    countries:     searchCountries.length  > 0 ? searchCountries  : icpCountries,
    keywords,
    limit:         (search.requested_lead_count as number) ?? 10,
  };

  // ── 5. Call Apollo ────────────────────────────────────────────────────────────

  let apolloResult: { results: ApolloLeadResult[]; total_available: number };

  try {
    apolloResult = await searchPeople(apolloParams);
  } catch (err: unknown) {
    const msg        = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;

    const existingNotes = (search.admin_notes as string | null) ?? "";
    const errorNote     = `[Auto-process error — ${new Date().toISOString()}]\n${msg}`;
    const newNotes      = existingNotes ? `${existingNotes}\n\n${errorNote}` : errorNote;

    await client
      .from("lead_searches")
      .update({
        status:                   "failed",
        process_finished_at:      new Date().toISOString(),
        process_duration_ms:      durationMs,
        process_generated_count:  0,
        process_duplicates_skipped: 0,
        process_error_message:    msg,
        admin_notes:              newNotes,
      })
      .eq("id", searchId);

    return NextResponse.json(
      { success: false, error: msg, duration_ms: durationMs },
      { status: 502 }
    );
  }

  // ── 6. Dedup against existing leads ──────────────────────────────────────────

  const { data: existing } = await client
    .from("lead_results")
    .select("company_name, email")
    .eq("search_id", searchId);

  const existingKeys = new Set(
    (existing ?? []).map(
      (r: { company_name: string; email: string | null }) =>
        `${r.company_name.toLowerCase()}|${(r.email ?? "").toLowerCase()}`
    )
  );

  const toInsert = apolloResult.results.filter((r) => {
    const key = `${r.company_name.toLowerCase()}|${(r.email ?? "").toLowerCase()}`;
    return !existingKeys.has(key);
  });

  const skipped = apolloResult.results.length - toInsert.length;

  // ── 7. Insert lead_results ────────────────────────────────────────────────────

  let insertedCount = 0;
  let insertError: string | null = null;

  if (toInsert.length > 0) {
    const rows = toInsert.map((r) => {
      const { email_type, email_quality } = classifyEmail(r.email);
      const seniority        = detectSeniority(r.title);
      const normalized_title   = normalizeTitle(r.title);
      const normalized_company = normalizeCompany(r.company_name);
      const domain             = extractDomain(r.website);
      const lead_score         = computeLeadScore({
        seniority, email_type, website: r.website,
        linkedin_url: r.linkedin_url, country: r.country,
      });
      const confidence_score = computeConfidenceScore({
        email: r.email, website: r.website,
        linkedin_url: r.linkedin_url, title: r.title,
      });
      return {
        ...r,
        search_id:          searchId,
        email_type,
        email_quality,
        seniority,
        normalized_title,
        normalized_company,
        domain,
        lead_score,
        confidence_score,
      };
    });
    const { data: inserted, error: insErr } = await client
      .from("lead_results")
      .insert(rows)
      .select("id");

    if (insErr) {
      insertError = insErr.message;
    } else {
      insertedCount = inserted?.length ?? toInsert.length;
    }
  }

  // ── 8. Update final status + log fields ──────────────────────────────────────

  const durationMs  = Date.now() - startMs;
  const finalStatus = insertError && insertedCount === 0 ? "failed" : "completed";

  const updatePayload: Record<string, unknown> = {
    status:                    finalStatus,
    process_finished_at:       new Date().toISOString(),
    process_duration_ms:       durationMs,
    process_generated_count:   insertedCount,
    process_duplicates_skipped: skipped,
    process_error_message:     insertError ?? null,
  };

  if (insertError) {
    const existingNotes = (search.admin_notes as string | null) ?? "";
    const errNote = `[Insert error — ${new Date().toISOString()}]\n${insertError}`;
    updatePayload.admin_notes = existingNotes
      ? `${existingNotes}\n\n${errNote}`
      : errNote;
  }

  await client
    .from("lead_searches")
    .update(updatePayload)
    .eq("id", searchId);

  // ── 9. Return log ─────────────────────────────────────────────────────────────

  return NextResponse.json({
    success:         finalStatus === "completed",
    search_id:       searchId,
    requested:       apolloParams.limit,
    apollo_returned: apolloResult.results.length,
    inserted:        insertedCount,
    skipped,
    errors:          insertError ? [insertError] : [],
    duration_ms:     durationMs,
    final_status:    finalStatus,
  });
}
