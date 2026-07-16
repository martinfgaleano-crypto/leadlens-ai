import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { reviewVaultSignal, type ReviewDecision, type EvidenceTier, type RightsStatus } from "@/lib/vault/signal-review";

// GET  → pending provider-search signals grouped by company, with proposed
//        evidence tier + duplicate cluster + rights + active review + progress.
// POST → record a governed review decision (state machine).
async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function proposeTier(sourceType: string | null, independent: number, dateValid: boolean, conflict: boolean): EvidenceTier {
  if (conflict) return "E";
  if (!dateValid) return "D";
  if (sourceType === "official" || sourceType === "regulatory") return "A";
  if (independent >= 2) return "B";
  if (sourceType === "news") return "C";
  return "D";
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // Provider-search companies + their pending signals + sources.
  const { data: companies } = await db.from("vault_companies").select("id, name, region, country").eq("source_status", "provider_search").limit(200);
  const coIds = (companies ?? []).map((c) => c.id);
  if (coIds.length === 0) return NextResponse.json({ groups: [], progress: { reviewed: 0, total: 0 } });

  const { data: signals } = await db.from("vault_signals").select("id, company_id, signal_type, signal_summary, signal_date, source_id, confidence_score, review_status").in("company_id", coIds).limit(500);
  const srcIds = Array.from(new Set((signals ?? []).map((s) => s.source_id).filter(Boolean)));
  const { data: sources } = srcIds.length ? await db.from("vault_sources").select("id, source_url, source_type, published_at, freshness_status, usage_rights_status, notes, raw_metadata").in("id", srcIds) : { data: [] };
  const srcById = new Map((sources ?? []).map((s) => [s.id, s]));

  // Latest review per signal (active decision).
  const sigIds = (signals ?? []).map((s) => s.id);
  const { data: reviews, error: revErr } = sigIds.length ? await db.from("vault_signal_reviews").select("signal_id, review_status, rights_status, evidence_tier, reviewed_at").in("signal_id", sigIds).order("reviewed_at", { ascending: false }) : { data: [], error: null };
  const migrationMissing = !!revErr && /relation|does not exist|schema cache/i.test(revErr.message);
  const activeReview = new Map<string, { review_status: string; rights_status: string | null; evidence_tier: string | null }>();
  for (const r of reviews ?? []) if (!activeReview.has(r.signal_id)) activeReview.set(r.signal_id, r);

  // Semantic dedupe: cluster by company + signal_type + date within 7 days.
  const clusterKey = (companyId: string, type: string, date: string | null) => {
    const bucket = date ? Math.floor(new Date(date).getTime() / (7 * 86_400_000)) : "nd";
    return `${companyId}|${type}|${bucket}`;
  };
  const clusterCount = new Map<string, number>();
  for (const s of signals ?? []) { const k = clusterKey(s.company_id, s.signal_type, s.signal_date); clusterCount.set(k, (clusterCount.get(k) ?? 0) + 1); }

  const groups = (companies ?? []).map((co) => {
    const coSignals = (signals ?? []).filter((s) => s.company_id === co.id).map((s) => {
      const src = srcById.get(s.source_id);
      const k = clusterKey(s.company_id, s.signal_type, s.signal_date);
      const clusterSize = clusterCount.get(k) ?? 1;
      const conflict = !!(src?.notes && /CONFLICT/.test(src.notes as string));
      const dateValid = !!s.signal_date;
      return {
        signal_id: s.id, signal_type: s.signal_type, claim: s.signal_summary, signal_date: s.signal_date,
        freshness: src?.freshness_status ?? null, confidence: s.confidence_score,
        source_url: src?.source_url ?? null, source_type: src?.source_type ?? null,
        provider: (src?.raw_metadata as { evidence?: { provider?: string } })?.evidence?.provider ?? null,
        extraction_method: (src?.raw_metadata as { evidence?: { extraction_method?: string } })?.evidence?.extraction_method ?? null,
        rights_status: src?.usage_rights_status ?? "unverified",
        proposed_tier: proposeTier(src?.source_type ?? null, clusterSize, dateValid, conflict),
        cluster_key: k, cluster_size: clusterSize, cluster_role: clusterSize > 1 ? "possible_duplicate" : "canonical_event",
        signal_status: s.review_status,
        active_review: activeReview.get(s.id) ?? null,
      };
    });
    return { company_id: co.id, company: co.name, region: co.region, country: co.country, signals: coSignals };
  }).filter((g) => g.signals.length > 0);

  const totalSignals = (signals ?? []).length;
  const reviewedSignals = (signals ?? []).filter((s) => activeReview.has(s.id)).length;
  const rightsDist: Record<string, number> = {};
  const tierDist: Record<string, number> = {};
  for (const g of groups) for (const s of g.signals) { rightsDist[s.rights_status] = (rightsDist[s.rights_status] ?? 0) + 1; tierDist[s.proposed_tier] = (tierDist[s.proposed_tier] ?? 0) + 1; }

  return NextResponse.json({
    groups, migration_missing: migrationMissing,
    progress: { reviewed: reviewedSignals, total: totalSignals },
    distributions: { rights: rightsDist, proposed_tier: tierDist },
    banner: "Human review governs which modern signals become usable intelligence. Nothing is auto-approved; every decision is audited and revocable.",
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body?.signal_id || !body?.decision) return NextResponse.json({ error: "signal_id and decision required" }, { status: 400 });
  const result = await reviewVaultSignal({
    signalId: body.signal_id,
    reviewerId: typeof body.reviewer === "string" && body.reviewer ? body.reviewer : "admin",
    decision: body.decision as ReviewDecision,
    rightsStatus: (body.rights_status ?? null) as RightsStatus | null,
    evidenceTier: (body.evidence_tier ?? null) as EvidenceTier | null,
    verdicts: body.verdicts,
    reasonCodes: Array.isArray(body.reason_codes) ? body.reason_codes : [],
    note: body.note ?? null,
    duplicateClusterId: body.duplicate_cluster_id ?? null,
    canonicalSignalId: body.canonical_signal_id ?? null,
  });
  return NextResponse.json({ result }, { status: result.ok ? 200 : (result.reason === "Migration 034 not applied" ? 503 : 400) });
}
