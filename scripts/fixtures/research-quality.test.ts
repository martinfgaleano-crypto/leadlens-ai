import {
  assessEvidenceCandidate, assessQueryQuality, buildResearchProfile, compareResearchRuns, costState,
  enforceResearchLimits, planAccountResearch, planCorroborationQuery, qualifyAccount,
  recoverAtomicClaims, sourceTier, type EvidenceCandidate, type EvidenceDecision,
} from "@/lib/intelligence/research-quality";
import { buildClientContext } from "@/lib/intelligence/evidence-temporal";

let p = 0, f = 0;
const t = (n: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${n}`); ok ? p++ : f++; };
const NOW = "2026-07-29T12:00:00.000Z";
const profile = buildResearchProfile({ company: "BioPlaza", domain: "bioplaza.com.co", country: "Colombia", city_or_region: "Bogotá", segment: "retail", structural_score: 74, verified_products_or_services: ["productos naturales"] });
const ambiguous = buildResearchProfile({ company: "Distribuidora DAM", domain: "distribuidoradam.com", country: "Colombia", segment: "distribution", structural_score: 72 });
const context = buildClientContext({ client_id: "amor", captured_at: NOW, region: "Colombia", offering: "bebidas botánicas", objective: "distribución", priority_segments: ["retail", "distribution"] });
const candidate = (over: Partial<EvidenceCandidate> = {}): EvidenceCandidate => ({
  url: "https://bioplaza.com.co/nueva-tienda", canonical_url: "https://bioplaza.com.co/nueva-tienda",
  title: "BioPlaza anuncia nueva tienda", excerpt: "La apertura será en Bogotá durante julio de 2026.",
  provider: "brave", source_type: "official", publication_date: "2026-07-01", retrieved_at: NOW, ...over,
});
const decision = (over: Partial<EvidenceDecision> = {}): EvidenceDecision => ({ ...assessEvidenceCandidate(profile, candidate(), new Set()), ...over });

t("01 profile canonical name from verified input", profile.canonical_company_name === "BioPlaza");
t("02 unknown alias is not invented", profile.known_aliases.length === 0);
t("03 unknown parent is null", profile.parent_company === null);
t("04 unknown locations remain empty", profile.known_locations.length === 0);
t("05 verified product preserved", profile.known_products_or_services[0] === "productos naturales");
t("06 ambiguous company produces risk terms", ambiguous.ambiguity_risks.length > 0);
t("07 country drives Spanish language", profile.likely_language === "es");
t("08 gaps exist before research", profile.current_evidence_gaps.includes("counterevidence"));
t("09 generic query rejected", assessQueryQuality({ query: "empresas saludables Colombia", profile, stage: "identity", target_gap: "identity" }).quality === "reject");
t("10 duplicate query rejected", assessQueryQuality({ query: "\"BioPlaza\" bioplaza.com.co Colombia", profile, stage: "identity", target_gap: "identity", previous_queries: ["\"BioPlaza\" bioplaza.com.co Colombia"] }).rejection_reasons.includes("redundant_query"));
t("11 purposeless query rejected", assessQueryQuality({ query: "\"BioPlaza\" bioplaza.com.co Colombia", profile, stage: "identity" }).rejection_reasons.includes("no_evidence_gap_purpose"));
const plan = planAccountResearch(profile, context);
t("12 bounded plan max five", plan.accepted.length + plan.rejected.length <= 5);
t("13 identity query is first", plan.accepted[0]?.stage === "identity");
t("14 counterevidence query planned", plan.accepted.some((q) => q.stage === "counterevidence"));
t("15 client query requires context", plan.accepted.some((q) => q.stage === "client_relevance"));
t("16 no context means no client query", !planAccountResearch(profile, null).accepted.some((q) => q.stage === "client_relevance"));
t("17 strong query uses account identity", plan.accepted.every((q) => q.query.includes("BioPlaza")));
t("17b official-domain queries are domain constrained", plan.accepted.filter((q) => q.stage !== "client_relevance").every((q) => q.query.includes("site:bioplaza.com.co")));
t("18 source tier A registry", sourceTier({ url: "https://rues.org.co/company", official_domain: null }).tier === "A");
t("19 official domain is tier B", sourceTier({ url: "https://bioplaza.com.co", official_domain: "bioplaza.com.co" }).tier === "B");
t("20 official social is tier C", sourceTier({ url: "https://instagram.com/bioplaza", official_domain: "bioplaza.com.co" }).tier === "C");
t("21 unknown aggregator is tier D", sourceTier({ url: "https://random-directory.example/x" }).tier === "D");
const acceptedOfficial = assessEvidenceCandidate(profile, candidate(), new Set());
t("22 official entity confirmed", acceptedOfficial.entity_state === "confirmed");
t("23 official relevant evidence accepted", acceptedOfficial.accepted);
const wrong = assessEvidenceCandidate(profile, candidate({ url: "https://futbol.co/dam", canonical_url: "https://futbol.co/dam", title: "DIMAYOR fútbol", excerpt: "Partido nacional" }), new Set());
t("24 wrong entity rejected", !wrong.accepted && wrong.reason_codes.includes("wrong_entity"));
const duplicate = assessEvidenceCandidate(profile, candidate(), new Set([candidate().canonical_url]));
t("25 duplicate evidence rejected audibly", !duplicate.accepted && duplicate.reason_codes.includes("duplicate_source"));
const lowGeneric = assessEvidenceCandidate(profile, candidate({ url: "https://directory.example/x", canonical_url: "https://directory.example/x", title: "BioPlaza", excerpt: null, source_type: null }), new Set());
t("26 tier D generic result rejected", !lowGeneric.accepted && lowGeneric.reason_codes.includes("low_quality_source"));
const noDate = assessEvidenceCandidate(profile, candidate({ publication_date: null }), new Set());
t("27 retrieval does not become publication", noDate.date_state === "retrieved_only" && noDate.candidate.publication_date === null);
t("28 rejected decision preserves candidate", wrong.candidate.title === "DIMAYOR fútbol");
const claims = recoverAtomicClaims(profile, [acceptedOfficial], NOW);
t("29 atomic activity claim recovered", claims.some((c) => c.category === "current_activity"));
t("30 fact separated from interpretation", claims[0]?.fact !== claims[0]?.interpretation);
t("31 recommendation absent from claim", claims[0]?.recommendation === null);
t("32 generic description lower priority", recoverAtomicClaims(profile, [decision({ candidate: candidate({ title: "BioPlaza empresa", excerpt: "Descripción general" }) })], NOW).length === 0);
t("33 single domain remains single source", claims[0]?.independent_source_count === 1);
const independent = decision({ decision_id: "ed2", candidate: candidate({ url: "https://businessnews.co/bioplaza", canonical_url: "https://businessnews.co/bioplaza", source_type: "news" }), entity_state: "high_confidence", entity_confidence: .9 });
const corroborated = recoverAtomicClaims(profile, [acceptedOfficial, independent], NOW);
t("34 independent domains corroborate", corroborated[0]?.corroboration_state === "corroborated");
const providerDuplicate = decision({ decision_id: "ed3", candidate: candidate({ provider: "serper" }) });
t("35 provider duplication not source diversity", recoverAtomicClaims(profile, [acceptedOfficial, providerDuplicate], NOW)[0]?.independent_source_count === 1);
const cq = planCorroborationQuery(profile, { claim_id: "c1", claim_statement: "anunció nueva tienda", known_domain: "bioplaza.com.co", known_source_tier: "B" });
t("36 corroboration query targets claim", cq.target_claim_id === "c1" && cq.query.includes("anunció nueva tienda"));
t("37 corroboration excludes known domain", cq.query.includes("-site:bioplaza.com.co"));
const footprintClaims = claims.map((c) => ({ ...c, category: "commercial_footprint" as const, freshness: "unknown" as const }));
const qualBase = { profile, claims: footprintClaims, decisions: [acceptedOfficial], context, structural_relevance: "strong" as const, counterevidence_checked: true };
const qPrioritize = qualifyAccount(qualBase);
t("38 structural+client fit without timing can prioritize/monitor", ["prioritize", "monitor"].includes(qPrioritize.state));
t("39 structural relevance alone cannot act now", qPrioritize.state !== "act_now");
t("40 every qualification has all eight gates", qPrioritize.gates.length === 8);
t("41 passed and failed gate arrays exist", Array.isArray(qPrioritize.passed_gates) && Array.isArray(qPrioritize.failed_gates));
t("42 monitor/prioritize has trigger", qPrioritize.monitoring_triggers.length > 0);
t("43 triggers specify evidence needed", qPrioritize.monitoring_triggers.every((x) => !!x.evidence_needed));
const noClient = qualifyAccount({ ...qualBase, context: null });
t("44 current/fit without client cannot act now", noClient.state !== "act_now");
t("45 no client gate not measured", noClient.gates.find((g) => g.id === "client_fit")?.state === "not_measured");
const wrongQual = qualifyAccount({ ...qualBase, decisions: [wrong], claims: [] });
t("46 wrong entity produces exclude", wrongQual.state === "exclude");
const severeNegative = { ...claims[0], claim_id: "neg", category: "negative_event" as const, confidence: .9 };
const negativeQual = qualifyAccount({ ...qualBase, claims: [severeNegative] });
t("47 severe counterevidence produces exclude", negativeQual.state === "exclude");
const investigate = qualifyAccount({ ...qualBase, decision_changing_question: "Confirmar fecha y alcance de la apertura." });
t("48 investigate requires decision-changing question", investigate.state === "investigate_now" || investigate.state === "prioritize");
t("49 counterevidence check is explicit", qPrioritize.gates.find((g) => g.id === "counterevidence")?.state === "passed");
t("50 no counterevidence found is bounded, not absolute", qPrioritize.gates.find((g) => g.id === "counterevidence")?.confidence === .5);
t("51 unmeasured provider cost remains unmeasured", costState(null, 12).state === "not_measured");
t("52 measured provider cost preserved", costState(.12, 12).state === "measured");
t("53 account cap enforced", enforceResearchLimits({ accounts: 7, queries: 0, retries: 0 }).includes("query_budget_exhausted"));
t("54 query cap enforced", enforceResearchLimits({ accounts: 6, queries: 25, retries: 0 }).includes("query_budget_exhausted"));
t("55 retry cap enforced", enforceResearchLimits({ accounts: 6, queries: 24, retries: 3 }).includes("retry_cap_reached"));
const comp1 = compareResearchRuns({ wrong_entity_evidence: 10, dated_evidence: 4, counterevidence_checks: 0, qualification_coverage: 0 }, { wrong_entity_evidence: 0, dated_evidence: 6, counterevidence_checks: 6, qualification_coverage: 6 });
const comp2 = compareResearchRuns({ wrong_entity_evidence: 10, dated_evidence: 4, counterevidence_checks: 0, qualification_coverage: 0 }, { wrong_entity_evidence: 0, dated_evidence: 6, counterevidence_checks: 6, qualification_coverage: 6 });
t("56 comparison deterministic", comp1.deterministic_key === comp2.deterministic_key);
t("57 comparison reports wrong-entity improvement", comp1.quality_changes.some((x) => x.includes("Fewer wrong-entity")));
t("58 qualification is internal-only", qPrioritize.internal_only);
t("59 immediate purchase intent remains unjustified", qPrioritize.unjustified_next_action.includes("purchase-intent"));
t("60 profile methodology is versioned", profile.methodology_version === "research-quality-v1");
const noIdentity = qualifyAccount({ ...qualBase, decisions: [], claims: [] });
t("61 missing identity cannot prioritize", !["act_now", "investigate_now", "prioritize", "monitor"].includes(noIdentity.state));
const ownedSocial = decision({ decision_id: "social", candidate: candidate({ url: "https://instagram.com/bioplaza", canonical_url: "https://instagram.com/bioplaza", source_type: null }), entity_state: "high_confidence", source_tier: "C" });
t("62 official plus owned social is one source owner", recoverAtomicClaims(profile, [acceptedOfficial, ownedSocial], NOW)[0]?.independent_source_count === 1);

console.log(`\n${p} passed, ${f} failed`);
if (f) process.exit(1);
