import assert from "node:assert/strict";
import {
  qualifyFromEvidence, qualifyReusedCandidates, needsReuseQualification,
  DEFAULT_REUSE_QUALIFICATION_BUDGET,
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

  // ── budget bound: only maxQualify fetches attempted ──
  const many: CandidateAccountUniverse = { ...universe, candidates: Array.from({ length: 30 }, (_, i) => mk(`Co${i}`, `co${i}.com`)) };
  let fetches = 0;
  await qualifyReusedCandidates(many, { fetchCompanyEvidence: async ({ domain }) => { fetches++; return ev("manufacturer manufacturing", true, domain); } }, { maxQualify: 5 });
  t("qualification respects the maxQualify budget", fetches === 5);
  t("default budget is bounded", DEFAULT_REUSE_QUALIFICATION_BUDGET.maxQualify <= 20);

  // ── fail-closed: a throwing fetcher never breaks qualification, leaves candidate held ──
  const { metrics: m2 } = await qualifyReusedCandidates(
    { ...universe, candidates: [mk("Boom", "boom.com")] },
    { fetchCompanyEvidence: async () => { throw new Error("network down"); } },
  );
  t("throwing fetcher → OPS_BLOCKED, candidate held (fail-closed)", m2.opsBlocked === 1 && m2.qualified === 0);

  console.log(`\n${p} passed, 0 failed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
