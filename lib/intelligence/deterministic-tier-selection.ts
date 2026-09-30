import type { DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";

export interface SelectableAccount {
  id: string;
  company: string;
  decision: DecisionState;
  fit: Strength | null;
  timing: Strength | null;
  evidence: Strength | null;
  evidenceCount: number;
  hasSource: boolean;
  hasValidatedDate: boolean;
  independentlyCorroborated: boolean;
  commercialMechanismVerified: boolean;
  accessVerified: boolean;
  counterevidenceMaterial: boolean;
}

export interface SelectionAudit<T extends SelectableAccount> {
  ordered: T[];
  selected: T[];
  qualifiedNotSelected: Array<{ account: T; reason: string }>;
  selectedReasons: Record<string, string>;
}

const D: Record<DecisionState, number> = { prioritize: 4, validate: 3, monitor: 2, hold: 1 };
const S: Record<Strength, number> = { Strong: 3, Moderate: 2, Limited: 1 };
const strength = (v: Strength | null) => v ? S[v] : 0;
export function selectionTuple(a: SelectableAccount): readonly (number | string)[] {
  return [D[a.decision], a.counterevidenceMaterial ? 0 : 1, a.accessVerified ? 1 : 0,
    a.commercialMechanismVerified ? 1 : 0, strength(a.fit), strength(a.timing), strength(a.evidence),
    a.independentlyCorroborated ? 1 : 0, a.hasValidatedDate ? 1 : 0, a.hasSource ? 1 : 0,
    a.evidenceCount, a.company.toLocaleLowerCase("en-US")];
}

export function compareSelectableAccounts(a: SelectableAccount, b: SelectableAccount): number {
  const at = selectionTuple(a), bt = selectionTuple(b);
  for (let i = 0; i < at.length - 1; i++) {
    const delta = Number(bt[i]) - Number(at[i]);
    if (delta) return delta;
  }
  return String(at.at(-1)).localeCompare(String(bt.at(-1)), "en-US");
}

export function selectDeterministically<T extends SelectableAccount>(accounts: T[], limit: number): SelectionAudit<T> {
  const ordered = [...accounts].sort(compareSelectableAccounts);
  const selected = ordered.slice(0, Math.max(0, limit));
  const cutoff = selected.at(-1);
  const selectedReasons = Object.fromEntries(selected.map((a) => [a.id,
    `${a.decision}; fit=${a.fit ?? "unknown"}; timing=${a.timing ?? "unknown"}; evidence=${a.evidence ?? "unknown"}; source=${a.hasSource}; dated=${a.hasValidatedDate}; access=${a.accessVerified}; corroborated=${a.independentlyCorroborated}`]));
  const qualifiedNotSelected = ordered.slice(Math.max(0, limit)).map((account) => ({
    account,
    reason: cutoff
      ? `Qualified but below ${cutoff.company} at the tier cutoff under the deterministic decision→counterevidence→access→mechanism→Fit→Timing→Evidence→corroboration→date→source→evidence-count ordering.`
      : "Qualified but tier capacity is zero.",
  }));
  return { ordered, selected, qualifiedNotSelected, selectedReasons };
}
