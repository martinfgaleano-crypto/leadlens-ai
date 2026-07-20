// Unit tests for the deep-validation layer: materiality, corporate identity
// name↔domain matching, homonym guard, corroboration tier, quality rubric.
// Run: npm run test:deep-validation

import { classifyMateriality } from "@/lib/discovery/materiality";
import { nameDomainMatch, signalMatchesIdentity, type CorporateIdentity } from "@/lib/discovery/corporate-identity";
import { scoreOpportunity, corroborationTier } from "@/lib/discovery/quality-rubric";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// ── Materiality ──
t("nueva planta → high", classifyMateriality("Nutresa inauguró una nueva planta en Antioquia").level === "high");
t("amplió su flota → high", classifyMateriality("Coordinadora amplió su flota con 200 vehículos").level === "high");
t("alianza menor → medium", classifyMateriality("La empresa firmó una alianza con un proveedor").level === "medium");
t("premio → low", classifyMateriality("La empresa recibió un premio a la innovación").level === "low");
t("feria vetoes lanzó → low", classifyMateriality("La empresa lanzó su stand en la feria Expologística").level === "low");
t("tiktok/redes → low", classifyMateriality("Síguenos en TikTok e Instagram").level === "low");
t("noticia negativa (aplaza pagos) → low", classifyMateriality("La empresa aplazó los pagos a sus proveedores y crece la flota").level === "low");
t("PR de sostenibilidad → low", classifyMateriality("La empresa avanza en su ruta de sostenibilidad").level === "low");
t("PR + evento material real → high (no vetado)", classifyMateriality("En su plan de sostenibilidad inauguró una nueva planta").level === "high");

// ── Corporate identity: name↔domain ──
t("Servientrega ↔ servientrega.com = 100", nameDomainMatch("Servientrega", "servientrega.com") === 100);
t("Grupo Éxito ↔ grupoexito.com.co ≥ 60", nameDomainMatch("Grupo Éxito", "grupoexito.com.co") >= 60);
t("Terpel ↔ bavaria.com = 0", nameDomainMatch("Terpel", "bavaria.com") === 0);

// ── Homonym guard ──
const coId: CorporateIdentity = { name: "Bavaria", domain: "bavaria.com.co", country: "Colombia", confidence: 90, aliases: [], resolved_from: "x", reasons: [] };
t("señal en dominio propio → ok", signalMatchesIdentity(coId, "https://bavaria.com.co/prensa/inversion", "bavaria invierte", true).ok);
t("homónimo alemán (FAU Erlangen) → NO ok", !signalMatchesIdentity(coId, "https://fau.de/bavaria-campaign", "bavaria campaign germany university", true).ok);
t("contenido colombiano + identidad fuerte → ok", signalMatchesIdentity(coId, "https://portafolio.co/nota", "bavaria anunció inversión en colombia bogotá", true).ok);
const weakId: CorporateIdentity = { ...coId, domain: null, confidence: 30 };
t("identidad débil + solo país → NO ok (posible homónimo)", !signalMatchesIdentity(weakId, "https://x.com/nota", "noticia en colombia", true).ok);

// ── Corroboration ──
t("primaria + 1 independiente → high", corroborationTier(1, true, 90) === "high");
t("1 independiente + identidad fuerte → medium", corroborationTier(1, false, 70) === "medium");
t("solo identidad → low", corroborationTier(0, false, 70) === "low");
t("nada → insufficient", corroborationTier(0, false, 30) === "insufficient");

// ── Rubric ──
const strong = scoreOpportunity({ corporate_identity_confidence: 90, fit_from_universe: true, materiality: "high", signal_association_ok: true, corroboration: "high", causal_thesis_specific: true, days_old: 20, has_next_step: true, hard_blockers: [] });
t("oportunidad fuerte ≥ 85 → prioritaria", strong.score >= 85 && strong.verdict === "prioritaria", `score ${strong.score}`);
const mid = scoreOpportunity({ corporate_identity_confidence: 70, fit_from_universe: true, materiality: "medium", signal_association_ok: true, corroboration: "medium", causal_thesis_specific: true, days_old: 40, has_next_step: true, hard_blockers: [] });
t("media → investigar/monitorear (no prioritaria)", mid.verdict !== "prioritaria" && mid.verdict !== "rechazar", `${mid.score}/${mid.verdict}`);
t("baja materialidad → rechazar aunque score alto", scoreOpportunity({ corporate_identity_confidence: 100, fit_from_universe: true, materiality: "low", signal_association_ok: true, corroboration: "high", causal_thesis_specific: true, days_old: 5, has_next_step: true, hard_blockers: [] }).verdict === "rechazar");
t("asociación fallida → rechazar", scoreOpportunity({ ...({ corporate_identity_confidence: 90, fit_from_universe: true, materiality: "high", corroboration: "high", causal_thesis_specific: true, days_old: 10, has_next_step: true, hard_blockers: [] } as any), signal_association_ok: false }).verdict === "rechazar");
t("hard blocker → rechazar", scoreOpportunity({ corporate_identity_confidence: 90, fit_from_universe: true, materiality: "high", signal_association_ok: true, corroboration: "high", causal_thesis_specific: true, days_old: 10, has_next_step: true, hard_blockers: ["no_valid_date"] }).verdict === "rechazar");
t("rúbrica genera objeciones adversariales", scoreOpportunity({ corporate_identity_confidence: 50, fit_from_universe: true, materiality: "medium", signal_association_ok: true, corroboration: "low", causal_thesis_specific: false, days_old: 120, has_next_step: true, hard_blockers: [] }).adversarial_flags.length >= 3);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
