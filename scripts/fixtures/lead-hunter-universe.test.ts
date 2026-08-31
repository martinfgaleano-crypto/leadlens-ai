// Automated Lead Hunter V1 acceptance. Deterministic facade over the discovery
// engine — exercised with MOCK discovery runners (no providers, no network). Proves
// plan generation, multi-route, golden objectives, identity resolution + dedup,
// exclusions, unknowns, coverage/gaps, provider-failure/all-fail, truth boundaries,
// context lineage, tenant isolation, idempotency, and observability.
import {
  planDiscovery, hunt, huntFromConfirmedContext,
  DEFAULT_DISCOVERY_BUDGET,
  type DiscoveryRunner, type DiscoveryRunOutput, type RawDiscoveredOrg, type DiscoveryPlan,
} from "@/lib/lead-hunter/candidate-universe";
import { confirmInterpretation } from "@/lib/interpretation/confirmed-commercial-context";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { ADV_CYBER_BANKS_NOT_FINTECH } from "@/lib/interpretation/fixtures/adversarial";
import type { ConfirmedCommercialContextV1 } from "@/lib/interpretation/confirmed-commercial-context";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const clock = () => new Date("2026-08-25T12:00:00.000Z");
const confirmOf = (interp: (typeof GOLDEN_FIXTURES)["software_manufacturing"], contextId = "ctx"): ConfirmedCommercialContextV1 => {
  const r = confirmInterpretation(interp, { contextId });
  if (!r.ok) throw new Error("fixture did not confirm: " + r.reason);
  return r.context;
};
const orgsRunner = (orgs: RawDiscoveredOrg[], over: Partial<DiscoveryRunOutput> = {}): DiscoveryRunner =>
  async () => ({ orgs, providersAvailable: ["brave", "tavily"], providersFailed: [], operatingMode: "full_discovery", ...over });
const O = (o: Partial<RawDiscoveredOrg> & { name: string }): RawDiscoveredOrg =>
  ({ origin: "dynamic_enumeration", provider: "brave", route: "industry_category", confidence: o.domain ? "verified" : "plausible", ...o });

// ─── PLAN ─────────────────────────────────────────────────────────────────────
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  t("plan: software → industry+geo routes, manufacturing industry, watch families, bounded budget",
    plan.routes.some((r) => r.kind === "industry_category") && plan.industries.some((i) => /manufactur/i.test(i)) &&
    plan.watchSignalFamilies.includes("new_facility" as never) && plan.routes.length <= DEFAULT_DISCOVERY_BUDGET.maxRoutes);
  t("plan: carries context lineage", plan.contextRef.contextId === "ctx" && plan.contextRef.version === 1);
}
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.partnerships));
  t("plan: partnerships → partner_channel route (not customer sales)", plan.routes.some((r) => r.kind === "partner_channel") && plan.targetRelationship === "partner");
}
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.consulting));
  t("plan: consulting/advisory → expansion_signal route", plan.routes.some((r) => r.kind === "expansion_signal") && plan.objectiveType === "advisory_opportunities");
}

// ─── GOLDEN runs (mock discovery) ─────────────────────────────────────────────
async function goldenRun(interp: (typeof GOLDEN_FIXTURES)["software_manufacturing"]) {
  const plan = planDiscovery(confirmOf(interp));
  const orgs = [O({ name: "Acme Manufacturing", domain: "acme.com", organizationType: "Manufacturer", industry: "Manufacturing", country: "United States" }),
                O({ name: "Beta Mills", domain: "betamills.com", organizationType: "Manufacturer", industry: "Manufacturing" }),
                O({ name: "Gamma Industrial", domain: "gamma.io", organizationType: "Manufacturer", industry: "Manufacturing" })];
  return hunt(plan, orgsRunner(orgs), { now: clock });
}
{
  const u = await goldenRun(GOLDEN_FIXTURES.software_manufacturing);
  t("golden software: ok universe, all eligible, no founder selection needed", u.ok && u.candidates.length === 3 && u.candidates.every((c) => c.status === "eligible") && u.reviewRequired.length === 0);
  t("golden software: NO Fit/Timing/Decision/Evidence anywhere in the universe",
    !/(\bfit\b|\btiming\b|\bdecision\b|"evidence"|what[_\s]?changed|externally_verified|counterevidence)/i.test(JSON.stringify(u)));
  t("golden software: candidates carry watch signal families as hints (config, not observed)",
    u.candidates.every((c) => c.watchSignalFamilies.every((f) => /^[a-z_]+$/.test(f))));
}
t("golden consulting: reaches an ok universe", (await goldenRun(GOLDEN_FIXTURES.consulting)).ok);
t("golden partnerships: reaches an ok universe", (await goldenRun(GOLDEN_FIXTURES.partnerships)).ok);

// ─── DEDUP across providers/routes → one candidate, multi-provenance ──────────
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const orgs = [
    O({ name: "Acme Manufacturing", domain: "acme.com", organizationType: "Manufacturer", provider: "brave", route: "industry_category" }),
    O({ name: "ACME Mfg", domain: "acme.com", organizationType: "Manufacturer", provider: "tavily", route: "geo_category" }),
    O({ name: "Acme", domain: "acme.com", organizationType: "Manufacturer", provider: "brave", route: "source_ecosystem" }),
  ];
  const u = await hunt(plan, orgsRunner(orgs), { now: clock });
  const acme = u.candidates.find((c) => c.identity.domain === "acme.com")!;
  t("dedup: same domain via 3 provider/route origins → ONE candidate with 3 provenance entries",
    u.candidates.length === 1 && acme.provenance.length === 3);
  t("dedup: multiple discovery origins are provenance, NOT evidence corroboration (no evidence fields)",
    !/(evidence|corroborat)/i.test(JSON.stringify(acme)) && acme.identity.aliases!.length >= 1);
  t("dedup: duplicateRate reflects the collapse", u.coverage.duplicateRate > 0.6);
}

// ─── IDENTITY: same name / different countries (parent/sub, brand) ────────────
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const orgs = [
    O({ name: "Nordic Steel", domain: "nordicsteel.se", country: "Sweden", organizationType: "Manufacturer" }),
    O({ name: "Nordic Steel", domain: "nordicsteel.com.co", country: "Colombia", organizationType: "Manufacturer" }),
  ];
  const u = await hunt(plan, orgsRunner(orgs), { now: clock });
  t("identity: same name, different domains/countries → TWO distinct candidates (not merged)", u.candidates.length === 2);
}
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const orgs = [
    O({ name: "Global Foods", domain: "globalfoods-us.com", organizationType: "Manufacturer" }),
    O({ name: "Global Foods", domain: "globalfoods-mx.com", organizationType: "Manufacturer" }),
    O({ name: "Global Foods", organizationType: "Manufacturer" }), // bare, cannot pin
  ];
  const u = await hunt(plan, orgsRunner(orgs), { now: clock });
  t("identity: bare name colliding with 2 domains → the bare mention is identity_ambiguous (needs review)",
    u.candidates.some((c) => c.status === "identity_ambiguous") && u.reviewRequired.includes("identity_ambiguity"));
}

// ─── EXCLUSION stays configuration (not counterevidence) ──────────────────────
{
  const plan = planDiscovery(confirmOf(ADV_CYBER_BANKS_NOT_FINTECH, "cyber"));
  const orgs = [
    O({ name: "First National Bank", domain: "fnb.com", industry: "Banking", organizationType: "Bank" }),
    O({ name: "PayZap", domain: "payzap.com", industry: "fintech", organizationType: "fintech" }),
  ];
  const u = await hunt(plan, orgsRunner(orgs), { now: clock });
  const zap = u.candidates.find((c) => /payzap/i.test(c.identity.canonicalName))!;
  t("exclusion: fintech candidate → excluded for configuration reason, not counterevidence",
    zap.status === "excluded" && /exclusion/i.test(zap.statusReason) && !/counterevidence|evidence/i.test(JSON.stringify(zap)));
}

// ─── UNKNOWN qualification field → needs_validation (unknown ≠ fail) ──────────
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const orgs = [O({ name: "Opaque Co", domain: "opaque.co" })]; // domain but no type/industry
  const u = await hunt(plan, orgsRunner(orgs), { now: clock });
  t("unknown: resolved identity but unknown type/industry → needs_validation (not excluded)",
    u.candidates[0].status === "needs_validation");
}

// ─── LOW PUBLIC FOOTPRINT → likely_eligible, not rejected ─────────────────────
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const orgs = [O({ name: "Tiny Private Manufacturer SAS", country: "Colombia", organizationType: "Manufacturer", confidence: "plausible" })];
  const u = await hunt(plan, orgsRunner(orgs), { now: clock });
  t("low-footprint: no domain but plausible → likely_eligible + low_public_footprint gap (not a poor-opportunity claim)",
    u.candidates[0].status === "likely_eligible" && u.coverage.gaps.some((g) => g.type === "low_public_footprint"));
}

// ─── DOMAIN IS NOT AUTOMATICALLY A COMMERCIAL ACCOUNT ────────────────────────
{
  const ctx = confirmOf(GOLDEN_FIXTURES.software_manufacturing);
  const plan = planDiscovery(ctx);
  const noise = [
    { name: "Kompass", domain: "co.kompass.com", organizationType: "manufacturing directory" },
    { name: "TikTok", domain: "tiktok.com", organizationType: "technology" },
    { name: "Datos Abiertos Colombia", domain: "datos.gov.co", organizationType: "manufacturing data" },
    { name: "Trade Shows", domain: "trade.gov", organizationType: "manufacturing events" },
    { name: "Base", domain: "example.com", organizationType: "manufacturer" },
    { name: "Distribuidores Mayoristas Colombia", domain: "example.org", organizationType: "distributor" },
    { name: "Computrabajo", domain: "co.computrabajo.com", organizationType: "manufacturer" },
    { name: "Más Colombia", domain: "mascolombia.com", organizationType: "manufacturer" },
  ];
  const runner: DiscoveryRunner = async () => ({
    orgs: noise.map(O), providersAvailable: ["brave"], providersFailed: [], operatingMode: "full_discovery",
  });
  const u = await hunt(plan, runner, { now: clock });
  t("non-account surfaces: directory/social/government/category labels are excluded despite having domains",
    u.candidates.length === noise.length && u.candidates.every((c) => c.status === "excluded"));
}

{
  const ctx = confirmOf(GOLDEN_FIXTURES.software_manufacturing);
  const plan = planDiscovery(ctx);
  const runner: DiscoveryRunner = async () => ({
    orgs: [O({ name: "Acme Packaging Colombia", domain: "acmepackaging.co", organizationType: "manufacturer" })],
    providersAvailable: ["brave"], providersFailed: [], operatingMode: "full_discovery",
  });
  const u = await hunt(plan, runner, { now: clock });
  t("non-account boundary: preserves a resolved commercial manufacturer", u.candidates[0]?.status === "eligible");
}

// ─── PROVIDER FAILURE (degraded) vs ALL-FAIL (honest failure) ─────────────────
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const u = await hunt(plan, orgsRunner([O({ name: "Acme", domain: "acme.com", organizationType: "Manufacturer" })], { providersFailed: ["serper"], providersAvailable: ["brave"], operatingMode: "provider_limited" }), { now: clock });
  t("provider failure: one provider down → universe still completes, gap + review recorded",
    u.ok && u.coverage.gaps.some((g) => g.type === "provider_unavailable") && u.reviewRequired.includes("provider_anomaly"));
}
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const allFail: DiscoveryRunner = async () => ({ orgs: [], providersAvailable: [], providersFailed: ["brave", "tavily", "serper"], operatingMode: "stopped" });
  const u = await hunt(plan, allFail, { now: clock });
  t("all-provider failure: honest failure, ZERO fabricated candidates", !u.ok && u.candidates.length === 0 && u.failureReason === "provider_unavailable");
}
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const thrower: DiscoveryRunner = async () => { throw new Error("boom"); };
  const u = await hunt(plan, thrower, { now: clock });
  t("runner throws → bounded fail-safe (no candidates, provider_unavailable)", !u.ok && u.candidates.length === 0);
}

// ─── QUERY/ROUTE BUDGET — planner stays bounded regardless of input breadth ───
{
  const wide = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  wide.targetAccountProfile = { ...wide.targetAccountProfile, industries: Array.from({ length: 40 }, (_, i) => `Industry ${i}`), geographies: Array.from({ length: 30 }, (_, i) => ({ label: `Country ${i}` })) };
  const plan = planDiscovery(confirmOf(wide));
  t("budget: many industries/geographies → routes still bounded by maxRoutes", plan.routes.length <= DEFAULT_DISCOVERY_BUDGET.maxRoutes);
}

// ─── TENANT ISOLATION + CONTEXT LINEAGE + IDEMPOTENCY (owner-scoped entry) ────
{
  const store = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(store, GOLDEN_FIXTURES.software_manufacturing, { userId: "owner", contextId: "run", now: clock });
  const runner = orgsRunner([O({ name: "Acme", domain: "acme.com", organizationType: "Manufacturer" })]);

  const mine = await huntFromConfirmedContext(store, "owner", { contextId: "run" }, runner, { now: clock });
  t("owner: authorized hunt returns a universe with context lineage",
    mine.ok && mine.universe.contextRef.contextId === "run" && mine.universe.candidates[0].opportunityConditionIds.length > 0);

  const attacker = await huntFromConfirmedContext(store, "attacker", { contextId: "run" }, runner, { now: clock });
  t("tenant isolation: different owner cannot hunt another owner's context", !attacker.ok && attacker.reason === "context_not_found");

  const again = await huntFromConfirmedContext(store, "owner", { contextId: "run" }, runner, { now: clock });
  t("idempotency: same context + clock → same runId, same candidate set", mine.ok && again.ok && mine.universe.runId === again.universe.runId && mine.universe.candidates.length === again.universe.candidates.length);
}

// ─── OBSERVABILITY fields present ─────────────────────────────────────────────
{
  const plan = planDiscovery(confirmOf(GOLDEN_FIXTURES.software_manufacturing));
  const u = await hunt(plan, orgsRunner([O({ name: "Acme", domain: "acme.com", organizationType: "Manufacturer" }), O({ name: "Beta", domain: "beta.com", organizationType: "Manufacturer" })]), { now: clock });
  const c = u.coverage;
  t("observability: coverage records providers/routes/counts/duplicateRate/gaps",
    typeof c.candidatesDiscovered === "number" && typeof c.candidatesUnique === "number" && Array.isArray(c.providersAvailable) &&
    typeof c.eligible === "number" && typeof c.duplicateRate === "number" && Array.isArray(c.gaps));
}

// ─── INSUFFICIENT TARGET → no provider run, honest gap ────────────────────────
{
  const bare = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  bare.targetAccountProfile = { organizationTypes: [], industries: [], namedAccounts: [], inferredFromInput: false };
  // confirmInterpretation would normally block this; test planDiscovery + hunt directly.
  const ctx = { ...confirmOf(GOLDEN_FIXTURES.software_manufacturing), targetAccountProfile: bare.targetAccountProfile };
  const plan = planDiscovery(ctx as ConfirmedCommercialContextV1);
  let ran = false;
  const runner: DiscoveryRunner = async () => { ran = true; return { orgs: [], providersAvailable: ["brave"], providersFailed: [], operatingMode: "full_discovery" }; };
  const u = await hunt(plan, runner, { now: clock });
  t("insufficient target: NO provider run, honest insufficient_target_definition failure",
    !ran && !u.ok && u.failureReason === "insufficient_target_definition");
}

// ─── REUSE: default runner adapts the existing engine (source-level) ──────────
{
  const src = (await import("node:fs")).readFileSync("lib/lead-hunter/discovery-runner.ts", "utf8");
  t("reuse: default runner calls runCompanyFirstDiscovery (no new engine)", /runCompanyFirstDiscovery/.test(src) && /universe_accounts/.test(src));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
};
run();
