import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { searchPeople } from "@/lib/apollo/client";
import type { ApolloLeadResult } from "@/lib/apollo/client";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ─── POST /api/admin/searches/[id]/generate ───────────────────────────────────
// Admin-triggered Apollo lead generation.
// Flow: fetch ICP → call Apollo → dedup → insert lead_results → update status.
// Uses service role throughout — no customer RLS involved.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const startMs = Date.now();
  const searchId = params.id;

  const client = await db();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  // ── 1. Fetch search ──────────────────────────────────────────────────────────

  const { data: search, error: searchErr } = await client
    .from("lead_searches")
    .select("*")
    .eq("id", searchId)
    .single();

  if (searchErr || !search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  // ── 2. Fetch linked ICP ──────────────────────────────────────────────────────

  let icp: Record<string, unknown> | null = null;
  if (search.icp_id) {
    const { data } = await client
      .from("icps")
      .select("*")
      .eq("id", search.icp_id as string)
      .single();
    icp = data ?? null;
  }

  // ── 3. Mark as processing ────────────────────────────────────────────────────

  await client
    .from("lead_searches")
    .update({ status: "processing" })
    .eq("id", searchId);

  // ── 4. Build Apollo params from ICP + search fields ──────────────────────────
  // Priority for countries/industries: lead_searches fields first (customer-chosen),
  // fall back to ICP fields.

  const jobTitles    = (icp?.target_job_titles as string[] | null) ?? [];
  const icpCountries = (icp?.target_countries  as string[] | null) ?? [];
  const icpIndustries = (icp?.industries        as string[] | null) ?? [];
  const companySizes  = (icp?.company_sizes     as string[] | null) ?? [];
  const keywords      = (icp?.keywords          as string[] | null) ?? [];

  const searchCountries   = (search.countries  as string[] | null) ?? [];
  const searchIndustries  = (search.industries as string[] | null) ?? [];

  const countries  = searchCountries.length > 0  ? searchCountries  : icpCountries;
  const industries = searchIndustries.length > 0 ? searchIndustries : icpIndustries;

  const apolloParams = {
    job_titles:    jobTitles,
    industries,
    company_sizes: companySizes,
    countries,
    keywords,
    limit:         (search.requested_lead_count as number) ?? 10,
  };

  // ── 5. Call Apollo ───────────────────────────────────────────────────────────

  let apolloResult: { results: ApolloLeadResult[]; total_available: number };

  try {
    apolloResult = await searchPeople(apolloParams);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;

    // Append error to admin_notes so admin sees it in the detail page
    const existingNotes = (search.admin_notes as string | null) ?? "";
    const errorNote = `[Apollo error — ${new Date().toISOString()}]\n${msg}\nDuration: ${durationMs}ms`;
    const newNotes  = existingNotes ? `${existingNotes}\n\n${errorNote}` : errorNote;

    await client
      .from("lead_searches")
      .update({ status: "failed", admin_notes: newNotes })
      .eq("id", searchId);

    return NextResponse.json(
      {
        success:     false,
        error:       msg,
        duration_ms: durationMs,
        final_status: "failed",
      },
      { status: 502 }
    );
  }

  // ── 6. Dedup against existing leads for this search ──────────────────────────

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
    const rows = toInsert.map((r) => ({ ...r, search_id: searchId }));
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

  // ── 8. Update final status ───────────────────────────────────────────────────

  const durationMs  = Date.now() - startMs;
  const finalStatus = insertError && insertedCount === 0 ? "failed" : "completed";

  // Only write to admin_notes on insert failure — preserve admin's own notes otherwise.
  if (insertError) {
    const existingNotes = (search.admin_notes as string | null) ?? "";
    const errNote = `[Insert error — ${new Date().toISOString()}]\n${insertError}`;
    const newNotes = existingNotes ? `${existingNotes}\n\n${errNote}` : errNote;
    await client
      .from("lead_searches")
      .update({ status: finalStatus, admin_notes: newNotes })
      .eq("id", searchId);
  } else {
    await client
      .from("lead_searches")
      .update({ status: finalStatus })
      .eq("id", searchId);
  }

  // ── 9. Return log ─────────────────────────────────────────────────────────────

  return NextResponse.json({
    success:          finalStatus === "completed",
    requested:        apolloParams.limit,
    apollo_returned:  apolloResult.results.length,
    total_available:  apolloResult.total_available,
    inserted:         insertedCount,
    skipped,
    errors:           insertError ? [insertError] : [],
    duration_ms:      durationMs,
    final_status:     finalStatus,
    params_used: {
      job_titles:    apolloParams.job_titles,
      industries:    apolloParams.industries,
      countries:     apolloParams.countries,
      company_sizes: apolloParams.company_sizes,
      keywords:      apolloParams.keywords,
    },
  });
}
