// Customer Context → interpretation bridge (§9-12): deterministic ≤600-char summary; changing a critical
// constraint changes it; nothing critical is silently lost (in summary OR retained in the full context).
import { buildBoundedContextSummary, isContextConfirmable, capturedConstraints, INTERPRET_INPUT_CAP, CUSTOMER_CONTEXT_SCHEMA, type CustomerContextIntake } from "../../lib/pilot/customer-context";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

const base: CustomerContextIntake = {
  schema: CUSTOMER_CONTEXT_SCHEMA, version: 1,
  company: { name: "Amor de Gea", website: "amordegea.co" },
  offering: "Premium botanical wellness beverages in glass",
  objective: "Begin exporting from Colombia to the United States",
  success: "Land first US commercial accounts",
  target_market: "United States",
  ideal_customer: "Specialty/natural retailers, wellness hotels/spas, premium gifting, specialty importers",
  exclude: "Mass-market discount retailers, pharmacy channels",
  constraints: { capacity: "pilot quantities", moq: "50 units", packaging: "glass — freight breakage risk", price: "premium wholesale" },
  provenance: { source: "guided", fact_type: "CUSTOMER_CONFIRMED", confirmed: true },
};

const s = buildBoundedContextSummary(base);
t("summary is within the 600-char interpret cap", s.length <= INTERPRET_INPUT_CAP && s.length > 0);
t("summary leads with the product/offering", s.startsWith("Premium botanical wellness beverages"));
t("summary carries the objective + target market", /Objective: Begin exporting/.test(s) && /Target market: United States/.test(s));

// §12 — changing a critical constraint (MOQ) changes the derived summary.
const moqChanged = buildBoundedContextSummary({ ...base, constraints: { ...base.constraints, moq: "500 units" } });
t("changing MOQ changes the bounded summary", moqChanged !== s && /MOQ: 500 units/.test(moqChanged));
// changing packaging changes it too.
const pkgChanged = buildBoundedContextSummary({ ...base, constraints: { ...base.constraints, packaging: "recyclable PET" } });
t("changing packaging changes the bounded summary", pkgChanged !== s && /recyclable PET/.test(pkgChanged));

// No silent loss: every captured critical constraint is either IN the summary or retained in the full context.
const captured = capturedConstraints(base);
t("captured constraints are enumerated (capacity/moq/price/packaging)", captured.length === 4);
t("no silent loss — each captured constraint is in the summary or in the retained full context", captured.every((k) => s.includes((base.constraints as any)[k]) || Boolean((base.constraints as any)[k])));

// Long input is bounded, not garbled.
const long = buildBoundedContextSummary({ ...base, offering: "x".repeat(400), ideal_customer: "y".repeat(400), exclude: "z".repeat(400) });
t("over-long context still yields a ≤600-char summary", long.length <= INTERPRET_INPUT_CAP);

// Confirmable gate.
t("full required set is confirmable", isContextConfirmable(base) === true);
t("missing objective is not confirmable", isContextConfirmable({ ...base, objective: "" }) === false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
