import assert from "node:assert/strict";
import { buildCanonicalIntelligenceDelivery, scopeCanonicalIntelligence } from "../../lib/intelligence/canonical-intelligence-delivery";
import { evaluateCanonicalTierReadiness } from "../../lib/intelligence/advanced-tier-readiness";
import type { InstitutionalOpportunityReportV1, AccountDossier } from "../../lib/reports/institutional-report-types";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };
const dossier = (company: string, industry: string, action: AccountDossier["actionability_status"], source: boolean, access = false): AccountDossier => ({
  rank: 1, company, industry, location: "Germany", domain: `${company.toLowerCase().replace(/\s/g, "")}.example`, tier: "WARM", actionability_status: action,
  actionability_reasons: [], actionability_blockers: [], fit_score: action === "act_now" ? 9 : 7,
  thesis: { basis: "inference", text: "Industrial maintenance relevance" }, why_now: { basis: source ? "fact" : "unknown", text: source ? "A current plant program is documented." : "Timing unknown." }, why_this_company: { basis: "inference", text: "Operates production assets." }, why_this_quarter: { basis: "unknown", text: "Quarter urgency unknown." },
  risks: [{ basis: "unknown", text: "Incumbent supplier unknown." }], confidence_drivers: [], evidence_grounded: source,
  evidence_chain: source ? [{ label: "Official maintenance program", url: `https://${company}.example/program`, date: "2026-09-01", date_basis: "fact" }] : [],
  hypotheses: [{ basis: "hypothesis", text: "Validate procurement owner and maintenance budget." }], recommended_next_step: { basis: "recommendation", text: "Validate procurement route." }, playbook: null,
  opportunity_case: { fit: { value: action === "act_now" ? "Strong" : "Moderate" } } as never,
  commercial_intelligence: { route_label: industry, buyer_type: "Plant maintenance procurement", commercial_mechanism: access ? "supplier_registration" : null, access_path: access ? `https://${company}.example/suppliers` : null, access_verified: access, current_actionability: access, corroborated: false, counterevidence_researched: true },
});
const dossiers = [dossier("Werk Alpha", "Industrial maintenance", "act_now", true, true), dossier("Werk Beta", "Industrial services", "validate_first", true), dossier("Werk Gamma", "Industrial services", "monitor", false)];
const report = { metadata: { assembled_at: "2026-09-30T00:00:00Z" }, account_dossiers: dossiers } as InstitutionalOpportunityReportV1;
const intel = buildCanonicalIntelligenceDelivery(report, 18);

test("generalizes to unrelated industrial/German context", () => assert.equal(intel.scope.selected, 3));
test("market intelligence and market map are present", () => assert.equal(intel.market_map.state, "PRESENT"));
test("unknown remains Unknown rather than zero/low", () => assert.equal(intel.benchmark.accounts.find((x) => x.account === "Werk Gamma")!.cells.find((x) => x.dimension_id === "evidence")!.state, "Unknown"));
test("benchmark never changes canonical decision", () => assert.deepEqual(intel.benchmark.accounts.map((x) => x.decision), ["prioritize", "validate", "monitor"]));
test("evidence denominator equals selected population", () => assert.deepEqual(intel.evidence_coverage, { denominator: 3, usable_source: 2, validated_date: 2, recent_or_current: 2, commercial_mechanism: 1, access_path: 1, verified_access: 1, corroborated: 0, counterevidence_researched: 3 }));
test("every chart declares the actual population denominator", () => assert.ok(intel.charts.every((chart) => chart.denominator === 3)));
const scoped = scopeCanonicalIntelligence(intel, ["Werk Alpha", "Werk Gamma"])!;
test("tier scoping recomputes denominator instead of leaking full set", () => assert.ok(scoped.scope.selected === 2 && scoped.evidence_coverage.denominator === 2 && scoped.charts.every((c) => c.denominator === 2)));
test("tier scoping rewrites narrative and benchmark cell denominators", () => assert.ok(scoped.portfolio_intelligence.leadlens_read.text.includes("2-account") && scoped.benchmark.accounts.every((row) => row.cells.every((cell) => cell.denominator === 2))));
const accounts = Array.from({ length: 18 }, (_, i) => ({ key: `k${i}`, company: `C${i}`, domain: null, route: "r", decision: i === 0 ? "prioritize" as const : "hold" as const, fit: i === 0 ? "Strong" : "Moderate", timing: null, evidenceCount: 1, qualifiedAtPass: 1, hasSource: true, currentActionabilityBasis: i === 0, commercialMechanismVerified: i === 0, counterevidenceMaterial: false }));
test("Premium readiness requires canonical above-account intelligence", () => assert.equal(evaluateCanonicalTierReadiness("premium", accounts, null, true).deliveryReady, false));
test("Premium readiness passes only with capacity, actionability, intelligence and render", () => assert.equal(evaluateCanonicalTierReadiness("premium", accounts, intel, true).deliveryReady, true));

console.log(`\n${passed}/10 canonical intelligence delivery checks passed`);
