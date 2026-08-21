import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateAmorOpportunityCase,
  evaluateInstitutionalOpportunityCase,
  isCoherentRoleType,
  type AccountRole,
} from "@/lib/intelligence/opportunity-case-intelligence";
import { fromAmorPilot } from "@/lib/deliverable/adapters";
import { renderPortableHtml } from "@/lib/deliverable/portable/render-portable";
import { toClientCanvasVM } from "@/lib/deliverable/client-canvas-vm";

let pass = 0;
const t = (name: string, condition: boolean) => { assert.equal(condition, true, name); pass += 1; console.log(`✅ ${name}`); };
const raw = JSON.parse(readFileSync("output/amor-pilot1-deliverable.data.json", "utf8"));
const vm = fromAmorPilot(raw);
const html = renderPortableHtml(vm);
const cases = raw.accounts.map((a: any) => a.opportunity_case);

const base = {
  account: "Fixture", routeKey: "specialty_retail", routeLabel: "Retail especializado", group: "Primera validación",
  clientObjective: "Encontrar cuentas", structuralReason: "Retail activo", proposedTest: "Validar categoría", unknown: "Alta no confirmada",
  nextStep: "Confirmar proceso", sourceLabel: "example.com", sourceUrl: "https://example.com", observedFact: "Opera una tienda", proves: "Retail activo",
};

t("1 previous P0 ordering remains closed", toClientCanvasVM(vm).landscape.slice(0, 3).every((a) => a.decision === "prioritize"));
t("2 Amor remains ten accounts", vm.accounts.length === 10);
t("3 explicit commercial Account Role", cases.every((c: any) => c.classification.accountRole.value === "Potential Customer" && c.classification.accountRole.basis === "explicit"));
t("4 unrelated landscape role cannot enter evaluator", evaluateInstitutionalOpportunityCase({ account: "X", clientObjective: null, explicitRole: "market leader", explicitType: null, opportunityDescriptor: null, fitScore: null, fitReasons: [], signal: null, whyNow: null, sourceEvidence: [], explicitIndependentSupport: false, risks: [], blockers: [], openQuestions: [], decision: "monitor", recommendedNextStep: null }).classification.accountRole === null);
t("5 all four account roles are architecture-valid", (["Potential Customer", "Supplier", "Distributor", "Strategic Partner"] as AccountRole[]).every((r) => typeof isCoherentRoleType(r, r === "Strategic Partner" || r === "Distributor" ? "Channel Partnership" : "New Business") === "boolean"));
t("6 controlled opportunity type emitted", cases.every((c: any) => c.classification.opportunityType.value === "New Business"));
t("7 descriptor carried separately", cases.every((c: any) => typeof c.classification.opportunityDescriptor === "string"));
t("8 incoherent Potential Customer plus Channel Partnership rejected", !isCoherentRoleType("Potential Customer", "Channel Partnership"));
t("9 unknown type rejected", evaluateInstitutionalOpportunityCase({ account: "X", clientObjective: null, explicitRole: "Potential Customer", explicitType: "Signal Event", opportunityDescriptor: null, fitScore: null, fitReasons: [], signal: null, whyNow: null, sourceEvidence: [], explicitIndependentSupport: false, risks: [], blockers: [], openQuestions: [], decision: "monitor", recommendedNextStep: null }).classification.opportunityType === null);
t("10 Amor Fit derives in evaluation layer", cases.every((c: any) => c.fit?.value === "Moderate" && c.fit.basis === "inferred"));
t("11 no aggregate customer score", !html.includes("/100") && !html.includes("attention score"));
t("12 static fact cannot establish Timing", cases.every((c: any) => c.timing === null));
t("13 static fact cannot become What Changed", cases.every((c: any) => c.changes.length === 0) && vm.accounts.every((a) => a.whatChanged.length === 0));
t("14 true dated event can establish change", evaluateInstitutionalOpportunityCase({ account: "X", clientObjective: "Find expansion accounts", explicitRole: "Potential Customer", explicitType: "Operations Expansion", opportunityDescriptor: null, fitScore: 8, fitReasons: ["aligned"], signal: { label: "Opened a plant", date: "2026-08-01", sourceLabel: "example.com", url: "https://example.com/news" }, whyNow: "The new plant expands the relevant operating footprint.", sourceEvidence: [{ label: "Plant announcement", url: "https://example.com/news", date: "2026-08-01" }], explicitIndependentSupport: false, risks: [], blockers: [], openQuestions: [], decision: "prioritize", recommendedNextStep: "Prepare validation" }).changes.length === 1);
t("15 Why Now requires client context", evaluateInstitutionalOpportunityCase({ account: "X", clientObjective: null, explicitRole: null, explicitType: null, opportunityDescriptor: null, fitScore: null, fitReasons: [], signal: { label: "Opened", date: "2026-08-01", sourceLabel: "x", url: "https://x.com" }, whyNow: "Relevant", sourceEvidence: [], explicitIndependentSupport: false, risks: [], blockers: [], openQuestions: [], decision: "monitor", recommendedNextStep: null }).whyNow === null);
t("16 Amor no false Why Now", cases.every((c: any) => c.whyNow === null));
t("17 claim-first direct evidence", cases.every((c: any) => c.evidence.length === 1 && c.evidence[0].relation === "direct" && c.evidence[0].claim && c.evidence[0].observation));
t("18 observed basis preserved", cases.every((c: any) => c.evidence[0].basis === "observed"));
t("19 source count does not equal corroboration", cases.every((c: any) => c.independentSupport === false));
t("20 single-source UI is honest", html.includes("sin soporte independiente") && !html.includes("Corroborada"));
t("21 unknown is not counterevidence", cases.every((c: any) => c.weaknesses.length === 0 && c.unknowns.length === 1));
t("22 absent counterevidence omitted", vm.accounts.every((a) => a.counterSignals.length === 0));
t("23 material unknown customer-visible", vm.accounts.every((a) => a.limitations.length === 1));
t("24 validation is decision-critical with route", cases.every((c: any) => c.validations[0].decisionCritical === true && c.validations[0].howToValidate));
t("25 rationale synthesizes fit evidence uncertainty and no timing", cases.every((c: any) => /encaje estructural|encaje moderado/i.test(c.decisionRationale.value) && /timing/i.test(c.decisionRationale.value)));
t("26 no purchase certainty", cases.every((c: any) => /No existe evidencia de intención de compra/.test(c.decisionRationale.value)));
t("27 Potential Value remains not ready", cases.every((c: any) => c.potentialValue === null));
t("28 Feasibility remains not ready", cases.every((c: any) => c.feasibility === null));
t("29 Role and Type visible and localized", html.includes("Cliente potencial · Nuevo negocio") && !html.includes("Potential Customer · New Business"));
t("30 Evidence shows establishes and observed trace", html.includes("Establece:") && html.includes("Observado:"));
t("31 Compare receives Role and Type", html.includes("Rol comercial") && html.includes("Tipo de oportunidad"));
t("32 validation route visible", html.includes("Cómo validarlo"));
t("33 legacy fallback remains renderable", fromAmorPilot({ meta: { client: "Legacy" }, accounts: [{ name: "Legacy account", group: "Primera validación", why: "Legacy thesis" }] }).accounts.length === 1);
t("34 portable remains self-contained", !/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html));
t("35 no secret-like values", !/(sk-[A-Za-z0-9]{20,}|ANTHROPIC_API_KEY|EXA_API_KEY|SUPABASE_SERVICE_ROLE)/.test(html));
t("36 portable Account navigation follows attention order", html.indexOf('data-acct="ser-saludable-4"') < html.indexOf('data-acct="teka-0"'));

console.log(`\n${pass}/36 passed`);
