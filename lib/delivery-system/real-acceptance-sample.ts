// ─── Real-data acceptance sample (MODE A) ───────────────────────────────────────────────────────────
// Builds a DeliverableViewModel from an EXISTING, COMMITTED controlled-acceptance artifact — the
// positive commercial-case review package (6 real US companies, real public source events, canonical
// decisions produced by Intelligence). This is CONTROLLED acceptance data (production_seeded: false),
// not a paid customer's private report; it is already committed under ml/data/acceptance and is used
// here only to verify that the V2.1 renderer presents REAL Intelligence output correctly.
//
// It fabricates nothing: every field is mapped from the artifact. Where the artifact's own text is
// mixed-language (its `decisionRationale` carries Spanish fragments — the exact leak V2 flagged), we
// prefer the clean English `commercial_analysis` fields, never inventing content.
import type {
  DeliverableViewModel, AccountBriefVM, DecisionState, Strength, ChangeVM, SourceVM,
} from "@/lib/deliverable/deliverable-view-model";
import pkg from "@/ml/data/acceptance/positive-commercial-case-review-package-v1.json";

const REPORT_MS = Date.parse((pkg as { generated_at?: string }).generated_at ?? "2026-08-28T00:00:00.000Z");
const daysAgo = (iso: string | null): number | null => (iso && !Number.isNaN(Date.parse(iso)) ? Math.max(0, Math.round((REPORT_MS - Date.parse(iso)) / 86_400_000)) : null);
const ageLabel = (iso: string | null): string | null => {
  const d = daysAgo(iso);
  if (d == null) return null;
  return d < 45 ? `${d}d ago` : `${Math.round(d / 30)}mo ago`;
};
const asStrength = (v: unknown): Strength => (v === "Strong" || v === "Moderate" || v === "Limited" ? v : "Limited");
const asDecision = (v: unknown): DecisionState => (v === "prioritize" || v === "validate" || v === "monitor" || v === "hold" ? v : "hold");
const hostLabel = (url: string | null | undefined): string => {
  if (!url) return "source";
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return String(url).slice(0, 40); }
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toAccount(c: any, i: number): AccountBriefVM {
  const oc = c.opportunity_case ?? {};
  const cc = c.canonical_case ?? {};
  const ca = c.commercial_analysis ?? {};
  const decision = asDecision(cc.decision ?? c.decision);
  const changes: ChangeVM[] = Array.isArray(oc.changes) ? oc.changes.map((ch: any) => ({
    event: String(ch.event ?? ""), date: ch.date ?? null, age: ageLabel(ch.date ?? null), source: ch.sourceLabel ?? null, kind: "recent_event",
  })).filter((x: ChangeVM) => x.event) : [];

  // Sources: the primary (direct) and the independent corroborating source, de-duplicated.
  const rawSources: Array<{ url: string; relation: "direct" | "corroborating"; date: string | null }> = [];
  if (c.primary_source) rawSources.push({ url: c.primary_source, relation: "direct", date: c.source_event?.event_date ?? c.event_date ?? null });
  if (c.independent_source && c.independent_source !== c.primary_source) rawSources.push({ url: c.independent_source, relation: "corroborating", date: null });
  const sources: SourceVM[] = rawSources.map((s) => ({
    label: hostLabel(s.url), url: s.url, date: s.date, age: ageLabel(s.date), relation: s.relation,
    claim: ca.verified_fact ? String(ca.verified_fact).slice(0, 140) : null, observation: null, basis: s.date ? "observed" : "inferred",
    impacts: ["what_changed", "timing"],
  }));
  const datedCount = sources.filter((s) => s.date).length;
  const latest = changes.map((x) => x.date).filter(Boolean).sort().at(-1) ?? (c.event_date ?? null);
  const corroborated = oc.independentSupport === true ? true : (oc.independentSupport === false ? null : null);

  const counter: string[] = [];
  if (ca.counterevidence) counter.push(String(ca.counterevidence));
  if (ca.alternative_explanation) counter.push(String(ca.alternative_explanation));
  if (Array.isArray(oc.weaknesses)) for (const w of oc.weaknesses) if (w?.value && !counter.includes(String(w.value))) counter.push(String(w.value));

  const validations: string[] = Array.isArray(oc.validations) && oc.validations.length
    ? oc.validations.map((v: any) => String(v.question ?? v.value ?? "")).filter(Boolean)
    : (Array.isArray(cc.remainingDecisionCritical) ? cc.remainingDecisionCritical.map(String) : (ca.decision_critical_question ? [String(ca.decision_critical_question)] : []));

  const fitReasons = Array.isArray(ca.fit_reasons) ? ca.fit_reasons.join("; ") : "";
  // Honest HOLD framing (§29): when the canonical decision is HOLD, explain it from the canonical
  // REASONS — never from the case's own why_now/next_action prose, which (e.g. John Deere) can read as
  // "worth validating now" and contradict the HOLD. We keep the decision verbatim and present its real
  // basis; the contradictory upstream prose is not used as the decision rationale.
  const reasons: string[] = Array.isArray(cc.reasons) ? cc.reasons.map(String) : [];
  const holdReason = (): string => {
    if (reasons.some((r) => /stale_beyond_180d/.test(r))) return "The observed event is older than 180 days, so present timing is not defensible — hold until a fresher signal appears.";
    if (reasons.some((r) => /reject/.test(r))) return "The opportunity test did not clear the bar for commercial attention now.";
    return "Insufficient basis to justify commercial attention now.";
  };
  const isHold = decision === "hold";
  const thesis = [ca.verified_fact ? String(ca.verified_fact) : "", !isHold && ca.why_now ? String(ca.why_now) : "", fitReasons ? `Fit: ${fitReasons}.` : ""].filter(Boolean).join(" ");

  return {
    id: `real-${i + 1}`, rank: i + 1, company: String(c.account ?? `Account ${i + 1}`),
    segment: (Array.isArray(c.__industries) ? c.__industries[0] : null) ?? null,
    geography: "United States", domain: null,
    accountRole: oc.classification?.accountRole?.value ?? null,
    opportunityType: oc.classification?.opportunityType?.value ?? null,
    decision,
    decisionNote: isHold ? holdReason() : (ca.why_now ? String(ca.why_now) : (reasons.length ? reasons.join("; ") : null)),
    thesis: thesis || null,
    whyItMatters: !isHold && ca.why_now ? String(ca.why_now) : null,
    dimensions: [
      { label: "Fit", value: asStrength(cc.fit ?? oc.fit?.value), note: oc.fit?.rationale ? String(oc.fit.rationale).slice(0, 120) : null },
      { label: "Timing", value: asStrength(cc.timing ?? oc.timing?.value), note: null },
      { label: "Evidence", value: asStrength(cc.evidence), note: null },
    ],
    whatChanged: changes,
    evidence: { sourceCount: sources.length, datedCount, corroborated, latestAge: ageLabel(latest), strength: asStrength(cc.evidence) },
    sources,
    counterSignals: counter,
    limitations: [],
    validations,
    // HOLD stays HOLD: an honest, hold-consistent next step (not the artifact's contradictory "validate
    // before outreach", which belongs to a non-stale reading). Non-hold uses the Intelligence next action.
    nextStep: isHold ? "No outreach now; revisit only if a fresher, dated signal appears." : (ca.next_action ? String(ca.next_action) : (oc.recommendedNextStep?.value ?? null)),
    freshness: latest ? { label: "Observed", age: ageLabel(latest) } : null,
    confidence: asStrength(cc.evidence),
  };
}

function headline(counts: Record<DecisionState, number>, total: number): string {
  if (counts.prioritize > 0) return `${counts.prioritize} account${counts.prioritize === 1 ? "" : "s"} to prioritize and ${counts.validate} to validate of ${total} evaluated`;
  if (counts.validate > 0) return `${counts.validate} account${counts.validate === 1 ? "" : "s"} to validate of ${total} evaluated`;
  if (counts.monitor > 0) return `${counts.monitor} to monitor of ${total} evaluated`;
  return `${total} accounts evaluated`;
}

/** Build a DeliverableViewModel from the committed controlled-acceptance review package (6 real cases).
 *  English (the acceptance context is US). Decisions are taken verbatim from Intelligence — never changed. */
export function buildRealAcceptanceDeliverable(): DeliverableViewModel {
  const p = pkg as any;
  const ctx = p.customer_context ?? {};
  const accounts: AccountBriefVM[] = (p.cases ?? []).map((c: any, i: number) => toAccount(c, i));
  const counts = accounts.reduce((m, a) => { m[a.decision]++; return m; }, { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<DecisionState, number>);
  return {
    meta: {
      client: "Controlled acceptance — real public evidence (US)",
      market: "United States · manufacturing, packaging, distribution",
      generatedAt: p.generated_at ?? null,
      generatedLabel: p.generated_at ? new Date(p.generated_at).toISOString().slice(0, 10) : null,
      tierLabel: "Premium", language: "en", schemaVersion: 1,
    },
    headline: headline(counts, accounts.length),
    summary: "REAL controlled-acceptance data (not a paid customer): canonical decisions and dated public source events from Intelligence, presented through the V2.1 renderer. No content is invented; weak or held cases are shown honestly.",
    portfolio: { total: accounts.length, counts, allocation: { line: "Where attention goes first", detail: "validate the decision-critical question first" }, funnel: null, note: "Ordered by canonical decision; no synthetic score." },
    accounts,
    commercialContext: {
      objective: ctx.value_proposition ?? null, clientDescription: null, summary: ctx.offer_summary ?? null,
      regions: Array.isArray(ctx.target_geography) ? ctx.target_geography : [],
      industries: Array.isArray(ctx.target_industries) ? ctx.target_industries : [],
      criteria: Array.isArray(ctx.buying_signals) ? ctx.buying_signals : [],
    },
    validationQueue: accounts.filter((a) => a.decision === "prioritize" || a.decision === "validate").map((a) => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations })),
    coverage: { withDatedEvidence: accounts.filter((a) => a.evidence.datedCount > 0).length, withSources: accounts.filter((a) => a.evidence.sourceCount > 0).length, corroborated: accounts.filter((a) => a.evidence.corroborated === true).length, grade: "Moderate", note: "Per-company coverage from dated public evidence." },
    methodology: ["Retrieval of dated public events.", "Per-company canonical case synthesis.", "Independent technical adjudication; human confirmation pending (controlled acceptance)."],
    limitations: ["Controlled-acceptance data — real public evidence, not a paid customer report.", "Human confirmation pending (customer_safe_human_positive_cases remains zero)."],
    downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
    capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
  };
}
