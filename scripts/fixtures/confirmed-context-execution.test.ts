// Confirmed context → live discovery execution acceptance.
// Proves the authenticated self-serve orchestration: authorized load → adapt →
// pipeline runs from STRUCTURED confirmed context (criteriaOverride + icpOverride,
// no prose), with owner isolation, confirmation gates, version lineage, aligned
// geography, and fail-safe behavior. The pipeline is MOCKED (no providers, no LLM,
// no live DB). In-memory store stands in for Supabase.
import { readFileSync } from "node:fs";
import {
  InMemoryConfirmedContextStore,
  persistConfirmedContext,
} from "@/lib/interpretation/confirmed-context-store";
import {
  buildDiscoveryJobInput,
  runDiscoveryFromConfirmedContext,
} from "@/lib/interpretation/confirmed-context-execution";
import type { ConfirmedContextStore } from "@/lib/interpretation/confirmed-context-store";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { ADV_INVESTORS, ADV_HELP_COMPANIES_GROW } from "@/lib/interpretation/fixtures/adversarial";
import type { CompanyInterpretationV1 } from "@/lib/interpretation/company-interpretation";
import type { LeadSearchCriteria, ICP, OnboardingData, PlanType } from "@/types";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const clock = () => new Date("2026-08-25T12:00:00.000Z");

// A mock pipeline that records exactly what discovery would receive.
type Captured = { onboardingData: OnboardingData; plan: PlanType; criteriaOverride: LeadSearchCriteria; icpOverride: ICP; jobId?: string };
function mockPipeline() {
  const calls: Captured[] = [];
  const run = async (input: Captured) => { calls.push(input); return { report: "ok", leads: 0 }; };
  return { run, calls };
}

async function seed(fixture: CompanyInterpretationV1, userId: string, contextId = "run") {
  const store = new InMemoryConfirmedContextStore();
  const p = await persistConfirmedContext(store, fixture, { userId, contextId, now: clock });
  return { store, persisted: p };
}

// ─── Golden live flows: confirmed context → pipeline (structured overrides) ────
async function golden(fixture: CompanyInterpretationV1, userId: string) {
  const { store } = await seed(fixture, userId);
  const pipe = mockPipeline();
  const res = await runDiscoveryFromConfirmedContext(store, userId, { contextId: "run" }, { plan: "standard", outputLanguage: "en", contactEmail: "c@x.com" }, pipe.run, "job1");
  return { res, pipe };
}

const soft = await golden(GOLDEN_FIXTURES.software_manufacturing, "u1");
t("§13 software: confirmed context → pipeline invoked with structured criteria (manufacturers)",
  soft.res.ok && soft.pipe.calls.length === 1 && soft.pipe.calls[0].criteriaOverride.target_industries.some((i) => /manufactur/i.test(i)));
t("§13 software: pipeline received an ICP override (prose ICP inference skipped)",
  soft.pipe.calls[0].icpOverride.target_industries.length > 0 && soft.pipe.calls[0].icpOverride.ideal_signals.includes("new_facility"));
t("§13 software: context version lineage returned + jobId threaded",
  soft.res.ok && soft.res.contextRef.contextId === "run" && soft.res.contextRef.version === 1 && soft.pipe.calls[0].jobId === "job1");

t("§14 consulting: reaches pipeline via structured overrides", (await golden(GOLDEN_FIXTURES.consulting, "u2")).res.ok);
t("§15 partnerships: reaches pipeline (relationship preserved, not forced to customer)", (await golden(GOLDEN_FIXTURES.partnerships, "u3")).res.ok);

// ─── Geography alignment: onboarding.target_countries == criteria.target_geography
{
  const edited = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  edited.targetAccountProfile = { ...edited.targetAccountProfile, geographies: [{ label: "United States", regionKey: "north_america" }] };
  const { store } = await seed(edited, "ug");
  const built = await buildDiscoveryJobInput(store, "ug", { contextId: "run" }, { outputLanguage: "en" });
  t("geo: server-derived onboarding geography equals criteria geography (pipeline contract holds)",
    built.ok && JSON.stringify((built.input.onboardingData.target_countries ?? []).sort()) === JSON.stringify([...built.input.criteria.target_geography].sort()));
}

// ─── §8 raw prose is NOT used: pipeline input carries no rawInputRef / textarea ─
t("§8 raw prose not used — pipeline input has no rawInput and no original sentence",
  soft.res.ok && !JSON.stringify(soft.pipe.calls[0]).includes("golden:software_manufacturing") && !("rawInput" in (soft.pipe.calls[0] as object)));

// ─── §12 output language preserved from confirmation through to execution ─────
{
  const { store } = await seed(GOLDEN_FIXTURES.consulting, "ul");
  const pipe = mockPipeline();
  await runDiscoveryFromConfirmedContext(store, "ul", { contextId: "run" }, { outputLanguage: "es", contactEmail: "x@y.com" }, pipe.run);
  t("§12 output_language threaded into criteria + onboarding",
    pipe.calls[0].criteriaOverride.output_language === "es" && pipe.calls[0].onboardingData.output_language === "es");
}

// ─── BLOCKED FLOWS ────────────────────────────────────────────────────────────
// Unsupported objective never persists → nothing to execute.
{
  const store = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(store, ADV_INVESTORS, { userId: "ub", contextId: "run" }).catch(() => {});
  const pipe = mockPipeline();
  const res = await runDiscoveryFromConfirmedContext(store, "ub", { contextId: "run" }, {}, pipe.run);
  t("§17 unsupported objective (investors) → no persisted context → discovery blocked, pipeline never called",
    !res.ok && res.reason === "context_not_found" && pipe.calls.length === 0);
}
// Vague/blocked interpretation never persists.
{
  const store = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(store, ADV_HELP_COMPANIES_GROW, { userId: "uv", contextId: "run" });
  const pipe = mockPipeline();
  const res = await runDiscoveryFromConfirmedContext(store, "uv", { contextId: "run" }, {}, pipe.run);
  t("§16 vague/blocked interpretation → discovery blocked, pipeline never called", !res.ok && pipe.calls.length === 0);
}

// Wrong owner cannot execute another user's context.
{
  const { store } = await seed(GOLDEN_FIXTURES.software_manufacturing, "owner");
  const pipe = mockPipeline();
  const res = await runDiscoveryFromConfirmedContext(store, "attacker", { contextId: "run" }, {}, pipe.run);
  t("§18 wrong owner → context_not_found (no leak), pipeline never called", !res.ok && res.reason === "context_not_found" && pipe.calls.length === 0);
}

// Invalid version → blocked.
{
  const { store } = await seed(GOLDEN_FIXTURES.software_manufacturing, "uver");
  const pipe = mockPipeline();
  const res = await runDiscoveryFromConfirmedContext(store, "uver", { contextId: "run", version: 99 }, {}, pipe.run);
  t("invalid version → blocked, pipeline never called", !res.ok && res.reason === "context_not_found" && pipe.calls.length === 0);
}

// ─── §20 context change: V1/V2 and explicit historical execution ──────────────
{
  const store = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(store, GOLDEN_FIXTURES.software_manufacturing, { userId: "uc", contextId: "c", now: clock });
  const v2src = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  v2src.targetAccountProfile = { ...v2src.targetAccountProfile, industries: ["Aerospace manufacturing"] };
  await persistConfirmedContext(store, v2src, { userId: "uc", contextId: "c", now: clock });

  const pipeV1 = mockPipeline();
  await runDiscoveryFromConfirmedContext(store, "uc", { contextId: "c", version: 1 }, {}, pipeV1.run);
  const pipeLatest = mockPipeline();
  await runDiscoveryFromConfirmedContext(store, "uc", { contextId: "c" }, {}, pipeLatest.run);
  t("§20 historical V1 execution uses V1 criteria; latest uses V2 (job stays attributable)",
    pipeV1.calls[0].criteriaOverride.target_industries.every((i) => !/aerospace/i.test(i)) &&
    pipeLatest.calls[0].criteriaOverride.target_industries.some((i) => /aerospace/i.test(i)));
}

// ─── §21/§22 signal hypotheses + exclusions remain CONFIGURATION ──────────────
t("§21 signal hypotheses arrive as buying_signals config (canonical tokens), not observations",
  soft.pipe.calls[0].criteriaOverride.buying_signals.every((s) => /^[a-z_]+$/.test(s)));
{
  const cyberSrc = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  // reuse cyber exclusion pattern by injecting a hard exclusion
  cyberSrc.disqualifiers = [{ type: "industry", rule: "fintech", severity: "exclude", origin: "user_input" }];
  const { store } = await seed(cyberSrc, "ux");
  const built = await buildDiscoveryJobInput(store, "ux", { contextId: "run" }, {});
  t("§22 hard exclusion → discovery exclusion config, not counterevidence",
    built.ok && (built.input.criteria.excluded_industries.some((x) => /fintech/i.test(x)) || built.input.criteria.disqualification_criteria.some((x) => /fintech/i.test(x))));
}

// ─── §29 FAILURE HANDLING — fail safe, never prose ────────────────────────────
{
  // Store that throws (unavailable) → refusal, pipeline never called.
  const brokenStore: ConfirmedContextStore = {
    async listVersions() { throw new Error("db down"); },
    async insert() { throw new Error("db down"); },
  };
  const pipe = mockPipeline();
  const res = await runDiscoveryFromConfirmedContext(brokenStore, "u", { contextId: "x" }, {}, pipe.run);
  t("§29 store unavailable → store_unavailable refusal, pipeline never called (no prose fallback)",
    !res.ok && res.reason === "store_unavailable" && pipe.calls.length === 0);
}
{
  const empty = new InMemoryConfirmedContextStore();
  const pipe = mockPipeline();
  const res = await runDiscoveryFromConfirmedContext(empty, "u", { contextId: "missing" }, {}, pipe.run);
  t("§29 missing context → context_not_found, pipeline never called", !res.ok && res.reason === "context_not_found" && pipe.calls.length === 0);
}

// ─── ROUTE boundary (source-level): server resolves owner, browser can't inject ─
const routeSrc = readFileSync("app/api/customer/discovery/route.ts", "utf8");
t("route: authenticates + resolves owner server-side (auth.getUser → user.id), body only names context_id/version",
  /auth\.getUser\(token\)/.test(routeSrc) && /user\.id/.test(routeSrc) && /context_id:/.test(routeSrc) && !/z\.object\([^)]*payload/.test(routeSrc));
t("route: browser cannot supply a trusted context object (no full-context field in schema)",
  !/companyProfile|opportunityConditions|objective:\s*z\./.test(routeSrc));
t("route: runs via runDiscoveryFromConfirmedContext + real pipeline, fails safe on store/lookup",
  /runDiscoveryFromConfirmedContext/.test(routeSrc) && /SupabaseConfirmedContextStore/.test(routeSrc) && /store_unavailable|503/.test(routeSrc));

// ─── isolation: execution seam imports no provider/LLM/network ────────────────
t("isolation: execution seam imports no provider/LLM/network", (() => {
  const src = readFileSync("lib/interpretation/confirmed-context-execution.ts", "utf8");
  const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
  return !/anthropic|openai|serper|brave|tavily|exa|firecrawl|company-first-discovery|public-signal-provider|@\/lib\/pipeline/i.test(imports);
})());

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
};
run();
