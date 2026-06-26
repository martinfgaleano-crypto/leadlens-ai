// Opportunity Snapshot CSV generator. Server-side only.
// Used by the delivery package generator and the admin export route.
// Exports company/account-level intelligence — no personal contact data.

export interface OpportunityResultRow {
  company_name:       string;
  website:            string | null;
  country:            string | null;
  source:             string | null;
  opportunity_score:  number | null;
  confidence_score:   number | null;
  buyer_fit:          string | null;   // HOT / WARM / COLD / DISCARD
  temperature:        string | null;   // signal warmth label
  ai_reasoning:       string | null;  // account-level context paragraph
  strengths:          string[] | null; // why this account fits
  weaknesses:         string[] | null; // gaps / risks
}

// Back-compat alias — callers that import LeadResultRow continue to compile.
/** @deprecated Use OpportunityResultRow for new code. */
export type LeadResultRow = OpportunityResultRow;

const COLUMNS: Array<{ header: string; key: keyof OpportunityResultRow | "_generated_at" }> = [
  { header: "Company",            key: "company_name" },
  { header: "Website",            key: "website" },
  { header: "Region",             key: "country" },
  { header: "Opportunity Score",  key: "opportunity_score" },
  { header: "Confidence Score",   key: "confidence_score" },
  { header: "Priority",           key: "buyer_fit" },
  { header: "Signal Status",      key: "temperature" },
  { header: "Company Context",    key: "ai_reasoning" },
  { header: "Why This Account",   key: "strengths" },
  { header: "Risks / Weaknesses", key: "weaknesses" },
  { header: "Evidence Source",    key: "source" },
  { header: "Generated At",       key: "_generated_at" },
];

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join(" | ") : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateLeadsCSV(rows: OpportunityResultRow[]): string {
  const generatedAt = new Date().toISOString();
  const header = COLUMNS.map(c => cell(c.header)).join(",");

  const dataRows = rows
    .sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0))
    .map(row =>
      COLUMNS.map(c => {
        if (c.key === "_generated_at") return cell(generatedAt);
        return cell(row[c.key as keyof OpportunityResultRow]);
      }).join(",")
    );

  return [header, ...dataRows].join("\n");
}
