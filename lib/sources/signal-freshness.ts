/**
 * Signal Freshness — normalizes source metadata and freshness for
 * the Source Access & Freshness Layer v0.
 *
 * Rules (v0):
 * - signal_date is NEVER invented. If not available, it stays null.
 * - discovered_at is always set to the current run timestamp.
 * - fresh_signal_count is always 0 in v0 (no signal_date in schema yet).
 * - Context-only sources never contribute to fresh_signal_count.
 * - "unknown" source type → reliability "unknown", not counted as fresh signal.
 * - This layer never changes fit_score, category, or ranking.
 * - Best-effort: never throws, never blocks pipeline.
 *
 * See signal-taxonomy.ts for the source type taxonomy and thresholds.
 */

import type {
  ProcessedLead,
  LeadLensReport,
  SourceType,
  SourceFreshness,
  SignalRole,
  RegionConfidence,
  EvidenceQualityLevel,
} from "@/types";

import {
  getSourceTaxonomy,
  getRegionConfidence,
  inferSourceTypeFromUrl,
  inferSourceTypeFromClaim,
  getDefaultSourceTypeForLeadSource,
  isTimingSource,
  isContextSource,
  getFreshThresholdDays,
  getStaleThresholdDays,
} from "./signal-taxonomy";

// ─── Source inputs ─────────────────────────────────────────────────────────────

export interface SourceLayerInputs {
  discovered_at: string;
  signal_date: string | null;
  signal_age_days: number | null;
  source_type: SourceType;          // Primary (most specific timing source, or fallback)
  source_types: SourceType[];       // All unique types found
  source_name: string | null;
  source_count: number;
  signal_count: number;
  fresh_signal_count: number;       // Always 0 in v0
  is_context_only: boolean;
  is_timing_signal: boolean;
  signal_role: SignalRole;
  source_freshness: SourceFreshness;
  freshness_score: number;
  region_confidence: RegionConfidence;
  limited_region_coverage: boolean;
}

// ─── Normalization ─────────────────────────────────────────────────────────────

/**
 * Normalize a raw string to a known SourceType.
 * Returns "unknown" if the value doesn't match any known type.
 */
export function normalizeSourceType(raw?: string | null): SourceType {
  if (!raw) return "unknown";
  const VALID: Set<string> = new Set<SourceType>([
    "company_website", "news", "job_posting", "press_release", "funding",
    "directory", "social", "public_registry", "trade_association",
    "chamber_of_commerce", "export_import_resource", "customer_memory",
    "demo", "unknown",
  ]);
  return VALID.has(raw) ? (raw as SourceType) : "unknown";
}

// ─── Signal age calculation ────────────────────────────────────────────────────

/**
 * Calculate how many days ago a signal_date occurred relative to a reference date.
 * Returns null if signal_date is null or invalid — never invents a date.
 */
export function calculateSignalAgeDays(
  signalDate: string | null | undefined,
  referenceDate?: string
): number | null {
  if (!signalDate) return null;
  try {
    const signal = new Date(signalDate).getTime();
    const ref    = referenceDate ? new Date(referenceDate).getTime() : Date.now();
    if (isNaN(signal) || isNaN(ref)) return null;
    const diffMs = ref - signal;
    if (diffMs < 0) return null; // signal_date in the future — treat as unknown
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Classify a signal's freshness from its age in days and source type.
 * Returns "unknown" when signal_age_days is null.
 * Thresholds are PROVISIONAL — see signal-taxonomy.ts.
 */
export function classifySourceFreshness(
  signalAgeDays: number | null,
  sourceType: SourceType
): SourceFreshness {
  if (signalAgeDays === null) return "unknown";
  const freshThreshold = getFreshThresholdDays(sourceType);
  const staleThreshold = getStaleThresholdDays(sourceType);
  if (signalAgeDays <= freshThreshold) return "fresh";
  if (signalAgeDays <= staleThreshold) return "recent";
  return "stale";
}

/**
 * Convert source freshness to a 0–1 score.
 * "unknown" → 0 (conservative). Used only as a metadata signal, not for scoring.
 */
export function calculateFreshnessScore(freshness: SourceFreshness): number {
  switch (freshness) {
    case "fresh":   return 1.0;
    case "recent":  return 0.5;
    case "stale":   return 0.1;
    case "unknown": return 0.0;
  }
}

// ─── Source extraction ─────────────────────────────────────────────────────────

export function extractSourceInputs(lead: ProcessedLead): SourceLayerInputs {
  const discipline   = lead.enrichment.evidence_discipline ?? [];
  const timingSignals = lead.enrichment.timing_signals ?? [];

  // ── Discover source types ───────────────────────────────────────────────────

  // Base type from the lead provider (Apollo → directory, mock → demo, etc.)
  const baseSourceType = getDefaultSourceTypeForLeadSource(lead.candidate.source);

  // Refine from source_url if the base is "unknown"
  const urlInferred = lead.candidate.source_url
    ? inferSourceTypeFromUrl(lead.candidate.source_url)
    : "unknown";

  // Collect types from evidence discipline claims
  const disciplineTypes: SourceType[] = [];
  for (const claim of discipline) {
    const inferred = inferSourceTypeFromClaim(claim.claim);
    if (inferred !== "unknown") disciplineTypes.push(inferred);
  }

  // Build unique set, prioritizing timing sources
  const allTypes = new Set<SourceType>();
  if (baseSourceType !== "unknown") allTypes.add(baseSourceType);
  if (urlInferred   !== "unknown") allTypes.add(urlInferred);
  for (const t of disciplineTypes) allTypes.add(t);
  if (allTypes.size === 0) allTypes.add("unknown");

  const source_types = Array.from(allTypes);

  // Primary type: prefer timing source (more informative); fall back to first found
  const primaryTiming = source_types.find(t => isTimingSource(t));
  const source_type: SourceType = primaryTiming ?? source_types[0] ?? "unknown";

  // ── Source counts ────────────────────────────────────────────────────────────

  // Count verified_public_signal entries (same basis as Evidence Quality)
  const verifiedClaims = discipline.filter(e => e.type === "verified_public_signal");
  const source_count   = verifiedClaims.length;

  // Non-generic timing signals (same basis as Evidence Quality)
  const confirmedSignals = timingSignals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );
  const signal_count = confirmedSignals.length;

  // ── Freshness ────────────────────────────────────────────────────────────────
  // signal_date is always null in v0 — no structured date field exists yet.
  // discovered_at is the run timestamp (always available).
  // fresh_signal_count is always 0 in v0.

  const signal_date: string | null = null;     // v0: no signal_date in schema
  const discovered_at = new Date().toISOString();
  const signal_age_days = calculateSignalAgeDays(signal_date);
  const source_freshness = classifySourceFreshness(signal_age_days, source_type);
  const freshness_score  = calculateFreshnessScore(source_freshness);
  const fresh_signal_count = 0;                // v0: no date = no confirmed fresh signal

  // ── Timing vs context ────────────────────────────────────────────────────────
  const has_timing_source = source_types.some(t => isTimingSource(t));
  const all_context_only  = source_types.every(t => isContextSource(t) || t === "unknown");
  const is_context_only   = source_count === 0 || all_context_only;
  const is_timing_signal  = has_timing_source && !is_context_only;

  const signal_role: SignalRole = is_timing_signal
    ? "timing_signal"
    : is_context_only
    ? "context_only"
    : "unknown";

  // ── Region confidence ────────────────────────────────────────────────────────
  const region_confidence = getRegionConfidence(lead.candidate.location);
  const limited_region_coverage = region_confidence === "low" || region_confidence === "unknown";

  // ── Source name ─────────────────────────────────────────────────────────────
  // Derive from source_url domain if available — never invent
  let source_name: string | null = null;
  if (lead.candidate.source_url) {
    try {
      const url = new URL(
        lead.candidate.source_url.startsWith("http")
          ? lead.candidate.source_url
          : `https://${lead.candidate.source_url}`
      );
      source_name = url.hostname.replace(/^www\./, "") || null;
    } catch {
      source_name = null;
    }
  }

  return {
    discovered_at,
    signal_date,
    signal_age_days,
    source_type,
    source_types,
    source_name,
    source_count,
    signal_count,
    fresh_signal_count,
    is_context_only,
    is_timing_signal,
    signal_role,
    source_freshness,
    freshness_score,
    region_confidence,
    limited_region_coverage,
  };
}

// ─── Human-readable summaries ──────────────────────────────────────────────────

export function buildFreshnessLabel(inputs: SourceLayerInputs): string {
  if (inputs.signal_date === null && inputs.is_context_only) {
    return "Context-only source · No timing signal";
  }
  if (inputs.signal_date === null) {
    return "No signal date available · Freshness unknown";
  }
  switch (inputs.source_freshness) {
    case "fresh":   return `Fresh signal (< ${getFreshThresholdDays(inputs.source_type)} days)`;
    case "recent":  return `Recent signal (31–${getStaleThresholdDays(inputs.source_type)} days)`;
    case "stale":   return `Stale signal (> ${getStaleThresholdDays(inputs.source_type)} days) · Verify still active`;
    case "unknown": return "Signal age unknown";
  }
}

export function buildSourceSummary(inputs: SourceLayerInputs): string {
  const typesStr = inputs.source_types
    .filter(t => t !== "unknown")
    .map(t => t.replace(/_/g, " "))
    .join(", ") || "unknown";

  const countPart = inputs.source_count === 0
    ? "No verified sources"
    : `${inputs.source_count} verified source${inputs.source_count > 1 ? "s" : ""} (${typesStr})`;

  const rolePart = inputs.is_context_only
    ? "· context-only"
    : inputs.is_timing_signal
    ? "· timing signal"
    : "";

  const datePart = inputs.signal_date
    ? `· signal date: ${inputs.signal_date.slice(0, 10)}`
    : "· no signal date";

  return `${countPart} ${rolePart} ${datePart}`.replace(/\s+/g, " ").trim();
}

// ─── Apply to a single lead ────────────────────────────────────────────────────

export function applySourceFreshnessToLead(lead: ProcessedLead): ProcessedLead {
  try {
    const inputs = extractSourceInputs(lead);
    const taxonomy = getSourceTaxonomy(inputs.source_type);
    const freshness_label = buildFreshnessLabel(inputs);
    const source_summary  = buildSourceSummary(inputs);

    return {
      ...lead,
      learning: {
        // Required fields (preserve existing or set defaults)
        agent_confidence:             lead.learning?.agent_confidence ?? 0,
        qc_flags:                     lead.learning?.qc_flags ?? [],
        genericness_risk:             lead.learning?.genericness_risk ?? "medium",
        hallucination_risk:           lead.learning?.hallucination_risk ?? "low",
        evidence_discipline_summary:  lead.learning?.evidence_discipline_summary ?? "weak",
        signal_patterns:              lead.learning?.signal_patterns ?? [],
        improvement_notes:            lead.learning?.improvement_notes ?? [],
        // Spread existing learning (vault, account memory, etc.)
        ...lead.learning,
        // Source Layer fields (overwrite any prior values)
        source_layer_applied:    true,
        discovered_at:           inputs.discovered_at,
        signal_date:             inputs.signal_date,
        signal_age_days:         inputs.signal_age_days,
        source_type:             inputs.source_type,
        source_types:            inputs.source_types,
        source_name:             inputs.source_name,
        source_count:            inputs.source_count,
        signal_count:            inputs.signal_count,
        fresh_signal_count:      inputs.fresh_signal_count,
        is_context_only:         inputs.is_context_only,
        is_timing_signal:        inputs.is_timing_signal,
        signal_role:             inputs.signal_role,
        source_freshness:        inputs.source_freshness,
        source_reliability:      taxonomy.reliability,
        freshness_score:         inputs.freshness_score,
        region_confidence:       inputs.region_confidence,
        limited_region_coverage: inputs.limited_region_coverage,
        freshness_label,
        source_summary,
      },
    };
  } catch {
    // Best-effort — never block pipeline
    return lead;
  }
}

// ─── Apply to all leads ────────────────────────────────────────────────────────

export function applySourceFreshnessToLeads(leads: ProcessedLead[]): ProcessedLead[] {
  return leads.map(applySourceFreshnessToLead);
}

// ─── Evidence strength label (customer-facing, not a raw enum) ────────────────

function buildEvidenceStrengthLabel(level?: EvidenceQualityLevel): string | undefined {
  switch (level) {
    case "high":         return "Strong evidence";
    case "medium":       return "Moderate evidence";
    case "low":          return "Limited evidence";
    case "insufficient": return "Insufficient evidence";
    default:             return undefined;
  }
}

// ─── Apply to report (patches ranked_opportunities with source metadata) ───────

export function applySourceFreshnessToReport(report: LeadLensReport): LeadLensReport {
  try {
    if (!report.ranked_opportunities?.length) return report;

    // Build map from lead_id → relevant learning metadata fields
    type SourceEntry = {
      freshness_label?: string;
      evidence_quality?: EvidenceQualityLevel;
      is_context_only?: boolean;
      signal_role?: import("@/types").SignalRole;
      limited_region_coverage?: boolean;
      source_name?: string | null;
      source_type?: SourceType;
    };
    const sourceMap = new Map<string, SourceEntry>();

    for (const lead of report.processed_leads) {
      const lm = lead.learning;
      if (lm?.source_layer_applied) {
        sourceMap.set(lead.id, {
          freshness_label:        lm.freshness_label,
          evidence_quality:       lm.evidence_quality,
          is_context_only:        lm.is_context_only,
          signal_role:            lm.signal_role,
          limited_region_coverage: lm.limited_region_coverage,
          source_name:            lm.source_name,
          source_type:            lm.source_type,
        });
      }
    }

    if (sourceMap.size === 0) return report;

    // Patch each ranked opportunity — metadata only, never changes score or rank
    const patched = report.ranked_opportunities.map(opp => {
      const src = sourceMap.get(opp.lead_id);
      if (!src) return opp;

      return {
        ...opp,
        evidence_strength_label: buildEvidenceStrengthLabel(src.evidence_quality),
        source_freshness_label:  src.freshness_label,
        is_context_only:         src.is_context_only,
        signal_role:             src.signal_role,
        source_coverage_note:    src.limited_region_coverage
          ? "Source coverage limited for this region"
          : undefined,
        source_name:  src.source_name,
        source_type:  src.source_type,
      };
    });

    return { ...report, ranked_opportunities: patched };
  } catch {
    return report;
  }
}
