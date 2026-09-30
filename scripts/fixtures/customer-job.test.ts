// Multi-pass customer-job orchestrator (customer-job-v1) — deterministic doubles,
// no network/DB. Validates §38/§39 accumulation, §38 dedup, §25 query novelty,
// §23/§26 route adaptation, §42 rejection memory, §8 Vault write-through, milestone
// → tier readiness (§50-53), and §7/§90 resume.
import {
  newCustomerJobState, runOnePass, runCustomerJob, selectNextPass, isQueryFamilyNovel,
  canonicalKey, tierReadinessFor, type CustomerJobDeps, type PassSpec, type DiscoveredCompany,
  type QualifiedAccount, type RejectionMemoryEntry, type CustomerJobState,
} from "../../lib/intelligence/customer-job";
import { InMemoryCustomerJobStore } from "../../lib/intelligence/customer-job-store";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

const co = (company: string, domain: string, industry = "retail"): DiscoveredCompany => ({ company, domain, country: "United States", industry });

// Scripted discovery per query family. "bad-*" companies are off-target (rejected).
const DISCOVERY: Record<string, DiscoveredCompany[]> = {
  "retail:f1": [co("Alpha Grocers", "alpha.com"), co("Beta Naturals", "beta.com"), co("BadLogistics Co", "badlogistics.com", "logistics")],
  "retail:f2": [co("Beta Naturals", "beta.com"), co("Gamma Market", "gamma.com")], // Beta repeats (dedup)
  "importer:f1": [co("Delta Importers", "delta.com", "importer")],
  "empty:f1": [],
  "empty:f2": [],
};

function makeDeps(calls: { vaultWrite: DiscoveredCompany[][]; save?: InMemoryCustomerJobStore; userId?: string }): CustomerJobDeps {
  return {
    now: () => new Date("2026-09-29T00:00:00Z"),
    vaultFirst: async () => [],
    discover: async (spec: PassSpec) => {
      const discovered = DISCOVERY[spec.queryFamilyId] ?? [];
      return { discovered, providersAttempted: ["brave", "firecrawl"], providerState: { brave: "available" }, rawResults: discovered.length * 3, costUsd: 0.02 };
    },
    vaultWriteThrough: async (companies) => {
      calls.vaultWrite.push(companies);
      return { evaluated: companies.length, new_companies: companies.filter((c) => c.domain).length, existing_rediscovered: 0, rejected_non_account: companies.filter((c) => (c.industry ?? "") === "logistics").length };
    },
    qualify: async (candidates) => {
      const qualified: QualifiedAccount[] = [];
      const rejected: RejectionMemoryEntry[] = [];
      for (const c of candidates) {
        if ((c.industry ?? "") === "logistics") { rejected.push({ key: c.key, company: c.company, reason: "NOT_BUYER", pass: c.firstSeenPass }); continue; }
        qualified.push({ key: c.key, company: c.company, domain: c.domain, route: c.route, decision: "hold", fit: "Strong", timing: null, evidenceCount: 3, qualifiedAtPass: c.firstSeenPass });
      }
      return { qualified, rejected };
    },
    save: calls.save ? (async (s) => { await calls.save!.save(s, calls.userId ?? null); }) : undefined,
  };
}

async function main() {
  // canonicalKey: domain-first, name fallback, www/scheme stripping.
  t("canonicalKey uses domain, strips www/scheme", canonicalKey("X", "https://www.Foo.com/path") === "d:foo.com");
  t("canonicalKey falls back to normalized name", canonicalKey("Café Münchën S.A.", null) === "n:cafe munchen s a");

  // 1-2. Accumulation + dedup across passes.
  {
    const calls = { vaultWrite: [] as DiscoveredCompany[][] };
    const deps = makeDeps(calls);
    const state = newCustomerJobState({ jobId: "j1", customer: "C", objective: "O", contextVersion: 1, geography: "United States", targetCount: 18 });
    const plan: PassSpec[] = [
      { passId: 1, route: "retail", queryFamilyId: "retail:f1", queries: ["q1"] },
      { passId: 2, route: "retail", queryFamilyId: "retail:f2", queries: ["q2"] },
      { passId: 3, route: "importer", queryFamilyId: "importer:f1", queries: ["q3"] },
    ];
    await runOnePass(state, plan[0], deps);
    await runOnePass(state, plan[1], deps);
    await runOnePass(state, plan[2], deps);
    // Alpha, Beta, BadLogistics, Gamma, Delta = 5 unique candidates (Beta deduped once).
    t("candidates accumulate + dedup (5 unique, Beta not doubled)", state.candidates.length === 5);
    // Qualified = Alpha, Beta, Gamma, Delta (BadLogistics rejected). 4.
    t("qualified accumulate across passes (4, logistics excluded)", state.qualified.length === 4);
    t("rejection memory holds the off-target company", state.rejectionMemory.length === 1 && state.rejectionMemory[0].reason === "NOT_BUYER");
    t("Vault write-through invoked every pass with discovered companies", calls.vaultWrite.length === 3 && state.vault.discovered === 6);
    t("Vault new-inserted counts accumulate", state.vault.newInserted === 6);
    t("prior candidates never lost when a new pass runs", state.candidates.some((c) => c.company === "Alpha Grocers") && state.candidates.some((c) => c.company === "Delta Importers"));
    t("spend accumulates across passes", Math.abs(state.spendUsd - 0.06) < 1e-9);
  }

  // 3. Query novelty.
  {
    const state = newCustomerJobState({ jobId: "j2", customer: "C", objective: "O", contextVersion: 1, geography: "US" });
    state.queryHistory.push({ route: "retail", queryFamilyId: "retail:f1", pass: 1, rawResults: 1, newCandidates: 1, qualifiedAdded: 1, status: "productive" });
    t("isQueryFamilyNovel false for a run family", !isQueryFamilyNovel(state, "retail", "retail:f1"));
    t("isQueryFamilyNovel true for a new family", isQueryFamilyNovel(state, "retail", "retail:f2"));
    const plan: PassSpec[] = [
      { passId: 1, route: "retail", queryFamilyId: "retail:f1", queries: [] },
      { passId: 2, route: "importer", queryFamilyId: "importer:f1", queries: [] },
    ];
    const next = selectNextPass(state, plan);
    t("selectNextPass skips the already-run family", next?.queryFamilyId === "importer:f1");
  }

  // 4. Route adaptation: an exhausted route (2 empty passes) is dropped.
  {
    const calls = { vaultWrite: [] as DiscoveredCompany[][] };
    const deps = makeDeps(calls);
    const state = newCustomerJobState({ jobId: "j3", customer: "C", objective: "O", contextVersion: 1, geography: "US" });
    await runOnePass(state, { passId: 1, route: "empty", queryFamilyId: "empty:f1", queries: [] }, deps);
    await runOnePass(state, { passId: 2, route: "empty", queryFamilyId: "empty:f2", queries: [] }, deps);
    const plan: PassSpec[] = [
      { passId: 3, route: "empty", queryFamilyId: "empty:f3", queries: [] },
      { passId: 4, route: "retail", queryFamilyId: "retail:f1", queries: [] },
    ];
    const next = selectNextPass(state, plan);
    t("exhausted route dropped; productive-looking route chosen", next?.route === "retail");
  }

  // 5. Rejection memory prevents re-qualifying the same off-target company.
  {
    const calls = { vaultWrite: [] as DiscoveredCompany[][] };
    const deps = makeDeps(calls);
    const state = newCustomerJobState({ jobId: "j4", customer: "C", objective: "O", contextVersion: 1, geography: "US" });
    await runOnePass(state, { passId: 1, route: "retail", queryFamilyId: "retail:f1", queries: [] }, deps); // BadLogistics rejected
    const before = state.candidates.length;
    // Re-discover BadLogistics in a later family — it must NOT be re-added.
    DISCOVERY["retail:f3"] = [co("BadLogistics Co", "badlogistics.com", "logistics")];
    await runOnePass(state, { passId: 2, route: "retail", queryFamilyId: "retail:f3", queries: [] }, deps);
    t("rejected company not re-added to candidates (rejection memory)", state.candidates.length === before);
    delete DISCOVERY["retail:f3"];
  }

  // 6. Milestone → tier readiness.
  {
    const q = (n: number): QualifiedAccount[] => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, company: `Co${i}`, domain: null, route: "r", decision: "hold" as const, fit: "Strong", timing: null, evidenceCount: 1, qualifiedAtPass: 1 }));
    const r2 = tierReadinessFor(q(2), [2, 6, 12, 18]);
    t("2 qualified → Preview FULL, Brief not", r2.Preview.full === true && r2.Brief.full === false && r2.Preview.actual === 2);
    const r6 = tierReadinessFor(q(6), [2, 6, 12, 18]);
    t("6 qualified → Preview+Brief FULL, Portfolio partial", r6.Brief.full === true && r6.Portfolio.full === false && r6.Portfolio.actual === 6);
    const r18 = tierReadinessFor(q(18), [2, 6, 12, 18]);
    t("18 qualified → all tiers FULL", r18.Premium.full === true && r18.Portfolio.full === true);
  }

  // 7. Resume: persist, reload, continue — accumulated state preserved.
  {
    const store = new InMemoryCustomerJobStore();
    const calls = { vaultWrite: [] as DiscoveredCompany[][], save: store, userId: "u1" };
    const deps = makeDeps(calls);
    const state = newCustomerJobState({ jobId: "j5", customer: "C", objective: "O", contextVersion: 1, geography: "US" });
    await runOnePass(state, { passId: 1, route: "retail", queryFamilyId: "retail:f1", queries: [] }, deps);
    const reloaded = await store.load("j5", "u1");
    t("job state persisted and reloadable (resume)", reloaded !== null && reloaded.candidates.length === state.candidates.length && reloaded.passesCompleted === 1);
    t("owner isolation on load (wrong user → null)", (await store.load("j5", "other")) === null);
    // Continue from reloaded state — no double-count.
    await runOnePass(reloaded!, { passId: 2, route: "importer", queryFamilyId: "importer:f1", queries: [] }, deps);
    t("resumed job extends foundation (Delta added, no reset)", reloaded!.qualified.some((x) => x.company === "Delta Importers") && reloaded!.qualified.length >= state.qualified.length);
  }

  // 8. Full run to a stop condition (no productive passes remaining → partial).
  {
    const calls = { vaultWrite: [] as DiscoveredCompany[][] };
    const deps = makeDeps(calls);
    const state = newCustomerJobState({ jobId: "j6", customer: "C", objective: "O", contextVersion: 1, geography: "US", targetCount: 18 });
    const plan: PassSpec[] = [
      { passId: 1, route: "retail", queryFamilyId: "retail:f1", queries: [] },
      { passId: 2, route: "retail", queryFamilyId: "retail:f2", queries: [] },
      { passId: 3, route: "importer", queryFamilyId: "importer:f1", queries: [] },
    ];
    await runCustomerJob(state, plan, deps, { maxPasses: 24, budgetUsd: 20 });
    t("runCustomerJob runs all novel passes then stops PARTIAL (<target)", state.status === "partial" && state.passesCompleted === 3 && state.qualified.length === 4);
    t("tierReadiness reflects the 4-account foundation (Preview full, Brief partial)", state.tierReadiness.Preview.full === true && state.tierReadiness.Brief.full === false);
  }

  // 9. Bounded qualification must preserve overflow and include its real cost.
  {
    const state = newCustomerJobState({ jobId: "j7", customer: "C", objective: "O", contextVersion: 1, geography: "US" });
    let calls = 0;
    const deps: CustomerJobDeps = {
      now: () => new Date("2026-09-29T00:00:00Z"), vaultFirst: async () => [],
      discover: async (spec) => ({ discovered: spec.passId === 1 ? [co("One", "one.com"), co("Two", "two.com"), co("Three", "three.com")] : [], providersAttempted: ["brave"], providerState: {}, rawResults: 3, costUsd: .01 }),
      vaultWriteThrough: async (xs) => ({ evaluated: xs.length, new_companies: xs.length, existing_rediscovered: 0, rejected_non_account: 0 }),
      qualify: async (xs) => {
        calls++;
        const attempted = xs.slice(0, 1), deferredKeys = xs.slice(1).map((x) => x.key);
        return { qualified: attempted.map((c) => ({ key: c.key, company: c.company, domain: c.domain, route: c.route, decision: "hold" as const, fit: "Strong", timing: null, evidenceCount: 1, qualifiedAtPass: c.firstSeenPass })), rejected: [], deferredKeys, costUsd: .25 };
      },
    };
    await runOnePass(state, { passId: 1, route: "r", queryFamilyId: "r:1", queries: [] }, deps);
    t("bounded qualification leaves overflow unresearched", state.candidates.filter((c) => !c.researched).length === 2);
    await runOnePass(state, { passId: 2, route: "r", queryFamilyId: "r:2", queries: [] }, deps);
    t("later pass drains the deferred backlog", state.candidates.filter((c) => c.researched).length === 2 && calls === 2);
    t("job budget includes discovery plus qualification spend", Math.abs(state.spendUsd - .52) < 1e-9);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
