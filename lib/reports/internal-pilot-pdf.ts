import { jsPDF } from "jspdf";
import type { PilotWorkspace } from "@/lib/intelligence/pilot-workspace";
import { ACCOUNT_UNIVERSE, ICP, recommendations } from "@/lib/intelligence/pilot-intelligence";

export const PREMIUM_PDF_VERSION = "leadlens-internal-brief-v2";
export const PREMIUM_EXPECTED_PAGES = 16;
export const PDF_MIN_BODY_SIZE = 9.5;
const INTERNAL = "INTERNO - NO APTO TODAVIA PARA ENTREGA AL CLIENTE";
const GREEN = [18, 43, 34] as const;
const SAGE = [47, 101, 80] as const;
const MINT = [226, 239, 232] as const;
const CREAM = [248, 245, 237] as const;
const INK = [28, 39, 34] as const;
const MUTED = [91, 105, 97] as const;
const GOLD = [158, 119, 52] as const;
const LINE = [218, 224, 219] as const;
const WHITE = [255, 255, 255] as const;

type ClaimKind = "HECHO" | "INFERENCIA" | "RECOMENDACION" | "LIMITACION";
type PdfColor = readonly [number, number, number];
type PremiumCopy = {
  thesis: string; useCase: string; buyer: string; route: string; friction: string;
  validation: string; action: string; fallback: string; avoid: string; trigger: string;
  whyAccount: string; role: string;
};

const COPY: Record<string, PremiumCopy> = {
  BioPlaza: {
    thesis: "La mejor cuenta para aprender primero si Amor de Gea puede entrar a una categoria de bienestar con una propuesta y un formato comercial comprensibles.",
    useCase: "Inclusion acotada de infusiones botanicas en un surtido de bienestar, iniciando con una referencia y una hipotesis de recompra.",
    buyer: "Gestion de categoria o compras de alimentos y bebidas de bienestar.",
    route: "Validar surtido actual, presentar una muestra B2B y confirmar el proceso de alta de proveedor antes de proponer un piloto.",
    friction: "No se conocen margen objetivo, pedido minimo, rotacion esperada ni requisitos documentales.",
    validation: "¿Existe un formato con precio, margen y abastecimiento aptos para una prueba de surtido?",
    action: "Preparar ficha B2B, economia por unidad y muestra para una validacion de categoria.",
    fallback: "Si la economia no cierra, usar el aprendizaje para recalibrar el ICP retail.",
    avoid: "No presentar la cuenta como interesada ni iniciar contacto sin propuesta mayorista.",
    trigger: "Nueva categoria de bienestar, ampliacion de surtido o convocatoria verificable de proveedores.",
    whyAccount: "Combina afinidad de categoria, una ruta compradora entendible y alto valor de aprendizaje.",
    role: "Cuenta de entrada",
  },
  "Distribuidora DAM": {
    thesis: "Puede probar si Amor de Gea tiene una propuesta replicable a traves de canal, pero solo despues de demostrar economia, capacidad y consistencia de abastecimiento.",
    useCase: "Incorporacion de una linea botanica colombiana al portafolio para ampliar cobertura sin vender cuenta por cuenta.",
    buyer: "Direccion comercial, portafolio o abastecimiento de distribucion.",
    route: "Validar cobertura del distribuidor, requisitos de margen y volumen; luego evaluar una referencia inicial con territorio definido.",
    friction: "El canal multiplica alcance y tambien exige margen, inventario, continuidad y soporte comercial.",
    validation: "¿Puede Amor de Gea sostener el margen, volumen y despacho que exige un distribuidor?",
    action: "Modelar economia de canal, MOQ, capacidad mensual y politica de territorio.",
    fallback: "Si el canal no es viable, mantener venta directa a cuentas retail de menor complejidad.",
    avoid: "No negociar cobertura nacional ni exclusividad sin capacidad documentada.",
    trigger: "Expansion de portafolio, nueva cobertura regional o busqueda publica de marcas colombianas.",
    whyAccount: "Es la unica cuenta de la muestra que prueba apalancamiento por distribucion.",
    role: "Palanca de canal",
  },
  "Natural + Mente": {
    thesis: "Cuenta retail estrategica para una segunda validacion: puede mostrar si la afinidad de bienestar se convierte en una propuesta de surtido diferenciada.",
    useCase: "Linea corta de infusiones para consumidores que ya buscan productos naturales y rituales de bienestar.",
    buyer: "Compras, curaduria de portafolio o liderazgo comercial del retail.",
    route: "Usar el aprendizaje de BioPlaza para presentar categoria, diferenciacion y economia con menos supuestos.",
    friction: "La similitud tematica no confirma espacio en surtido, rotacion ni disposicion a abrir proveedor.",
    validation: "¿Que atributo de Amor de Gea agrega valor frente al surtido natural existente?",
    action: "Definir diferenciador de portafolio y comparar formato, precio y narrativa de categoria.",
    fallback: "Mantener como cuenta de aprendizaje cualitativo si no existe espacio de surtido.",
    avoid: "No confundir afinidad de marca con demanda ni con prioridad de compra.",
    trigger: "Renovacion de catalogo, contenido sobre infusiones o anuncio de nuevas marcas.",
    whyAccount: "Prueba diferenciacion dentro de un entorno naturalmente afin, no solo encaje generico.",
    role: "Seguimiento estrategico",
  },
  "Tu Tienda Saludable": {
    thesis: "Una cuenta retail util para contrastar si la propuesta funciona en un canal de salud mas transaccional y con menor tolerancia a complejidad operativa.",
    useCase: "Referencia botanica de compra recurrente para complementar un portafolio de productos saludables.",
    buyer: "Responsable de compras, abastecimiento o administracion de tienda.",
    route: "Presentar una propuesta simple: referencias limitadas, MOQ manejable, reposicion clara y soporte de producto.",
    friction: "Una operacion posiblemente compacta puede exigir simplicidad, rotacion rapida y bajo riesgo de inventario.",
    validation: "¿Puede Amor de Gea ofrecer una entrada simple, rentable y facil de reponer?",
    action: "Diseñar un piloto de bajo inventario con reglas de reposicion y margen visibles.",
    fallback: "Si el MOQ es alto, posponer hasta contar con un formato mayorista mas flexible.",
    avoid: "No proponer demasiadas referencias ni una implementacion operativamente pesada.",
    trigger: "Ampliacion del catalogo de bebidas, nueva tienda o campaña de consumo saludable.",
    whyAccount: "Contrasta la viabilidad en retail saludable con una ruta operativa potencialmente mas simple.",
    role: "Seguimiento estrategico",
  },
  "Hotel Spa La Colina": {
    thesis: "Cuenta de hospitalidad que permite explorar un caso de uso premium distinto al retail, aunque hoy no existe un programa o expansion que justifique prioridad.",
    useCase: "Bebida de bienvenida, ritual de spa o amenidad botanica integrada a la experiencia del huesped.",
    buyer: "Alimentos y bebidas, spa, experiencia de huesped u operaciones.",
    route: "Identificar primero el responsable del programa; despues validar formato de servicio, volumen por estadia y consistencia.",
    friction: "La personalizacion, el servicio y la operacion hotelera pueden elevar costo y complejidad con volumen incierto.",
    validation: "¿Existe un momento de experiencia donde una infusion mejore la propuesta del hotel sin cargar la operacion?",
    action: "Mantener monitoreo y preparar un concepto de amenidad de una pagina, no una propuesta comercial completa.",
    fallback: "Reactivar solo cuando exista un programa, renovacion o interlocutor verificable.",
    avoid: "No contactar por afinidad estetica ni asumir presupuesto de bienestar.",
    trigger: "Expansion de spa, nuevo programa de huesped, renovacion de amenidades o alianza de bienestar.",
    whyAccount: "Introduce un caso premium de experiencia y diversifica el aprendizaje fuera del retail.",
    role: "Cuenta de monitoreo",
  },
  "Somos Consiente": {
    thesis: "Cuenta de bienestar para observar posibles alianzas de contenido, comunidad o ritual; su ruta de compra es hoy la menos directa de la muestra.",
    useCase: "Infusion botanica como complemento de una rutina, experiencia o colaboracion de bienestar consciente.",
    buyer: "Fundador, alianzas, comunidad u operaciones de bienestar.",
    route: "Esperar evidencia de programa o alianza; luego validar si existe una transaccion, colaboracion o recomendacion comercial concreta.",
    friction: "La afinidad conceptual puede terminar en contenido o comunidad sin volumen, recompra ni proceso de compras.",
    validation: "¿La cuenta tiene un modelo comercial que convierta afinidad en una relacion B2B repetible?",
    action: "Definir criterios de trigger y no invertir investigacion profunda hasta observar uno.",
    fallback: "Usar la cuenta solo como radar de lenguaje y alianzas del segmento.",
    avoid: "No convertir afinidad tematica en una tesis de compra.",
    trigger: "Programa nuevo, alianza comercial, tienda propia o lanzamiento de experiencia con productos.",
    whyAccount: "Prueba el limite entre afinidad de bienestar y una oportunidad comercial realmente repetible.",
    role: "Cuenta de monitoreo",
  },
};

function safe(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[—–]/g, "-").replace(/→/g, "->");
}

export function premiumAccountEditorial(workspace: PilotWorkspace) {
  return recommendations(workspace).map(rec => ({ ...rec, editorial: COPY[rec.account.account_name] }));
}

export function buildInternalPilotPdf(workspace: PilotWorkspace, generatedAt = new Date()) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  const accounts = premiumAccountEditorial(workspace);
  const reportDate = generatedAt.toLocaleDateString("es-CO");
  pdf.setProperties({
    title: "Amor de Gea - Informe interno de inteligencia comercial",
    author: "LeadLens",
    subject: "Piloto interno de oportunidades comerciales en Colombia",
    keywords: "LeadLens, Amor de Gea, inteligencia comercial, cuentas, Colombia, piloto interno",
    creator: PREMIUM_PDF_VERSION,
  });

  let currentSection = "";
  const fill = (color: PdfColor) => pdf.setFillColor(color[0], color[1], color[2]);
  const stroke = (color: PdfColor) => pdf.setDrawColor(color[0], color[1], color[2]);
  const color = (value: PdfColor) => pdf.setTextColor(value[0], value[1], value[2]);
  const font = (size: number, weight: "normal" | "bold" = "normal") => { pdf.setFont("helvetica", weight); pdf.setFontSize(size); };
  const lines = (text: string, width: number) => pdf.splitTextToSize(safe(text), width) as string[];
  const text = (value: string, x: number, y: number, width = 178, size = PDF_MIN_BODY_SIZE, weight: "normal" | "bold" = "normal", tone: PdfColor = INK, lineHeight = 1.35) => {
    font(size, weight); color(tone); pdf.setLineHeightFactor(lineHeight); pdf.text(lines(value, width), x, y);
  };
  const pageHeader = (section: string) => {
    currentSection = section;
    font(7.5, "bold"); color(SAGE); pdf.text("LEADLENS", 16, 12);
    font(7.5); color(MUTED); pdf.text("AMOR DE GEA", 105, 12, { align: "center" });
    pdf.text(safe(section).toUpperCase(), 194, 12, { align: "right" });
    stroke(LINE); pdf.line(16, 16, 194, 16);
  };
  const footer = () => {
    const page = pdf.getNumberOfPages();
    stroke(LINE); pdf.line(16, 282, 194, 282);
    font(7.5); color(MUTED); pdf.text(`${reportDate}  |  ${currentSection}`, 16, 289);
    color(GOLD); pdf.text("INTERNO - REVISION LEADLENS", 105, 289, { align: "center" });
    color(MUTED); pdf.text(`${page} / ${PREMIUM_EXPECTED_PAGES}`, 194, 289, { align: "right" });
  };
  const addPage = (section: string, background: PdfColor = CREAM) => {
    if (currentSection && currentSection !== "Cubierta") footer();
    pdf.addPage();
    fill(background); pdf.rect(0, 0, 210, 297, "F");
    pageHeader(section);
  };
  const title = (number: string, heading: string, deck: string) => {
    font(8, "bold"); color(GOLD); pdf.text(number, 16, 29);
    const titleText = safe(heading);
    font(24, "bold");
    const measured = pdf.getTextWidth(titleText);
    const fittedSize = Math.max(17, Math.min(24, 24 * 178 / measured));
    font(fittedSize, "bold"); color(GREEN); pdf.text(titleText, 16, 43);
    text(deck, 16, 53, 160, 10.5, "normal", MUTED, 1.35);
  };
  const card = (x: number, y: number, w: number, h: number, background: PdfColor = WHITE, border: PdfColor = LINE) => {
    fill(background); stroke(border); pdf.roundedRect(x, y, w, h, 2, 2, "FD");
  };
  const label = (kind: ClaimKind, x: number, y: number) => {
    const tones: Record<ClaimKind, PdfColor> = { HECHO: SAGE, INFERENCIA: [73, 91, 126], RECOMENDACION: GOLD, LIMITACION: [144, 76, 64] };
    fill(tones[kind]); pdf.roundedRect(x, y - 4, kind === "RECOMENDACION" ? 29 : 23, 6, 1, 1, "F");
    font(6.5, "bold"); color(WHITE); pdf.text(kind, x + 2, y);
  };
  const metric = (x: number, y: number, value: string, caption: string, accent: PdfColor = SAGE) => {
    fill(WHITE); stroke(LINE); pdf.roundedRect(x, y, 32, 25, 2, 2, "FD");
    font(20, "bold"); color(accent); pdf.text(value, x + 4, y + 10);
    text(caption, x + 4, y + 16, 24, 7.5, "normal", MUTED, 1.1);
  };
  const sectionCard = (x: number, y: number, w: number, h: number, heading: string, body: string, kind?: ClaimKind) => {
    card(x, y, w, h);
    if (kind) label(kind, x + 6, y + 9);
    font(10.5, "bold"); color(GREEN); pdf.text(safe(heading), x + 6, y + (kind ? 18 : 10));
    text(body, x + 6, y + (kind ? 26 : 18), w - 12, 9.5, "normal", MUTED, 1.28);
  };
  const websiteLink = (url: string, x: number, y: number, max = 72) => {
    const display = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    font(8, "bold"); color(SAGE); pdf.textWithLink(display.slice(0, max), x, y, { url });
  };

  // 1 - Cover
  fill(GREEN); pdf.rect(0, 0, 210, 297, "F");
  fill(SAGE); pdf.circle(171, 53, 38, "F"); fill([31, 72, 57]); pdf.circle(181, 68, 27, "F");
  stroke([92, 139, 117]); for (let i = 0; i < 5; i++) pdf.line(18, 188 + i * 6, 156 - i * 8, 126 + i * 3);
  font(10, "bold"); color([168, 203, 185]); pdf.text("LEADLENS  /  COMMERCIAL INTELLIGENCE", 18, 26);
  font(35, "bold"); color(WHITE); pdf.text("Amor de Gea", 18, 76);
  font(18); color([220, 232, 226]); pdf.text("Commercial Opportunity", 18, 91); pdf.text("Intelligence Pilot", 18, 100);
  font(10, "bold"); color([168, 203, 185]); pdf.text("INTERNAL INTELLIGENCE BRIEF", 18, 119);
  card(18, 208, 174, 43, [24, 52, 42], [72, 107, 91]);
  font(9, "bold"); color([238, 218, 175]); pdf.text(INTERNAL, 27, 222);
  text("Documento de decision para revision interna. No representa intencion de compra ni una salida aprobada para cliente.", 27, 232, 150, 9.5, "normal", [205, 220, 213], 1.3);
  font(8); color([168, 203, 185]); pdf.text(`Fecha  ${reportDate}`, 18, 271); pdf.text(`Metodologia  ${PREMIUM_PDF_VERSION}`, 192, 271, { align: "right" });
  currentSection = "Cubierta";

  // 2 - Executive brief
  addPage("Executive Brief");
  title("01", "La oportunidad existe en el encaje; la accion depende de viabilidad", "LeadLens encontro una cartera util para validar canales. Todavia no encontro una ventana comercial que justifique contacto inmediato.");
  metric(16, 72, "6", "cuentas profundamente evaluadas");
  metric(52, 72, "4", "recomendadas para validacion");
  metric(88, 72, "2", "cuentas bajo monitoreo");
  metric(124, 72, "0", "senales actuales de timing", GOLD);
  metric(160, 72, "10", "bloqueos criticos de cliente", GOLD);
  sectionCard(16, 108, 112, 62, "Conclusion central", "La mejor ruta no es buscar mas empresas hoy. Es confirmar una oferta B2B viable y aprender primero con BioPlaza; despues probar el apalancamiento de Distribuidora DAM y usar esos aprendizajes en dos cuentas retail estrategicas.", "RECOMENDACION");
  sectionCard(134, 108, 60, 62, "Cautela principal", "Encaje estructural no equivale a demanda, presupuesto, apertura de proveedor ni intencion de compra.", "LIMITACION");
  font(11, "bold"); color(GREEN); pdf.text("Tres decisiones que destraban el piloto", 16, 190);
  [["01", "Empaque y formato", "Definir que puede ofrecerse como producto B2B."], ["02", "Economia y MOQ", "Probar margen, pedido minimo y riesgo de inventario."], ["03", "Cobertura y capacidad", "Delimitar donde y cuanto puede cumplirse."]].forEach((item, i) => {
    card(16 + i * 60, 199, 56, 55);
    font(17, "bold"); color(GOLD); pdf.text(item[0], 21 + i * 60, 211);
    font(9.5, "bold"); color(GREEN); pdf.text(item[1], 21 + i * 60, 221);
    text(item[2], 21 + i * 60, 230, 45, 8.5, "normal", MUTED, 1.25);
  });

  // 3 - Key decisions
  addPage("Decisiones");
  title("02", "Una secuencia de validacion, no un ranking de compra", "El orden responde al valor de aprendizaje y al rol comercial de cada cuenta. Ninguna cuenta esta en estado de actuar ahora.");
  const groups = [
    { y: 73, h: 50, name: "VALIDAR PRIMERO", accounts: "1. BioPlaza  /  2. Distribuidora DAM", reason: "Aprender categoria y luego probar apalancamiento de canal.", tone: SAGE },
    { y: 131, h: 50, name: "SEGUIMIENTO ESTRATEGICO", accounts: "3. Natural + Mente  /  4. Tu Tienda Saludable", reason: "Aplicar aprendizajes para diferenciar oferta y simplificar operacion.", tone: [73, 91, 126] as const },
    { y: 189, h: 50, name: "MONITOREAR", accounts: "5. Hotel Spa La Colina  /  6. Somos Consiente", reason: "Esperar un programa, expansion o alianza que cree una ruta real.", tone: GOLD },
  ];
  groups.forEach(group => {
    card(16, group.y, 178, group.h);
    fill(group.tone); pdf.rect(16, group.y, 5, group.h, "F");
    font(8, "bold"); color(group.tone); pdf.text(group.name, 28, group.y + 12);
    font(13, "bold"); color(GREEN); pdf.text(group.accounts, 28, group.y + 25);
    text(group.reason, 28, group.y + 35, 153, 9.5, "normal", MUTED);
  });
  fill([241, 231, 209]); pdf.roundedRect(16, 248, 178, 24, 2, 2, "F");
  font(9, "bold"); color(GOLD); pdf.text("ANTES DE CONTACTAR", 22, 258);
  text("Confirmar formato, precio, MOQ, capacidad, cobertura y certificaciones de Amor de Gea.", 66, 258, 119, 9, "normal", INK);

  // 4 - ICP
  addPage("Perfil de cliente ideal");
  title("03", "El ICP actual es una hipotesis operativa", "Busca cuentas colombianas con afinidad de categoria y una ruta comercial que Amor de Gea pueda realmente atender.");
  sectionCard(16, 69, 178, 45, "Declaracion ICP", ICP.summary, "INFERENCIA");
  const dimensions = [
    ["GEOGRAFIA", "Colombia", "HECHO" as ClaimKind], ["SEGMENTOS", "Retail, distribucion, hospitalidad, bienestar", "HECHO" as ClaimKind],
    ["CANALES", "Surtido, experiencia, alianza, portafolio", "INFERENCIA" as ClaimKind], ["USOS", "Recompra, amenidad, ritual, distribucion", "INFERENCIA" as ClaimKind],
    ["ESCALA", "Compatible con capacidad y MOQ", "LIMITACION" as ClaimKind], ["COMPRAS", "Ruta accesible y proporcionada", "INFERENCIA" as ClaimKind],
  ];
  dimensions.forEach((d, i) => {
    const x = 16 + (i % 3) * 60; const y = 122 + Math.floor(i / 3) * 39;
    card(x, y, 56, 34); font(7, "bold"); color(d[2] === "HECHO" ? SAGE : d[2] === "LIMITACION" ? [144,76,64] : [73,91,126]); pdf.text(d[0], x + 5, y + 9);
    text(d[1], x + 5, y + 17, 46, 8.5, "normal", INK, 1.2);
  });
  sectionCard(16, 204, 56, 63, "Indicadores positivos", "Afinidad de bienestar\nRuta de categoria\nRecompra plausible\nPresencia Colombia\nValor de aprendizaje", "HECHO");
  sectionCard(77, 204, 56, 63, "Descalificadores", "MOQ incompatible\nMargen inviable\nCobertura imposible\nRegistros faltantes\nComplejidad excesiva", "LIMITACION");
  sectionCard(138, 204, 56, 63, "Lo que no sabe", "Capacidad real\nEconomia mayorista\nFormatos B2B\nCertificaciones\nModelo comercial", "LIMITACION");

  // 5 - Market universe
  addPage("Universo de mercado");
  title("04", "El valor esta en la reduccion disciplinada del universo", "La muestra controlada permite probar canales distintos. No representa todo el mercado colombiano.");
  const funnel = [
    [ACCOUNT_UNIVERSE.raw, "Brutos"], [ACCOUNT_UNIVERSE.deduplicated, "Deduplicados"], [ACCOUNT_UNIVERSE.verified, "Verificados"],
    [ACCOUNT_UNIVERSE.probable, "Probables"], [ACCOUNT_UNIVERSE.excluded, "Excluidos"], [ACCOUNT_UNIVERSE.controlled, "Controlados"],
  ] as const;
  funnel.forEach(([value, name], i) => {
    const w = 168 - i * 18; const x = 16 + i * 9; const y = 72 + i * 24;
    fill(i < 2 ? [214, 229, 220] : i < 4 ? [186, 211, 198] : i === 4 ? [235, 225, 203] : SAGE);
    pdf.roundedRect(x, y, w, 18, 2, 2, "F");
    font(14, "bold"); color(i === 5 ? WHITE : GREEN); pdf.text(String(value), x + 7, y + 12);
    font(8, "bold"); pdf.text(name.toUpperCase(), x + 29, y + 11);
  });
  metric(16, 229, "4", "candidatos para validacion");
  metric(52, 229, "2", "cuentas monitoreadas", GOLD);
  sectionCard(92, 229, 102, 38, "Lectura", "Retail prueba surtido; distribucion prueba alcance; hospitalidad prueba experiencia; bienestar prueba alianza. La cobertura de segmentos es intencional.", "INFERENCIA");

  // 6 - Recommended portfolio
  addPage("Portafolio recomendado");
  title("05", "Seis cuentas, seis trabajos distintos dentro del piloto", "La recomendacion combina encaje, claridad de uso, friccion, evidencia y valor de aprendizaje.");
  accounts.forEach((rec, i) => {
    const col = i % 2; const row = Math.floor(i / 2); const x = 16 + col * 91; const y = 70 + row * 63;
    card(x, y, 87, 57);
    font(16, "bold"); color(i < 2 ? SAGE : i < 4 ? [73,91,126] : GOLD); pdf.text(String(rec.order).padStart(2, "0"), x + 6, y + 13);
    font(10.5, "bold"); color(GREEN); pdf.text(safe(rec.account.account_name), x + 21, y + 12);
    font(7.2, "bold"); color(MUTED); pdf.text(safe(rec.editorial.role).toUpperCase(), x + 21, y + 20);
    text(rec.editorial.whyAccount, x + 6, y + 29, 75, 8.3, "normal", INK, 1.2);
    font(7.3, "bold"); color(GOLD); pdf.text(i < 4 ? "SIN TIMING - VALIDAR VIABILIDAD" : "SIN TIMING - MONITOREAR", x + 6, y + 50);
  });
  fill(GREEN); pdf.roundedRect(16, 261, 178, 13, 2, 2, "F");
  font(8.5, "bold"); color(WHITE); pdf.text("SECUENCIA: entrada retail -> canal -> retail estrategico -> triggers", 105, 269, { align: "center" });

  // 7 - Portfolio map
  addPage("Mapa de portafolio");
  title("06", "Claridad de oportunidad vs. friccion comercial", "Posiciones cualitativas derivadas de rol, segmento y ruta. No son scores ni implican precision estadistica.");
  const x0 = 35, y0 = 82, plotW = 145, plotH = 142;
  fill(WHITE); stroke(LINE); pdf.rect(x0, y0, plotW, plotH, "FD");
  stroke([205, 214, 208]); pdf.line(x0 + plotW / 2, y0, x0 + plotW / 2, y0 + plotH); pdf.line(x0, y0 + plotH / 2, x0 + plotW, y0 + plotH / 2);
  font(7, "bold"); color(MUTED); pdf.text("MENOR FRICCION", x0, y0 - 5); pdf.text("MAYOR FRICCION", x0 + plotW, y0 - 5, { align: "right" });
  pdf.text("ALTA CLARIDAD", 17, y0 + 5); pdf.text("BAJA CLARIDAD", 17, y0 + plotH);
  const positions: Record<string, [number, number]> = {
    BioPlaza: [42, 34], "Distribuidora DAM": [112, 45], "Natural + Mente": [62, 72],
    "Tu Tienda Saludable": [82, 87], "Hotel Spa La Colina": [119, 112], "Somos Consiente": [101, 130],
  };
  accounts.forEach((rec, i) => {
    const [px, py] = positions[rec.account.account_name];
    fill(i < 2 ? SAGE : i < 4 ? [73,91,126] : GOLD); pdf.circle(x0 + px, y0 + py, 5, "F");
    font(7.2, "bold"); color(INK); pdf.text(safe(rec.account.account_name), x0 + px + 7, y0 + py + 2);
  });
  sectionCard(16, 237, 178, 35, "Interpretacion", "BioPlaza ofrece la ruta mas clara para aprender. DAM agrega alcance con mayor friccion. Las cuentas estrategicas ganan valor despues de resolver oferta. Las cuentas de monitoreo necesitan un evento.", "INFERENCIA");

  // 8-13 - Account pages
  accounts.forEach((rec, index) => {
    const account = rec.account;
    const ed = rec.editorial;
    const identity = account.identity;
    const official = identity?.official_properties?.[0];
    const contactAnchor = identity?.confirmed_anchors?.find((item: any) => item.kind === "contact_page");
    addPage(`Cuenta ${index + 1} / 6`);
    font(8, "bold"); color(GOLD); pdf.text(`${String(index + 1).padStart(2, "0")}  ${safe(ed.role).toUpperCase()}`, 16, 29);
    font(25, "bold"); color(GREEN); pdf.text(safe(account.account_name), 16, 44);
    websiteLink(official?.url ?? `https://${account.domain}`, 16, 55);
    font(8, "bold"); color(MUTED); pdf.text(`${safe(account.segment).toUpperCase()}  /  ${safe(rec.category).toUpperCase()}`, 194, 54, { align: "right" });
    sectionCard(16, 66, 178, 44, "Tesis ejecutiva", ed.thesis, "INFERENCIA");
    sectionCard(16, 118, 86, 57, "Por que esta cuenta", `${ed.whyAccount}\n\nCaso de uso: ${ed.useCase}`, "HECHO");
    sectionCard(108, 118, 86, 57, "Ruta comercial", `${ed.buyer}\n\n${ed.route}`, "INFERENCIA");
    sectionCard(16, 183, 86, 54, "Friccion y pregunta critica", `${ed.friction}\n\n${ed.validation}`, "LIMITACION");
    sectionCard(108, 183, 86, 54, "Timing", `Ahora: sin senal comercial actual.\n\nTrigger: ${ed.trigger}`, "LIMITACION");
    card(16, 241, 178, 30, MINT);
    label("RECOMENDACION", 22, 250);
    text(ed.action, 22, 259, 112, 9.2, "bold", GREEN, 1.2);
    text(`Fallback: ${ed.fallback}\nEvitar: ${ed.avoid}`, 139, 250, 49, 7.1, "normal", MUTED, 1.15);
    font(7.5, "bold"); color(SAGE); pdf.text("EVIDENCIA", 16, 273);
    font(7.2); color(MUTED);
    pdf.text(`Sitio oficial  |  propiedad oficial  |  ${identity?.last_verified_date?.slice(0, 10) ?? "sin fecha"}  |  reciente  |  confianza ${Math.round((identity?.identity_confidence ?? 0) * 100)}%`, 42, 273);
    pdf.text("Claim: identidad + dominio  |  Rol: soporte estructural  |  Limite: no prueba timing ni compra.", 42, 278);
    if (official?.url) websiteLink(official.url, 143, 273, 27);
    if (contactAnchor?.value) pdf.link(177, 272, 15, 7, { url: contactAnchor.value });
  });

  // 14 - Client context
  addPage("Contexto del cliente");
  title("13", "La siguiente mejora depende de cinco respuestas del cliente", "LeadLens puede proponer rutas; solo Amor de Gea puede confirmar economia, capacidad y cumplimiento.");
  sectionCard(16, 70, 54, 54, "Conocido", "Marca: Amor de Gea\nGeografia: Colombia\nCategoria: infusiones botanicas\nAlcance: piloto de seis cuentas", "HECHO");
  sectionCard(78, 70, 54, 54, "Propuesto", "Casos de surtido\nRuta de distribucion\nAmenidad de hospitalidad\nAlianza de bienestar", "INFERENCIA");
  sectionCard(140, 70, 54, 54, "Por confirmar", "Formatos y precio\nMOQ y margen\nCapacidad y cobertura\nCertificaciones\nModelo B2B", "LIMITACION");
  font(12, "bold"); color(GREEN); pdf.text("Cinco preguntas de mayor impacto", 16, 143);
  const questions = [
    ["01", "¿Que formatos B2B estan disponibles?", "Afecta las 6 cuentas"],
    ["02", "¿Cual es el pedido minimo?", "Afecta retail y distribucion"],
    ["03", "¿Que cobertura puede cumplirse?", "Afecta las 6 cuentas"],
    ["04", "¿Cual es la capacidad mensual?", "Afecta DAM y cuentas escalables"],
    ["05", "¿Que registros y certificaciones existen?", "Afecta habilitacion y reporte final"],
  ];
  questions.forEach((q, i) => {
    const y = 153 + i * 23; card(16, y, 178, 18);
    font(12, "bold"); color(GOLD); pdf.text(q[0], 22, y + 12);
    font(9.5, "bold"); color(INK); pdf.text(q[1], 39, y + 8);
    font(7.5); color(MUTED); pdf.text(q[2], 39, y + 14);
  });

  // 15 - Timing and readiness
  addPage("Timing y preparacion");
  title("14", "Cero senales no significa cero oportunidad", "Significa que ninguna evidencia publica reciente supero los gates de fecha, atribucion y relevancia comercial.");
  const checked = ["Nuevas ubicaciones", "Cambios de surtido", "Alianzas", "Contratacion", "Programas de bienestar", "Proveedores"];
  card(16, 72, 84, 79); font(10.5, "bold"); color(GREEN); pdf.text("Categorias revisadas", 22, 84);
  checked.forEach((item, i) => { fill(MINT); pdf.circle(24, 96 + i * 8, 1.5, "F"); font(8.5); color(INK); pdf.text(item, 30, 98 + i * 8); });
  card(108, 72, 86, 79); font(10.5, "bold"); color(GREEN); pdf.text("Por que no calificaron", 114, 84);
  ["Sin evento atribuible", "Fecha insuficiente", "Relevancia comercial debil", "Sin corroboracion independiente"].forEach((item, i) => {
    label("LIMITACION", 114, 98 + i * 13); text(item, 139, 98 + i * 13, 48, 8.2, "normal", MUTED, 1.1);
  });
  font(11, "bold"); color(GREEN); pdf.text("Preparacion del reporte", 16, 169);
  const readiness: Array<[string, string, PdfColor]> = [
    ["BASE SOLIDA", "Identidad, funnel, segmentos, shortlist y tesis internas.", SAGE],
    ["UTIL CON LIMITES", "ICP, estrategia de portafolio, encaje y evidencia base.", [73,91,126] as const],
    ["CONFIRMACION", "Economia, capacidad, cobertura, formatos y registros.", GOLD],
    ["NO LISTO", "Timing actual, revision customer-safe y reporte final.", [144,76,64] as const],
  ];
  readiness.forEach((r, i) => {
    const x = 16 + (i % 2) * 91, y = 179 + Math.floor(i / 2) * 43;
    card(x, y, 87, 36); fill(r[2]); pdf.rect(x, y, 4, 36, "F");
    font(8, "bold"); color(r[2]); pdf.text(r[0], x + 10, y + 11);
    text(r[1], x + 10, y + 20, 70, 8.3, "normal", MUTED, 1.2);
  });

  // 16 - Methodology
  addPage("Metodologia y limites");
  title("15", "Disciplina de evidencia antes que volumen", "El reporte convierte informacion publica y contexto de cliente en decisiones internas trazables.");
  const methods = [
    ["01", "Identidad", "Dominio y propiedad oficial antes de atribuir evidencia."],
    ["02", "Funnel", "Deduplicacion y exclusiones antes de investigar en profundidad."],
    ["03", "Evidencia", "Fuente, fecha, atribucion y rol del claim permanecen visibles."],
    ["04", "Separacion", "Hecho, inferencia, recomendacion y limitacion no se mezclan."],
    ["05", "Timing", "Encaje estructural nunca crea urgencia ni intencion de compra."],
    ["06", "Contexto", "Los datos operativos del cliente no se sintetizan ni se adivinan."],
  ];
  methods.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 16 + col * 91, y = 72 + row * 48;
    card(x, y, 87, 41);
    font(15, "bold"); color(GOLD); pdf.text(m[0], x + 6, y + 13);
    font(10, "bold"); color(GREEN); pdf.text(m[1], x + 23, y + 12);
    text(m[2], x + 23, y + 21, 56, 8.3, "normal", MUTED, 1.2);
  });
  sectionCard(16, 224, 178, 42, "Limitaciones del piloto", "Las seis cuentas no representan todo el mercado. No existe evidencia de demanda ni de timing actual. La viabilidad depende de respuestas de Amor de Gea. Ninguna recomendacion habilita contacto automatico ni reporte final.", "LIMITACION");
  font(7.5); color(MUTED); pdf.text(`Metodologia: ${PREMIUM_PDF_VERSION}  |  Ranking: sin cambios  |  Customer-safe: bloqueado`, 16, 276);
  footer();

  if (pdf.getNumberOfPages() !== PREMIUM_EXPECTED_PAGES) {
    throw new Error(`PREMIUM_PDF_PAGE_CONTRACT: expected ${PREMIUM_EXPECTED_PAGES}, got ${pdf.getNumberOfPages()}`);
  }
  return Buffer.from(pdf.output("arraybuffer"));
}
