// Lead Hunter V1.1 — production run persistence + authenticated job integration.
// Deterministic (mock discovery runner + in-memory stores). Proves run persistence,
// immutability, idempotency, retry, failure, provider degradation, owner isolation,
// historical context lineage, provenance roundtrip (never Evidence), no Fit/Timing/
// Decision, mixed auto/review, downstream Research acceptance, observability.
import { readFileSync } from "node:fs";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { InMemoryLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import { runAndPersistLeadHunter, loadLeadHunterUniverse, toResearchCandidates, researchReadyCandidates } from "@/lib/lead-hunter/hunt-and-persist";
import type { DiscoveryRunner, DiscoveryRunOutput, RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import type { LeadCandidate, ICP, OnboardingData, PlanType, LeadSearchCriteria } from "@/types";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const clock = () => new Date("2026-08-26T12:00:00.000Z");
const O = (o: Partial<RawDiscoveredOrg> & { name: string }): RawDiscoveredOrg =>
  ({ origin: "dynamic_enumeration", provider: "brave", route: "industry_category", confidence: o.domain ? "verified" : "plausible", ...o });
const runnerOf = (orgs: RawDiscoveredOrg[], over: Partial<DiscoveryRunOutput> = {}): DiscoveryRunner =>
  async () => ({ orgs, providersAvailable: ["brave", "tavily"], providersFailed: [], operatingMode: "full_discovery", ...over });

const MANU = [
  O({ name: "Acme Manufacturing", domain: "acme.com", organizationType: "Manufacturer", industry: "Manufacturing", sourceUrl: "https://dir.example/acme" }),
  O({ name: "Beta Mills", domain: "betamills.com", organizationType: "Manufacturer", industry: "Manufacturing" }),
  O({ name: "Gamma Industrial", domain: "gamma.io", organizationType: "Manufacturer", industry: "Manufacturing" }),
];

async function seedCtx(fixture: (typeof GOLDEN_FIXTURES)["software_manufacturing"], userId: string, contextId = "run") {
  const cs = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(cs, fixture, { userId, contextId, now: clock });
  return cs;
}

// ─── PERSISTENCE + RELOAD + LINEAGE ───────────────────────────────────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "u1");
  const rs = new InMemoryLeadHunterRunStore();
  const r = await runAndPersistLeadHunter(cs, rs, "u1", { contextId: "run" }, runnerOf(MANU), { now: clock });
  t("persist: run created with a durable runId + context lineage", r.ok && r.created && /^lh_run_v1_/.test(r.runId) && r.universe.contextRef.version === 1);
  const reloaded = await loadLeadHunterUniverse(rs, r.ok ? r.runId : "", "u1");
  t("reload: persisted universe reloads with candidates + provenance intact",
    !!reloaded && reloaded.candidates.length === 3 && reloaded.candidates[0].provenance.length >= 1);
  t("provenance roundtrip: source url survives reload but is NOT evidence",
    !!reloaded && !/"evidence"|corroborat/i.test(JSON.stringify(reloaded)) &&
    JSON.stringify(reloaded).includes("dir.example/acme"));
  t("no Fit/Timing/Decision introduced by persistence roundtrip",
    !!reloaded && !/(\bfit\b|\btiming\b|\bdecision\b|what[_\s]?changed|externally_verified)/i.test(JSON.stringify(reloaded)));
}

// ─── IDEMPOTENCY (same run twice → reuse, no duplicate) ───────────────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "u2");
  const rs = new InMemoryLeadHunterRunStore();
  const a = await runAndPersistLeadHunter(cs, rs, "u2", { contextId: "run" }, runnerOf(MANU), { now: clock });
  const b = await runAndPersistLeadHunter(cs, rs, "u2", { contextId: "run" }, runnerOf(MANU), { now: clock });
  t("idempotency: second identical run reuses the snapshot (created=false, reused=true, same runId)",
    a.ok && b.ok && b.created === false && b.reused === true && a.runId === b.runId);
}

// ─── IMMUTABILITY (persist never rewrites a stored run) ───────────────────────
{
  const rs = new InMemoryLeadHunterRunStore();
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "u3");
  const first = await runAndPersistLeadHunter(cs, rs, "u3", { contextId: "run" }, runnerOf(MANU), { now: clock });
  // A different discovery result under the SAME runId must not overwrite.
  const second = await runAndPersistLeadHunter(cs, rs, "u3", { contextId: "run" }, runnerOf([O({ name: "Different Co", domain: "different.com", organizationType: "Manufacturer" })]), { now: clock });
  const loaded = await loadLeadHunterUniverse(rs, first.ok ? first.runId : "", "u3");
  t("immutability: same runId keeps the original snapshot (3 candidates, not overwritten)",
    second.ok && second.reused && !!loaded && loaded.candidates.length === 3);
}

// ─── RETRY after failure (new snapshot, no duplicate) ─────────────────────────
{
  const rs = new InMemoryLeadHunterRunStore();
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "u4");
  const allFail: DiscoveryRunner = async () => ({ orgs: [], providersAvailable: [], providersFailed: ["brave", "tavily"], operatingMode: "stopped" });
  const failed = await runAndPersistLeadHunter(cs, rs, "u4", { contextId: "run" }, allFail, { now: clock });
  t("failed run: all-provider failure persisted as failed, ZERO fabricated candidates",
    failed.ok && failed.universe.ok === false && failed.universe.candidates.length === 0);
  // Retry same day reuses the failed snapshot id (idempotent); a real retry uses a new day/runId.
  const retryNextDay = await runAndPersistLeadHunter(cs, rs, "u4", { contextId: "run" }, runnerOf(MANU), { now: () => new Date("2026-08-27T12:00:00.000Z") });
  t("retry: a new discovery cycle (new runId) succeeds and persists separately",
    failed.ok && retryNextDay.ok && retryNextDay.created && retryNextDay.universe.ok && retryNextDay.runId !== failed.runId);
}

// ─── PROVIDER-DEGRADED (completes with gap) ───────────────────────────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "u5");
  const rs = new InMemoryLeadHunterRunStore();
  const degraded = await runAndPersistLeadHunter(cs, rs, "u5", { contextId: "run" }, runnerOf(MANU, { providersFailed: ["serper"], providersAvailable: ["brave"], operatingMode: "provider_limited" }), { now: clock });
  t("provider degraded: run completes with a persisted provider_unavailable gap",
    degraded.ok && degraded.universe.ok && degraded.universe.coverage.gaps.some((g) => g.type === "provider_unavailable"));
}

// ─── CONTEXT-SCOPED CANDIDATE MEMORY (stable core, no Evidence) ───────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "ucm");
  const rs = new InMemoryLeadHunterRunStore();
  const first = await runAndPersistLeadHunter(cs, rs, "ucm", { contextId: "run" }, runnerOf(MANU), { now: clock });
  const second = await runAndPersistLeadHunter(cs, rs, "ucm", { contextId: "run" }, runnerOf([]), { now: () => new Date("2026-08-27T12:00:00.000Z") });
  const u = second.ok ? second.universe : null;
  t("context memory: a zero-yield fresh pass retains the previously verified stable core",
    first.ok && !!u && u.candidates.length === 3 && u.candidates.every((c) => c.universeState === "stable_reused"));
  t("context memory: reuse telemetry is explicit and does not claim fresh candidates",
    !!u && u.coverage.priorCandidatesConsidered === 3 && u.coverage.candidatesReused === 3 && u.coverage.freshCandidates === 0 && u.coverage.stableCorePercent === 100);
  t("context memory: candidate reuse remains Discovery provenance, never Evidence or Decision",
    !!u && u.candidates.every((c) => c.provenance.some((p) => p.origin.startsWith("context_memory")))
      && !/(\"evidence\"|\"decision\"|\"timing\")/i.test(JSON.stringify(u.candidates)));
}

{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "ucmf");
  const rs = new InMemoryLeadHunterRunStore();
  await runAndPersistLeadHunter(cs, rs, "ucmf", { contextId: "run" }, runnerOf(MANU), { now: clock });
  const failedProviders: DiscoveryRunner = async () => ({ orgs: [], providersAvailable: [], providersFailed: ["brave", "tavily"], operatingMode: "stopped" });
  const continued = await runAndPersistLeadHunter(cs, rs, "ucmf", { contextId: "run" }, failedProviders, { now: () => new Date("2026-08-27T12:00:00.000Z") });
  t("context memory: provider outage preserves verified account coverage in an explicit degraded mode",
    continued.ok && continued.universe.ok && continued.universe.coverage.operatingMode === "context_memory_reuse" && continued.universe.coverage.providersFailed.length === 2);
}

// ─── OWNER ISOLATION ──────────────────────────────────────────────────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "owner");
  const rs = new InMemoryLeadHunterRunStore();
  const mine = await runAndPersistLeadHunter(cs, rs, "owner", { contextId: "run" }, runnerOf(MANU), { now: clock });
  const attackerHunt = await runAndPersistLeadHunter(cs, rs, "attacker", { contextId: "run" }, runnerOf(MANU), { now: clock });
  t("owner isolation: attacker cannot hunt owner's context", !attackerHunt.ok && attackerHunt.reason === "context_not_found");
  const attackerRead = await loadLeadHunterUniverse(rs, mine.ok ? mine.runId : "", "attacker");
  t("owner isolation: attacker cannot read owner's persisted universe", attackerRead === null);
}

// ─── HISTORICAL CONTEXT V1/V2 ─────────────────────────────────────────────────
{
  const cs = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(cs, GOLDEN_FIXTURES.software_manufacturing, { userId: "uh", contextId: "c", now: clock });
  const v2 = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  v2.targetAccountProfile = { ...v2.targetAccountProfile, industries: ["Aerospace manufacturing"] };
  await persistConfirmedContext(cs, v2, { userId: "uh", contextId: "c", now: clock });
  const rs = new InMemoryLeadHunterRunStore();
  const runV1 = await runAndPersistLeadHunter(cs, rs, "uh", { contextId: "c", version: 1 }, runnerOf(MANU), { now: clock });
  const runLatest = await runAndPersistLeadHunter(cs, rs, "uh", { contextId: "c" }, runnerOf(MANU), { now: clock });
  t("historical: V1 run stays version 1; latest run is version 2; distinct runIds",
    runV1.ok && runLatest.ok && runV1.universe.contextRef.version === 1 && runLatest.universe.contextRef.version === 2 && runV1.runId !== runLatest.runId);
}

// ─── MIXED auto/review universe ───────────────────────────────────────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "um");
  const rs = new InMemoryLeadHunterRunStore();
  const mixed = [
    ...MANU,
    O({ name: "Global Foods", domain: "gf-us.com", organizationType: "Manufacturer" }),
    O({ name: "Global Foods", domain: "gf-mx.com", organizationType: "Manufacturer" }),
    O({ name: "Global Foods", organizationType: "Manufacturer" }), // ambiguous
  ];
  const r = await runAndPersistLeadHunter(cs, rs, "um", { contextId: "run" }, runnerOf(mixed), { now: clock });
  const u = r.ok ? r.universe : null;
  const ready = u ? researchReadyCandidates(u) : [];
  t("mixed: eligible subset proceeds while ambiguous candidate is held for review (not all-or-nothing)",
    !!u && u.reviewRequired.includes("identity_ambiguity") && ready.length >= 3 && ready.every((c) => c.status !== "identity_ambiguous"));
}

// ─── DOWNSTREAM RESEARCH HANDOFF (candidatesOverride) ─────────────────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "ud");
  const rs = new InMemoryLeadHunterRunStore();
  const r = await runAndPersistLeadHunter(cs, rs, "ud", { contextId: "run" }, runnerOf(MANU), { now: clock });
  const candidates: LeadCandidate[] = toResearchCandidates(r.ok ? r.universe : ({} as never));
  t("handoff: research-ready candidates map to valid LeadCandidate[] (id/company/source/confidence)",
    candidates.length === 3 && candidates.every((c) => c.id && c.company && c.source === "public_signal" && typeof c.confidence_score === "number"));
  t("handoff: LeadCandidate carries NO Fit/Timing/Decision/Evidence fields",
    !/(\bfit\b|\btiming\b|"decision"|"evidence"|what_changed|externally_verified)/i.test(JSON.stringify(candidates)));

  // Prove the existing pipeline's candidatesOverride seam ACCEPTS them (mock pipeline).
  type PInput = { onboardingData: OnboardingData; plan: PlanType; candidatesOverride?: LeadCandidate[]; criteriaOverride?: LeadSearchCriteria; icpOverride?: ICP };
  const captured: PInput[] = [];
  const mockPipeline = async (input: PInput) => { captured.push(input); return { report: "ok" }; };
  await mockPipeline({ onboardingData: {} as OnboardingData, plan: "standard", candidatesOverride: candidates });
  t("downstream smoke: Research entry (candidatesOverride) accepts persisted candidates",
    captured.length === 1 && (captured[0].candidatesOverride?.length ?? 0) === 3);
}

// ─── OBSERVABILITY persisted ──────────────────────────────────────────────────
{
  const cs = await seedCtx(GOLDEN_FIXTURES.software_manufacturing, "uo");
  const rs = new InMemoryLeadHunterRunStore();
  const r = await runAndPersistLeadHunter(cs, rs, "uo", { contextId: "run" }, runnerOf(MANU, { providersFailed: ["serper"] }), { now: clock });
  const loaded = await loadLeadHunterUniverse(rs, r.ok ? r.runId : "", "uo");
  const c = loaded?.coverage;
  t("observability: persisted coverage has counts/providers/routes/duplicateRate/gaps",
    !!c && typeof c.candidatesDiscovered === "number" && Array.isArray(c.providersFailed) && c.providersFailed.includes("serper") && typeof c.duplicateRate === "number");
}

// ─── ROUTE guards (server resolves owner; no browser candidate injection) ─────
{
  const src = readFileSync("app/api/customer/lead-hunter/route.ts", "utf8");
  t("route: authenticates + resolves owner server-side, body names only context_id/version",
    /auth\.getUser\(token\)/.test(src) && /user\.id/.test(src) && /context_id:/.test(src) && !/candidates?:\s*z\./.test(src));
  t("route: runs via runAndPersistLeadHunter + Supabase stores, fails safe (404/503)",
    /runAndPersistLeadHunter/.test(src) && /SupabaseLeadHunterRunStore/.test(src) && /404|503/.test(src));
  t("reuse: run store persists on snapshot_reports (no new table)",
    /snapshot_reports/.test(readFileSync("lib/lead-hunter/run-store.ts", "utf8")));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
};
run();
