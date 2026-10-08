#!/usr/bin/env node
/**
 * Commercial Path P0 — LIVE V3 on the SAME accounts (CECO, Hillman). Extends the
 * decision-driven research with buyer-function → EXTERNAL mechanism → access, using the
 * mandatory guards (§54 acquisition≠mechanism, §55 person≠access). Grounded free sources
 * only (paid search is out of credits): SEC EDGAR full-text (8-K/10-K/DEF 14A) + direct
 * HTTP page + bounded LLM assessment that is ALWAYS post-filtered by the deterministic
 * guards. Produces a V1/V2/V3 comparison + a V3 Gold-Standard artifact. Kanebridge (§47)
 * is independently checked against EDGAR and only kept if grounded.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["ANTHROPIC_API_KEY"]) if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const OUT = process.env.TRACKA_OUT || "output/goldstandard/track-a";
mkdirSync(OUT, { recursive: true });
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
type EvidenceState = import("@/lib/intelligence/decision-driven-research").EvidenceState;
type CCInput = import("@/lib/monitor/canonical-case").CanonicalCaseInput;

const customer: import("@/lib/intelligence/decision-driven-research").ResearchCustomerContext = {
  service: "post-merger integration (PMI) operational execution",
  triggerFamily: ["acquisition", "carve-out", "merger"],
  mechanismHints: ["integration management office", "external integration advisory", "transformation consulting"],
  buyerFunctionHints: ["corporate development", "integration management", "operations leadership"],
  geography: "United States",
};
const DAYS = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

async function edgarFTS(phrase: string, forms?: string): Promise<{ total: number; hits: Array<{ date: string | null; names: string[]; form: string | null }>; url: string }> {
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(phrase)}${forms ? `&forms=${forms}` : ""}`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`EDGAR HTTP ${r.status}`);
  const j: any = await r.json();
  const hits = (j.hits?.hits ?? []).map((h: any) => ({ date: h._source?.file_date ?? null, names: h._source?.display_names ?? [], form: h._source?.root_form ?? h._source?.file_type ?? null }));
  return { total: j.hits?.total?.value ?? 0, hits, url };
}
const nameMatches = (names: string[], company: string) => names.some((d) => d.toLowerCase().includes(company.toLowerCase().split(" ")[0]));

async function assessPage(url: string, o: Obj): Promise<{ state: EvidenceState; result: string; src: { url: string; title: string | null; date: string | null } | null }> {
  let text = "", used = "";
  for (const u of [url]) { try { const ex: any = await extractWithFallback(u); const t = ex.text ?? ex.content ?? ""; if (ex.ok && t.length > 200) { text = t.slice(0, 6000); used = u; break; } } catch { /* next */ } }
  if (!text) return { state: "not_found", result: "No public page retrievable (direct retrieval only; paid search unavailable).", src: null };
  const a = await callClaudeJSON<{ state: EvidenceState; result: string }>(
    `You assess ONE commercial-intelligence question from a company's own page text, for a customer selling ${customer.service}. Strict + evidence-bound. Never infer buying intent. The account's OWN acquisition activity is NOT evidence of an external mechanism. A named person is NOT access. One sentence citing what the page shows.`,
    `QUESTION: ${o.question}\nSUPPORTS IF: ${o.supportsIf}\nWEAKENS IF: ${o.weakensIf}\nPAGE (${used}):\n${text}`, 400);
  return { state: a.state, result: a.result, src: { url: used, title: `${o.question.slice(0, 40)}`, date: null } };
}

function makeResearcher(company: string, domain: string | null) {
  return async (o: Obj): Promise<Finding> => {
    try {
      if (o.dimension === "trigger") {
        const e = await edgarFTS(`"${company}" acquisition`, "8-K");
        const hits = e.hits.filter((h) => nameMatches(h.names, company) && h.date).sort((a, b) => (a.date! < b.date! ? 1 : -1));
        if (!hits.length) return { state: "not_found", result: `No acquisition-referencing 8-K in SEC EDGAR for ${company}.`, sources: [{ url: e.url, title: "SEC EDGAR 8-K search", date: null }], failure: "evidence_not_found" };
        const age = DAYS(hits[0].date!); const current = age <= 730;
        return { state: current ? "verified" : "supported", result: `SEC EDGAR: most recent acquisition-referencing 8-K filed ${hits[0].date} (${Math.round(age)}d ago; ${current ? "current" : "older than 24 months"}).`, sources: [{ url: e.url, title: "SEC EDGAR 8-K full-text", date: hits[0].date }], dated: hits[0].date };
      }
      if (o.dimension === "counterevidence") {
        const e = await edgarFTS(`"${company}" acquisition`, "8-K");
        const hits = e.hits.filter((h) => nameMatches(h.names, company) && h.date).sort((a, b) => (a.date! < b.date! ? 1 : -1));
        if (hits.length && DAYS(hits[0].date!) > 730) return { state: "supported", result: `Most recent acquisition 8-K is ${Math.round(DAYS(hits[0].date!))}d old (>24mo) — triggered integration likely complete.`, sources: [{ url: e.url, title: "SEC EDGAR 8-K", date: hits[0].date }] };
        return { state: "not_found", result: "No evidence the trigger is stale or handled strictly in-house.", sources: [], failure: "evidence_not_found" };
      }
      if (o.dimension === "buyer_function") {
        // Primary source: proxy / 10-K naming the relevant function. EDGAR FTS over the company's filings.
        const e = await edgarFTS(`"${company}" "corporate development"`);
        const hit = e.hits.filter((h) => nameMatches(h.names, company) && h.date).sort((a, b) => (a.date! < b.date! ? 1 : -1))[0];
        if (hit) return { state: "supported", result: `SEC filing (${hit.form ?? "filing"}, ${hit.date}) references a Corporate Development function — the plausible owner of post-close integration.`, sources: [{ url: e.url, title: "SEC EDGAR full-text", date: hit.date }] };
        // Fall back to organizational inference (clearly labeled, never verified).
        return { state: "inferred", result: `No primary source assigns ownership; by organizational logic Corporate Development / Operations would own post-acquisition integration at ${company}. Inference, not verified.`, sources: [], failure: "evidence_not_found" };
      }
      if (o.dimension === "mechanism") {
        // A filing merely CO-OCCURRING the words "integration"/"advisor" is NOT evidence
        // the account engages EXTERNAL PMI advisors — it is almost always the acquisition
        // announcement itself (post-merger integration PLAN + transaction bankers, §39/§54).
        // Establishing a real mechanism needs parsed filing-body/case-study language stating
        // the account ENGAGES external integration consultants, which free full-text
        // co-occurrence cannot confirm. So this is honestly NOT ESTABLISHED (not "does not
        // exist", §45). We do not route explanatory prose through the keyword guard.
        return { state: "not_found", result: `No primary-source evidence that ${company} engages EXTERNAL post-merger-integration advisors was established; a recent filing's use of "integration"/"advisor" reflects the acquisition announcement (integration plan + transaction advisors), not a services mechanism.`, sources: [], failure: "evidence_not_found" };
      }
      if (o.dimension === "access") {
        // Direct page (procurement / corp-dev) then GUARD. Paid search unavailable.
        const candidates = [domain ? `https://${domain}` : null, domain ? `https://${domain}/suppliers` : null].filter((x): x is string => Boolean(x));
        let raw = { state: "not_found" as EvidenceState, result: "No access route retrievable.", src: null as any };
        for (const u of candidates) { const a = await assessPage(u, o); if (a.state !== "not_found") { raw = a; break; } if (!raw.src && a.src) raw = a; }
        const guarded = ddr.accessStateFromEvidence(raw.result ?? "", raw.state);
        return { state: guarded.state, result: `${guarded.note}${raw.result ? ` ${raw.result}` : ""}`.slice(0, 240), sources: raw.src ? [raw.src] : [], failure: guarded.state === "not_found" ? "evidence_not_found" : null };
      }
      return { state: "unknown", result: "n/a", sources: [] };
    } catch (e) { return { state: "unknown", result: `Research failed: ${e instanceof Error ? e.message : String(e)}`, sources: [], failure: "provider_failure" }; }
  };
}

// Kanebridge verification (§47).
async function verifyKanebridge(): Promise<{ grounded: boolean; note: string; url: string }> {
  try { const e = await edgarFTS(`"Kanebridge"`); const hit = e.hits.find((h) => nameMatches(h.names, "Hillman") || (h.names.join(" ").toLowerCase().includes("kanebridge"))); return { grounded: Boolean(hit), note: hit ? `SEC filing references Kanebridge (${hit.date}).` : "No SEC filing independently references a Hillman–Kanebridge transaction in full-text search.", url: e.url }; } catch (e) { return { grounded: false, note: `EDGAR check failed: ${e instanceof Error ? e.message : e}`, url: "" }; }
}

// ── Load control (V2) ──
const control = JSON.parse(readFileSync(`${OUT}/track-a-merged-report.json`, "utf8"));
const v2 = JSON.parse(readFileSync(`${OUT}/track-a-before-after.json`, "utf8"));
const leads: any[] = control.reportJson.processed_leads;
const cases: any[] = control.reportJson.canonical_cases;
const pick = ["Hillman", "CECO"];
const selected = leads.filter((l) => pick.some((p) => (l.candidate.company ?? "").toLowerCase().includes(p.toLowerCase()))).slice(0, 2);
console.log(`=== COMMERCIAL PATH V3 — ${selected.length} accounts ===`);
const startUsd = usdNow();
const kane = await verifyKanebridge();
console.log(`Kanebridge check: grounded=${kane.grounded} — ${kane.note}`);

const comparison: any[] = [];
const v3Leads: any[] = [];
const v3Canonical: any[] = [];
const v3Path = new Map<string, any>();
for (const lead of selected) {
  const company = lead.candidate.company; const domain = lead.candidate.domain ?? null;
  const cc = cases.find((c) => c.lead_id === lead.id);
  const v2acct = (v2.accounts ?? []).find((a: any) => a.company.toLowerCase().includes(company.toLowerCase().split(" ")[0]));
  const beforeInput: CCInput = { accountId: company, identityVerified: true, fromUniverse: true, signalKind: null, signalDate: null, dateConfidence: "none", sourceHost: null, materialEvent: false, hasMaterialCounter: false, openDecisionCritical: ["Is there a current why-now trigger?"], priorFit: cc?.fit ?? "Strong", priorTiming: cc?.timing ?? "Limited", priorEvidence: cc?.evidence ?? "Moderate", independentSupportNew: false, hasPostReviewEvent: false, geographyConfirmed: true, regionRequired: false };

  const objectives = ddr.deriveResearchObjectives({ account: { company, domain }, customer, missing: { trigger: true, mechanism: true, buyerFunction: true, access: true }, openDecisionCritical: beforeInput.openDecisionCritical, fit: beforeInput.priorFit });
  const run = await ddr.runResearchAgenda(objectives, { research: makeResearcher(company, domain) });
  const afterInput = ddr.applyFindingsToCaseInput(beforeInput, objectives);
  const afterCase = synthesizeCase(afterInput);
  const dim = (d: string) => objectives.find((o) => o.dimension === d);
  const afterPtp = derivePathToPrioritize({ decision: afterCase.decision, fit: afterInput.priorFit, timing: afterCase.timing, evidence: afterCase.evidence, openDecisionCritical: afterInput.openDecisionCritical, hasMaterialCounter: afterInput.hasMaterialCounter, commercialMechanismVerified: afterInput.channelAccessVerified === true, commercialAccessVerified: afterInput.channelAccessVerified === true, independentlyCorroborated: false });

  console.log(`\n${company}: V2=${v2acct?.after?.decision ?? "?"} → V3=${afterCase.decision} | triggerCurrent=${run.triggerCurrent}`);
  for (const o of objectives) console.log(`   [${o.dimension}] ${o.status}/${o.state}: ${(o.result ?? "").slice(0, 100)}`);

  comparison.push({
    company,
    v1: { decision: "hold", whyNow: null, buyerFunction: "not established", mechanism: "not established", access: "unknown", nextAction: null },
    v2: { decision: v2acct?.after?.decision ?? "validate", whyNow: v2acct?.after?.whyNow ?? null, buyerFunction: "not established", mechanism: v2acct?.after?.mechanism ?? "not established", access: "unknown", nextAction: v2acct?.after?.nextAction ?? null },
    v3: {
      decision: afterCase.decision, commercialProblem: ddr.deriveCommercialProblem(customer, dim("trigger")?.result ?? null),
      whyNow: dim("trigger")?.result ?? null, buyerFunction: `${dim("buyer_function")?.state}: ${dim("buyer_function")?.result}`,
      mechanism: `${dim("mechanism")?.state}: ${dim("mechanism")?.result}`, access: `${dim("access")?.state}: ${dim("access")?.result}`,
      counterevidence: dim("counterevidence")?.result, criticalUnknown: afterInput.openDecisionCritical,
      pathToPrioritize: afterPtp.reachable ? afterPtp.conditions : [afterPtp.rationale],
      nextAction: run.triggerCurrent ? `Validate with ${customer.buyerFunctionHints[0]} whether post-close integration remains active and whether external PMI support is used, before allocating outbound effort.` : "No active action — reconsider on a new acquisition/transformation trigger.",
    },
    objectives: objectives.map((o) => ({ dimension: o.dimension, status: o.status, state: o.state, dated: o.dated, result: o.result, sources: o.sources })),
  });

  // Build V3 render lead: grounded why_now + guarded path; drop unverified Kanebridge specifics unless grounded.
  const l = JSON.parse(JSON.stringify(lead));
  if (run.triggerCurrent && dim("trigger")?.dated) { l.candidate.signal_date = dim("trigger")!.dated; l.candidate.signal_type = "acquisition"; l.candidate.source_url = dim("trigger")!.sources?.[0]?.url ?? l.candidate.source_url; }
  const bf = dim("buyer_function");
  // §47: Kanebridge specifics kept only if grounded; otherwise reframed. Applied to the
  // SOURCE why_now text (what the assembler actually reads), not the ignored opportunity_case.
  const scrub = (s: string | null): string | null => (!s || kane.grounded) ? s : s.replace(/kanebridge[^.]*\$?\d[\d.,]*\s*(m|million|billion|b)?[^.]*\.?/gi, "a recent acquisition (specific terms not independently verified).");
  const whyNowV3 = scrub(dim("trigger")?.result ?? null);
  const nextActionV3 = run.triggerCurrent
    ? `Validate with ${customer.buyerFunctionHints[0]} whether post-close integration remains active and whether external PMI specialists are used, before allocating outbound effort.`
    : "No active action — reconsider on a new acquisition or transformation trigger.";
  // Feed the commercial path through opp.decision.* — the SOURCE fields the institutional
  // assembler reads (L51/L134/L205) to build the dossier, opportunity_case and buyer_type.
  v3Path.set(lead.id, {
    why_now: whyNowV3,
    recommended_action: nextActionV3,
    buyer_function: bf?.state === "supported" ? "Corporate Development (SEC-supported owner of post-close integration)" : "Corporate Development / Operations (inferred owner — not verified)",
    account_role: "Potential client",
    account_research: {
      commercial_mechanism_note: `EXTERNAL post-merger-integration mechanism NOT established (not disproven): ${dim("mechanism")?.result ?? ""}`,
      access_note: `Commercial access route not established: ${dim("access")?.result ?? ""}`,
      counterevidence: dim("counterevidence")?.result ?? "No disqualifying counterevidence found.",
    },
  });
  v3Leads.push(l);
  v3Canonical.push({ ...cc, decision: afterCase.decision });
}
writeFileSync(`${OUT}/track-a-v1-v2-v3.json`, JSON.stringify({ customer: customer.service, kanebridge: kane, generatedAt: new Date().toISOString(), spendUsd: usdNow() - startUsd, accounts: comparison }, null, 2));
console.log(`\nV1/V2/V3 -> ${OUT}/track-a-v1-v2-v3.json | spend $${(usdNow() - startUsd).toFixed(4)}`);

const rankedV3 = (control.reportJson.ranked_opportunities ?? []).filter((o: any) => v3Leads.some((l: any) => l.id === o.lead_id))
  .map((o: any) => { const p = v3Path.get(o.lead_id); if (!p) return o; return { ...o, decision: { ...(o.decision ?? {}), why_now: p.why_now, recommended_action: p.recommended_action, buyer_function: p.buyer_function, account_role: p.account_role } }; });
// Also feed buyer-function/mechanism/access notes into each lead's enrichment (read by the assembler's evidence/why paths).
for (const l of v3Leads) { const p = v3Path.get(l.id); if (!p) continue; l.enrichment = l.enrichment ?? {}; l.enrichment.why_now = p.why_now; l.enrichment.recommended_action = p.recommended_action; l.enrichment.account_research = { ...(l.enrichment.account_research ?? {}), ...p.account_research, why_now: p.why_now }; }
const reportJson: any = { onboarding: control.reportJson.onboarding, processed_leads: v3Leads, ranked_opportunities: rankedV3, canonical_cases: v3Canonical, executive_summary: control.reportJson.executive_summary };
const meta = { job_id: `tracka_v3_${Date.now()}`, plan: "pro", search_id: null, customer_ref: "track-a-pmi-consultancy", created_at: new Date().toISOString() };
const institutional = assembleInstitutionalReport(reportJson, meta);
const vm = fromInstitutionalReport(institutional, resolveReportExperience("premium_launch_v0", "en"));
const doc = { ...fromDeliverableViewModel(vm), premiumContext: null };
const pm = toPresentationModel(doc as any, "premium", "pdf");
const pdf = await renderPdfBuffer(pm as any);
const pdfPath = `${OUT}/LeadLens_TrackA_GoldStandard_V3_CommercialPath.pdf`;
writeFileSync(pdfPath, pdf);
console.log(`V3 artifact :: ${pdfPath} (${pdf.length} bytes, ${(pm as any).document?.accounts?.length ?? 0} accounts)`);
console.log("done");
