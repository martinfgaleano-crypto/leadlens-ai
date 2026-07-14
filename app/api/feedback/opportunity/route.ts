import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeSentiment, validateReasonCodes } from "@/lib/intelligence/feedback-taxonomy";

// ─── Validation schema ────────────────────────────────────────────────────────
// Strict: no personal data fields (email, phone, name, linkedin personal).
// Only company-level and signal-level information.

const VALID_SIGNALS = [
  "useful", "partially_useful", "not_useful", "irrelevant", "contacted", "meeting_booked",
  "wrong_fit", "generic", "replied", "add_to_vault", "exclude_similar",
] as const;

const schema = z.object({
  job_id:             z.string().max(200).optional(),
  /** lead_searches.id — monitor series context from report.search_id (P2). */
  search_id:          z.string().uuid().optional(),
  company:            z.string().min(1).max(200),
  domain:             z.string().max(200).optional(),
  industry:           z.string().max(100).optional(),
  segment:            z.string().max(100).optional(),
  opportunity_score:  z.number().min(0).max(10).optional(),
  category:           z.enum(["HOT", "WARM", "COLD", "DISCARD"]).optional(),
  recommended_action: z.string().max(100).optional(),
  signal_patterns:    z.array(z.string().max(300)).max(10).optional(),
  buying_window:      z.string().max(50).optional(),
  feedback_signal:    z.enum(VALID_SIGNALS),
  feedback_notes:     z.string().max(500).optional(),
  /** Optional structured reason codes (closed enum, re-validated below). */
  reason_codes:       z.array(z.string().max(40)).max(10).optional(),
});

// ── Server-side intelligence enrichment ──────────────────────────────────────
// The browser is NEVER the source of truth for snapshots/versions: both are
// copied from the persisted report (frozen at generation time). If the report
// predates snapshots, we store null — history is never reconstructed from
// live data and passed off as what the system knew back then.
async function loadFrozenIntelligence(jobId: string | undefined, company: string): Promise<{
  feature_snapshot: Record<string, unknown> | null;
  versions: Record<string, unknown> | null;
}> {
  if (!jobId) return { feature_snapshot: null, versions: null };
  try {
    const { getSnapshot } = await import("@/lib/storage/snapshot-store");
    const snapshot = await getSnapshot(jobId);
    const report = snapshot?.report_json as {
      _versions?: Record<string, unknown>;
      ranked_opportunities?: Array<{ company?: string; feature_snapshot?: Record<string, unknown> }>;
    } | null;
    if (!report) return { feature_snapshot: null, versions: null };
    const { companyKey } = await import("@/lib/intelligence/feature-snapshot");
    const wanted = companyKey(company);
    const opp = (report.ranked_opportunities ?? []).find((o) => o.company && companyKey(o.company) === wanted);
    return {
      feature_snapshot: opp?.feature_snapshot ?? null,
      versions: report._versions ?? null,
    };
  } catch {
    return { feature_snapshot: null, versions: null };
  }
}

// In-memory fallback when Supabase is not configured
type FeedbackRow = z.infer<typeof schema> & { id: string; created_at: string };
const g = globalThis as typeof globalThis & { __leadlens_feedback?: FeedbackRow[] };
if (!g.__leadlens_feedback) g.__leadlens_feedback = [];

// ─── POST /api/feedback/opportunity ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Closed-enum re-validation of reason codes (unknown code → 400).
  const reasonCheck = validateReasonCodes(data.reason_codes);
  if (!reasonCheck.ok) {
    return NextResponse.json({ error: reasonCheck.error }, { status: 400 });
  }
  const reasonCodes = reasonCheck.codes;
  const normalizedSentiment = normalizeSentiment(data.feedback_signal);

  // Try Supabase first
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServerClient } = await import("@/lib/supabase/server");
      const db = createServerClient();
      if (db) {
        // Attach the authenticated user when a valid JWT is present — feedback
        // still works anonymously (demo mode), but signed-in feedback keeps
        // its owner for future learning/reporting. Never client-supplied.
        let feedbackUserId: string | null = null;
        const authHeader = req.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (token) {
          const { data: { user } } = await db.auth.getUser(token).catch(() => ({ data: { user: null } }));
          if (user) feedbackUserId = user.id;
        }
        // Dedup guard: identical feedback (same run + same account + same
        // signal) must not accumulate duplicate rows. Return the existing row
        // as already_saved — the signal meaning is unchanged by repetition.
        // Key stays job_id + company + signal: job_id is unique per run, so it
        // subsumes search_id; filtering on search_id would miss legacy rows
        // written before search context existed and re-create duplicates.
        if (data.job_id) {
          const { data: existing } = await db
            .from("opportunity_feedback")
            .select("id")
            .eq("job_id", data.job_id)
            .eq("company", data.company)
            .eq("feedback_signal", data.feedback_signal)
            .limit(1)
            .maybeSingle();

          if (existing) {
            // Same sentiment resubmitted with reason chips → enrich the
            // existing row instead of losing the structured reasons.
            if (reasonCodes.length > 0) {
              await db.from("opportunity_feedback")
                .update({ reason_codes: reasonCodes })
                .eq("id", (existing as { id: string }).id)
                .then(({ error: upErr }) => {
                  if (upErr && !/column|schema cache/i.test(upErr.message)) {
                    console.warn("[feedback] reason enrich failed:", upErr.message);
                  }
                });
            }
            return NextResponse.json({
              success: true,
              already_saved: true,
              id: (existing as { id: string }).id,
            });
          }
        }

        const baseRow = {
          user_id:            feedbackUserId,
          job_id:             data.job_id             ?? null,
          search_id:          data.search_id          ?? null,
          company:            data.company,
          domain:             data.domain             ?? null,
          industry:           data.industry           ?? null,
          segment:            data.segment            ?? null,
          opportunity_score:  data.opportunity_score  ?? null,
          category:           data.category           ?? null,
          recommended_action: data.recommended_action ?? null,
          signal_patterns:    data.signal_patterns    ?? null,
          buying_window:      data.buying_window      ?? null,
          feedback_signal:    data.feedback_signal,
          feedback_notes:     data.feedback_notes     ?? null,
        };

        // Server-side enrichment: frozen snapshot + versions from the report.
        const frozen = await loadFrozenIntelligence(data.job_id, data.company);
        const intelligenceRow = {
          ...baseRow,
          reason_codes:            reasonCodes,
          feature_snapshot:        frozen.feature_snapshot,
          versions:                frozen.versions,
          normalized_sentiment:    normalizedSentiment,
          feedback_schema_version: 2,
        };

        let { data: row, error } = await db
          .from("opportunity_feedback")
          .insert(intelligenceRow)
          .select("id")
          .single();

        // Migration 031 not applied yet → retry without intelligence columns
        // so the customer flow never breaks. Warning is actionable, not silent.
        if (error && /column|schema cache/i.test(error.message)) {
          console.warn("[feedback] intelligence columns missing (apply migration 031) — storing legacy row");
          ({ data: row, error } = await db.from("opportunity_feedback").insert(baseRow).select("id").single());
        }

        if (!error && row) {
          if (data.feedback_signal === "exclude_similar") {
            const { markAccountDoNotShowFromFeedback } = await import("@/lib/memory/account-memory");
            markAccountDoNotShowFromFeedback({
              job_id:          data.job_id,
              company:         data.company,
              domain:          data.domain,
              industry:        data.industry,
              segment:         data.segment,
              feedback_signal: data.feedback_signal,
            }).catch(() => {});
          }
          return NextResponse.json({ success: true, id: (row as { id: string }).id });
        }
        console.log("[feedback] Supabase insert failed:", error?.message);
      }
    } catch (err) {
      console.warn("[feedback] Supabase error, falling back to in-memory:", err);
    }
  }

  // In-memory fallback (works in demo mode / no Supabase)
  const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  g.__leadlens_feedback!.push({ ...data, id, created_at: new Date().toISOString() });
  console.log(`[feedback] in-memory: ${data.feedback_signal} → ${data.company} (${data.category ?? "?"} ${data.opportunity_score ?? "?"})`);

  return NextResponse.json({ success: true, id });
}
