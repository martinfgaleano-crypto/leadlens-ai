import { jsPDF } from "jspdf";
import type { PilotWorkspace } from "@/lib/intelligence/pilot-workspace";
import { ACCOUNT_UNIVERSE, ICP, recommendations } from "@/lib/intelligence/pilot-intelligence";

const NOTICE = "INTERNO - NO APTO TODAVIA PARA ENTREGA AL CLIENTE";

function accountThesis(account: any) {
  const use: Record<string, string> = {
    retail: "validar entrada al surtido de bebidas botanicas de bienestar",
    hospitality: "probar una bebida para huespedes o una amenidad de spa",
    distribution: "evaluar una ampliacion de portafolio con una categoria botanica colombiana",
    wellness: "explorar una bebida botanica complementaria para rutinas de bienestar",
  };
  return `${account.account_name} es una cuenta colombiana estructuralmente relevante para ${use[account.segment] ?? "validar un caso de uso comercial"}. Es una tesis de encaje, no evidencia de demanda ni intencion de compra.`;
}

export function buildInternalPilotPdf(workspace: PilotWorkspace, generatedAt = new Date()) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const recs = recommendations(workspace);
  let y = 24;
  const bottom = 278;
  const addFooter = () => {
    const page = pdf.getNumberOfPages();
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(120, 80, 25);
    pdf.text(NOTICE, 15, 289);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(90); pdf.text(`LeadLens - pagina ${page}`, 195, 289, { align: "right" });
  };
  const newPage = () => { addFooter(); pdf.addPage(); y = 20; };
  const ensure = (needed = 24) => { if (y + needed > bottom) newPage(); };
  const heading = (title: string, subtitle?: string) => {
    ensure(28); pdf.setFont("helvetica", "bold"); pdf.setFontSize(17); pdf.setTextColor(22, 48, 39); pdf.text(title, 15, y); y += 8;
    if (subtitle) { pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(90); pdf.text(subtitle, 15, y); y += 7; }
  };
  const paragraph = (text: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(9); pdf.setTextColor(45, 58, 51);
    const safeText = text.replace(/[—–]/g, "-").replace(/→/g, "->");
    const lines: string[] = pdf.splitTextToSize(safeText, 178);
    ensure(lines.length * 4.5 + 3);
    lines.forEach(line => { pdf.text(line, 15, y); y += 4.5; });
    y += 3;
  };
  const bullets = (items: string[]) => items.forEach(item => paragraph(`• ${item}`));

  pdf.setFillColor(20, 39, 31); pdf.rect(0, 0, 210, 297, "F");
  pdf.setTextColor(158, 196, 178); pdf.setFontSize(10); pdf.setFont("helvetica", "bold"); pdf.text("LEADLENS - INTELIGENCIA COMERCIAL", 20, 34);
  pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(32); pdf.text("Amor de Gea", 20, 77);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(17); pdf.text("Informe interno del piloto", 20, 91);
  pdf.setFontSize(10); pdf.setTextColor(210, 226, 218); pdf.text(`Generado: ${generatedAt.toLocaleDateString("es-CO")} - ${workspace.pilot.methodology_version}`, 20, 112);
  pdf.setFillColor(247, 240, 223); pdf.roundedRect(20, 228, 170, 27, 2, 2, "F");
  pdf.setTextColor(118, 90, 40); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text(NOTICE, 105, 240, { align: "center" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text("Este documento es un borrador de inteligencia para revisión interna; no es el reporte final.", 105, 248, { align: "center" });

  pdf.addPage(); y = 20;
  heading("1. Resumen ejecutivo", "Diagnóstico, recomendaciones y límites actuales");
  paragraph("LeadLens verificó una muestra controlada de seis cuentas colombianas. Cuatro deben validarse y dos permanecer bajo monitoreo. La limitación principal es confirmar la capacidad comercial de Amor de Gea y encontrar timing verificable; no existe evidencia de intención de compra.");
  paragraph(`Recomendadas: ${recs.filter(r => r.account.decision === "prioritize").map(r => r.account.account_name).join(", ")}.`, true);
  bullets(["Confirmar formatos y empaques B2B.", "Confirmar precio mayorista y pedido mínimo.", "Confirmar cobertura de entrega y capacidad productiva."]);

  heading("2. Perfil de cliente ideal");
  paragraph(ICP.summary);
  ICP.dimensions.forEach(([name, value, state]) => paragraph(`${name} [${state === "hecho" ? "HECHO" : state === "inferencia" ? "INFERENCIA" : "PREGUNTA ABIERTA"}] - ${value}`));
  paragraph("Indicadores positivos", true); bullets(ICP.positive);
  newPage();
  paragraph("Descalificadores aún no resueltos", true); bullets(ICP.disqualifiers);
  paragraph("Origen y confianza", true);
  bullets([...ICP.provenance.facts.map(x => `HECHO: ${x}`), ...ICP.provenance.inferences.map(x => `INFERENCIA: ${x}`), ...ICP.provenance.questions.map(x => `PREGUNTA ABIERTA: ${x}`)]);

  heading("3. Universo analizado");
  paragraph(`${ACCOUNT_UNIVERSE.raw} candidatos brutos -> ${ACCOUNT_UNIVERSE.deduplicated} deduplicados -> ${ACCOUNT_UNIVERSE.verified} verificados + ${ACCOUNT_UNIVERSE.probable} probables -> ${ACCOUNT_UNIVERSE.excluded} excluidos -> ${ACCOUNT_UNIVERSE.controlled} cuentas controladas -> ${ACCOUNT_UNIVERSE.recommended} recomendadas y ${ACCOUNT_UNIVERSE.monitored} monitoreadas.`);
  paragraph(ACCOUNT_UNIVERSE.limitation);

  heading("4. Cuentas recomendadas");
  recs.forEach(rec => {
    ensure(26); paragraph(`${rec.order}. ${rec.account.account_name} - ${rec.category}`, true);
    paragraph(`${rec.rationale} Fortaleza: ${rec.strength} Bloqueo: ${rec.blocker} Próxima acción: ${rec.action}`);
  });

  newPage(); heading("5. Perfiles de las seis cuentas");
  recs.forEach(rec => {
    ensure(62); paragraph(`${rec.account.account_name} - ${rec.category}`, true);
    paragraph(`Tesis: ${accountThesis(rec.account)}`);
    paragraph(`Caso de uso: ${rec.account.use_case?.statement ?? "Caso de uso de categoría sujeto a validación."}`);
    paragraph(`Ruta de acceso: ${rec.account.segment === "retail" ? "Compras y gestión de categoría" : rec.account.segment === "distribution" ? "Dirección de distribución" : "Responsable de operación o alianza"}.`);
    const official = rec.account.identity?.official_properties?.[0]?.url;
    paragraph(`Evidencia: identidad y dominio oficial verificados${official ? ` - ${official}` : ""}.`);
    paragraph(`Por qué ahora: no existe señal temporal actual. Por qué no ahora: ${rec.blocker}`);
    paragraph(`Recomendación: ${rec.action} Trigger: ${rec.trigger}`);
  });

  newPage(); heading("6. Estrategia de portafolio");
  paragraph("La secuencia equilibra aprendizaje temprano, cuentas estratégicas, una posible palanca de canal y dos apuestas que requieren trigger. No es un ranking algorítmico nuevo ni modifica el ranking canónico.");
  recs.forEach(rec => paragraph(`${rec.order}. ${rec.account.account_name}: ${rec.rationale}`));

  newPage(); heading("7. Contexto del cliente");
  paragraph("Conocido: marca Amor de Gea, alcance Colombia y enfoque en infusiones botánicas/bienestar. Propuesto: los casos de uso y rutas comerciales descritos. Sin respuesta: formatos, precios, mínimos, cobertura, capacidad, certificaciones, margen y modelo B2B.");
  bullets(["Formatos y empaques B2B.", "Pedido mínimo.", "Cobertura y métodos de entrega.", "Capacidad productiva mensual.", "Registros y certificaciones."]);

  heading("8. Evidencia y timing");
  paragraph("Las identidades y dominios están verificados mediante fuentes oficiales. La afinidad, el comprador probable y las rutas comerciales son inferencias. Cero señales actuales significa que no se encontró un evento reciente, atribuible y comercialmente relevante; no significa intención negativa ni ausencia de encaje.");
  paragraph("Plan de monitoreo: expansión, cambio de surtido, alianza, contratación comercial o búsqueda pública de proveedores.");

  heading("9. Preparación del reporte");
  paragraph("Base utilizable con limitaciones: identidad, segmentación, muestra controlada, tesis y roles. Bloqueado: viabilidad, timing, revisión humana y seguridad para cliente. Próximo paso: completar las cinco confirmaciones críticas y revisar las seis tesis.");
  paragraph("PDF interno: disponible para revisión. Reporte final para cliente: bloqueado.");

  heading("10. Metodología y limitaciones");
  bullets(["Los hechos se separan de inferencias y preguntas abiertas.", "No se asume demanda, intención de compra ni timing.", "La muestra de seis no representa el mercado completo.", "El orden es una secuencia editorial de validación, no un nuevo score.", "No se crearon respuestas sintéticas ni se llamó a proveedores durante la exportación.", "Documento exclusivamente interno."]);
  addFooter();
  return Buffer.from(pdf.output("arraybuffer"));
}
