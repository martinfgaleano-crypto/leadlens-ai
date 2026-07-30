import {
  assessClaim, assessEntityMatch, assessFreshness, buildAccountDossier, buildAccountState, buildClientContext,
  canonicalizeEvidence, compareAccountStates, deduplicateEvidence, deriveTimingState,
  domainFromUrl, evidenceAgeDays, independentSourceKey, resolveDateState,
  type CanonicalEvidence, type ClaimAssessment,
} from "@/lib/intelligence/evidence-temporal";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${name}`); ok ? passed++ : failed++; };
const NOW = "2026-07-29T12:00:00.000Z";
const ev = (over: Partial<Parameters<typeof canonicalizeEvidence>[0]> = {}): CanonicalEvidence => canonicalizeEvidence({
  scope: "account", scope_key: "acme.co", url: "https://acme.co/news?id=1&utm_source=x",
  publisher: "ACME", source_type: "official", provider: "brave", title: "Expansion",
  excerpt: "ACME abrió una nueva sede.", claim_type: "commercial_signal",
  publication_date: "2026-07-20", retrieved_at: NOW, entity_match: "ACME",
  entity_match_confidence: .95, source_quality: .8, ...over,
});
const claim = (links: Parameters<typeof assessClaim>[0]["links"], over: Partial<Parameters<typeof assessClaim>[0]> = {}): ClaimAssessment =>
  assessClaim({ scope: "account", scope_key: "acme.co", category: "commercial_signal", statement: "ACME se expandió", links, now: NOW, ...over });

const e1 = ev();
const e2 = ev({ url: "https://reuters.com/acme-expansion", publisher: "Reuters", source_type: "news", provider: "serper", provider_result_id: "2", source_quality: .95 });
const e3 = ev({ url: "https://registry.gov.co/acme", publisher: "Registro empresarial", source_type: "regulatory", provider: "tavily", provider_result_id: "3", source_quality: .9 });

t("01 canonical URL strips tracking", e1.canonical_url === "https://acme.co/news?id=1");
t("02 domain strips www", domainFromUrl("https://www.Acme.co/x") === "acme.co");
t("03 invalid URL has null domain", domainFromUrl("x") === null);
t("04 deterministic evidence id", ev().evidence_id === e1.evidence_id);
t("05 different provider result changes id", ev({ provider_result_id: "x" }).evidence_id !== e1.evidence_id);
t("06 exact date state", resolveDateState({ publication_date: "2026-01-01" }) === "exact");
t("07 inferred date state", resolveDateState({ publication_date: "2026-01-01", inferred: true }) === "inferred");
t("08 conflicting date wins", resolveDateState({ publication_date: "2026-01-01", conflict: true }) === "conflicting");
t("09 invalid date state", resolveDateState({ publication_date: "not-a-date" }) === "invalid");
t("10 retrieved-only is explicit", resolveDateState({ retrieved_at: NOW }) === "retrieved_only");
t("11 unknown date state", resolveDateState({}) === "unknown");
t("12 invalid publication is not persisted as date", ev({ publication_date: "x" }).publication_date === null);
t("13 confidence clamps high", ev({ source_quality: 3 }).source_quality === 1);
t("14 confidence clamps low", ev({ entity_match_confidence: -1 }).entity_match_confidence === 0);
t("15 age calculation", evidenceAgeDays(e1, NOW) === 9);
t("16 no publication means unknown age", evidenceAgeDays(ev({ publication_date: null }), NOW) === null);
t("17 commercial evidence is fresh", assessFreshness("commercial_signal", [e1], NOW) === "fresh");
t("18 timing becomes stale sooner", assessFreshness("timing", [ev({ publication_date: "2026-01-01" })], NOW) === "stale");
t("19 identity stays recent longer", assessFreshness("identity", [ev({ publication_date: "2025-10-01" })], NOW) === "fresh");
t("20 no dates means unknown freshness", assessFreshness("other", [ev({ publication_date: null })], NOW) === "unknown");
t("21 duplicate canonical evidence counts once", deduplicateEvidence([e1, ev({ source_quality: .2 })]).length === 1);
const syndicated = ev({ url: "https://copy.co/story", publisher: "Copy", syndicated_from: "wire:123" });
const syndicated2 = ev({ url: "https://copy2.co/story", publisher: "Copy2", syndicated_from: "wire:123" });
t("22 syndicated copies count once", deduplicateEvidence([syndicated, syndicated2]).length === 1);
t("23 syndicated independent key is origin", independentSourceKey(syndicated) === "syndicated:wire:123");
t("24 unsupported claim", claim([]).corroboration_state === "unsupported");
t("25 single source claim", claim([{ evidence: e1, relation: "supports" }]).corroboration_state === "single_source");
t("26 two diverse independent sources corroborate", claim([{ evidence: e1, relation: "supports" }, { evidence: e2, relation: "supports" }]).corroboration_state === "corroborated");
t("27 three diverse independent sources strongly corroborate", claim([{ evidence: e1, relation: "supports" }, { evidence: e2, relation: "supports" }, { evidence: e3, relation: "supports" }]).corroboration_state === "strongly_corroborated");
t("28 same source class only partially corroborates", claim([{ evidence: e1, relation: "supports" }, { evidence: ev({ url: "https://other.co/x", publisher: "Other" }), relation: "supports" }]).corroboration_state === "partially_corroborated");
t("29 contradiction is explicit", claim([{ evidence: e1, relation: "supports" }, { evidence: e2, relation: "contradicts" }]).corroboration_state === "contradicted");
t("30 incompatible semantics do not support", claim([{ evidence: e1, relation: "supports", semantic_compatibility: .2 }]).support_count === 0);
t("31 incompatible time does not support", claim([{ evidence: e1, relation: "supports", time_compatible: false }]).support_count === 0);
t("32 weak entity match does not support", claim([{ evidence: ev({ entity_match_confidence: .2 }), relation: "supports" }]).support_count === 0);
t("33 duplicate links do not inflate support", claim([{ evidence: e1, relation: "supports" }, { evidence: ev(), relation: "supports" }]).support_count === 1);
t("34 contradiction reduces confidence", claim([{ evidence: e1, relation: "supports" }, { evidence: e2, relation: "contradicts" }]).confidence < claim([{ evidence: e1, relation: "supports" }]).confidence);
t("35 claim id deterministic", claim([]).claim_id === claim([]).claim_id);
const oldTiming = claim([{ evidence: ev({ publication_date: "2025-01-01", claim_type: "timing" }), relation: "supports" }], { category: "timing" });
t("36 stale dynamic claim is stale", oldTiming.corroboration_state === "stale");
t("37 explicit context records unknowns", buildClientContext({ client_id: "c", captured_at: NOW }).unknown_fields.length === 3);
const ctx = buildClientContext({ client_id: "c", captured_at: NOW, region: " Colombia ", offering: "té", objective: "distribución", priority_segments: ["retail"] });
t("38 context trims explicit values", ctx.region === "Colombia" && ctx.unknown_fields.length === 0);
const corroborated = claim([{ evidence: e1, relation: "supports" }, { evidence: e2, relation: "supports" }]);
t("39 fresh corroborated timing is current", deriveTimingState([{ ...corroborated, category: "timing" }]) === "current_opportunity");
t("40 single fresh timing is monitor", deriveTimingState([{ ...claim([{ evidence: e1, relation: "supports" }]), category: "timing" }]) === "monitor");
t("41 structural evidence is structural-only", deriveTimingState([{ ...claim([{ evidence: e1, relation: "supports" }]), category: "structural_fit" }]) === "structural_only");
t("42 no evidence is insufficient", deriveTimingState([]) === "insufficient_evidence");
const input = { account_key: "acme.co", client_id: "c", observed_at: NOW, claims: [corroborated], structural_score: 70 };
const state1 = buildAccountState(input);
t("43 first state is not measured", state1.material_changes[0]?.state === "not_measured");
const stateRepeat = buildAccountState(input, state1);
t("44 identical state is idempotent", stateRepeat.state_id === state1.state_id && stateRepeat.material_changes.length === 0);
const changed = buildAccountState({ ...input, structural_score: 76 }, state1);
t("45 score change threshold is material", changed.material_changes.some((c) => c.field === "structural_score"));
t("46 sub-threshold score change ignored", compareAccountStates(state1, { ...input, structural_score: 73 }).every((c) => c.field !== "structural_score"));
const dossier = buildAccountDossier({ name: "ACME", domain: "acme.co", country: "Colombia", segment: "retail", state: state1, context: ctx });
t("47 dossier remains internal", dossier.internal_only === true);
t("48 explicit segment match only", dossier.commercial.client_relevance === "explicit_match");
t("49 dossier exposes evidence counts", dossier.evidence.independent_sources === 2);
t("50 review candidate needs corroboration", dossier.decision.state === "review_candidate");
const noContext = buildAccountDossier({ name: "ACME", domain: "acme.co", country: null, segment: null, state: buildAccountState({ ...input, claims: [] }), context: null });
t("51 absent context is not inferred", noContext.commercial.client_relevance === "not_assessed");
t("52 absent context is a limitation", noContext.limitations.some((x) => x.includes("Client context unavailable")));
t("53 official domain is a strong entity match", assessEntityMatch({ company: "Distribuidora DAM", domain: "distribuidoradam.com", url: "https://distribuidoradam.com/nosotros" }) === .99);
t("54 unrelated DAM acronym is rejected", assessEntityMatch({ company: "Distribuidora DAM", domain: "distribuidoradam.com", url: "https://dimayor.com.co", title: "Fútbol femenino", excerpt: "Proyecto deportivo" }) === .25);
t("55 full company mention is accepted", assessEntityMatch({ company: "Tu Tienda Saludable", domain: null, url: "https://news.co/x", title: "Tu Tienda Saludable abre sede" }) === .9);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
