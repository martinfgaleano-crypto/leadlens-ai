#!/usr/bin/env node
/**
 * Decision-Driven Research P0 — LIVE BEFORE/AFTER on the SAME Track-A accounts.
 *
 * CONTROL = the previous profile-driven result (track-a-merged-report.json). For 3 of
 * those same accounts (Hillman = MONITOR + 2 HOLDs), we now run decision-driven research:
 * decision gaps → bounded customer-context objectives → TARGETED evidence → re-evaluate
 * via the existing `synthesizeCase` authority. Grounded evidence paths (no paid search,
 * which is out of credits here): SEC EDGAR free full-text search for the M&A trigger
 * (the PMI "why now"), and direct-HTTP page extraction + one bounded LLM assessment for
 * mechanism/access. Honest not_found / provider_failure where evidence cannot be grounded.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["ANTHROPIC_API_KEY"]) if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const OUT = process.env.TRACKA_OUT || "output/goldstandard/track-a";
mkdirSync(OUT, { recursive: true });
const CONTROL = `${OUT}/track-a-merged-report.json`;
const UA = { "User-Agent": "LeadLens research experiment founder@example.com", Accept: "application/json" };

const ddr = await import("@/lib/intelligence/decision-driven-research");
const { synthesizeCase } = await import("@/lib/monitor/canonical-case");
const { derivePathToPrioritize } = await import("@/lib/intelligence/path-to-prioritize");
const { extractWithFallback } = await import("@/lib/sources/access/extractors");
const { callClaudeJSON } = await import("@/lib/anthropic");
const { getUsage } = await import("@/lib/ops/usage-ledger");
const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
const { fromDeliverableViewModel } = await import("@/lib/delivery-system/delivery-document");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");
const { resolveReportExperience } = await import("@/lib/products/report-experience");
const usdNow = () => (getUsage().anthropic?.calculated_cost_usd_today ?? 0);

type Obj = import("@/lib/intelligence/decision-driven-research").ResearchObjective;
type Finding = import("@/lib/intelligence/decision-driven-research").ResearchFinding;
type CCInput = import("@/lib/monitor/canonical-case").CanonicalCaseInput;

// Track-A customer context for the research agenda (same fixture as before).
const customer: import("@/lib/intelligence/decision-driven-research").ResearchCustomerContext = {
  service: "post-merger integration (PMI) operational execution",
  triggerFamily: ["acquisition", "carve-out", "merger"],
  mechanismHints: ["integration management office", "corporate development", "external advisory engagement"],
  buyerFunctionHints: ["integration management", "operations leadership", "corporate development"],
  geography: "United States",
};
const DAYS = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

// ── Grounded researchers ──
async function edgarRecentAcquisition(company: string): Promise<{ date: string | null; url: string; total: number }> {
  const u = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${company}" acquisition`)}&forms=8-K`;
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error(`EDGAR HTTP ${r.status}`);
  const j: any = await r.json();
  const hits = (j.hits?.hits ?? []).filter((h: any) => (h._source?.display_names ?? []).some((d: string) => d.toLowerCase().includes(company.toLowerCase().split(" ")[0])));
  const dates = hits.map((h: any) => h._source?.file_date).filter(Boolean).sort().reverse();
  return { date: dates[0] ?? null, url: u, total: j.hits?.total?.value ?? 0 };
}
async function researchObjective(o: Obj, account: { company: string; domain: string | null }): Promise<Finding> {
  try {
    if (o.dimension === "trigger") {
      const e = await edgarRecentAcquisition(account.company);
      if (!e.date) return { state: "not_found", result: `No acquisition-related 8-K found in SEC EDGAR full-text search for ${account.company}.`, sources: [{ url: e.url, title: "SEC EDGAR full-text search (8-K)", date: null }], failure: "evidence_not_found" };
      const age = DAYS(e.date);
      const current = age <= 730;
      return { state: current ? "verified" : "supported", result: `SEC EDGAR: most recent acquisition-referencing 8-K filed ${e.date} (${Math.round(age)}d ago; ${current ? "current" : "older than 24 months"}). ${e.total} acquisition-referencing 8-Ks on record.`, sources: [{ url: e.url, title: "SEC EDGAR 8-K full-text search", date: e.date }], dated: e.date };
    }
    if (o.dimension === "counterevidence") {
      const e = await edgarRecentAcquisition(account.company);
      if (e.date && DAYS(e.date) > 730) return { state: "supported", result: `Most recent acquisition 8-K is ${Math.round(DAYS(e.date))}d old (>24 months) — the integration triggered by it is likely complete; not a current opportunity.`, sources: [{ url: e.url, title: "SEC EDGAR 8-K", date: e.date }] };
      return { state: "not_found", result: "No evidence the trigger is stale or handled entirely in-house.", sources: [], failure: "evidence_not_found" };
    }
    // mechanism / access / buyer_function — direct-HTTP page + one bounded LLM assessment.
    const candidates = [account.domain ? `https://${account.domain}` : null, account.domain ? `https://${account.domain}/about` : null, account.domain ? `https://investors.${account.domain}` : null].filter((x): x is string => Boolean(x));
    let pageText = "", pageUrl = "";
    for (const url of candidates) {
      try { const ex: any = await extractWithFallback(url); const txt = ex.text ?? ex.content ?? ""; if (ex.ok && txt.length > 200) { pageText = txt.slice(0, 6000); pageUrl = url; break; } } catch { /* next */ }
    }
    if (!pageText) return { state: "not_found", result: `No public page could be retrieved to establish ${o.dimension} (direct retrieval only; paid search unavailable).`, sources: [], failure: "evidence_not_found" };
    const assess = await callClaudeJSON<{ state: "verified" | "supported" | "plausible" | "unknown" | "not_found"; result: string }>(
      `You assess ONE commercial-intelligence question from a company's own public page text, for a customer selling ${customer.service}. Be strict and evidence-bound: only "verified"/"supported" if the page text itself supports it; otherwise "plausible"/"unknown"/"not_found". Never infer buying intent. Keep result to one sentence citing what the page shows.`,
      `QUESTION: ${o.question}\nSUPPORTS IF: ${o.supportsIf}\nWEAKENS IF: ${o.weakensIf}\nPAGE (${pageUrl}):\n${pageText}`,
      400,
    );
    return { state: assess.state, result: assess.result, sources: [{ url: pageUrl, title: `${account.company} public page`, date: null }], failure: assess.state === "not_found" ? "evidence_not_found" : null };
  } catch (e) {
    return { state: "unknown", result: `Research failed: ${e instanceof Error ? e.message : String(e)}`, sources: [], failure: "provider_failure" };
  }
}

// ── Load control + pick 3 accounts ──
const control = JSON.parse(readFileSync(CONTROL, "utf8"));
const leads: any[] = control.reportJson.processed_leads;
const cases: any[] = control.reportJson.canonical_cases;
const pick = ["Hillman", "CECO", "Chart"]; // MONITOR + 2 HOLD serial acquirers (diagnostic value)
const selected = leads.filter((l) => pick.some((p) => (l.candidate.company ?? "").toLowerCase().includes(p.toLowerCase()))).slice(0, 3);
console.log(`=== DECISION-DRIVEN RESEARCH — ${selected.length} accounts ===`);
const startUsd = usdNow();

const beforeAfter: any[] = [];
for (const lead of selected) {
  const cc = cases.find((c) => c.lead_id === lead.id);
  const company = lead.candidate.company; const domain = lead.candidate.domain ?? null;
  const beforeInput: CCInput = {
    accountId: company, identityVerified: true, fromUniverse: true, signalKind: null, signalDate: null, dateConfidence: "none",
    sourceHost: null, materialEvent: false, hasMaterialCounter: false, openDecisionCritical: ["Is there a current why-now trigger for this account?"],
    priorFit: cc?.fit ?? "Strong", priorTiming: cc?.timing ?? "Limited", priorEvidence: cc?.evidence ?? "Moderate",
    independentSupportNew: false, hasPostReviewEvent: false, geographyConfirmed: true, regionRequired: false,
  };
  const beforeDecision = synthesizeCase(beforeInput).decision;
  const beforePtp = derivePathToPrioritize({ decision: beforeDecision, fit: beforeInput.priorFit, timing: beforeInput.priorTiming, evidence: beforeInput.priorEvidence, openDecisionCritical: beforeInput.openDecisionCritical, hasMaterialCounter: false, commercialMechanismVerified: false, commercialAccessVerified: false, independentlyCorroborated: false });

  const objectives = ddr.deriveResearchObjectives({ account: { company, domain }, customer, missing: { trigger: true, mechanism: true, buyerFunction: true, access: true }, openDecisionCritical: beforeInput.openDecisionCritical, fit: beforeInput.priorFit });
  const run = await ddr.runResearchAgenda(objectives, { research: (o) => researchObjective(o, { company, domain }) });

  const afterInput = ddr.applyFindingsToCaseInput(beforeInput, objectives);
  const afterCase = synthesizeCase(afterInput);
  const afterDecision = afterCase.decision;
  const afterPtp = derivePathToPrioritize({ decision: afterDecision, fit: afterInput.priorFit, timing: afterCase.timing, evidence: afterCase.evidence, openDecisionCritical: afterInput.openDecisionCritical, hasMaterialCounter: afterInput.hasMaterialCounter, commercialMechanismVerified: afterInput.channelAccessVerified === true, commercialAccessVerified: afterInput.channelAccessVerified === true, independentlyCorroborated: false });

  const dim = (d: string) => objectives.find((o) => o.dimension === d);
  console.log(`\n${company}: ${beforeDecision} → ${afterDecision} | triggerCurrent=${run.triggerCurrent} resolved=${run.resolved}/${run.attempted}`);
  for (const o of objectives) console.log(`   [${o.dimension}] ${o.status}/${o.state}${o.dated ? ` (${o.dated})` : ""}: ${(o.result ?? "").slice(0, 110)}`);

  beforeAfter.push({
    company, before: { decision: beforeDecision, whyNow: null, mechanism: "not established", buyerFunction: "not established", access: "unknown", counterevidence: "none", pathToPrioritize: beforePtp.conditions, nextAction: null },
    after: {
      decision: afterDecision, whyNow: dim("trigger")?.result ?? null, mechanism: dim("mechanism")?.result ?? "skipped (no current trigger)",
      buyerFunction: dim("access")?.result ?? "skipped", access: dim("access")?.state ?? "unknown", counterevidence: dim("counter" as any)?.result ?? dim("counterevidence")?.result ?? "none",
      pathToPrioritize: afterPtp.reachable ? afterPtp.conditions : [afterPtp.rationale], nextAction: afterCase.reasons.includes("material_counterevidence_requires_revalidation") ? "Revalidate — counterevidence present" : (run.triggerCurrent ? "Validate the mechanism/owning function before outreach" : "No active action — reconsider on a new acquisition/transformation trigger"),
    },
    objectives: objectives.map((o) => ({ dimension: o.dimension, status: o.status, state: o.state, dated: o.dated, result: o.result, sources: o.sources })),
    decisionChanged: beforeDecision !== afterDecision, triggerCurrent: run.triggerCurrent,
  });
}
writeFileSync(`${OUT}/track-a-before-after.json`, JSON.stringify({ customer: customer.service, generatedAt: new Date().toISOString(), spendUsd: usdNow() - startUsd, accounts: beforeAfter }, null, 2));
console.log(`\nbefore/after -> ${OUT}/track-a-before-after.json | spend $${(usdNow() - startUsd).toFixed(4)}`);

// ── Render an AFTER Gold-Standard artifact for the 3 accounts (reuse cached profiles + new decisions/why-now) ──
const afterLeads = selected.map((lead) => {
  const ba = beforeAfter.find((b) => b.company === lead.candidate.company);
  const trig = ba.objectives.find((o: any) => o.dimension === "trigger");
  const l = JSON.parse(JSON.stringify(lead));
  if (ba.triggerCurrent && trig?.dated) { l.candidate.signal_date = trig.dated; l.candidate.signal_type = "acquisition"; l.candidate.source_url = trig.sources?.[0]?.url ?? l.candidate.source_url; }
  l.enrichment = l.enrichment ?? {}; l.enrichment.account_research = l.enrichment.account_research ?? {};
  l.enrichment.account_research.why_now = ba.after.whyNow;
  return l;
});
const afterCanonical = selected.map((lead) => { const ba = beforeAfter.find((b) => b.company === lead.candidate.company); const cc = cases.find((c) => c.lead_id === lead.id); return { ...cc, decision: ba.after.decision }; });
const reportJson: any = { onboarding: control.reportJson.onboarding, processed_leads: afterLeads, ranked_opportunities: (control.reportJson.ranked_opportunities ?? []).filter((o: any) => afterLeads.some((l: any) => l.id === o.lead_id)), canonical_cases: afterCanonical, executive_summary: control.reportJson.executive_summary };
const meta = { job_id: `tracka_ddr_${Date.now()}`, plan: "pro", search_id: null, customer_ref: "track-a-pmi-consultancy", created_at: new Date().toISOString() };
const institutional = assembleInstitutionalReport(reportJson, meta);
const vm = fromInstitutionalReport(institutional, resolveReportExperience("premium_launch_v0", "en"));
const doc = { ...fromDeliverableViewModel(vm), premiumContext: null };
const pm = toPresentationModel(doc as any, "premium", "pdf");
const pdf = await renderPdfBuffer(pm as any);
const pdfPath = `${OUT}/LeadLens_TrackA_GoldStandard_AFTER.pdf`;
writeFileSync(pdfPath, pdf);
console.log(`AFTER artifact :: ${pdfPath} (${pdf.length} bytes, ${(pm as any).document?.accounts?.length ?? 0} accounts)`);
console.log("done");
