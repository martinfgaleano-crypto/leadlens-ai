// Unit tests: counterevidence-v1 + adversarial-review-v1.
// Run: npm run test:counterevidence

import { assessCounterevidence, applyCounterevidence } from "@/lib/discovery/counterevidence";
import { adversarialReview } from "@/lib/discovery/adversarial-review";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// ── Counterevidence markers ──
const outsourced = assessCounterevidence({ content: "la operación logística está tercerizada con un operador externo", event_summary: "Nueva bodega", days_old: 30, operational_fit: false, corroboration: "medium" });
t("tercerización detectada como counterevidence", outsourced.counterevidence.some((c) => c.includes("tercerizada")));
t("tercerización genera explicación alternativa", outsourced.alternative_explanation !== null);
t("riesgo alto con tercerización", outsourced.thesis_risk === "high");

const provider = assessCounterevidence({ content: "la compañía ya cuenta con un proveedor tecnológico para su operación", event_summary: "Inversión", days_old: 20, operational_fit: true, corroboration: "high" });
t("proveedor existente detectado", provider.counterevidence.some((c) => c.includes("proveedor")));

const cancelled = assessCounterevidence({ content: "la empresa aplazó el proyecto de expansión por condiciones del mercado", event_summary: "Expansión", days_old: 15, operational_fit: true, corroboration: "medium" });
t("evento aplazado detectado (penalidad mayor)", cancelled.confidence_adjustment >= 15);

const clean = assessCounterevidence({ content: "bavaria invirtió cop 115.000 millones en la ampliación de su red de tiendas propias con presupuesto aprobado", event_summary: "Inversión Bavaria", days_old: 20, operational_fit: true, corroboration: "high" });
t("sin marcadores → riesgo bajo", clean.thesis_risk === "low", clean.thesis_risk);
t("ausencia de CE ≠ certeza: preguntas abiertas persisten", clean.unresolved_questions.length > 0);

const stale = assessCounterevidence({ content: "evento sin marcadores", event_summary: null, days_old: 150, operational_fit: true, corroboration: "medium" });
t("señal >120 días cuenta como counterevidence de timing", stale.counterevidence.some((c) => c.includes("120")));

// ── applyCounterevidence: ajusta, nunca rescata, nunca hard-rechaza ──
const dn = applyCounterevidence("prioritaria", 90, outsourced);
t("CE alto degrada prioritaria → investigar", dn.verdict === "investigar" || dn.verdict === "monitorear");
t("CE reduce score", dn.score < 90);
const keep = applyCounterevidence("investigar", 80, clean);
t("CE bajo no degrada", keep.verdict === "investigar" && keep.score >= 75);
t("CE nunca produce rechazar por sí solo", applyCounterevidence("monitorear", 55, outsourced).verdict !== "rechazar");

// ── Adversarial review ──
const base = { company: "Bavaria", identity_confidence: 90, domain: "bavaria.co", organization_eligible: true, entity_role_is_account: true, signal_association_ok: true, materiality: "high" as const, operational_fit: true, commercial_fit_score: 85, causal_thesis_specific: true, corroboration: "high" as const, days_old: 20, has_next_step: true, counterevidence: clean, generator_verdict: "prioritaria" as const };
t("caso limpio → confirm", adversarialReview(base).verdict === "confirm");
t("identidad débil → reject", adversarialReview({ ...base, identity_confidence: 40 }).verdict === "reject");
t("rol incidental → reject", adversarialReview({ ...base, entity_role_is_account: false }).verdict === "reject");
t("sin fit operacional → reject", adversarialReview({ ...base, operational_fit: false }).verdict === "reject");
t("corroboración insuficiente → reject", adversarialReview({ ...base, corroboration: "insufficient" }).verdict === "reject");
t("1 objeción seria → downgrade", adversarialReview({ ...base, causal_thesis_specific: false }).verdict === "downgrade");
t("3 objeciones serias → monitor", adversarialReview({ ...base, causal_thesis_specific: false, corroboration: "low", days_old: 160 }).verdict === "monitor");
const dis = adversarialReview({ ...base, identity_confidence: 40 });
t("desacuerdo generador-revisor registrado", dis.disagrees_with_generator === true);
t("objeciones listadas", dis.objections.length > 0);

// ── Source utility (source-utility-v1) ──
import { newSourceLedger, noteUrl, noteOutcome, sourceUtilityScore } from "@/lib/discovery/source-utility";
{
  const L = newSourceLedger();
  t("dominio desconocido → baseline 50", sourceUtilityScore(L, "desconocido.com") === 50);
  t("prensa observada con eventos > desconocido", sourceUtilityScore(L, "larepublica.co") > 50);
  t("agregador observado < desconocido", sourceUtilityScore(L, "es-us.noticias.yahoo.com".split(".").slice(-2).join(".")) < 50 || sourceUtilityScore(L, "yahoo.com") < 50);
  noteUrl(L, "bueno.com"); noteOutcome(L, "bueno.com", { extracted: true, valid_date: true, trigger_event: true, deep_candidate: true });
  t("evidencia in-run sube el score", sourceUtilityScore(L, "bueno.com") > 50);
  noteUrl(L, "malo.com"); noteOutcome(L, "malo.com", { extracted: true }); noteOutcome(L, "malo.com", { extracted: true });
  t("2 extracciones sin fecha → penalizado", sourceUtilityScore(L, "malo.com") < 50);
  t("in-run domina al prior", sourceUtilityScore(L, "bueno.com") > sourceUtilityScore(L, "larepublica.co"));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
