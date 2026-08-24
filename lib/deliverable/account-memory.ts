// ─── Account Memory / Living Opportunity Cases V1 ─────────────────────────────
// Commercial memory, not a changelog: compares the CANONICAL structured state of
// an Opportunity Case across evaluation reviews and surfaces only meaningful
// change (§3/§48). The current Case stays primary; memory explains how we got
// here (§59/§132). Deterministic and locale-independent — it diffs canonical
// fields (decision, strengths, dated-change keys, evidence origins, validation
// theme keys), never rendered prose or localized strings (§9/§52).
//
// Reuse: idempotency mirrors snapshot-engine's fingerprint idea; validation
// transitions mirror validation-lifecycle; portfolio-level change reuses
// diffPortfolioIntelligence. This module adds only the customer-facing Case diff.
import type { AccountBriefVM, DecisionState, Strength } from "./deliverable-view-model";

export const ACCOUNT_MEMORY_VERSION = "account-memory-v1";

// canonical taxonomies (locale-independent keys) — kept local so the frozen
// Portfolio Intelligence module is not reopened.
const CONTRADICTORY = /\b(layoff|lay off|job cuts?|clos(e|es|ed|ure|ing)|shut|declin|decline|contract(ion|ing)?|loss(es)?|soft|muted|downturn|lawsuit|reduc(e|tion|ing)|cut(s|ting)?|despido|cierre|p[eé]rdida|recorte|demanda|ca[ií]da)\b/i;
const VALIDATION_THEME_KEYS: Array<{ key: string; re: RegExp }> = [
  { key: "systems", re: /system|vendor|platform|stack|tooling|tms|wms|erp|sistema|proveedor|plataforma|herramienta/i },
  { key: "owner", re: /owner|ownership|decision.?maker|procurement|responsable|due[ñn]|compras|qui[eé]n/i },
  { key: "integration", re: /integrat|scope|post-close|onboard|integrac|alcance/i },
  { key: "fit", re: /\bfit\b|category|relevan|applicab|encaje|categor[ií]a/i },
  { key: "corroboration", re: /corroborat|second (source|origin)|independent|confirm|corrobora|independiente|confirmar|segunda fuente/i },
  { key: "timing", re: /window|timeline|timing|when|moved from plan|build|ventana|cronograma|cu[aá]ndo|momento|plazo/i },
];
const validationKey = (q: string): string | null => VALIDATION_THEME_KEYS.find(v => v.re.test(q))?.key ?? null;
const isVerified = (kind?: string) => kind === "true_change" || kind === "recent_event";
const STRENGTH_RANK: Record<string, number> = { Limited: 1, Moderate: 2, Strong: 3 };

/** Immutable canonical review snapshot (§10). Contains NO localized prose. */
export interface AccountReviewSnapshot {
  reviewId: string;              // stable job/cycle id — never browser time (§79/§82)
  reviewedAt: string;            // evaluation timestamp (ordering only, §78)
  contextVersion: string;        // client context version (§11)
  accountId: string;
  decision: DecisionState;
  fit: Strength | null;
  timing: Strength | null;
  evidence: Strength | null;
  changeKeys: string[];          // `${kind}:${date}` for VERIFIED dated changes
  hasVerifiedChange: boolean;
  evidenceOrigins: string[];     // canonical source hosts (dedup)
  independentSupport: boolean;
  counterCount: number;
  hasMaterialCounter: boolean;
  validationThemeKeys: string[];
  decisionCriticalThemeKeys: string[];
  hasRevisitTrigger: boolean;
}

const dimOf = (a: AccountBriefVM, label: string): Strength | null => a.dimensions.find(d => d.label === label)?.value ?? null;
const hostKey = (label: string | null, url: string | null): string | null => {
  const raw = url ?? label; if (!raw) return null;
  try { return new URL(raw.startsWith("http") ? raw : `https://${raw}`).host.replace(/^www\./, "").toLowerCase(); }
  catch { return label ? label.toLowerCase().trim() : null; }
};

/** Derive a canonical snapshot from a customer-facing Case + review identity. */
export function snapshotAccountReview(a: AccountBriefVM, review: { reviewId: string; reviewedAt: string; contextVersion: string }): AccountReviewSnapshot {
  const changeKeys = Array.from(new Set(a.whatChanged.filter(c => isVerified(c.kind) && c.date).map(c => `${c.kind}:${c.date}`)));
  const origins = Array.from(new Set(a.sources.map(s => hostKey(s.label, s.url)).filter(Boolean) as string[]));
  const details = a.validationDetails ?? a.validations.map(q => ({ question: q, decisionCritical: false, howToValidate: null, changesDecisionBecause: null }));
  const themeKeys = Array.from(new Set(details.map(v => validationKey(v.question)).filter(Boolean) as string[]));
  const dcKeys = Array.from(new Set(details.filter(v => v.decisionCritical).map(v => validationKey(v.question)).filter(Boolean) as string[]));
  return {
    reviewId: review.reviewId, reviewedAt: review.reviewedAt, contextVersion: review.contextVersion, accountId: a.id,
    decision: a.decision, fit: dimOf(a, "Fit"), timing: dimOf(a, "Timing"), evidence: dimOf(a, "Evidence") ?? a.evidence.strength,
    changeKeys, hasVerifiedChange: changeKeys.length > 0,
    evidenceOrigins: origins, independentSupport: a.evidence.corroborated === true,
    counterCount: a.counterSignals.length, hasMaterialCounter: a.counterSignals.some(s => CONTRADICTORY.test(s)),
    validationThemeKeys: themeKeys, decisionCriticalThemeKeys: dcKeys, hasRevisitTrigger: !!a.revisitWhen,
  };
}

/** Canonical fingerprint for idempotency (§80-81/§121): same intelligence ⇒ same string. */
export function snapshotFingerprint(s: AccountReviewSnapshot): string {
  return JSON.stringify([s.accountId, s.decision, s.fit, s.timing, s.evidence, [...s.changeKeys].sort(), [...s.evidenceOrigins].sort(), s.independentSupport, s.hasMaterialCounter, [...s.validationThemeKeys].sort(), [...s.decisionCriticalThemeKeys].sort()]);
}

export type StrengthDirection = "strengthened" | "weakened" | "unchanged";
export type DecisionDriver =
  | "new_material_change" | "new_corroboration" | "counterevidence_added" | "decision_critical_resolved"
  | "timing_changed" | "fit_changed" | "evidence_stale" | "client_objective_changed" | "revisit_trigger_met";

export interface AccountCaseDiff {
  accountId: string;
  isFirstReview: boolean;
  isSameReview: boolean;            // idempotency: identical intelligence
  contextChanged: boolean;         // client objective/criteria changed (§11-12)
  decision: { from: DecisionState; to: DecisionState; changed: boolean; drivers: DecisionDriver[] };
  timing: { from: Strength | null; to: Strength | null; direction: StrengthDirection };
  fit: { from: Strength | null; to: Strength | null; direction: StrengthDirection };
  evidenceStrength: { from: Strength | null; to: Strength | null; direction: StrengthDirection };
  newChangeKeys: string[];         // verified changes in next not prev
  evidenceAdded: string[];         // origins in next not prev (dedup, §21)
  independentSupportAdded: boolean;
  counterevidenceAdded: boolean;   // material counter newly present (§28)
  validationResolved: string[];    // theme keys in prev not next (§25-26)
  validationStillOpen: string[];   // theme keys in both
  decisionCriticalResolved: string[];
  revisitTriggerMet: boolean;      // §30-31
  material: boolean;               // any customer-material change (§48-49)
}

const dir = (from: Strength | null, to: Strength | null): StrengthDirection => {
  const f = from ? STRENGTH_RANK[from] : 0, t = to ? STRENGTH_RANK[to] : 0;
  return t > f ? "strengthened" : t < f ? "weakened" : "unchanged";
};

/** Diff two canonical snapshots. `prev` is the earlier review, `next` the later.
 *  Caller should order by reviewedAt first (see latestOf). */
export function diffAccountCase(prev: AccountReviewSnapshot | null, next: AccountReviewSnapshot): AccountCaseDiff {
  const base = {
    accountId: next.accountId, timing: { from: null, to: next.timing, direction: "unchanged" as StrengthDirection },
    fit: { from: null, to: next.fit, direction: "unchanged" as StrengthDirection },
    evidenceStrength: { from: null, to: next.evidence, direction: "unchanged" as StrengthDirection },
    newChangeKeys: [], evidenceAdded: [], independentSupportAdded: false, counterevidenceAdded: false,
    validationResolved: [], validationStillOpen: [], decisionCriticalResolved: [], revisitTriggerMet: false,
  };
  if (!prev) return { ...base, isFirstReview: true, isSameReview: false, contextChanged: false, decision: { from: next.decision, to: next.decision, changed: false, drivers: [] }, material: false };
  if (prev.reviewId === next.reviewId || snapshotFingerprint(prev) === snapshotFingerprint(next)) {
    return { ...base, isFirstReview: false, isSameReview: true, contextChanged: false, decision: { from: prev.decision, to: next.decision, changed: false, drivers: [] }, timing: { from: prev.timing, to: next.timing, direction: "unchanged" }, fit: { from: prev.fit, to: next.fit, direction: "unchanged" }, evidenceStrength: { from: prev.evidence, to: next.evidence, direction: "unchanged" }, material: false };
  }
  const contextChanged = prev.contextVersion !== next.contextVersion;
  const newChangeKeys = next.changeKeys.filter(k => !prev.changeKeys.includes(k));
  const evidenceAdded = next.evidenceOrigins.filter(o => !prev.evidenceOrigins.includes(o));
  const independentSupportAdded = next.independentSupport && !prev.independentSupport;
  const counterevidenceAdded = next.hasMaterialCounter && !prev.hasMaterialCounter;
  const validationResolved = prev.validationThemeKeys.filter(k => !next.validationThemeKeys.includes(k));
  const validationStillOpen = next.validationThemeKeys.filter(k => prev.validationThemeKeys.includes(k));
  const decisionCriticalResolved = prev.decisionCriticalThemeKeys.filter(k => !next.decisionCriticalThemeKeys.includes(k));
  const timing = { from: prev.timing, to: next.timing, direction: dir(prev.timing, next.timing) };
  const fit = { from: prev.fit, to: next.fit, direction: dir(prev.fit, next.fit) };
  const evidenceStrength = { from: prev.evidence, to: next.evidence, direction: dir(prev.evidence, next.evidence) };
  // Revisit trigger met: prev was a watch decision with a trigger, and a genuinely new verified change appeared (§31).
  const revisitTriggerMet = prev.hasRevisitTrigger && (prev.decision === "monitor" || prev.decision === "hold") && newChangeKeys.length > 0;

  const drivers: DecisionDriver[] = [];
  const decisionChanged = prev.decision !== next.decision;
  if (newChangeKeys.length) drivers.push("new_material_change");
  if (independentSupportAdded) drivers.push("new_corroboration");
  if (counterevidenceAdded) drivers.push("counterevidence_added");
  if (decisionCriticalResolved.length) drivers.push("decision_critical_resolved");
  if (timing.direction !== "unchanged") drivers.push("timing_changed");
  if (fit.direction !== "unchanged") drivers.push("fit_changed");
  if (revisitTriggerMet) drivers.push("revisit_trigger_met");
  if (contextChanged) drivers.push("client_objective_changed");

  const material = decisionChanged || newChangeKeys.length > 0 || evidenceAdded.length > 0 || independentSupportAdded
    || counterevidenceAdded || validationResolved.length > 0 || timing.direction !== "unchanged"
    || fit.direction !== "unchanged" || evidenceStrength.direction !== "unchanged" || revisitTriggerMet || contextChanged;

  return {
    ...base, isFirstReview: false, isSameReview: false, contextChanged,
    decision: { from: prev.decision, to: next.decision, changed: decisionChanged, drivers: decisionChanged ? drivers : drivers.filter(d => d !== "client_objective_changed" || contextChanged) },
    timing, fit, evidenceStrength, newChangeKeys, evidenceAdded, independentSupportAdded, counterevidenceAdded,
    validationResolved, validationStillOpen, decisionCriticalResolved, revisitTriggerMet, material,
  };
}

/** Pick the current snapshot and its immediate predecessor from an unordered set,
 *  safely (out-of-order insert must not corrupt, §85/§120). Dedupes idempotent
 *  re-ingests by fingerprint (§121). */
export function orderReviews(snapshots: AccountReviewSnapshot[]): { current: AccountReviewSnapshot | null; previous: AccountReviewSnapshot | null; ordered: AccountReviewSnapshot[] } {
  const seen = new Set<string>();
  const dedup = snapshots.filter(s => { const fp = s.reviewId; if (seen.has(fp)) return false; seen.add(fp); return true; });
  const ordered = [...dedup].sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime());
  return { current: ordered[ordered.length - 1] ?? null, previous: ordered[ordered.length - 2] ?? null, ordered };
}

// ── localized customer-facing "Since Last Review" (§14/§74-75) ──
export interface MemoryItem { kind: "decision" | "new" | "evidence" | "validation" | "unknown" | "revisit"; text: string }

export function sinceLastReview(diff: AccountCaseDiff, es: boolean): { title: string; items: MemoryItem[] } | null {
  if (diff.isFirstReview || diff.isSameReview || !diff.material) return null;
  const decWord: Record<DecisionState, string> = es
    ? { prioritize: "Priorizar", validate: "Validar", monitor: "Monitorear", hold: "En espera" }
    : { prioritize: "Prioritize", validate: "Validate", monitor: "Monitor", hold: "Hold" };
  const driverWord: Record<DecisionDriver, string> = es ? {
    new_material_change: "nuevo cambio material verificado", new_corroboration: "nuevo respaldo independiente", counterevidence_added: "nueva contraevidencia",
    decision_critical_resolved: "se resolvió una validación crítica", timing_changed: "cambió el momento", fit_changed: "cambió el encaje",
    evidence_stale: "la evidencia envejeció", client_objective_changed: "cambió el objetivo del cliente", revisit_trigger_met: "se cumplió el disparador de revisión",
  } : {
    new_material_change: "new verified material change", new_corroboration: "new independent support", counterevidence_added: "new counterevidence",
    decision_critical_resolved: "a decision-critical validation was resolved", timing_changed: "timing changed", fit_changed: "fit changed",
    evidence_stale: "evidence aged", client_objective_changed: "client objective changed", revisit_trigger_met: "revisit trigger met",
  };
  const items: MemoryItem[] = [];
  if (diff.decision.changed) items.push({ kind: "decision", text: `${es ? "Decisión" : "Decision"}: ${decWord[diff.decision.from]} → ${decWord[diff.decision.to]}${diff.decision.drivers.length ? ` — ${diff.decision.drivers.map(d => driverWord[d]).join("; ")}` : ""}` });
  if (diff.revisitTriggerMet) items.push({ kind: "revisit", text: es ? "Se cumplió la condición de revisión" : "Revisit condition met" });
  if (diff.newChangeKeys.length) items.push({ kind: "new", text: es ? `Nuevo desde la última revisión: ${diff.newChangeKeys.length} desarrollo(s) material(es) verificado(s)` : `New since last review: ${diff.newChangeKeys.length} verified material development(s)` });
  if (diff.evidenceAdded.length) items.push({ kind: "evidence", text: `${es ? "Evidencia añadida" : "Evidence added"}: +${diff.evidenceAdded.length} ${es ? "origen(es) independiente(s)" : "independent origin(s)"}${diff.independentSupportAdded ? (es ? " (ahora corroborado)" : " (now corroborated)") : ""}` });
  if (diff.counterevidenceAdded) items.push({ kind: "evidence", text: es ? "Contraevidencia material añadida — el caso se debilitó" : "Material counterevidence added — the Case weakened" });
  if (diff.timing.direction === "strengthened") items.push({ kind: "new", text: es ? `El momento se fortaleció (${diff.timing.from ?? "—"} → ${diff.timing.to})` : `Timing strengthened (${diff.timing.from ?? "—"} → ${diff.timing.to})` });
  else if (diff.timing.direction === "weakened") items.push({ kind: "new", text: es ? `El momento se debilitó (${diff.timing.from ?? "—"} → ${diff.timing.to})` : `Timing weakened (${diff.timing.from ?? "—"} → ${diff.timing.to})` });
  if (diff.validationResolved.length) items.push({ kind: "validation", text: `${es ? "Validación resuelta" : "Validation resolved"}: ${diff.validationResolved.length}${diff.decisionCriticalResolved.length ? (es ? ` (${diff.decisionCriticalResolved.length} crítica)` : ` (${diff.decisionCriticalResolved.length} decision-critical)`) : ""}` });
  if (diff.validationStillOpen.length) items.push({ kind: "unknown", text: es ? `Aún por validar: ${diff.validationStillOpen.length}` : `Still to validate: ${diff.validationStillOpen.length}` });
  return { title: es ? "Desde la última revisión" : "Since last review", items };
}
