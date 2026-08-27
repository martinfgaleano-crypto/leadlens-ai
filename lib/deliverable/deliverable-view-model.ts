// ─── Interactive Customer Deliverable — view model + design tokens ────────────
// The single typed contract the interactive Opportunity Portfolio workspace
// renders from. It is NOT a data source: adapters (see ./adapters) map an
// already-assembled, already-authorized report snapshot (or a legacy pilot
// artifact) into this shape. The workspace never sees raw report_json.
//
// Honesty rules (shared with the Institutional Report contract):
//   • never invent a field — absent data renders as graceful absence,
//   • never fabricate a date/relation/decision that the source does not support,
//   • uncertainty (counter-signals, limits, what-to-validate) is first-class,
//   • a single opaque score never dominates — dimensions stay separate.

export type DecisionState = "prioritize" | "validate" | "monitor" | "hold";

/** Ordinal evidence/dimension strength — never a raw number on its own. */
export type Strength = "Strong" | "Moderate" | "Limited";

export type EvidenceRelation = "direct" | "corroborating" | "context";

export interface DimensionVM {
  label: string;              // Fit / Timing / Evidence …
  value: Strength;
  /** Optional supporting detail (e.g. the fit score behind "Strong"). */
  note?: string | null;
}

export interface ChangeVM {
  event: string;
  date: string | null;        // ISO yyyy-mm-dd when known — never invented
  age: string | null;         // "9d ago" — derived only from a real date
  source: string | null;      // host / source name when available
  /** Truthful presentation semantics. Legacy callers may omit this, in which
   *  case the renderer uses the conservative "relevant signal" label. */
  kind?: "true_change" | "recent_event" | "static_context" | "inference" | "unknown";
}

export interface SourceVM {
  label: string;              // source name / title
  url: string | null;
  date: string | null;
  age: string | null;
  relation: EvidenceRelation | null;
  claim: string | null;       // what this source establishes
  observation?: string | null; // what the source directly says/shows
  basis?: "observed" | "inferred" | null;
  impacts?: Array<"fit" | "timing" | "what_changed" | "why_now" | "decision" | "counter_case">;
}

export interface EvidenceSummaryVM {
  sourceCount: number;
  datedCount: number;
  corroborated: boolean | null;   // null = not evaluated (not "no corroboration")
  latestAge: string | null;
  strength: Strength | null;
}

export interface AccountBriefVM {
  id: string;                 // stable slug for URL + reload-free switching
  rank: number | null;
  company: string;
  segment: string | null;     // industry / commercial route
  geography: string | null;
  domain: string | null;
  monitorIdentity?: {
    canonicalName: string; domain: string | null; country: string | null;
    organizationType: string | null; aliases: string[];
    confidence: "verified" | "strong" | "plausible" | "ambiguous";
    fromUniverse: boolean;
  } | null;
  /** Architecture-ready for multi-role opportunities (§8). Null unless the
   *  source explicitly provides them — never fabricated. */
  accountRole: string | null;     // Potential Customer / Supplier / Distributor / Partner …
  opportunityType: string | null; // Supplier Expansion / Market Entry / Supply Resilience …
  opportunityDescriptor?: string | null;
  decision: DecisionState;
  decisionNote: string | null;   // one-line why this decision
  thesis: string | null;         // why this account
  whyItMatters: string | null;   // commercial relevance (only if source supports)
  dimensions: DimensionVM[];
  whatChanged: ChangeVM[];
  evidence: EvidenceSummaryVM;
  sources: SourceVM[];
  counterSignals: string[];      // risks / counter-evidence that weaken the thesis
  limitations: string[];         // what limits confidence today
  validations: string[];         // what to validate before acting
  validationDetails?: Array<{
    question: string;
    decisionCritical: boolean;
    howToValidate: string | null;
    changesDecisionBecause: string | null;
  }>;
  nextStep: string | null;       // recommended commercial next step
  revisitWhen?: string | null;
  freshness: { label: string; age: string | null } | null;
  confidence: Strength | null;   // evidence strength, not a generic AI score
}

export interface DeliverableCapabilities {
  showPortfolioTab: boolean;
  showCompareTab: boolean;
  showEvidenceTab: boolean;
  showDownloadsTab: boolean;
  showMethodology: boolean;
}

/** The commercial context LeadLens evaluated accounts against — surfaced so the
 *  customer can recall WHAT was assessed, not just the results (§62–65). */
export interface CommercialContextVM {
  /** The commercial question LeadLens was asked to help answer. */
  objective?: string | null;
  /** What the client sells/is. Never presented as the objective. */
  clientDescription?: string | null;
  summary: string | null;        // ICP / other commercial-context summary
  regions: string[];
  industries: string[];
  criteria: string[];            // opportunity criteria when available
}

/** One account's outstanding validations — aggregated into a portfolio queue so
 *  the deliverable reads as an actionable decision queue (§24–25). */
export interface ValidationQueueItemVM {
  accountId: string;
  company: string;
  decision: DecisionState;
  items: string[];
}

export interface DeliverableViewModel {
  meta: {
    client: string | null;      // customer / project name
    market: string | null;      // geography / market context
    generatedAt: string | null; // ISO
    generatedLabel: string | null;
    tierLabel: string | null;   // Preview / Brief / Intelligence / Premium
    language: "en" | "es";
    schemaVersion: number | null;
  };
  headline: string | null;
  summary: string | null;
  portfolio: {
    total: number;
    counts: Record<DecisionState, number>;
    /** Optional allocation guidance line (Intelligence/Premium). */
    allocation: { line: string; detail: string } | null;
    funnel: { considered: number; rejected: number; selected: number } | null;
    note: string | null;
  };
  accounts: AccountBriefVM[];
  commercialContext: CommercialContextVM | null;
  validationQueue: ValidationQueueItemVM[];
  coverage: {
    withDatedEvidence: number;
    withSources: number;
    corroborated: number;        // accounts with corroborated evidence (null-safe count)
    grade: Strength | null;
    note: string | null;
  } | null;
  methodology: string[];
  limitations: string[];
  downloads: { pdf: boolean; portfolioCsv: boolean; evidenceCsv: boolean };
  capabilities: DeliverableCapabilities;
}

// ─── Design tokens — shared decision-state grammar (matches the landing) ──────
// Prioritize=blue, Validate=amber, Monitor=slate, Hold=light. Color is never the
// only signal: every badge also carries its text label (a11y §129).
export const DECISION_TOKENS: Record<DecisionState, { label: string; labelEs: string; color: string; dot: string; bg: string; border: string }> = {
  prioritize: { label: "Prioritize", labelEs: "Priorizar",  color: "#0369a1", dot: "#0284c7", bg: "#f0f9ff", border: "#e0f2fe" },
  validate:   { label: "Validate",   labelEs: "Validar",    color: "#b45309", dot: "#d97706", bg: "#fffbeb", border: "#fef3c7" },
  monitor:    { label: "Monitor",    labelEs: "Monitorear", color: "#475569", dot: "#94a3b8", bg: "#f8fafc", border: "#eef2f6" },
  hold:       { label: "Hold",       labelEs: "En espera",  color: "#64748b", dot: "#cbd5e1", bg: "#f8fafc", border: "#eef2f6" },
};

export const STRENGTH_TOKENS: Record<Strength, { color: string; weight: number }> = {
  Strong:   { color: "#0f172a", weight: 700 },
  Moderate: { color: "#475569", weight: 600 },
  Limited:  { color: "#94a3b8", weight: 500 },
};

export const RELATION_TOKENS: Record<EvidenceRelation, { label: string; labelEs: string; color: string }> = {
  direct:        { label: "Direct",        labelEs: "Directa",       color: "#0284c7" },
  corroborating: { label: "Corroborating", labelEs: "Corroborante",  color: "#15803d" },
  context:       { label: "Context",       labelEs: "Contexto",      color: "#94a3b8" },
};

// ─── Shared derivations ───────────────────────────────────────────────────────

export function decisionLabel(state: DecisionState, es: boolean): string {
  const t = DECISION_TOKENS[state];
  return es ? t.labelEs : t.label;
}

const ROLE_ES: Record<string, string> = { "Potential Customer": "Cliente potencial", Supplier: "Proveedor", Distributor: "Distribuidor", "Strategic Partner": "Socio estratégico" };
const TYPE_ES: Record<string, string> = {
  "New Business": "Nuevo negocio", "Operations Expansion": "Expansión operativa", "Technology Modernization": "Modernización tecnológica",
  "Enterprise Transformation": "Transformación empresarial", "New Market Entry": "Entrada a nuevo mercado", "Capacity Expansion": "Expansión de capacidad",
  "Vendor or Platform Change": "Cambio de proveedor o plataforma", "Channel Partnership": "Alianza de canal",
};
export const accountRoleLabel = (value: string | null, es: boolean): string | null => value ? (es ? ROLE_ES[value] ?? value : value) : null;
export const opportunityTypeLabel = (value: string | null, es: boolean): string | null => value ? (es ? TYPE_ES[value] ?? value : value) : null;

/** Canonical attention order. Decision always wins; explicit legacy rank only
 * breaks ties inside one decision state. Array position is the final stable
 * tie-break. No aggregate or synthetic score is introduced. */
export const DECISION_PRIORITY: Record<DecisionState, number> = {
  prioritize: 0,
  validate: 1,
  monitor: 2,
  hold: 3,
};

export function orderByAttention<T extends Pick<AccountBriefVM, "decision" | "rank">>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) =>
      DECISION_PRIORITY[a.item.decision] - DECISION_PRIORITY[b.item.decision]
      || (a.item.rank ?? Number.MAX_SAFE_INTEGER) - (b.item.rank ?? Number.MAX_SAFE_INTEGER)
      || a.index - b.index,
    )
    .map(({ item }) => item);
}

/** Whole days since an ISO date, or null when undated / in the future. */
export function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null;
}

/** "9d ago" / "3mo ago" — only ever from a real date. */
export function ageLabel(iso: string | null | undefined, es = false): string | null {
  const d = daysAgo(iso);
  if (d === null) return null;
  if (d === 0) return es ? "hoy" : "today";
  if (d < 45) return `${d}d`;
  const mo = Math.round(d / 30);
  return es ? `${mo} mes${mo > 1 ? "es" : ""}` : `${mo}mo`;
}

/** Host of a URL for compact source display, or null. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return null; }
}
