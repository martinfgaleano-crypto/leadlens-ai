// Execution Context Adapter — Stage A → canonical Stage B commercial context.
// Proves the doorway maps CONFIRMED context into the real canonical
// CommercialContext, refuses everything unconfirmed/unsupported/ambiguous, and
// leaks no raw prose, no queries, and no evidence/signal/fit/timing/decision.
// No network, no provider, no LLM.
import { readFileSync } from "node:fs";
import {
  adaptConfirmedContext,
  adaptInterpretation,
  type AdapterResult,
} from "@/lib/interpretation/execution-context-adapter";
import { confirmInterpretation } from "@/lib/interpretation/confirmed-commercial-context";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import {
  ADV_INVESTORS,
  ADV_HELP_COMPANIES_GROW,
  ADV_FIND_COMPANIES,
  ADV_CONSULTING_NO_MARKET,
  ADV_CYBER_BANKS_NOT_FINTECH,
} from "@/lib/interpretation/fixtures/adversarial";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

const adapterSrc = readFileSync("lib/interpretation/execution-context-adapter.ts", "utf8");
const opts = (id: string) => ({ contextId: id });
const golden = Object.values(GOLDEN_FIXTURES);
const okExec = (r: AdapterResult) => (r.ok ? r.execution : null);

// ─── Golden fixtures map through into canonical execution context ──────────────
const soft = adaptInterpretation(GOLDEN_FIXTURES.software_manufacturing, opts("ctx_soft"));
t("golden software → adapts ok", soft.ok);
t("golden software → canonical CommercialContext buyer names manufacturers, goal set",
  !!okExec(soft) &&
  /manufacturer/i.test(okExec(soft)!.commercialContext.buyer) &&
  okExec(soft)!.commercialContext.commercial_goal.length > 0 &&
  okExec(soft)!.commercialContext.offer.length > 0);
t("golden software → signal HYPOTHESES become WATCH families (new_facility/acquisition/expansion)",
  !!okExec(soft) &&
  ["new_facility", "acquisition", "expansion"].every((f) => okExec(soft)!.watchSignalFamilies.includes(f as never)));
t("golden software → no geography stated ⇒ empty target_countries (no invented country)",
  !!okExec(soft) && okExec(soft)!.commercialContext.target_countries.length === 0);

t("golden consulting → adapts ok", adaptInterpretation(GOLDEN_FIXTURES.consulting, opts("ctx_cons")).ok);
t("golden partnerships → adapts ok", adaptInterpretation(GOLDEN_FIXTURES.partnerships, opts("ctx_part")).ok);
t("ALL golden fixtures confirm AND adapt into execution", golden.every((f, i) => adaptInterpretation(f, opts(`ctx_g${i}`)).ok));

// ─── §17/§40 — disqualifiers are CONFIGURATION, not counterevidence ────────────
const cyber = adaptInterpretation(ADV_CYBER_BANKS_NOT_FINTECH, opts("ctx_cyber"));
t("cyber/banks/not-fintech → adapts ok and fintech is a hard EXCLUSION (config, not counterevidence)",
  cyber.ok && !!okExec(cyber) && okExec(cyber)!.hardExclusions.some((r) => /fintech/i.test(r)));

// ─── §40 execution gates — refusals ───────────────────────────────────────────
const investors = adaptInterpretation(ADV_INVESTORS, opts("ctx_inv"));
t("unsupported objective (investors) → execution REFUSED as unsupported_objective",
  !investors.ok && investors.reason === "unsupported_objective");

t("vague 'help companies grow' → execution REFUSED (blocking gap)", !adaptInterpretation(ADV_HELP_COMPANIES_GROW, opts("x1")).ok);
t("'find companies' (no target) → execution REFUSED", !adaptInterpretation(ADV_FIND_COMPANIES, opts("x2")).ok);
t("consulting with no market (target blocker) → execution REFUSED", !adaptInterpretation(ADV_CONSULTING_NO_MARKET, opts("x3")).ok);

// Unconfirmed interpretation cannot execute.
const draftish = structuredClone(GOLDEN_FIXTURES.software_manufacturing);
(draftish as { interpretationStatus: string }).interpretationStatus = "needs_clarification";
(draftish as { clarification: { blockers: unknown[] } }).clarification.blockers = [
  { id: "b", priority: "commercial_objective", reason: "unclear" },
];
t("interpretation with open blocker → execution REFUSED (not confirmable)", !adaptInterpretation(draftish, opts("x4")).ok);

// ─── Degenerate confirmed context is defensively rejected by the adapter ───────
const confirmed = confirmInterpretation(GOLDEN_FIXTURES.software_manufacturing, opts("ctx_def"));
if (confirmed.ok) {
  const noGoal = structuredClone(confirmed.context);
  (noGoal.objective as { description: string }).description = "   ";
  const r = adaptConfirmedContext(noGoal);
  t("confirmed context with empty commercial goal → adapter REFUSES (not_executable)",
    !r.ok && r.reason === "not_executable" && (r as { missing: string[] }).missing.includes("commercial_goal"));

  // discovery-required target with no descriptors is a VALID executable state.
  const discovery = structuredClone(confirmed.context);
  discovery.targetAccountProfile = {
    ...discovery.targetAccountProfile,
    organizationTypes: [], industries: [], namedAccounts: [],
    definitionStatus: "discovery_required",
  };
  t("confirmed context, discovery_required + empty buyer → still adapts (LeadLens discovers universe)",
    adaptConfirmedContext(discovery).ok);

  // Context identity + version are preserved (Account Memory cause attribution).
  const versioned = structuredClone(confirmed.context);
  versioned.version = 3;
  versioned.supersedes = { contextId: "ctx_def", version: 2 };
  const vr = adaptConfirmedContext(versioned);
  t("context version + supersedes retained through adapter",
    vr.ok && vr.execution.ref.version === 3 && vr.execution.ref.contextId === "ctx_def" &&
    vr.execution.ref.supersedes?.version === 2);
} else {
  t("PRECONDITION: golden software confirms", false);
  t("PRECONDITION: golden software confirms", false);
  t("PRECONDITION: golden software confirms", false);
}

// ─── Truth boundaries on the OUTPUT ───────────────────────────────────────────
const softExec = okExec(soft)!;

// §28 — raw prose is NOT required downstream: the confirmed context carries no
// raw input, and the adapter output never echoes the original sentence ref.
t("§28 execution output carries NO raw prose (rawInputRef never leaks downstream)",
  !JSON.stringify(softExec).includes("golden:software_manufacturing"));

// §29 — query generation is owned downstream, never by the adapter.
t("§29 adapter emits NO provider queries (no query field, watch families are canonical tokens)",
  !/quer(y|ies)/i.test(JSON.stringify(softExec)) &&
  softExec.watchSignalFamilies.every((f) => /^[a-z_]+$/.test(f)));

// §8 — the canonical commercial context has ONLY configuration keys — no
// evidence / signal / fit / timing / decision / verification fields.
const ccKeys = Object.keys(softExec.commercialContext).sort().join(",");
t("§8 canonical CommercialContext has exactly the config keys (no evidence/fit/timing/decision leak)",
  ccKeys === "buyer,commercial_goal,company_description,derived_region,offer,problem_solved,target_countries");
t("§8 no evidence/observation vocabulary anywhere in the mapped commercial context",
  !/(evidence|observed|verified|counterevidence|account_fit|\btiming\b|decision|externally)/i.test(JSON.stringify(softExec.commercialContext)));

// §57 — the adapter module imports no provider / LLM / network / persistence.
t("§57 adapter isolation: no provider/LLM/network/persistence imports", (() => {
  const importLines = adapterSrc.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
  return !/anthropic|openai|providers|serper|brave|tavily|exa|firecrawl|supabase|fetch|node:http|apollo/i.test(importLines);
})());
// The adapter reuses the canonical normalizer instead of a parallel ontology.
t("reuse: adapter maps into canonical lib/commercial commercial-context (no second pipeline)",
  /from ["']@\/lib\/commercial\/commercial-context["']/.test(adapterSrc) && /normalizeCommercialContext/.test(adapterSrc));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
