import { NextRequest, NextResponse } from "next/server";
import type { StandardLead, SourceSearchParams } from "@/lib/sources/source-provider";
import { classifyEmail } from "@/lib/quality/email-quality";
import { normalizeTitle, detectSeniority } from "@/lib/quality/title-normalizer";
import { normalizeCompany, extractDomain } from "@/lib/quality/company-normalizer";
import { computeLeadScore, computeConfidenceScore } from "@/lib/quality/scoring";
import { computeBuyerFit } from "@/lib/enrichment/buyer-fit";
import { computeTemperature } from "@/lib/enrichment/temperature";
import { computeOpportunityScore } from "@/lib/enrichment/opportunity-score";
import { computeStrengths, computeWeaknesses, generateReasoning } from "@/lib/enrichment/reasoning";
import { upsertVaultLead } from "@/lib/vault/upsert-vault-lead";
import { upsertCompanyProfile } from "@/lib/company/upsert-company";
import { searchVault, type VaultCandidate } from "@/lib/vault/search-vault";
import { allocateLeads } from "@/lib/vault/reuse-engine";
import { executeSourceSearch } from "@/lib/sources/orchestrator";
import { listActiveProviders } from "@/lib/sources/source-registry";
import { consumeCredits } from "@/lib/credits/consume-credits";
import { createNotification } from "@/lib/notifications/create-notification";

/**
 * POST /api/process/search/[id]
 *
 * Auto-processing endpoint. Called by the customer dashboard (fire-and-forget)
 * immediately after a lead_search is inserted. Runs the full pipeline via the
 * multi-source orchestrator and returns when complete.
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

  if (search.status !== "pending") {
    return NextResponse.json({
      skipped: true,
      reason:  `Status is already "${search.status as string}" — not reprocessing.`,
    });
  }

  const requestedCount = (search.requested_lead_count as number) ?? 10;
  const userId         = search.user_id as string;
  const now            = new Date().toISOString();

  // Atomic transition: WHERE status='pending' ensures only one process wins.
  const { data: claimed } = await client
    .from("lead_searches")
    .update({
      status:                 "processing",
      process_started_at:     now,
      processing_started_at:  now,
    })
    .eq("id", searchId)
    .eq("status", "pending")
    .select("id");

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({
      skipped: true,
      reason:  "Another process already started this search.",
    });
  }

  // ── 3. Credit pre-check ───────────────────────────────────────────────────────
  // Abort early if the customer does not have enough credits.

  const { data: creditRow } = await client
    .from("customer_credits")
    .select("credit_balance")
    .eq("user_id", userId)
    .maybeSingle();

  const currentBalance = (creditRow?.credit_balance as number) ?? 0;

  if (currentBalance < requestedCount) {
    const durationMs   = Date.now() - startMs;
    const errMsg       = `Insufficient credits — required: ${requestedCount}, available: ${currentBalance}`;
    const existingNotes = (search.admin_notes as string | null) ?? "";
    const creditNote   = `[Insufficient credits — ${now}]\nRequired: ${requestedCount}, Available: ${currentBalance}`;

    await client
      .from("lead_searches")
      .update({
        status:                    "failed",
        process_finished_at:       new Date().toISOString(),
        processing_completed_at:   new Date().toISOString(),
        process_duration_ms:       durationMs,
        process_generated_count:   0,
        process_error_message:     errMsg,
        error_message:             errMsg,
        admin_notes:               existingNotes ? `${existingNotes}\n\n${creditNote}` : creditNote,
      })
      .eq("id", searchId);

    // Notify customer (best-effort)
    try {
      await createNotification(client, {
        userId,
        type:    "search_failed",
        title:   "Search failed",
        message: `Your search "${search.name as string}" could not be processed: insufficient credits (${currentBalance} available, ${requestedCount} required).`,
        metadata: { search_id: searchId, required: requestedCount, available: currentBalance },
      });
    } catch { /* never block */ }

    return NextResponse.json(
      { success: false, error: "Insufficient credits", required: requestedCount, available: currentBalance },
      { status: 402 }
    );
  }

  // ── 4. Fetch linked ICP ──────────────────────────────────────────────────────

  let icp: Record<string, unknown> | null = null;
  if (search.icp_id) {
    const { data } = await client
      .from("icps")
      .select("*")
      .eq("id", search.icp_id as string)
      .single();
    icp = data ?? null;
  }

  // ── 5. Build search params ───────────────────────────────────────────────────

  const jobTitles      = (icp?.target_job_titles as string[] | null) ?? [];
  const icpCountries   = (icp?.target_countries  as string[] | null) ?? [];
  const icpIndustries  = (icp?.industries         as string[] | null) ?? [];
  const companySizes   = (icp?.company_sizes      as string[] | null) ?? [];
  const keywords       = (icp?.keywords           as string[] | null) ?? [];
  const searchCountries  = (search.countries  as string[] | null) ?? [];
  const searchIndustries = (search.industries as string[] | null) ?? [];

  let sourceParams: SourceSearchParams = {
    job_titles:    jobTitles,
    industries:    searchIndustries.length > 0 ? searchIndustries : icpIndustries,
    company_sizes: companySizes,
    countries:     searchCountries.length  > 0 ? searchCountries  : icpCountries,
    keywords,
    limit:         requestedCount,
  };

  // ── 5.5. Vault-first search ──────────────────────────────────────────────────
  // Reuse matching leads from the vault before calling Apollo.
  // Vault failure always falls through to Apollo — never blocks lead generation.

  let vaultLeadsToUse: VaultCandidate[] = [];
  let apolloRequestedCount = requestedCount;
  let vaultSearchDurationMs = 0;

  try {
    const vaultStart = Date.now();
    const vaultCandidates = await searchVault(client, sourceParams, requestedCount);
    vaultSearchDurationMs = Date.now() - vaultStart;

    const allocation     = allocateLeads(vaultCandidates, requestedCount);
    vaultLeadsToUse      = allocation.vaultResultsToUse;
    apolloRequestedCount = allocation.remainingCount;

    // Update Apollo limit to only fetch what vault couldn't provide
    sourceParams = { ...sourceParams, limit: apolloRequestedCount };
  } catch {
    // Vault failure → full Apollo run
    vaultLeadsToUse      = [];
    apolloRequestedCount = requestedCount;
    sourceParams         = { ...sourceParams, limit: requestedCount };
  }

  // ── 6. Run orchestrator ───────────────────────────────────────────────────────
  // Apollo is the only active source today. Future sources activate by setting
  // active=true in their provider — no changes needed here.

  const activeSources = listActiveProviders().map(p => p.name);

  let orchestratorResult: Awaited<ReturnType<typeof executeSourceSearch>>;

  try {
    orchestratorResult = await executeSourceSearch(client, {
      searchId,
      requestedCount,
      params:        sourceParams,
      activeSources,
    });
  } catch (err: unknown) {
    const msg        = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    const existingNotes = (search.admin_notes as string | null) ?? "";
    const errorNote     = `[Orchestrator error — ${new Date().toISOString()}]\n${msg}`;

    await client
      .from("lead_searches")
      .update({
        status:                    "failed",
        process_finished_at:       new Date().toISOString(),
        processing_completed_at:   new Date().toISOString(),
        process_duration_ms:       durationMs,
        process_generated_count:   0,
        process_error_message:     msg,
        error_message:             msg,
        admin_notes:               existingNotes ? `${existingNotes}\n\n${errorNote}` : errorNote,
      })
      .eq("id", searchId);

    // Notify customer (best-effort)
    try {
      await createNotification(client, {
        userId,
        type:    "search_failed",
        title:   "Search failed",
        message: `Your search "${search.name as string}" failed: ${msg}`,
        metadata: { search_id: searchId, error: msg },
      });
    } catch { /* never block */ }

    return NextResponse.json(
      { success: false, error: msg, duration_ms: durationMs },
      { status: 502 }
    );
  }

  const leads = orchestratorResult.leads;

  // ── 7. Dedup against existing leads ──────────────────────────────────────────

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

  const toInsert = leads.filter((r: StandardLead) => {
    const key = `${r.company_name.toLowerCase()}|${(r.email ?? "").toLowerCase()}`;
    return !existingKeys.has(key);
  });

  const skipped = leads.length - toInsert.length;

  // ── 7.5. Insert vault leads (best-effort; source="vault") ────────────────────

  let vaultInsertedCount = 0;

  if (vaultLeadsToUse.length > 0) {
    const vaultToInsert = vaultLeadsToUse.filter(v => {
      const key = `${v.company_name.toLowerCase()}|${(v.email ?? "").toLowerCase()}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key); // mark consumed so Apollo dedup excludes it
      return true;
    });

    if (vaultToInsert.length > 0) {
      const vaultRows = vaultToInsert.map(v => ({
        search_id:          searchId,
        company_name:       v.company_name,
        normalized_company: v.normalized_company,
        website:            v.website,
        domain:             v.domain,
        contact_name:       v.contact_name,
        title:              v.title,
        normalized_title:   v.normalized_title,
        seniority:          v.seniority,
        email:              v.email,
        email_quality:      v.email_quality,
        email_type:         v.email_type,
        linkedin_url:       v.linkedin_url,
        country:            v.country,
        lead_score:         v.lead_score,
        confidence_score:   v.confidence_score,
        opportunity_score:  v.opportunity_score,
        buyer_fit:          v.buyer_fit,
        temperature:        v.temperature,
        ai_reasoning:       v.ai_reasoning,
        strengths:          v.strengths,
        weaknesses:         v.weaknesses,
        source:             "vault",
      }));

      try {
        const { data: vaultInserted } = await client
          .from("lead_results")
          .insert(vaultRows)
          .select("id");
        vaultInsertedCount = vaultInserted?.length ?? 0;
      } catch {
        // Vault insert failure must never block Apollo delivery
      }
    }
  }

  // ── 8. Insert lead_results ────────────────────────────────────────────────────

  let insertedCount = 0;
  let insertError: string | null = null;

  if (toInsert.length > 0) {
    const rows = toInsert.map((r: StandardLead) => {
      const { email_type, email_quality } = classifyEmail(r.email);
      const seniority          = detectSeniority(r.title);
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

      // ── AI enrichment layer ──────────────────────────────────────────────────
      const buyer_fit         = computeBuyerFit(lead_score);
      const temperature       = computeTemperature({ seniority, email_type, linkedin_url: r.linkedin_url });
      const opportunity_score = computeOpportunityScore({ lead_score, confidence_score, seniority });

      const reasoningInput = {
        seniority, email_type, email_quality,
        website: r.website, linkedin_url: r.linkedin_url,
        country: r.country, temperature, buyer_fit,
      };
      const strengths    = computeStrengths(reasoningInput);
      const weaknesses   = computeWeaknesses(reasoningInput);
      const ai_reasoning = generateReasoning(reasoningInput, strengths, weaknesses);

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
        buyer_fit,
        temperature,
        opportunity_score,
        strengths,
        weaknesses,
        ai_reasoning,
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

    // ── 8b. Upsert into Vault and Company profiles (best-effort) ─────────────
    if (!insErr) {
      for (const row of rows) {
        try {
          await upsertVaultLead(client, {
            company_name:       row.company_name,
            normalized_company: row.normalized_company,
            website:            row.website,
            domain:             row.domain,
            contact_name:       row.contact_name,
            title:              row.title,
            normalized_title:   row.normalized_title,
            seniority:          row.seniority,
            email:              row.email,
            email_quality:      row.email_quality,
            email_type:         row.email_type,
            linkedin_url:       row.linkedin_url,
            country:            row.country,
            industry:           null,
            company_size:       null,
            source:             row.source ?? "apollo",
            lead_score:         row.lead_score,
            confidence_score:   row.confidence_score,
            opportunity_score:  row.opportunity_score,
            buyer_fit:          row.buyer_fit,
            temperature:        row.temperature,
            ai_reasoning:       row.ai_reasoning,
            strengths:          row.strengths,
            weaknesses:         row.weaknesses,
          });
        } catch {
          // Vault upsert failure must never block lead delivery
        }

        if (row.normalized_company) {
          try {
            await upsertCompanyProfile(client, {
              normalized_company: row.normalized_company,
              company_name:       row.company_name,
              domain:             row.domain ?? null,
              industry:           null,
              company_size:       null,
              country:            row.country ?? null,
              title:              row.title ?? null,
              opportunity_score:  row.opportunity_score ?? null,
            });
          } catch {
            // Company upsert failure must never block lead delivery
          }
        }
      }
    }
  }

  // ── 9. Determine final status ─────────────────────────────────────────────────
  // A search with zero delivered leads is always failed — never completed.
  // This prevents charging credits when Apollo returns nothing.

  const durationMs    = Date.now() - startMs;
  const totalInserted = vaultInsertedCount + insertedCount;
  const noLeadsFound  = totalInserted === 0;
  const finalStatus   = noLeadsFound ? "failed" : "completed";
  const completedAt   = new Date().toISOString();

  // When 0 leads were found, record a clear error message.
  if (noLeadsFound && !insertError) {
    insertError = "No leads found";
  }

  // ── 10. Deduct credits on success ────────────────────────────────────────────
  // Charge only for leads actually delivered, never for requested count.
  // Zero-lead searches pay nothing.

  let creditsConsumed = 0;
  if (finalStatus === "completed") {
    try {
      const creditResult = await consumeCredits(
        client,
        userId,
        totalInserted,
        `Lead search completed — ${totalInserted} lead${totalInserted !== 1 ? "s" : ""} delivered`,
        searchId,
      );
      if (creditResult.success) {
        creditsConsumed = totalInserted;
      }
    } catch {
      // Non-blocking
    }
  }

  // ── 11. Notifications (best-effort) ──────────────────────────────────────────

  try {
    if (finalStatus === "completed") {
      await createNotification(client, {
        userId,
        type:    "search_completed",
        title:   "Search completed",
        message: `Your search "${search.name as string}" has been completed successfully. ${totalInserted} lead${totalInserted !== 1 ? "s" : ""} delivered.`,
        metadata: { search_id: searchId, leads_delivered: totalInserted, vault_leads: vaultInsertedCount, apollo_leads: insertedCount },
      });
      // Alert customer when balance drops below 20
      if (creditsConsumed > 0) {
        const { data: updatedCredit } = await client
          .from("customer_credits")
          .select("credit_balance")
          .eq("user_id", userId)
          .maybeSingle();
        const newBalance = (updatedCredit?.credit_balance as number) ?? 0;
        if (newBalance < 20) {
          await createNotification(client, {
            userId,
            type:    "credits_low",
            title:   "Credits running low",
            message: `Your credit balance is ${newBalance}. Purchase more credits to continue running searches.`,
            metadata: { balance: newBalance },
          });
        }
      }
    } else {
      const failMsg = noLeadsFound
        ? `Your search "${search.name as string}" returned no leads. Try broadening your filters or contact support.`
        : `Your search "${search.name as string}" could not be completed. ${insertError ?? "Unknown error."}`;
      await createNotification(client, {
        userId,
        type:    "search_failed",
        title:   noLeadsFound ? "No leads found" : "Search failed",
        message: failMsg,
        metadata: { search_id: searchId, error: insertError, no_leads_found: noLeadsFound },
      });
    }
  } catch { /* never block */ }

  // ── 12. Update final status + observability columns ───────────────────────────

  const vaultHitRate =
    requestedCount > 0 ? Math.round((vaultInsertedCount / requestedCount) * 100) / 100 : 0;

  const deliveryReady = finalStatus === "completed" && totalInserted > 0;

  const updatePayload: Record<string, unknown> = {
    status:                    finalStatus,
    process_finished_at:       completedAt,
    processing_completed_at:   completedAt,
    process_duration_ms:       durationMs,
    process_generated_count:   totalInserted,
    process_duplicates_skipped: skipped,
    process_error_message:     insertError ?? null,
    error_message:             insertError ?? null,
    credits_consumed:          creditsConsumed,
    vault_leads_used:          vaultInsertedCount,
    apollo_leads_used:         insertedCount,
    vault_hit_rate:            vaultHitRate,
    delivery_ready:            deliveryReady,
    delivery_ready_at:         deliveryReady ? completedAt : null,
  };

  if (insertError) {
    const existingNotes = (search.admin_notes as string | null) ?? "";
    const label    = noLeadsFound ? "No leads found" : "Insert error";
    const errNote  = `[${label} — ${completedAt}]\n${insertError}`;
    updatePayload.admin_notes = existingNotes
      ? `${existingNotes}\n\n${errNote}`
      : errNote;
  }

  await client
    .from("lead_searches")
    .update(updatePayload)
    .eq("id", searchId);

  // ── 13. Return log ─────────────────────────────────────────────────────────────

  return NextResponse.json({
    success:            finalStatus === "completed",
    search_id:          searchId,
    requested:          requestedCount,
    total_found:        orchestratorResult.totalResults,
    inserted:           totalInserted,
    vault_leads:        vaultInsertedCount,
    apollo_leads:       insertedCount,
    vault_hit_rate:     vaultHitRate,
    vault_search_ms:    vaultSearchDurationMs,
    skipped,
    credits_consumed:   creditsConsumed,
    errors:             insertError ? [insertError] : [],
    duration_ms:        durationMs,
    final_status:       finalStatus,
    delivery_ready:     deliveryReady,
    source_breakdown:   orchestratorResult.sourceBreakdown,
  });
}
