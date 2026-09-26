// ─── Canonical decision/rationale consistency (customer-safety, channel-agnostic) ───────────────────
// A deterministic guard applied at the delivery seam (fromDeliverableViewModel) so EVERY customer report
// — digital, PDF, real, synthetic and production — presents a coherent decision. It never changes the
// canonical decision, fabricates an event, or discards uncertainty. It only detects an actual
// contradiction and neutralizes the contradictory customer-facing ACTION text.
//
// The specific contradiction (the "John Deere class"): a HOLD/MONITOR grounded in stale or insufficient
// evidence, paired with a next-step/thesis that asserts an IMMEDIATE commercial trigger ("validate now",
// "before outreach", "act now"). That prose belongs to a non-stale reading and contradicts the decision.
// The canonical decision stays; the action text is made decision-consistent.
import type { AccountBriefVM, DecisionState } from "@/lib/deliverable/deliverable-view-model";

// Phrases that assert an immediate commercial trigger — inappropriate for a HOLD/MONITOR.
const TRIGGER_NOW = /\b(validate now|worth validating now|before outreach|act now|reach out now|pursue now|prioriti[sz]e now|engage now|contact .*now)\b/i;
// Spanish equivalents (customer reports render in ES too).
const TRIGGER_NOW_ES = /\b(validar ahora|vale la pena validar ahora|antes de contactar|actuar ahora|contactar ahora|priorizar ahora)\b/i;

const isStaleOrThin = (a: AccountBriefVM): boolean =>
  a.evidence.datedCount === 0 ||
  a.evidence.strength === "Limited" ||
  /\b(\d+)\s*(mo|month|meses|m)\b/i.test(a.evidence.latestAge ?? "") ||   // months-old latest evidence
  a.counterSignals.some((c) => /stale|older than|más antigu|desactualiz|180/i.test(c));

export interface ConsistencyIssue { accountId: string; company: string; decision: DecisionState; field: "nextStep" | "thesis"; note: string }

/** Detect decision/rationale contradictions WITHOUT mutating — used by tests and Admin diagnostics. */
export function checkAccountConsistency(a: AccountBriefVM): ConsistencyIssue | null {
  if (a.decision !== "hold" && a.decision !== "monitor") return null;
  if (!isStaleOrThin(a)) return null;
  const trig = (s: string | null) => !!s && (TRIGGER_NOW.test(s) || TRIGGER_NOW_ES.test(s));
  if (trig(a.nextStep)) return { accountId: a.id, company: a.company, decision: a.decision, field: "nextStep", note: "Immediate-trigger next step contradicts a stale/insufficient-evidence " + a.decision.toUpperCase() };
  if (trig(a.thesis)) return { accountId: a.id, company: a.company, decision: a.decision, field: "thesis", note: "Thesis asserts a current trigger inconsistent with " + a.decision.toUpperCase() };
  return null;
}

const HOLD_STEP = { en: "No outreach now; revisit only if a fresher, dated signal appears.", es: "Sin contacto ahora; retomar solo si aparece una señal más reciente y fechada." };
const MONITOR_STEP = { en: "Monitor for a confirming, dated development before allocating outreach.", es: "Monitorear un desarrollo confirmatorio y fechado antes de asignar contacto." };

/** Return a consistency-safe account: the canonical decision is untouched; a contradictory immediate-
 *  trigger next step is replaced with a decision-consistent, honest one. Facts and uncertainty stay. */
export function reconcileAccountConsistency(a: AccountBriefVM, language: "en" | "es" = "en"): AccountBriefVM {
  const issue = checkAccountConsistency(a);
  if (!issue || issue.field !== "nextStep") return a;
  const step = a.decision === "hold" ? HOLD_STEP : MONITOR_STEP;
  return { ...a, nextStep: language === "es" ? step.es : step.en };
}

/** Apply the guard to every account in a deliverable. Returns the reconciled accounts + any issues found
 *  (for Admin diagnostics / acceptance evidence). */
export function reconcileAccounts(accounts: AccountBriefVM[], language: "en" | "es" = "en"): { accounts: AccountBriefVM[]; issues: ConsistencyIssue[] } {
  const issues: ConsistencyIssue[] = [];
  const out = accounts.map((a) => { const i = checkAccountConsistency(a); if (i) issues.push(i); return reconcileAccountConsistency(a, language); });
  return { accounts: out, issues };
}
