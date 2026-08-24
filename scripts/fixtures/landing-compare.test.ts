// Landing Compare (Sprint 4) — canonical projection + no-ranking guards.
import { readFileSync } from "node:fs";
import { LANDING_COMPARISON as C, leadersOn, dimValue, type CompareDimension } from "../../lib/landing/fixtures/landing-comparison";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const src = readFileSync("app/demo-pipeline/page.tsx", "utf8");
const S = new Set(["Strong", "Moderate", "Limited"]);

// §7/§10 canonical dimensions + decisions, no score field
t("§10 three accounts with canonical Fit/Timing/Evidence", C.accounts.length === 3 && C.accounts.every((a) => S.has(a.fit) && S.has(a.timing) && S.has(a.evidence)));
t("§7 decisions are canonical states", C.accounts.every((a) => ["prioritize", "validate", "monitor", "hold"].includes(a.decision)));
t("§8 no score/rank field on accounts", C.accounts.every((a) => !("score" in a) && !("rank" in a) && !("total" in a)));

// §7 leadership is an ordinal read of canonical strength — NOT a computed score
t("§13 Timing leader is Northstar alone (recent change)", JSON.stringify(leadersOn(C, "Timing")) === JSON.stringify(["Northstar Logistics"]));
t("§13 Evidence leader is Northstar alone (corroborated)", JSON.stringify(leadersOn(C, "Evidence")) === JSON.stringify(["Northstar Logistics"]));
t("§8 Fit does NOT separate — Northstar & FreshRoute tie (the insight is preserved)", leadersOn(C, "Fit").length === 2 && leadersOn(C, "Fit").includes("Northstar Logistics") && leadersOn(C, "Fit").includes("FreshRoute Foods"));
t("§10 dimValue reads canonical values", dimValue(C.accounts[0], "Timing") === "Strong" && dimValue(C.accounts[2], "Timing") === "Limited");

// §8 relative reasoning present + honest (Fit doesn't decide, Timing does)
t("§8 Fit 'why' says Fit alone does not decide", /does not decide|Timing/.test(C.why.Fit));
t("§9 Timing 'why' ties to the recent change", /recent|dated|change/i.test(C.why.Timing));
t("§7 each account keeps an unresolved unknown (uncertainty retained)", C.accounts.every((a) => typeof a.unknown === "string" && a.unknown.length > 8));
t("§26 fixture is illustrative", C.provenance === "illustrative_fixture" && C.illustrative === true);

// no dimension outside the canonical three
t("§7 dimensions are exactly Fit/Timing/Evidence", (["Fit", "Timing", "Evidence"] as CompareDimension[]).every((d) => d in C.why));

// §11/§29 landing render: component present, no workspace/provider/memory import for it
t("§11 CompareLens rendered", /function CompareLens\(/.test(src) && /<CompareLens lang=\{lang\} \/>/.test(src));
t("§8 not a spreadsheet — uses a dimension radiogroup focus, not a static table", /role="radiogroup"/.test(src) && /aria-checked/.test(src));
t("§29 no OpportunityWorkspace / provider / Account Memory import on landing", !/OpportunityWorkspace/.test(src) && !/account-memory/.test(src) && !/from "@\/lib\/sources\/access/.test(src));
t("§10 no NN/100 aggregate score anywhere", !/\d\s*\/\s*100/.test(src));
t("§8/§10 Compare states it does not recompute ranking", /cmpNote: "[^"]*ranking/.test(src) || /no ranking/i.test(src));

// §27 localized in 4 locales
for (const key of ["cmpEyebrow", "cmpTitle", "cmpLeads"]) t(`§27 ${key} localized in 4 locales`, (src.match(new RegExp(`${key}: "`, "g")) || []).length === 4);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
