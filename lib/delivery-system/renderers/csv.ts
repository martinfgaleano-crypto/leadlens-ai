// ─── Delivery System V1 — CSV renderer (operational data) ──────────────────────────────────────
// Flat per-account operational rows from a channel="csv" PresentationModel. Decision-oriented; no
// narrative, no outreach, no opaque score (product truth). Column set is governed by ExportPolicy.
import { DECISION_TOKENS } from "@/lib/deliverable/deliverable-view-model";
import type { PresentationModel } from "@/lib/delivery-system/presentation-model";
import { dimensionValue } from "@/lib/delivery-system/renderers/shared";

function cell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function renderCsv(pm: PresentationModel): string {
  const cols = pm.policy.csvColumns;
  if (!cols) throw new Error(`renderCsv: channel "${pm.channel}" has no CSV column policy`);
  const rows = pm.document.accounts.map((a, i) => [
    a.rank ?? i + 1,
    a.company,
    a.segment ?? "",
    a.geography ?? "",
    a.domain ?? "",
    DECISION_TOKENS[a.decision].label,
    a.decisionNote ?? "",
    dimensionValue(a, "Fit") ?? "",
    dimensionValue(a, "Timing") ?? "",
    dimensionValue(a, "Evidence") ?? "",
    a.confidence ?? "",
    a.evidence.sourceCount,
    a.evidence.datedCount,
    a.evidence.latestAge ?? "",
    a.whatChanged.map((c) => c.event).join(" | "),
    a.counterSignals.join(" | "),
    a.validations.join(" | "),
    a.nextStep ?? "",
  ].map(cell).join(","));
  return [cols.map(cell).join(","), ...rows].join("\n");
}
