import assert from "node:assert/strict";
import {
  qualifyFromEvidence, qualifyReusedCandidates, needsReuseQualification,
  DEFAULT_REUSE_QUALIFICATION_BUDGET, adaptiveQualificationBudget, MAX_ADAPTIVE_QUALIFY,
  type CompanyEvidence, type ReuseQualificationDeps,
} from "../../lib/lead-hunter/vault-reuse-qualification";
import { prioritizeResearch } from "../../lib/lead-hunter/research-readiness";
import type { CandidateAccount, CandidateAccountUniverse, DiscoveryPlan } from "../../lib/lead-hunter/candidate-universe";
import { DEFAULT_DISCOVERY_BUDGET } from "../../lib/lead-hunter/candidate-universe";

let p = 0; const t = (n: string, ok: boolean) => { assert.equal(ok, true, n); p++; console.log(`✅ ${n}`); };

const ev = (content: string, ok = true, domain = "x.com"): CompanyEvidence => ({ domain, content, sourceUrl: `https://${domain}`, ok });
const TARGET = ["manufacturer"];

async function main() {
  // ── PURE qualifyFromEvidence ──
  t("manufacturer content matching target → QUALIFIED with neutral role",
    (() => { const r = qualifyFromEvidence(ev("We are a leading manufacturer of industrial packaging; our manufacturing plants ..."), TARGET, "Acme Packaging");
      return r.status === "QUALIFIED_FOR_RESEARCH" && r.observedRole === "manufacturer" && !!r.sourceRef; })());
  t("distributor content when target is manufacturer → REJECTED_WRONG_TARGET_TYPE",
    qualifyFromEvidence(ev("We are a wholesale distributor and distribution partner for retail brands."), TARGET, "Dist Co").status === "REJECTED_WRONG_TARGET_TYPE");
  t("logistics content matching a logistics target → QUALIFIED",
    qualifyFromEvidence(ev("Third-party logistics and freight transport across the region."), ["logistics"], "3PL Co").status === "QUALIFIED_FOR_RESEARCH");
  t("association/guild → REJECTED_NON_COMPANY (via classifyOrganization)",
    qualifyFromEvidence(ev("La Asociación Nacional de Empresarios reúne a las empresas del sector."), TARGET, "Asociación Nacional de Industriales").status === "REJECTED_NON_COMPANY");
  t("government body → REJECTED_NON_COMPANY",
    qualifyFromEvidence(ev("Ministerio de Comercio — política pública."), TARGET, "Ministerio de Comercio").status === "REJECTED_NON_COMPANY");
  t("publisher / news wire content → REJECTED_NON_COMPANY (content role evidence, not domain)",
    qualifyFromEvidence(ev("Press release distributed via PRNewswire. Subscribe to our newsletter for breaking news.", true, "prnewswire.com"), TARGET, "Colombina impulsa la modernización").status === "REJECTED_NON_COMPANY");
  t("job board content → REJECTED_NON_COMPANY",
    qualifyFromEvidence(ev("Browse jobs and apply now for thousands of jobs. Post a job today."), TARGET, "Ejecutivo Técnico Comercial").status === "REJECTED_NON_COMPANY");
  t("operating company with no role signal → UNRESOLVED (held, not excluded)",
    qualifyFromEvidence(ev("Alpina is a company with a long history and strong values serving communities."), TARGET, "Alpina").status === "UNRESOLVED_INSUFFICIENT_EVIDENCE");
  t("empty/too-short content → UNRESOLVED", qualifyFromEvidence(ev("   "), TARGET, "X").status === "UNRESOLVED_INSUFFICIENT_EVIDENCE");
  t("provider failure (ok:false) → OPS_BLOCKED, never wrong-target", qualifyFromEvidence(ev("", false), TARGET, "X").status === "OPS_BLOCKED_PROVIDER_FAILURE");

  // ── operating-role attribution (DHL fix, §7–§15) — context-dependent, generalizable ──
  const MFR = ["manufacturer"];
  // CASE A: genuine US manufacturer with self-production evidence → QUALIFIED
  t("A: genuine manufacturer (self-production evidence) → QUALIFIED",
    qualifyFromEvidence(ev("We are a manufacturer of rigid packaging; our manufacturing plants produce millions of units."), MFR, "American Packaging").status === "QUALIFIED_FOR_RESEARCH");
  // CASE B: contract-logistics operator serving manufacturers (the DHL pattern) → NOT QUALIFIED as manufacturer
  t("B: 3PL/logistics serving manufacturers → REJECTED_WRONG_TARGET_TYPE (not a manufacturer)",
    qualifyFromEvidence(ev("A leading third-party logistics and supply chain solutions provider. We run warehousing and fulfillment for manufacturers and help manufacturing customers optimize distribution."), MFR, "DHL Supply Chain").status === "REJECTED_WRONG_TARGET_TYPE");
  // CASE C: pure software vendor serving manufacturers → NOT QUALIFIED as manufacturer
  t("C: software platform for manufacturers → REJECTED_WRONG_TARGET_TYPE",
    qualifyFromEvidence(ev("Our SaaS platform helps manufacturers run their factories. We build software for manufacturing operations."), MFR, "FactoryOS").status === "REJECTED_WRONG_TARGET_TYPE");
  // CASE D: genuine manufacturer that ALSO operates distribution → QUALIFIED (self-mfg evidence present)
  t("D: manufacturer that also distributes → QUALIFIED (own manufacturing evidence)",
    qualifyFromEvidence(ev("We are a manufacturer of snack foods. We manufacture at our own production plants and also operate our distribution network of warehouses."), MFR, "Compact Industries").status === "QUALIFIED_FOR_RESEARCH");
  // CASE E: ambiguous — logistics-provider role but NO self-manufacturing evidence → not auto-qualified
  t("E: ambiguous logistics-provider role, no self-mfg evidence → NOT qualified",
    qualifyFromEvidence(ev("We provide contract logistics and fulfillment services. Manufacturing sector expertise."), MFR, "Ambiguous Co").status !== "QUALIFIED_FOR_RESEARCH");
  // CASE F: the SAME logistics company under a logistics-targeting ICP → QUALIFIED (context-dependent)
  t("F: logistics company under a logistics-targeting ICP → QUALIFIED (not globally excluded)",
    qualifyFromEvidence(ev("A leading third-party logistics and supply chain solutions provider running warehousing and fulfillment."), ["logistics"], "DHL Supply Chain").status === "QUALIFIED_FOR_RESEARCH");
  // Guard is precise: a real manufacturer with NO conflicting service role still qualifies without explicit "we manufacture".
  t("no conflicting service role → keyword-level manufacturer still qualifies",
    qualifyFromEvidence(ev("Industrial manufacturing company. Producer of automotive components for the industrial sector."), MFR, "Acme Industrial").status === "QUALIFIED_FOR_RESEARCH");
  // A factory-ish NAME must NOT qualify without content evidence (§10).
  t("factory-sounding name but no content evidence → NOT qualified on name alone",
    qualifyFromEvidence(ev("", false), TARGET, "Global Manufacturing Solutions").status !== "QUALIFIED_FOR_RESEARCH");

  // ── needsReuseQualification predicate ──
  const reused = (over: Partial<CandidateAccount["identity"]> = {}, status: CandidateAccount["status"] = "needs_validation"): CandidateAccount => ({
    identity: { canonicalName: "Reused Co", domain: "reused.com", country: "Colombia", confidence: "verified", ...over },
    status, statusReason: "", provenance: [{ route: "verified_identity_reuse", origin: "vault_reuse", provider: "vault", discoveredName: "Reused Co", discoveredAt: "2026-01-01" }],
    originFlags: ["VAULT_REUSED"], opportunityConditionIds: [], watchSignalFamilies: [], openQualificationQuestions: [],
  });
  t("qualifies only reused, in-scope, domain-verified, type-unknown identities", needsReuseQualification(reused()));
  t("skips a reused identity that already has an org type", !needsReuseQualification(reused({ organizationType: "manufacturer" })));
  t("skips an excluded reused identity", !needsReuseQualification(reused({}, "excluded")));
  t("skips a non-reused (fresh) candidate", !needsReuseQualification({ ...reused(), originFlags: ["ACCOUNT_FIRST"] }));

  // ── orchestrator: enrichment on a working copy, persisted snapshot immutable ──
  const plan: DiscoveryPlan = {
    contextRef: { contextId: "c", version: 1 }, objectiveType: "sell", targetRelationship: "customer",
    organizationTypes: ["manufacturer"], industries: ["packaging"], geographies: ["Colombia"],
    routes: [], exclusions: [], namedAccountSeeds: [], watchSignalFamilies: [], budget: DEFAULT_DISCOVERY_BUDGET, planGaps: [],
  };
  const mk = (name: string, domain: string): CandidateAccount => ({ ...reused({ canonicalName: name, domain }) });
  const universe: CandidateAccountUniverse = {
    runId: "r", contextRef: plan.contextRef, generatedAt: "2026-01-01", plan,
    candidates: [
      { identity: { canonicalName: "Fresh Mfr", domain: "fresh.com", country: "Colombia", organizationType: "manufacturer", confidence: "verified" }, status: "eligible", statusReason: "", provenance: [{ route: "engine", origin: "vertical_seed", provider: "engine", discoveredName: "Fresh Mfr", discoveredAt: "2026-01-01" }], originFlags: ["ACCOUNT_FIRST"], opportunityConditionIds: [], watchSignalFamilies: [], openQualificationQuestions: [] },
      mk("Colpack", "colpack.com"),       // → manufacturer content → qualified
      mk("DistribCo", "distribco.com"),    // → distributor content → wrong target
      mk("PressWire", "prnewswire.com"),   // → publisher → non-company
      mk("Opaque SA", "opaque.com"),       // → no role signal → unresolved
    ],
    coverage: {} as never, reviewRequired: [], ok: true,
  };
  const contentByDomain: Record<string, CompanyEvidence> = {
    "colpack.com": ev("We manufacture rigid packaging in our manufacturing facilities.", true, "colpack.com"),
    "distribco.com": ev("Wholesale distributor and distribution network for retailers.", true, "distribco.com"),
    "prnewswire.com": ev("Press release distributed via newswire. Breaking news.", true, "prnewswire.com"),
    "opaque.com": ev("A proud company serving customers since 1950.", true, "opaque.com"),
  };
  const deps: ReuseQualificationDeps = { fetchCompanyEvidence: async ({ domain }) => contentByDomain[domain] ?? ev("", false, domain) };
  const { universe: enriched, metrics } = await qualifyReusedCandidates(universe, deps);

  t("persisted universe is NOT mutated (immutable snapshot)",
    universe.candidates[1].identity.organizationType === undefined && universe.candidates[2].status === "needs_validation");
  t("metrics: 1 qualified, 1 wrong-target, 1 non-company, 1 unresolved",
    metrics.qualified === 1 && metrics.rejectedWrongTarget === 1 && metrics.rejectedNonCompany === 1 && metrics.unresolved === 1);
  const col = enriched.candidates.find((c) => c.identity.canonicalName === "Colpack")!;
  const dist = enriched.candidates.find((c) => c.identity.canonicalName === "DistribCo")!;
  const wire = enriched.candidates.find((c) => c.identity.canonicalName === "PressWire")!;
  const opaque = enriched.candidates.find((c) => c.identity.canonicalName === "Opaque SA")!;
  t("qualified reused identity gets a neutral source-verified org type", col.identity.organizationType === "manufacturer" && col.status === "needs_validation");
  t("wrong-target reused identity is excluded", dist.status === "excluded");
  t("non-company reused identity is excluded", wire.status === "excluded");
  t("unresolved reused identity is held (not excluded, not researched)", opaque.status === "needs_validation" && opaque.identity.organizationType === undefined);

  // ── END-TO-END: qualified reused identity now REACHES Research; wrong ones do not ──
  const ready = prioritizeResearch(enriched.candidates, enriched.plan);
  const readyNames = ready.map((c) => c.identity.canonicalName);
  t("BLOCKER CLOSED: qualified reused operator now reaches Research", readyNames.includes("Colpack"));
  t("wrong-target reused identity still does NOT reach Research (wrong_target_type preserved)", !readyNames.includes("DistribCo"));
  t("non-company reused identity does NOT reach Research", !readyNames.includes("PressWire"));
  t("unresolved reused identity does NOT reach Research", !readyNames.includes("Opaque SA"));
  t("fresh candidate still reaches Research (no regression)", readyNames.includes("Fresh Mfr"));

  // ── budget bound: only maxQualify candidates fetched (each qualifies on homepage → no subpage) ──
  const many: CandidateAccountUniverse = { ...universe, candidates: Array.from({ length: 30 }, (_, i) => mk(`Co${i}`, `co${i}.com`)) };
  let fetches = 0;
  const okContent = "We are a manufacturer operating manufacturing plants that produce packaging for our clients across the region.";
  await qualifyReusedCandidates(many, { fetchCompanyEvidence: async ({ domain }) => { fetches++; return ev(okContent, true, domain); } }, { maxQualify: 5 });
  t("qualification respects the maxQualify budget (homepage-qualified → no subpages)", fetches === 5);
  t("default budget is bounded", DEFAULT_REUSE_QUALIFICATION_BUDGET.maxQualify <= 20 && (DEFAULT_REUSE_QUALIFICATION_BUDGET.maxTotalFetches ?? 0) <= 40);

  // ── adaptive coverage budget (§17/§18): scales with delivery target, hard-capped ──
  t("Preview (2) keeps the conservative floor of 12", adaptiveQualificationBudget(2).maxQualify === 12);
  t("Brief (6) widens coverage to 18", adaptiveQualificationBudget(6).maxQualify === 18);
  t("Portfolio (12) is capped at MAX_ADAPTIVE_QUALIFY", adaptiveQualificationBudget(12).maxQualify === MAX_ADAPTIVE_QUALIFY && MAX_ADAPTIVE_QUALIFY === 30);
  t("adaptive maxTotalFetches stays bounded (2x maxQualify)", adaptiveQualificationBudget(6).maxTotalFetches === 36 && adaptiveQualificationBudget(18).maxTotalFetches === 60);

  // ── subpage cascade: an ambiguous homepage is recovered by an official subpage (§16) ──
  const subUniverse: CandidateAccountUniverse = { ...universe, candidates: [mk("Ambiguous Mfr", "ambig.com.co")] };
  const bySubpath: Record<string, CompanyEvidence> = {
    "https://ambig.com.co": ev("Bienvenidos. Nuestra empresa con más de 50 años de trayectoria y valores. Cookies.", true, "ambig.com.co"),
    "https://ambig.com.co/nosotros": ev("Somos un fabricante: operamos plantas de manufactura y producción industrial de empaques.", true, "ambig.com.co"),
  };
  let subFetches = 0;
  const subDeps: ReuseQualificationDeps = { fetchCompanyEvidence: async ({ domain, path }) => { subFetches++; return bySubpath[`https://${domain}${path ?? ""}`] ?? ev("", false, domain); } };
  const { universe: subEnriched, metrics: subMetrics } = await qualifyReusedCandidates(subUniverse, subDeps);
  t("ambiguous homepage recovered via official subpage → QUALIFIED", subMetrics.qualified === 1 && subMetrics.recoveredViaSubpage === 1);
  t("subpage recovery sets a source-verified role and reaches Research",
    prioritizeResearch(subEnriched.candidates, subEnriched.plan).some((c) => c.identity.canonicalName === "Ambiguous Mfr"));
  t("subpage cascade consumed a bounded number of fetches (homepage + ≤ MAX subpages)", subFetches >= 2 && subFetches <= 3);

  // ── §20: a real wrong-target homepage is NEVER overridden by subpage fishing ──
  let wtFetches = 0;
  const wtDeps: ReuseQualificationDeps = { fetchCompanyEvidence: async ({ domain, path }) => { wtFetches++; return ev(path ? "we also manufacture" : "We are a third-party logistics and freight transport operator.", true, domain); } };
  const { metrics: wtMetrics } = await qualifyReusedCandidates({ ...universe, candidates: [mk("Logi Co", "logi.com")] }, wtDeps);
  t("wrong-target homepage stays rejected (no subpage fishing, single fetch)", wtMetrics.rejectedWrongTarget === 1 && wtFetches === 1);

  // ── fail-closed: a throwing fetcher never breaks qualification, leaves candidate held ──
  const { metrics: m2 } = await qualifyReusedCandidates(
    { ...universe, candidates: [mk("Boom", "boom.com")] },
    { fetchCompanyEvidence: async () => { throw new Error("network down"); } },
  );
  t("throwing fetcher → OPS_BLOCKED, candidate held (fail-closed)", m2.opsBlocked === 1 && m2.qualified === 0);

  console.log(`\n${p} passed, 0 failed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
