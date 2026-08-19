// ─── Deliverable exports — deterministic CSV builders + filenames ─────────────
// Pure functions over the curated view model (no DOM, no fetch, no raw report
// fields) so they are unit-testable and safe to run server- or client-side. The
// interactive workspace is the PRIMARY experience; these are portable, secondary
// representations for spreadsheets/CRM and offline sharing (§84–101).

import type { DeliverableViewModel, AccountBriefVM } from "./deliverable-view-model";
import { decisionLabel } from "./deliverable-view-model";

/** RFC-4180 field escaping: quote when the value contains a comma, quote, CR or
 *  LF; double any embedded quotes. Everything is coerced to a flat string first
 *  so an object can never leak as "[object Object]". */
export function csvEscape(value: unknown): string {
  let s: string;
  if (value === null || value === undefined) s = "";
  else if (Array.isArray(value)) s = value.map((v) => (v === null || v === undefined ? "" : String(v))).join("; ");
  else if (typeof value === "object") s = "";
  else s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}

const dim = (a: AccountBriefVM, label: string) => a.dimensions.find((d) => d.label === label)?.value ?? "";

/** One row per account — the portfolio a customer can sort/filter in Excel/CRM. */
export function portfolioCsv(vm: DeliverableViewModel): string {
  const es = vm.meta.language === "es";
  const header = [
    "Rank", "Account", "Decision", "Segment", "Geography",
    "Fit", "Timing", "Evidence Strength", "Latest Change", "Change Date",
    "Latest Evidence Age", "Source Count", "Corroborated", "Primary Limiter",
    "Validate Next", "Decision Rationale", "Recommended Next Step",
  ];
  const lines = vm.accounts.map((a) => row([
    a.rank ?? "",
    a.company,
    decisionLabel(a.decision, es),
    a.segment ?? "",
    a.geography ?? "",
    dim(a, "Fit"),
    dim(a, "Timing"),
    a.evidence.strength ?? "",
    a.whatChanged[0]?.event ?? "",
    a.whatChanged[0]?.date ?? "",
    a.evidence.latestAge ?? "",
    a.evidence.sourceCount,
    a.evidence.corroborated === true ? "Yes" : a.evidence.corroborated === false ? "No" : "Not evaluated",
    a.limitations[0] ?? "",
    a.validations.join("; "),
    a.decisionNote ?? "",
    a.nextStep ?? "",
  ]));
  return [row(header), ...lines].join("\r\n");
}

/** One row per evidence source across all accounts — claim-first provenance. */
export function evidenceCsv(vm: DeliverableViewModel): string {
  const header = ["Account", "Decision", "Claim", "Source", "Relation", "Date", "Age", "URL"];
  const es = vm.meta.language === "es";
  const lines: string[] = [];
  for (const a of vm.accounts) {
    for (const s of a.sources) {
      lines.push(row([
        a.company, decisionLabel(a.decision, es),
        s.claim ?? "", s.label, s.relation ?? "", s.date ?? "", s.age ?? "", s.url ?? "",
      ]));
    }
  }
  return [row(header), ...lines].join("\r\n");
}

/** Safe, premium filename: LeadLens_Opportunity_Portfolio_<Client>_<YYYY-MM-DD>.<ext> */
export function deliverableFilename(vm: DeliverableViewModel, kind: "portfolio" | "evidence" | "pdf", ext: string): string {
  const client = (vm.meta.client ?? "Portfolio").normalize("NFKD").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "Portfolio";
  const date = (vm.meta.generatedAt ?? new Date().toISOString()).slice(0, 10);
  const base = kind === "evidence" ? "Evidence" : kind === "pdf" ? "Opportunity_Portfolio" : "Portfolio";
  return `LeadLens_${base}_${client}_${date}.${ext}`;
}
