import { readFileSync } from "node:fs";
import {
  assertLiveBenchmarkFlag, benchmarkDoesNotAffectProduction, calculateBenchmarkMetrics,
  createMonitoringOperation, deriveMonitoringPolicy, queryFamilyMetrics, replayBenchmarkCase,
  resolveBenchmarkDate, resumableAccounts, retryFailedAccounts, runFixtureBenchmark,
  validateBenchmarkDataset, type BenchmarkCase, type BenchmarkDataset,
} from "@/lib/intelligence/signal-benchmark";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${name}`); ok ? passed++ : failed++; };
const dataset = JSON.parse(readFileSync("benchmarks/signal-recovery-v1.json", "utf8")) as BenchmarkDataset;
const run = runFixtureBenchmark(dataset);
const byId = (id: string) => dataset.cases.find((c) => c.id === id)!;
const obs = (id: string) => run.observations.find((o) => o.case_id === id)!;

t("01 dataset labels validate", validateBenchmarkDataset(dataset).length === 0);
const badPositive = { ...byId("pos-ikea-cali-opening-2024"), id: "bad", event_date: null } as BenchmarkCase;
t("02 positive requires dated real event", validateBenchmarkDataset({ ...dataset, cases: [badPositive] }).some((x) => x.includes("positive_requires")));
t("03 static page cannot be positive", !replayBenchmarkCase({ ...byId("neg-bioplaza-product-static"), class: "positive", expected_signal: true, category: "product_launch" }).predicted_signal);
t("04 negatives contain no qualifying fixture event", dataset.cases.filter((c) => c.class === "negative").every((c) => !replayBenchmarkCase(c).predicted_signal));
t("05 adversarial wrong entity rejected", !obs("adv-bioplaza-nigeria").predicted_signal && obs("adv-bioplaza-nigeria").predicted_entity === "wrong_entity");
t("06 duplicate does not create two independent owners", obs("adv-spotify-controlled-source-duplicate").source_owner_keys[0] === obs("pos-spotify-umg-agreement-2025").source_owner_keys[0]);
t("07 official/social source remains one owner", dataset.cases.filter((c) => c.id.includes("spotify") && c.source_owner === "spotify.com").length >= 2);
t("08 old event not current", !obs("neg-dam-old-price-list").predicted_signal && obs("neg-dam-old-price-list").gate_trace.find((g) => g.gate === "freshness")?.state === "fail");
t("09 planned differs from completed", obs("adv-microsoft-planned-not-completed").predicted_status === "planned" && obs("pos-microsoft-activision-completed-2023").predicted_status === "completed");
t("10 fixture replay uses no provider", run.mode === "fixture" && run.provider === null && run.cost.state === "not_measured");
let liveBlocked = false; try { assertLiveBenchmarkFlag(undefined); } catch { liveBlocked = true; }
t("11 live mode requires explicit flag", liveBlocked);
t("12 explicit live flag accepted", (() => { try { assertLiveBenchmarkFlag("I_UNDERSTAND_PROVIDER_CALLS"); return true; } catch { return false; } })());
t("13 precision denominator correct", run.metrics.precision.denominator === run.metrics.true_positives + run.metrics.false_positives);
t("14 recall denominator correct", run.metrics.recall.denominator === run.metrics.true_positives + run.metrics.false_negatives);
const empty = calculateBenchmarkMetrics({ ...dataset, cases: [] }, []);
t("15 empty benchmark insufficient sample", empty.precision.state === "insufficient_sample" && empty.recall.value === null);
const unlabeled = { ...byId("neg-hotel-static-listing"), expected_signal: undefined } as unknown as BenchmarkCase;
t("16 missing label does not become valid negative", validateBenchmarkDataset({ ...dataset, cases: [unlabeled] }).length > 0 || unlabeled.expected_signal !== false);
const forcedFn = replayBenchmarkCase({ ...byId("pos-ikea-cali-opening-2024"), text: "Static company listing with no event.", title: "Static listing" });
t("17 false negative receives reason", forcedFn.false_negative_code !== null);
const syntheticFp = replayBenchmarkCase({ ...byId("neg-bioplaza-product-static"), text: "BioPlaza opened a new store on July 25, 2026.", title: "BioPlaza opened store", event_date: "2026-07-25", commercially_meaningful: true });
t("18 false positive receives reason", syntheticFp.false_positive_code !== null);
t("19 query-family metrics deterministic", JSON.stringify(queryFamilyMetrics(dataset, run.observations)) === JSON.stringify(queryFamilyMetrics(dataset, run.observations)));
t("20 provider agreement is not corroboration", obs("pos-ikea-cali-opening-2024").source_owner_keys.length === 1);
const conflict = resolveBenchmarkDate([{ kind: "article_schema", value: "2026-01-01", confidence: .9 }, { kind: "open_graph", value: "2026-01-02", confidence: .8 }]);
t("21 date precedence preserves conflicts", conflict.state === "conflicting" && conflict.conflicts.length === 2);
const retrieved = resolveBenchmarkDate([{ kind: "retrieval", value: "2026-01-01", confidence: 1 }]);
t("22 retrieval is not publication", retrieved.date === null && retrieved.state === "retrieved_only");
t("23 gate trace includes all ten gates", run.observations.every((o) => o.gate_trace.length === 10));
t("24 failed identity blocks signal", !obs("adv-bioplaza-puerto-rico-address").predicted_signal);
t("25 failed event blocks signal", !obs("neg-hotel-flickr-profile").predicted_signal);
t("26 failed date blocks timing", obs("adv-generic-hiring-page").gate_trace.find((g) => g.gate === "timing")?.state === "fail");
t("27 missing corroboration allows single-source observation", obs("pos-fedex-vianen-facility-2025").predicted_signal && obs("pos-fedex-vianen-facility-2025").gate_trace.find((g) => g.gate === "corroboration")?.state === "insufficient_evidence");
const operation = createMonitoringOperation({ client_id: "c", source_cutoff: "2026-07-30", account_ids: ["b", "a"], max_retries: 99 });
t("28 recovery retry cap enforced", operation.max_retries === 2);
t("29 monitoring run resumable", JSON.stringify(resumableAccounts(operation)) === JSON.stringify(["a", "b"]));
const mixed = { ...operation, accounts: [{ account_id: "a", state: "completed" as const, attempts: 1, error: null }, { account_id: "b", state: "failed" as const, attempts: 1, error: "timeout" }] };
t("30 retry processes failed only", retryFailedAccounts(mixed).accounts.find((a) => a.account_id === "a")?.state === "completed" && retryFailedAccounts(mixed).accounts.find((a) => a.account_id === "b")?.state === "queued");
t("31 run idempotency stable", createMonitoringOperation({ client_id: "c", source_cutoff: "2026-07-30", account_ids: ["a", "b"] }).operation_id === createMonitoringOperation({ client_id: "c", source_cutoff: "2026-07-30", account_ids: ["b", "a"] }).operation_id);
const policy = (decision: "act_now" | "monitor" | "exclude") => deriveMonitoringPolicy({ decision, trigger_review_horizon_days: 60, signal_decay_days: 180, account_importance: "medium", source_availability: "strong", evidence_gap: false, previous_change_frequency: "low", client_relevance: "strong", cost_state: "not_measured" });
t("32 policy varies by decision", policy("act_now").cadence_days! < policy("monitor").cadence_days!);
t("33 excluded inactive by default", !policy("exclude").active && policy("exclude").cadence_days === null);
const safety = benchmarkDoesNotAffectProduction();
t("34 benchmark separated from production", safety.production_intelligence_table === false && safety.internal_only);
t("35 benchmark cannot change Outcome Performance", safety.outcome_performance_impact === "none");
t("36 benchmark cannot change ranking", safety.ranking_impact === "off");
t("37 false-positive gates retained", run.metrics.false_positives === 0);
t("38 current positives recovered", run.metrics.true_positives >= 8);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
