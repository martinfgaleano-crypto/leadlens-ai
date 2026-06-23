// Pure CSV generation from lead_results rows.
// Shared by the delivery package generator and the admin export route.
// Server-side only.

export interface LeadResultRow {
  company_name:       string;
  contact_name:       string | null;
  title:              string | null;
  email:              string | null;
  email_quality:      string | null;
  email_type:         string | null;
  linkedin_url:       string | null;
  website:            string | null;
  country:            string | null;
  seniority:          string | null;
  source:             string | null;
  lead_score:         number | null;
  confidence_score:   number | null;
  opportunity_score:  number | null;
  buyer_fit:          string | null;
  temperature:        string | null;
  strengths:          string[] | null;
  weaknesses:         string[] | null;
  ai_reasoning:       string | null;
}

const COLUMNS: Array<{ header: string; key: keyof LeadResultRow }> = [
  { header: "Company",           key: "company_name" },
  { header: "Contact Name",      key: "contact_name" },
  { header: "Title",             key: "title" },
  { header: "Email",             key: "email" },
  { header: "Email Quality",     key: "email_quality" },
  { header: "Email Type",        key: "email_type" },
  { header: "LinkedIn",          key: "linkedin_url" },
  { header: "Website",           key: "website" },
  { header: "Country",           key: "country" },
  { header: "Seniority",         key: "seniority" },
  { header: "Source",            key: "source" },
  { header: "Lead Score",        key: "lead_score" },
  { header: "Confidence Score",  key: "confidence_score" },
  { header: "Opportunity Score", key: "opportunity_score" },
  { header: "Buyer Fit",         key: "buyer_fit" },
  { header: "Temperature",       key: "temperature" },
  { header: "Strengths",         key: "strengths" },
  { header: "Weaknesses",        key: "weaknesses" },
  { header: "AI Reasoning",      key: "ai_reasoning" },
];

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join(" | ") : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateLeadsCSV(leads: LeadResultRow[]): string {
  const header = COLUMNS.map(c => cell(c.header)).join(",");
  const rows   = leads
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .map(row => COLUMNS.map(c => cell(row[c.key])).join(","));
  return [header, ...rows].join("\n");
}
