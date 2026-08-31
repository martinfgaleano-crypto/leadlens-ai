import assert from "node:assert/strict";
import { deriveAccountActionabilityFunnel, summarizeActionabilityFunnel } from "../../lib/intelligence/actionability-funnel";
import { bindVerifiedClaimToSources, stableSourceId } from "../../lib/intelligence/claim-provenance";
import { isAffirmativeCounterevidence, shouldDeepenSearchResult, type AccountDeepResearchTelemetry } from "../../lib/intelligence/account-deep-research";
import { resolveResearchConcurrency } from "../../lib/intelligence/research-concurrency";
import { enumerationRouteQueries, extractStructuredCompanyEntities, inferEnumeratedDomain, isBrandOnlyIdentity, recoverGroundedCompanyNames } from "../../lib/discovery/company-universe";
import { canonicalCaseForLead, reconcileLeadNarrativeWithCanonicalCase } from "../../lib/intelligence/productive-spine";

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`✓ ${name}`); }

const telemetry = (over: Partial<AccountDeepResearchTelemetry> = {}): AccountDeepResearchTelemetry => ({
  version: "account-deep-research-v1", account: "Acme Foods", domain: "acme.com",
  planned_queries: 4, executed_queries: 4, provider_calls: 4, provider_failures: 0,
  results_seen: 12, evidence_accepted: 2, evidence_rejected: 3, pages_extracted: 2,
  extraction_failures: 0, structured_extraction_calls: 1, dated_evidence: 2,
  independent_domains: 2, corroboration_attempted: true, corroborating_domains: 1,
  claims_recovered: 2, counterevidence_checked: true, early_stop_reason: "sufficient_evidence",
  query_audit: [], extraction_audit: [], provider_ops: [],
  validated_events: [{ url: "https://acme.com/news/new-plant?utm_source=x", source_host: "acme.com", event_date: "2026-08-20", kind: "corporate_event", claim_excerpt: "Acme Foods opened a new production plant in Ohio adding two packaging lines", stage: "current_activity", materiality_valid: true, counterevidence: false }],
  ...over,
});

const lead = (over: Record<string, unknown> = {}) => ({
  id: "lead-1", candidate: { company: "Acme Foods", domain: "acme.com", confidence_score: .9 },
  qualification: { fit_score: 8, category: "WARM" }, outreach: { qc_status: "APPROVED" },
  enrichment: { account_research: telemetry(), evidence_discipline: [] }, ...over,
}) as never;

test("01 actionable account exposes every diagnostic funnel stage", () => {
  const row = deriveAccountActionabilityFunnel(lead(), "validate", []);
  assert.equal(row.target_valid, true); assert.equal(row.temporal_valid_events, 1);
  assert.equal(row.materiality_valid_events, 1); assert.equal(row.evidence_valid, true);
  assert.equal(row.independent_support, true); assert.equal(row.hold_reason, null);
});

test("02 provider degradation is insufficient coverage, never a commercial negative", () => {
  const l = lead({ enrichment: { account_research: telemetry({ early_stop_reason: "providers_unavailable", enrichment_failed: { provider: "tavily", reason: "provider_degraded" } }) } });
  const row = deriveAccountActionabilityFunnel(l, "hold", []);
  assert.equal(row.research_coverage, "insufficient"); assert.equal(row.hold_reason, "INSUFFICIENT_COVERAGE");
});

test("03 no validated event maps to NO_CURRENT_EVENT", () => {
  const l = lead({ enrichment: { account_research: telemetry({ validated_events: [], early_stop_reason: "no_material_event" }) } });
  assert.equal(deriveAccountActionabilityFunnel(l, "hold", []).hold_reason, "NO_CURRENT_EVENT");
});

test("04 aggregate denominator and decisions remain account-based", () => {
  const rows = [deriveAccountActionabilityFunnel(lead(), "validate", []), deriveAccountActionabilityFunnel(lead({ enrichment: { account_research: telemetry({ validated_events: [] }) } }), "hold", [])];
  const out = summarizeActionabilityFunnel(rows);
  assert.equal(out.accounts, 2); assert.equal(out.decisions.validate, 1); assert.equal(out.decisions.hold, 1);
});

test("05 verified claim binds only exact validated event source", () => {
  const sources = bindVerifiedClaimToSources({ claim: "Acme Foods opened a new production plant with two packaging lines", type: "verified_public_signal", date: "2026-08-20", telemetry: telemetry() });
  assert.equal(sources.length, 1); assert.equal(sources[0].url, "https://acme.com/news/new-plant");
  assert.equal(sources[0].source_id, stableSourceId("https://acme.com/news/new-plant"));
});

test("06 claim A never inherits unrelated source B", () => {
  const t = telemetry({ validated_events: [
    ...telemetry().validated_events!,
    { url: "https://other.com/news/warehouse", source_host: "other.com", event_date: "2026-08-20", kind: "corporate_event", claim_excerpt: "Other Holdings acquired a warehouse operator in Texas", stage: "current_activity", materiality_valid: true, counterevidence: false },
  ] });
  const sources = bindVerifiedClaimToSources({ claim: "Acme Foods opened a production plant with packaging lines", type: "verified_public_signal", date: "2026-08-20", telemetry: t });
  assert.deepEqual(sources.map((source) => source.origin), ["acme.com"]);
});

test("07 inference never inherits verified URL", () => {
  assert.deepEqual(bindVerifiedClaimToSources({ claim: "Acme may need automation", type: "inferred_from_context", date: "2026-08-20", telemetry: telemetry() }), []);
});

test("08 same URL is deduplicated by stable source identity", () => {
  const event = telemetry().validated_events![0];
  const sources = bindVerifiedClaimToSources({ claim: "Acme Foods opened a new production plant adding packaging lines", type: "verified_public_signal", date: "2026-08-20", telemetry: telemetry({ validated_events: [event, { ...event, url: "https://acme.com/news/new-plant" }] }) });
  assert.equal(sources.length, 1);
});

test("09 affirmative cancellation is counterevidence", () => assert.equal(isAffirmativeCounterevidence("The company cancelled the plant expansion"), true));
test("10 unknown budget is not counterevidence", () => assert.equal(isAffirmativeCounterevidence("No public budget information was found"), false));
test("11 provider failure is not counterevidence", () => assert.equal(isAffirmativeCounterevidence("Search provider unavailable due to quota"), false));
test("12 stale event alone is not counterevidence", () => assert.equal(isAffirmativeCounterevidence("The expansion announcement is two years old"), false));
test("13 productive research defaults to validated concurrency 2", () => assert.equal(resolveResearchConcurrency(undefined), 2));
test("14 concurrency retains serial rollback and hard ceiling", () => { assert.equal(resolveResearchConcurrency("1"), 1); assert.equal(resolveResearchConcurrency("8"), 2); });
test("15 multi-industry enumeration uses alternatives, not impossible conjunction", () => {
  const queries = enumerationRouteQueries({ target_industries: ["Food manufacturing", "Beverage manufacturing", "Consumer goods manufacturing"] } as never, "United States", { target_company_profile: "manufacturers", expected_need: "capacity" } as never, false);
  assert.match(queries[0].query, /Food manufacturing.*OR.*Beverage manufacturing/);
  assert.doesNotMatch(queries[0].query, /Food manufacturing and Beverage manufacturing/);
});
test("16 thin-universe recovery keeps literal company names and rejects list headings", () => {
  const names = recoverGroundedCompanyNames([{ title: "Expansion leaders", snippet: "Conagra Brands opened a plant. Top Food Manufacturers in America." }]);
  assert.deepEqual(names, ["Conagra Brands"]);
});
test("17 identity pages never consume event extraction or structured LLM budget", () => {
  assert.equal(shouldDeepenSearchResult("identity", "high", "Company announces new plant", "Expansion"), false);
  assert.equal(shouldDeepenSearchResult("current_activity", "high", "Company announces new plant", "Expansion"), true);
});
test("18 canonical stale reason wins when stale events were rejected upstream", () => {
  const l = lead({ enrichment: { account_research: telemetry({ validated_events: [], early_stop_reason: "no_material_event" }) } });
  assert.equal(deriveAccountActionabilityFunnel(l, "hold", ["hard_blocker_stale_beyond_180d"]).hold_reason, "STALE_EVENT");
});
test("19 single-word brands are not recovered by deterministic thin-universe fallback", () => {
  const names = recoverGroundedCompanyNames([{ title: "Beverage portfolio", snippet: "Dasani and smartwater are beverage brands. Milo's Tea Company operates a plant." }]);
  assert.deepEqual(names, ["Milo's Tea Company"]);
});
test("20 directory page extracts explicitly linked companies, not the directory owner", () => {
  const entities = extractStructuredCompanyEntities('<h1>Packaging Association</h1><a href="https://www.acmepackaging.com/about">Acme Packaging Corporation</a>', "https://packagingassociation.org/members");
  assert.deepEqual(entities.map((entity) => [entity.name, entity.domain]), [["Acme Packaging Corporation", "acmepackaging.com"]]);
});
test("21 same-origin directory links and unrelated hosts cannot become corporate identities", () => {
  const entities = extractStructuredCompanyEntities('<a href="/members/acme">Acme Packaging Corporation</a><a href="https://unrelated.example">Acme Packaging Corporation</a>', "https://directory.example/members");
  assert.equal(entities.length, 0);
});
test("22 JSON-LD organization with exact outbound identity is recoverable", () => {
  const entities = extractStructuredCompanyEntities('{"@type":"Organization","name":"Beta Foods Incorporated","url":"https:\\/\\/betafoods.com"}', "https://trade.example/exhibitors");
  assert.equal(entities[0]?.domain, "betafoods.com");
});
test("23 explicit product brand identity cannot become an operating account", () => {
  assert.equal(isBrandOnlyIdentity("Hillshire Farm", [{ title: "Hillshire Farm (brand)", snippet: "Hillshire Farm is a brand of Tyson Foods", url: "https://example.org" }]), true);
  assert.equal(isBrandOnlyIdentity("Hillshire Farm", [{ title: "Smoked Sausage | Hillshire Farm® Brand", snippet: "Products", url: "https://hillshirefarm.com" }]), true);
});
test("24 a corporation that owns brands is not rejected as a brand", () => {
  assert.equal(isBrandOnlyIdentity("Tyson Foods", [{ title: "Tyson Foods", snippet: "Tyson Foods is a food company that owns multiple brands", url: "https://tysonfoods.com" }]), false);
});
test("25 generic supply token cannot assign an unrelated industry host", () => {
  assert.equal(inferEnumeratedDomain("HD Supply", [{ title: "HD Supply profile", snippet: "industrial distribution", url: "https://supplychainconnect.com/hd-supply" }]).domain, null);
  assert.equal(inferEnumeratedDomain("HD Supply", [{ title: "HD Supply", snippet: "official website", url: "https://hdsupply.com" }]).domain, "hdsupply.com");
});
test("26 LLM claim cannot create Validate when deep telemetry accepted zero events", () => {
  const l = lead({
    candidate: { company: "Bronco Wine Co.", domain: "broncowine.com", country: "United States", source_url: "https://broncowine.com/press" },
    enrichment: { account_research: telemetry({ validated_events: [], early_stop_reason: "no_material_event" }), research_confidence: 0.62, evidence_discipline: [{ claim: "Acquisition of a portfolio brand", type: "verified_public_signal", date: "2026-06-16" }], next_best_question: "Confirm plant impact." },
  } as never);
  assert.equal(canonicalCaseForLead(l as never)?.decision, "hold");
});

test("28 canonical Hold removes contradictory confirmed-now prose from customer narrative", () => {
  const l = lead({ enrichment: { account_research: telemetry({ validated_events: [], early_stop_reason: "no_material_event" }), why_now: "Confirmed: a new plant creates an active buying trigger right now." } }) as unknown as { enrichment: { why_now?: string } };
  const c = canonicalCaseForLead(l as never)!;
  assert.equal(c.decision, "hold");
  reconcileLeadNarrativeWithCanonicalCase(l as never, c);
  assert.match(l.enrichment.why_now ?? "", /No current dated material event was validated/);
  assert.doesNotMatch(l.enrichment.why_now ?? "", /Confirmed: a new plant/);
});
test("27 generic Spanish industry token cannot assign another company's domain", () => {
  assert.equal(inferEnumeratedDomain("Pepsico Alimentos Colombia Ltda.", [{ title: "Pepsico Alimentos Colombia", snippet: "fabricante", url: "https://alimentossas.com" }]).domain, null);
  assert.equal(inferEnumeratedDomain("Pepsico Alimentos Colombia Ltda.", [{ title: "PepsiCo Colombia", snippet: "sitio corporativo", url: "https://pepsico.com" }]).domain, "pepsico.com");
});

console.log(`\n${passed}/28 intelligence release-candidate contracts passed`);
