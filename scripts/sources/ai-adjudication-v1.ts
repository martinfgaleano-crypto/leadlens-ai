// ─── AI-assisted signal adjudication v1 (policy ai-adjudication-v1) ───────────
// Expert per-signal decisions made by Claude (claude-fable-5) over stored
// evidence — NEVER recorded as human review: origin=ai_assisted, agent+policy
// versioned, requires_human_confirmation=true on every row. Prudent policy:
// max rights granted = link_and_summary_allowed; customer approval only with
// clean corporate identity + specific supported claim + valid recent date;
// publishers/aggregators/job-posts/mismatches rejected (kept, never deleted).
// Idempotent-safe: re-running appends new versions (audit trail is append-only)
// — run once per policy version. Run: npm run sources:adjudicate

import { readFileSync, existsSync } from "node:fs";
for (const f of [".env", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
import { reviewVaultSignal, type ReviewDecision, type EvidenceTier, type RightsStatus } from "@/lib/vault/signal-review";

const AGENT = "claude-fable-5";
const POLICY = "ai-adjudication-v1";

interface D { sig: string; decision: ReviewDecision; tier: EvidenceTier; rights?: RightsStatus; conf: number; reasons: string[]; note: string; verdicts: { company_match: boolean; date_valid: boolean; claim: boolean; signal?: boolean; opportunity?: boolean } }

// Decisions grounded in stored evidence (claim/title, source URL/type, date,
// entity-repair state). Signal ids are full UUID prefixes resolved below.
const DECISIONS: D[] = [
  { sig: "df7c799b", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.75, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "NAWAH: specific first-US VACNT manufacturing facility (Ohio), dated 2026-06-11, credible news source.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { sig: "bb733437", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.78, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "OPmobility (ex-Plastic Omnium): announced new Ohio manufacturing facility, dated 2026-06-17.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { sig: "c647aff4", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.72, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "Geek+: specific partnership with Mindugar for warehouse automation, dated 2026-05-07.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { sig: "97919591", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.75, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "Ramp: launched AI agents for corporate procurement, dated 2026-04-29, specific product launch.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { sig: "9f5b65aa", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.65, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal"], note: "Apex B2B: SaaS platform launch with £1.3m funding — specific and dated; smaller company, single source.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { sig: "09f58850", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.72, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "Transervice: introduced customized freight visibility tool, dated 2026-05-25.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  // Monitor-only: real signal, but identity imperfect or stale.
  { sig: "a3f06e48", decision: "approved_monitor_only", tier: "C", rights: "internal_only", conf: 0.6, reasons: ["grounded_claim", "valid_date", "monitor_only"], note: "Real Target Corp receive-center expansion (Houston), but stored identity is the facility name, not the canonical entity (Target Corporation). Fix identity before customer use.", verdicts: { company_match: false, date_valid: true, claim: true, signal: true } },
  { sig: "c98a2005", decision: "approved_monitor_only", tier: "C", rights: "internal_only", conf: 0.6, reasons: ["grounded_claim", "stale_signal", "monitor_only"], note: "Cardinal Health at-Home Solutions Texas facility — name truncated ('Cardinal Health at') and 2025-09-04 is stale (>90d).", verdicts: { company_match: false, date_valid: true, claim: true, signal: true } },
  { sig: "e523ceaf", decision: "approved_monitor_only", tier: "C", rights: "internal_only", conf: 0.65, reasons: ["grounded_claim", "valid_date", "monitor_only"], note: "FedEx–ServiceNow expanded collaboration is a real dated partnership, but the entity is stored as a composite ('FedEx and ServiceNow') — split before customer use.", verdicts: { company_match: false, date_valid: true, claim: true, signal: true } },
  { sig: "ec5e7e58", decision: "approved_monitor_only", tier: "C", rights: "internal_only", conf: 0.62, reasons: ["correct_company", "grounded_claim", "stale_signal", "monitor_only"], note: "Shippeo AI launch is specific but dated 2025-11-06 — stale for a launch signal.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true } },
  { sig: "0f18a7c5", decision: "approved_monitor_only", tier: "C", rights: "internal_only", conf: 0.62, reasons: ["correct_company", "grounded_claim", "stale_signal", "monitor_only"], note: "Inter Rapidísimo (CO): warehouse investment announcement, real and relevant but 2025-10-31 is stale.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true } },
  // Rejections: identity broken, generic/SEO/aggregator, or publisher-as-company. Data kept.
  { sig: "bde826df", decision: "rejected", tier: "E", conf: 0.85, reasons: ["wrong_company", "generic_mention", "not_actionable"], note: "'Sales Staffing Agency' is a service page, not a company signal.", verdicts: { company_match: false, date_valid: true, claim: false } },
  { sig: "c5f9b77d", decision: "rejected", tier: "E", conf: 0.85, reasons: ["wrong_company", "generic_mention", "not_actionable"], note: "SEO hiring guide, not a company event.", verdicts: { company_match: false, date_valid: true, claim: false } },
  { sig: "fa6c4cb9", decision: "rejected", tier: "E", conf: 0.85, reasons: ["wrong_company", "generic_mention"], note: "'B2B Companies' is aggregate hiring data, not an entity.", verdicts: { company_match: false, date_valid: true, claim: false } },
  { sig: "c266376e", decision: "rejected", tier: "D", conf: 0.7, reasons: ["generic_mention", "not_actionable"], note: "Gartner rankings announcement is editorial content, not a commercial signal about Gartner.", verdicts: { company_match: true, date_valid: true, claim: false } },
  { sig: "21cac585", decision: "rejected", tier: "D", conf: 0.7, reasons: ["unsupported_claim", "generic_mention"], note: "Trends article on Phoenix Investors' site — no specific company event.", verdicts: { company_match: false, date_valid: true, claim: false } },
  { sig: "54535be6", decision: "rejected", tier: "D", conf: 0.75, reasons: ["wrong_company"], note: "Claim is about GXO/KION deployment; stored entity 'Cxtms' is the publisher domain. Real signal belongs to GXO/KION.", verdicts: { company_match: false, date_valid: true, claim: true } },
  { sig: "c2a56e80", decision: "rejected", tier: "D", conf: 0.7, reasons: ["insufficient_evidence", "generic_mention"], note: "'Newsroom - Zip' is an index page, no specific claim.", verdicts: { company_match: false, date_valid: true, claim: false } },
  { sig: "730a5a2b", decision: "rejected", tier: "D", conf: 0.75, reasons: ["wrong_company"], note: "Publisher (FoodNewsLatam) stored as company; underlying Mapei infrastructure signal may merit re-promotion under Mapei.", verdicts: { company_match: false, date_valid: true, claim: true } },
  { sig: "e1f24143", decision: "rejected", tier: "D", conf: 0.75, reasons: ["wrong_company"], note: "'Noticia' is not an entity; real signal is Mapei's Atlántico plant — re-promote under Mapei if needed.", verdicts: { company_match: false, date_valid: true, claim: true } },
  { sig: "be73da17", decision: "rejected", tier: "E", conf: 0.85, reasons: ["wrong_company", "not_actionable"], note: "Job posting title stored as company.", verdicts: { company_match: false, date_valid: true, claim: false } },
  { sig: "59561f42", decision: "rejected", tier: "E", conf: 0.85, reasons: ["wrong_company", "not_actionable"], note: "Job posting title stored as company.", verdicts: { company_match: false, date_valid: true, claim: false } },
];

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: sigs } = await db.from("vault_signals").select("id").eq("review_status", "pending_review");
  const byPrefix = new Map((sigs ?? []).map((s) => [s.id.slice(0, 8), s.id]));

  let applied = 0, customerApproved = 0, monitorOnly = 0, rejected = 0, blocked = 0;
  for (const d of DECISIONS) {
    const id = byPrefix.get(d.sig);
    if (!id) { console.log(`skip ${d.sig}: not pending (already adjudicated?)`); continue; }
    const r = await reviewVaultSignal({
      signalId: id, reviewerId: `ai:${AGENT}`, origin: "ai_assisted", reviewerAgent: AGENT,
      policyVersion: POLICY, confidence: d.conf, requiresHumanConfirmation: true,
      decision: d.decision, rightsStatus: d.rights ?? null, evidenceTier: d.tier,
      verdicts: d.verdicts, reasonCodes: d.reasons, note: d.note,
    });
    if (!r.ok) { blocked++; console.log(`BLOCKED ${d.sig}: ${r.reason}`); if (r.reason?.includes("036")) break; continue; }
    applied++;
    if (r.effective_status === "approved") customerApproved++;
    else if (r.effective_status === "approved_monitor_only") monitorOnly++;
    else if (r.effective_status === "rejected") rejected++;
  }
  console.log(JSON.stringify({ policy: POLICY, agent: AGENT, applied, customer_approved: customerApproved, monitor_only: monitorOnly, rejected, blocked, label: "AI-reviewed — requires human confirmation; NOT human-validated" }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
