// ─── AI-assisted signal adjudication v2 (policy ai-adjudication-v2) ──────────
// Individual expert decisions by Claude (claude-fable-5) over stored evidence
// for the signals promoted from the query-policy-v3 / promotion-gates-v3
// benchmark run. NEVER recorded as human review: origin=ai_assisted,
// requires_human_confirmation=true on every row. Human reviews are never
// overwritten (pending_review-only targeting). Prudent policy: max rights
// link_and_summary_allowed, tier C. Run once: npm run sources:adjudicate-v2

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
const POLICY = "ai-adjudication-v2";

interface D { match: string; decision: ReviewDecision; tier: EvidenceTier; rights?: RightsStatus; conf: number; reasons: string[]; note: string; verdicts: { company_match: boolean; date_valid: boolean; claim: boolean; signal?: boolean; opportunity?: boolean } }

// Keyed by a distinctive substring of the promoted signal claim.
const DECISIONS: D[] = [
  { match: "Echodyne Opens New Manufacturing Facility", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.75, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "Echodyne: real radar manufacturer opening a new facility on surging demand, dated 2026-07-10, trade press.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { match: "Slimstock and RETAILATAM strategic partnership", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.72, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "Slimstock: first-party dated (2026-07-16) strategic partnership; Slimstock is the announcing account, RETAILATAM secondary participant (entity-resolution-v3).", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { match: "Exol Announces Strategic Partnership with Manhattan", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.66, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "syndicated_source"], note: "Exol: real GlobeNewswire partnership with Manhattan Associates (2026-05-15); syndicated copy — corroborate original wire before customer use.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { match: "Raymond partners with Third Wave Automation", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.75, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "The Raymond Corporation: dated (2026-06-17) partnership with Third Wave Automation for physical AI on lift trucks, trade press.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { match: "Geekplus Partners with Mindugar", decision: "duplicate", tier: "C", conf: 0.85, reasons: ["duplicate_event", "syndicated_source"], note: "Duplicate of the already-approved Geek+/Mindugar partnership (same event, different outlet). Canonical signal remains the earlier approval.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true } },
  { match: "American Industrial Partners to Acquire", decision: "quarantined", tier: "D", conf: 0.6, reasons: ["insufficient_evidence", "generic_mention"], note: "Real acquisition event (AIP / Honeywell asset) but target account unresolved (PE acquirer vs acquired unit) and vendor-blog page — corroborate before any use.", verdicts: { company_match: false, date_valid: true, claim: true, signal: true } },
  { match: "Tendencys invierte medio mill", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.72, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "Tendencys: USD 0.5M investment in a new 5,000 m² Colombia warehouse, dated 2026-06-04 — concrete operational investment.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
  { match: "TIS Studios inaugura Estudio 7", decision: "approved_monitor_only", tier: "C", rights: "internal_only", conf: 0.62, reasons: ["correct_company", "valid_date", "grounded_claim", "monitor_only"], note: "TIS Studios: real dated expansion but media-production vertical — commercial relevance to ICP partial; monitor.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true } },
  { match: "EMCALI inaugura nueva planta solar", decision: "approved_monitor_only", tier: "C", rights: "internal_only", conf: 0.6, reasons: ["grounded_claim", "valid_date", "monitor_only"], note: "EMCALI: municipal public utility — real dated event but weak B2B account fit; monitor only, never customer candidate.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true } },
  { match: "WDC Networks firma alianza con Lightera", decision: "approved", tier: "C", rights: "link_and_summary_allowed", conf: 0.72, reasons: ["correct_company", "valid_date", "grounded_claim", "valid_signal", "qualified_opportunity"], note: "WDC Networks: dated (2026-07-06) alliance with Lightera, BNamericas trade press — concrete regional partnership.", verdicts: { company_match: true, date_valid: true, claim: true, signal: true, opportunity: true } },
];

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: sigs } = await db.from("vault_signals").select("id, signal_summary").eq("review_status", "pending_review");

  let applied = 0, approved = 0, monitor = 0, other = 0, blocked = 0;
  for (const d of DECISIONS) {
    const sig = (sigs ?? []).find((s) => (s.signal_summary ?? "").includes(d.match));
    if (!sig) { console.log(`skip [${d.match.slice(0, 40)}]: not pending`); continue; }
    const r = await reviewVaultSignal({
      signalId: sig.id, reviewerId: `ai:${AGENT}`, origin: "ai_assisted", reviewerAgent: AGENT,
      policyVersion: POLICY, confidence: d.conf, requiresHumanConfirmation: true,
      decision: d.decision, rightsStatus: d.rights ?? null, evidenceTier: d.tier,
      verdicts: d.verdicts, reasonCodes: d.reasons, note: d.note,
    });
    if (!r.ok) { blocked++; console.log(`BLOCKED [${d.match.slice(0, 40)}]: ${r.reason}`); continue; }
    applied++;
    if (r.effective_status === "approved") approved++;
    else if (r.effective_status === "approved_monitor_only") monitor++;
    else other++;
  }
  console.log(JSON.stringify({ policy: POLICY, agent: AGENT, applied, customer_approved: approved, monitor_only: monitor, other, blocked, label: "AI-reviewed — requires human confirmation; NOT human-validated" }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
