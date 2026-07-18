// Unit tests: deterministic portfolio depth (statuses/decay/momentum/
// allocation) + pilot cost estimates. Run: npm run test:pilot-depth

import { derivePortfolioStatus, deriveDecay, deriveMomentum, deriveAllocation } from "@/lib/products/report-experience";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };
const daysIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

// Portfolio statuses — factor-based, never a single score
t("HOT+grounded → act_now", derivePortfolioStatus({ tier: "HOT", evidence_grounded: true, latest_date: daysIso(10) }).status === "act_now");
t("HOT sin grounding → investigate", derivePortfolioStatus({ tier: "HOT", evidence_grounded: false, latest_date: daysIso(10) }).status === "investigate");
t("WARM → investigate", derivePortfolioStatus({ tier: "WARM", evidence_grounded: true, latest_date: daysIso(10) }).status === "investigate");
t("COLD grounded reciente → monitor", derivePortfolioStatus({ tier: "COLD", evidence_grounded: true, latest_date: daysIso(30) }).status === "monitor");
t("COLD grounded viejo → reserve", derivePortfolioStatus({ tier: "COLD", evidence_grounded: true, latest_date: daysIso(80) }).status === "reserve");
t("DISCARD → reject", derivePortfolioStatus({ tier: "DISCARD", evidence_grounded: true, latest_date: daysIso(5) }).status === "reject");
t("statuses explican factores", derivePortfolioStatus({ tier: "HOT", evidence_grounded: true, latest_date: daysIso(5) }).because.length > 20);

// Decay — date-driven with revalidation dates
t("≤30d → fresh", deriveDecay(daysIso(10)).state === "fresh");
t("≤60d → active", deriveDecay(daysIso(45)).state === "active");
t("≤90d → aging", deriveDecay(daysIso(75)).state === "aging");
t("≤120d → stale", deriveDecay(daysIso(100)).state === "stale");
t(">120d → revalidation_required", deriveDecay(daysIso(150)).state === "revalidation_required");
t("sin fecha → revalidation_required", deriveDecay(null).state === "revalidation_required");
t("decay trae fecha de revalidación", /^\d{4}-\d{2}-\d{2}$/.test(deriveDecay(daysIso(10)).revalidate_by));

// Momentum — honest with single data point
t("1 evento → insufficient_data", deriveMomentum([daysIso(10)]).state === "insufficient_data");
t("2 eventos recientes → accelerating", deriveMomentum([daysIso(10), daysIso(35)]).state === "accelerating");
t("reciente + viejo → positive", deriveMomentum([daysIso(40), daysIso(120)]).state === "positive");
t("todo viejo → weakening", deriveMomentum([daysIso(100), daysIso(150)]).state === "weakening");
t("momentum explica factores", deriveMomentum([daysIso(10)]).factors.includes("single point"));

// Allocation — counts + reasons, no arbitrary percentages
const alloc = deriveAllocation([
  { status: "act_now", label: "", because: "" }, { status: "investigate", label: "", because: "" },
  { status: "monitor", label: "", because: "" }, { status: "reject", label: "", because: "" },
]);
t("allocation cuenta estados", alloc.line === "1 act now · 1 investigate · 1 monitor · 0 reserve · 1 reject");
t("allocation sin porcentajes arbitrarios", !/%/.test(alloc.line + alloc.detail));
t("allocation explica factores", alloc.detail.length > 40);
const noAct = deriveAllocation([{ status: "investigate", label: "", because: "" }]);
t("sin act_now recomienda validar antes que outreach", noAct.detail.includes("validating"));

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
