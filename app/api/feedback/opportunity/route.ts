import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── Validation schema ────────────────────────────────────────────────────────
// Strict: no personal data fields (email, phone, name, linkedin personal).
// Only company-level and signal-level information.

const VALID_SIGNALS = [
  "useful", "not_useful", "irrelevant", "contacted", "meeting_booked",
  "wrong_fit", "generic", "replied", "add_to_vault", "exclude_similar",
] as const;

const schema = z.object({
  job_id:             z.string().max(200).optional(),
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
});

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

  // Try Supabase first
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServerClient } = await import("@/lib/supabase/server");
      const db = createServerClient();
      if (db) {
        const { data: row, error } = await db
          .from("opportunity_feedback")
          .insert({
            job_id:             data.job_id             ?? null,
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
          })
          .select("id")
          .single();

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
