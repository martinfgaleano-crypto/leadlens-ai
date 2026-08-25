// Confirmed context persistence + live discovery handoff.
// Proves: confirmation is the durable write gate; versions are immutable and
// owner-isolated; only confirmed/executable context reaches canonical discovery
// criteria; raw prose is never required; user claims never become evidence.
// No network, no provider, no LLM. In-memory store stands in for Supabase so the
// DOMAIN logic (gate/versioning/idempotency/isolation) is fully exercised.
import { readFileSync } from "node:fs";
import {
  InMemoryConfirmedContextStore,
  persistConfirmedContext,
  loadConfirmedContext,
} from "@/lib/interpretation/confirmed-context-store";
import {
  confirmedContextToDiscoveryCriteria,
  prepareDiscoveryFromContext,
} from "@/lib/interpretation/discovery-handoff";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import {
  ADV_INVESTORS,
  ADV_HELP_COMPANIES_GROW,
  ADV_CONSULTING_NO_MARKET,
  ADV_CYBER_BANKS_NOT_FINTECH,
} from "@/lib/interpretation/fixtures/adversarial";
import type { CompanyInterpretationV1 } from "@/lib/interpretation/company-interpretation";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const USER_A = "user-aaa";
const USER_B = "user-bbb";
const clock = () => new Date("2026-08-25T12:00:00.000Z");

// ─── PRECONDITION (§44 git/preconditions surface at repo level; here: contracts) ─
t("PRECONDITION: golden fixtures present (software/consulting/partnerships)",
  !!GOLDEN_FIXTURES.software_manufacturing && !!GOLDEN_FIXTURES.consulting && !!GOLDEN_FIXTURES.partnerships);

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
{
  const store = new InMemoryConfirmedContextStore();
  const r1 = await persistConfirmedContext(store, GOLDEN_FIXTURES.software_manufacturing, { userId: USER_A, contextId: "ctx1", now: clock });
  t("persist: first confirmed context → version 1, created", r1.ok && r1.record.version === 1 && r1.created);

  // Idempotent re-confirm of identical intent → no new version.
  const r2 = await persistConfirmedContext(store, GOLDEN_FIXTURES.software_manufacturing, { userId: USER_A, contextId: "ctx1", now: clock });
  t("persist: duplicate confirm of same intent → idempotent (still v1, not created)",
    r2.ok && r2.record.version === 1 && r2.created === false && store.all().length === 1);

  // A genuine edit (changed objective description) → new version 2, supersedes 1.
  const edited: CompanyInterpretationV1 = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  (edited.commercialObjective as { description: string }).description = "Identify manufacturers opening new plants in North America.";
  edited.targetAccountProfile = { ...edited.targetAccountProfile, geographies: [{ label: "United States", regionKey: "north_america" }] };
  const r3 = await persistConfirmedContext(store, edited, { userId: USER_A, contextId: "ctx1", now: clock });
  t("persist: edited intent → version 2 supersedes version 1", r3.ok && r3.record.version === 2 && r3.record.supersedesVersion === 1);

  // Historical version unchanged (immutability at the domain level).
  const v1 = await loadConfirmedContext(store, USER_A, { contextId: "ctx1", version: 1 });
  t("persist: historical version 1 remains immutable after v2 written",
    !!v1 && v1.version === 1 && /strong reason to engage/i.test(v1.context.objective.description));

  // Latest lookup vs explicit historical lookup.
  const latest = await loadConfirmedContext(store, USER_A, { contextId: "ctx1" });
  t("persist: latest lookup returns version 2", !!latest && latest.version === 2);
  t("persist: explicit historical lookup returns the requested version", !!v1 && v1.version === 1);

  // Owner isolation: USER_B cannot see USER_A's context.
  const leak = await loadConfirmedContext(store, USER_B, { contextId: "ctx1" });
  t("persist: owner isolation — different user cannot load another user's context", leak === null);

  // Independent contexts per customer.
  await persistConfirmedContext(store, GOLDEN_FIXTURES.consulting, { userId: USER_B, contextId: "ctx1", now: clock });
  const bLatest = await loadConfirmedContext(store, USER_B, { contextId: "ctx1" });
  t("persist: different customers have independent contexts under the same contextId",
    !!bLatest && bLatest.userId === USER_B && bLatest.objectiveType === "advisory_opportunities");

  // Stored payload is validated structured context — no raw prose field.
  t("persist: stored payload is structured ConfirmedCommercialContextV1 (schemaVersion 1, no rawInput)",
    r1.ok && r1.record.context.schemaVersion === "1" && !("rawInput" in (r1.record.context as object)) &&
    !JSON.stringify(r1.record.context).includes("golden:software_manufacturing"));
}

// ─── GATES — unconfirmable / unsupported / blocked never persist ──────────────
{
  const store = new InMemoryConfirmedContextStore();
  const inv = await persistConfirmedContext(store, ADV_INVESTORS, { userId: USER_A, contextId: "c" });
  t("gate: unsupported objective (investors) → NOT persisted", !inv.ok && store.all().length === 0);

  const vague = await persistConfirmedContext(store, ADV_HELP_COMPANIES_GROW, { userId: USER_A, contextId: "c" });
  t("gate: vague 'help companies grow' (blocker) → NOT persisted", !vague.ok && store.all().length === 0);

  const noMarket = await persistConfirmedContext(store, ADV_CONSULTING_NO_MARKET, { userId: USER_A, contextId: "c" });
  t("gate: consulting-no-market (target blocker) → NOT persisted", !noMarket.ok && store.all().length === 0);

  // Fully interpretable but NOT confirmed/ready → not persisted.
  const draft = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  (draft as { interpretationStatus: string }).interpretationStatus = "needs_clarification";
  (draft.clarification as { blockers: unknown[] }).blockers = [{ id: "b", priority: "commercial_objective", reason: "x" }];
  const un = await persistConfirmedContext(store, draft, { userId: USER_A, contextId: "c" });
  t("gate: unconfirmed / needs_clarification interpretation → NOT persisted (cannot execute)",
    !un.ok && store.all().length === 0);
}

// ─── EXECUTION — persisted context reaches canonical discovery criteria ────────
async function reachesDiscovery(fixture: CompanyInterpretationV1, userId: string) {
  const store = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(store, fixture, { userId, contextId: "run", now: clock });
  return prepareDiscoveryFromContext(store, userId, { contextId: "run" }, { outputLanguage: "en", plan: "standard", leadCount: 10 });
}

const soft = await reachesDiscovery(GOLDEN_FIXTURES.software_manufacturing, "u1");
t("exec: software fixture → persisted → loaded → adapter → canonical LeadSearchCriteria",
  soft.ok && soft.criteria.target_industries.some((i) => /manufactur/i.test(i)) && soft.criteria.require_real_discovery === true);
t("exec: software → watch signal families become buying_signals (config), value_proposition set",
  soft.ok && ["new_facility", "acquisition", "expansion"].every((f) => soft.criteria.buying_signals.includes(f)) && soft.criteria.value_proposition.length > 0);
t("exec: software → context version lineage returned (contextId + version)",
  soft.ok && soft.ref.contextId === "run" && soft.ref.version === 1);

t("exec: consulting fixture → reaches canonical discovery criteria", (await reachesDiscovery(GOLDEN_FIXTURES.consulting, "u2")).ok);
t("exec: partnership fixture → reaches canonical discovery criteria (not forced to customer)",
  (await reachesDiscovery(GOLDEN_FIXTURES.partnerships, "u3")).ok);

// Disqualifiers stay CONFIGURATION (exclusion), never counterevidence.
const cyber = await reachesDiscovery(ADV_CYBER_BANKS_NOT_FINTECH, "u4");
t("exec: 'not fintechs' → discovery EXCLUSION config (excluded_industries/disqualification), not counterevidence",
  cyber.ok &&
  (cyber.criteria.excluded_industries.some((x) => /fintech/i.test(x)) || cyber.criteria.disqualification_criteria.some((x) => /fintech/i.test(x))));

// Raw prose is NOT required and NOT present anywhere in the discovery config.
t("exec: raw prose not required — criteria carry no rawInput / original sentence",
  soft.ok && !JSON.stringify(soft.criteria).includes("golden:") && !("rawInput" in (soft.criteria as object)));

// Unknown context → fail safe, never fall back to prose.
{
  const store = new InMemoryConfirmedContextStore();
  const missing = await prepareDiscoveryFromContext(store, "nobody", { contextId: "ghost" });
  t("exec: unknown/unauthorized context → fail safe (context_not_found), no discovery", !missing.ok && missing.reason === "context_not_found");
}

// Historical version selection: a job referencing v1 must get v1's config, not latest.
{
  const store = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(store, GOLDEN_FIXTURES.software_manufacturing, { userId: "uh", contextId: "h", now: clock });
  const edited = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
  edited.targetAccountProfile = { ...edited.targetAccountProfile, industries: ["Aerospace manufacturing"] };
  await persistConfirmedContext(store, edited, { userId: "uh", contextId: "h", now: clock });
  const v1 = await prepareDiscoveryFromContext(store, "uh", { contextId: "h", version: 1 });
  const latest = await prepareDiscoveryFromContext(store, "uh", { contextId: "h" });
  t("exec: explicit historical version yields that version's criteria (lineage preserved)",
    v1.ok && latest.ok && v1.ref.version === 1 && latest.ref.version === 2 &&
    !v1.criteria.target_industries.some((i) => /aerospace/i.test(i)) &&
    latest.criteria.target_industries.some((i) => /aerospace/i.test(i)));
}

// ─── TRUTH BOUNDARIES (end-to-end) ────────────────────────────────────────────
// "Manufacturers are expanding rapidly" is USER CONTEXT; even persisted it never
// becomes fact/signal/timing/evidence. The software golden encodes exactly this
// kind of change claim as an opportunity CONDITION (hypothesis), never observed.
t("truth: no evidence/observation vocabulary in the discovery config produced from user context",
  soft.ok && !/(evidence|observed|verified|counterevidence|what[_\s]?changed|externally|account_fit)/i.test(JSON.stringify(soft.criteria)));
t("truth: signal families are WATCH config (hypotheses), never carry an observation",
  soft.ok && soft.criteria.buying_signals.every((s) => /^[a-z_]+$/.test(s)));

// The confirmed context itself carries only Stage-A verification statuses.
{
  const store = new InMemoryConfirmedContextStore();
  const r = await persistConfirmedContext(store, GOLDEN_FIXTURES.software_manufacturing, { userId: "ut", contextId: "t", now: clock });
  const blob = r.ok ? JSON.stringify(r.record.context) : "";
  t("truth: persisted confirmed context contains NO externally_verified claim (USER_CONFIRMED ≠ EVIDENCE_VERIFIED)",
    r.ok && !blob.includes("externally_verified"));
  t("truth: persisted context has no Fit/Timing/Decision/observed Signal fields",
    r.ok && !/(\baccountFit\b|\bfinalTiming\b|\bdecision\b|observedSignal|"fit"|"timing"|"evidence")/i.test(blob));
}

// ─── LLM BOUNDARY (source-level) — the service cannot reach discovery ─────────
const svcSrc = readFileSync("lib/interpretation/interpret-service.ts", "utf8");
const svcImports = svcSrc.split("\n").filter((l) => /^\s*import\b/.test(l) || /await import\(/.test(l)).join("\n");
t("llm-boundary: interpret-service imports NO discovery/provider/supabase (cannot start discovery from LLM output)",
  !/company-first-discovery|public-signal-provider|runCompanyFirstDiscovery|@\/lib\/providers|supabase|serper|brave|tavily|exa|firecrawl/i.test(svcImports));
t("llm-boundary: interpret-service never calls confirmInterpretation/adapter/prepareDiscovery (draft only; confirmation is a separate explicit step)",
  !/confirmInterpretation|adaptConfirmedContext|prepareDiscoveryFromContext|persistConfirmedContext/.test(svcSrc));

// ─── REUSE — no second pipeline ───────────────────────────────────────────────
const handoffSrc = readFileSync("lib/interpretation/discovery-handoff.ts", "utf8");
t("reuse: discovery handoff builds canonical LeadSearchCriteria via adaptConfirmedContext (no new ontology)",
  /from "@\/types"/.test(handoffSrc) && /adaptConfirmedContext/.test(handoffSrc));
t("isolation: persistence + handoff import no provider/LLM/network", (() => {
  const storeSrc = readFileSync("lib/interpretation/confirmed-context-store.ts", "utf8");
  const imports = (s: string) => s.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
  const bad = /anthropic|openai|serper|brave|tavily|exa|firecrawl|company-first-discovery|public-signal-provider/i;
  return !bad.test(imports(storeSrc)) && !bad.test(imports(handoffSrc));
})());

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
};
run();
