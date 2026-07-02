import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runLeadLensPipeline } from "@/lib/pipeline";
import {
  createProcessingSnapshot,
  completeSnapshot,
  failSnapshot,
} from "@/lib/storage/snapshot-store";

/**
 * POST /api/process
 * Runs the full pipeline and tracks the run lifecycle in snapshot_reports:
 *   processing  → inserted before pipeline starts
 *   completed   → upserted after pipeline succeeds
 *   failed      → upserted if pipeline throws (best-effort, non-blocking)
 */

// Pipeline runs take minutes — raise the serverless function limit where the
// hosting plan allows it (ignored/clamped otherwise).
export const maxDuration = 300;

const bodySchema = z.object({
  plan: z.enum(["sample", "starter", "standard", "pro"]).default("starter"),
  onboarding: z.object({
    company_name: z.string().min(1),
    company_description: z.string().min(1),
    offer_description: z.string().min(1),
    value_proposition: z.string().min(1),
    target_customer_description: z.string().min(1),
    average_ticket: z.string().optional(),
    tone: z.enum(["direct", "consultative", "casual"]).default("direct"),
    contact_email: z.string().email(),
    output_language: z.enum(["en", "es", "pt", "ja"]).optional(),
    target_market_region: z.enum(["north_america", "latin_america", "europe", "asia", "global"]).optional(),
  }),
  jobId: z.string().optional(),
  /** lead_searches.id — enables safe previous-snapshot scope for Monthly Monitor runs. */
  searchId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { plan, onboarding } = parsed.data;
  const jobId    = parsed.data.jobId    ?? `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const searchId = parsed.data.searchId ?? undefined;

  // ── 1. Mark processing — best-effort, never blocks the run ──────────────────
  createProcessingSnapshot(jobId, plan, searchId).catch(() => {});

  // ── 2. Run pipeline ─────────────────────────────────────────────────────────
  try {
    const report = await runLeadLensPipeline({ onboardingData: onboarding, plan, jobId, searchId });

    // ── 3. Mark completed — best-effort ───────────────────────────────────────
    completeSnapshot(jobId, plan, report, searchId).catch(() => {});

    return NextResponse.json({ success: true, job_id: jobId, report });

  } catch (err) {
    // ── 4. Mark failed — await so the status lands before responding ──────────
    const safeReason = err instanceof Error
      ? err.message.slice(0, 200)   // cap length; never contains env vars or secrets
      : "Pipeline error";

    console.error("[/api/process]", jobId, safeReason);

    await failSnapshot(jobId, plan, safeReason, searchId).catch(() => {});

    return NextResponse.json({ error: safeReason, job_id: jobId }, { status: 500 });
  }
}
