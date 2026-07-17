// ─── Immutable feature snapshot + decision versioning ────────────────────────
// Frozen at report-generation time so feedback and future learning always
// refer to what the system knew WHEN it decided — never to live data dressed
// up as history. Pure, null-safe, no PII (account-level fields only; never
// contact names/emails/profiles). Nothing here reads learned_preferences or
// touches selection/scoring.

import type { LeadLensReport, OpportunityRanking, ProcessedLead } from "@/types";

export const FEATURE_SCHEMA_VERSION = 1;
export const INTELLIGENCE_FOUNDATION_VERSION = 1;
export const REPORT_SCHEMA_VERSION = 1;

export interface OpportunityFeatureSnapshot {
  schema_version: number;
  company_key: string;          // normalized company name (stable join key; already customer-visible in the report)
  primary_signal_type: string | null;
  signal_types: string[];
  signal_date: string | null;
  signal_age_days: number | null;
  freshness_bucket: "fresh" | "recent" | "stale" | null;
  industry: string | null;
  region: string | null;
  country: string | null;
  company_size: string | null;
  size_bucket: string | null;
  source_types: string[];
  source_count: number;
  evidence_grounded: boolean | null;
  evidence_quality: string | null;
  confidence: number | null;    // candidate confidence 0–1
  fit_score: number | null;
  category: string | null;
  combo_key: string | null;     // sorted signal-type pair, only when ≥2 valid types
  coverage_limited: boolean;
  exploration: boolean;
  generated_at: string;
}

export const normalizeFeatureValue = (v: string): string =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function companyKey(name: string): string {
  return normalizeFeatureValue(name);
}

function signalAgeDays(iso: string | null | undefined, at: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = Math.floor((at.getTime() - t) / 86_400_000);
  return d >= 0 ? d : null;
}

export function freshnessBucket(ageDays: number | null): "fresh" | "recent" | "stale" | null {
  if (ageDays === null) return null;
  if (ageDays <= 30) return "fresh";
  if (ageDays <= 90) return "recent";
  return "stale";
}

export function sizeBucket(companySize: string | null | undefined): string | null {
  if (!companySize) return null;
  const m = companySize.match(/(\d[\d,.]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[,.]/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  if (n < 50) return "lt_50";
  if (n < 200) return "50_200";
  if (n < 1000) return "200_1000";
  return "gt_1000";
}

export function comboKey(signalTypes: string[]): string | null {
  const valid = Array.from(new Set(signalTypes.map(normalizeFeatureValue).filter((s) => s && s !== "other" && s !== "unknown")));
  if (valid.length < 2) return null;
  // deterministic ordered pair of the first two distinct types (pairs only in v0)
  return valid.sort().slice(0, 2).join("+");
}

/** Pure builder — uses ONLY data present on the lead/ranking at report time. */
export function buildOpportunityFeatureSnapshot(
  lead: ProcessedLead,
  ranking: OpportunityRanking | undefined,
  at: Date = new Date(),
): OpportunityFeatureSnapshot {
  const c = lead.candidate;
  const rawSignalTypes = [c.signal_type].filter((s): s is string => typeof s === "string" && s.length > 0);
  const age = signalAgeDays(c.signal_date, at);
  const sourceTypes = [ranking?.source_type, c.source]
    .map((s) => (typeof s === "string" ? s : ""))
    .filter((s) => s.length > 0);

  return {
    schema_version: FEATURE_SCHEMA_VERSION,
    company_key: companyKey(c.company),
    primary_signal_type: rawSignalTypes[0] ? normalizeFeatureValue(rawSignalTypes[0]) : null,
    signal_types: rawSignalTypes.map(normalizeFeatureValue),
    signal_date: c.signal_date ?? null,
    signal_age_days: age,
    freshness_bucket: freshnessBucket(age),
    industry: c.industry ? normalizeFeatureValue(c.industry) : null,
    region: c.region ? normalizeFeatureValue(c.region) : null,
    country: c.country ? normalizeFeatureValue(c.country) : null,
    company_size: c.company_size ?? null,
    size_bucket: sizeBucket(c.company_size),
    source_types: Array.from(new Set(sourceTypes.map(normalizeFeatureValue))),
    source_count: c.source_url ? 1 : 0,
    evidence_grounded: ranking?.decision?.evidence_grounded ?? null,
    evidence_quality: ranking?.evidence_quality ?? lead.learning?.evidence_quality ?? null,
    confidence: typeof c.confidence_score === "number" ? c.confidence_score : null,
    fit_score: ranking?.fit_score ?? lead.qualification?.fit_score ?? null,
    category: ranking?.category ?? lead.qualification?.category ?? null,
    combo_key: comboKey(rawSignalTypes),
    coverage_limited: !!(ranking?.source_coverage_note ?? lead.learning?.limited_region_coverage),
    exploration: false, // exploration policy does not exist yet — honest constant
    generated_at: at.toISOString(),
  };
}

/** Decision-versions block frozen into every new report ("_versions").
 *  Identifiers only — never prompt contents, config, or secrets. */
export async function getVersionsBlock(): Promise<Record<string, string | number>> {
  // Dynamic imports keep this dependency one-directional: intelligence reads
  // version constants FROM decision modules; those modules never import us.
  const { SELECTOR_VERSION, SCORING_VERSION } = await import("@/lib/vault/vault-opportunity-selector");
  const { DECISION_ENGINE_VERSION } = await import("@/lib/quality/opportunity-decision");
  let modelId = "unknown";
  try {
    const anthropic = await import("@/lib/anthropic");
    if (typeof (anthropic as { MODEL?: string }).MODEL === "string") modelId = (anthropic as { MODEL: string }).MODEL;
  } catch { /* honest fallback */ }
  return {
    report_schema: REPORT_SCHEMA_VERSION,
    feature_schema: FEATURE_SCHEMA_VERSION,
    intelligence_foundation: INTELLIGENCE_FOUNDATION_VERSION,
    selector: SELECTOR_VERSION,
    scoring: SCORING_VERSION,
    decision_engine: DECISION_ENGINE_VERSION,
    pipeline: 1,
    data_origin_contract: "origin-v1",
    promotion_gates: "promotion-gates-v3",
    eligibility_contract: "eligibility-v1",
    entity_resolver: "entity-resolution-v3",
    research_prompt: "unversioned",
    qualification_prompt: "unversioned",
    report_prompt: "unversioned",
    model_provider: "anthropic",
    model_id: modelId,
    generated_at: new Date().toISOString(),
  };
}

/** Attach snapshots + versions to a freshly built report. Additive only —
 *  never changes scores, categories, decisions or ordering. */
export async function applyIntelligenceFoundation(
  report: LeadLensReport,
  leads: ProcessedLead[],
): Promise<LeadLensReport> {
  const byId = new Map(leads.map((l) => [l.id, l]));
  const now = new Date();
  for (const opp of report.ranked_opportunities ?? []) {
    const lead = byId.get(opp.lead_id);
    if (lead) opp.feature_snapshot = buildOpportunityFeatureSnapshot(lead, opp, now) as unknown as Record<string, unknown>;
  }
  report._versions = await getVersionsBlock();
  return report;
}
