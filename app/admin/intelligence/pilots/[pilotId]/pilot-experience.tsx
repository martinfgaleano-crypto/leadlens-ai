"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PilotWorkspace } from "@/lib/intelligence/pilot-workspace";
import { ACCOUNT_UNIVERSE, ICP, PILOT_SECTIONS, type PilotSection, recommendations } from "@/lib/intelligence/pilot-intelligence";
import PilotIntake from "./pilot-intake";
import PilotContextReview from "./pilot-context-review";
import PilotReviewOperations from "./pilot-review-operations";
import styles from "./workspace.module.css";

const SEGMENT: Record<string, string> = {
  retail: "Retail especializado",
  hospitality: "Hospitalidad y bienestar",
  distribution: "Distribución",
  wellness: "Bienestar",
};
const DECISION: Record<string, string> = {
  prioritize: "Priorizar para validación",
  monitor: "Monitorear hasta una señal comercial",
};
const ROLE: Record<string, string> = {
  accessible_entry_account: "Mejor candidato para validar entrada",
  channel_account: "Palanca potencial de distribución",
  strategic_account: "Cuenta estratégica para segunda fase",
  monitor_account: "Cuenta sujeta a un trigger",
};
const SECTION: Record<string, string> = {
  "Client context summary": "Contexto del cliente",
  "Market landscape": "Panorama de mercado",
  "Buyer segments": "Segmentos compradores",
  "Account shortlist": "Portafolio de cuentas",
  "Account details": "Inteligencia por cuenta",
  "Opportunity theses": "Tesis de oportunidad",
  "Use cases": "Casos de uso",
  "Access paths": "Rutas de acceso",
  "Buying paths": "Hipótesis de compra",
  "Commercial feasibility": "Viabilidad comercial",
  "Evidence": "Evidencia",
  "Signals": "Señales y temporalidad",
  "Counterevidence": "Riesgos y contraevidencia",
  "Recommendations": "Recomendaciones",
  "Methodology": "Metodología",
  "Limitations": "Limitaciones",
  "Executive summary": "Resumen ejecutivo",
  "Next actions": "Próximas acciones",
  "Appendix": "Anexo",
  "Customer safety": "Seguridad para cliente",
};

function roleFor(workspace: PilotWorkspace, accountId: string) {
  return workspace.portfolio?.roles?.find((role: any) => role.account_id === accountId);
}

function sequenceFor(workspace: PilotWorkspace, accountId: string) {
  return workspace.portfolio?.sequence?.find((step: any) => step.account_id === accountId);
}

function qualitative(value: number | undefined, kind: "fit" | "access") {
  if (value == null) return "Aún no medido";
  if (kind === "fit") return value >= .7 ? "Encaje estructural sólido" : value >= .5 ? "Encaje por validar" : "Encaje débil";
  return value >= .65 ? "Acceso plausible" : value >= .45 ? "Acceso moderado, sin verificar" : "Acceso difícil";
}

function strategicCopy(account: any, role: any) {
  if (role?.role === "accessible_entry_account") return "La tesis más clara para aprender primero sobre categoría, acceso y viabilidad.";
  if (role?.role === "channel_account") return "Puede multiplicar cobertura si los márgenes, mínimos y capacidad de distribución son compatibles.";
  if (account.segment === "hospitality") return "Ofrece un caso de uso diferenciado en experiencia de huésped, pero requiere un trigger comercial.";
  if (account.segment === "wellness") return "La afinidad temática es plausible; la prioridad subirá solo con evidencia de alianza o surtido.";
  return "Cuenta relevante cuyo valor depende de validar el modelo comercial antes de escalar.";
}

function thesisEs(account: any) {
  const use: Record<string, string> = {
    retail: "validar una posible entrada al surtido de bebidas botánicas de bienestar",
    hospitality: "probar una bebida de bienestar para huéspedes o una amenidad de spa",
    distribution: "evaluar una ampliación de portafolio con una categoría botánica colombiana",
    wellness: "explorar una bebida botánica complementaria para rutinas de bienestar",
  };
  return `${account.account_name} es una cuenta colombiana estructuralmente relevante para ${use[account.segment] ?? "validar un caso de uso comercial"}. La tesis indica encaje potencial, no demanda ni intención de compra; antes de actuar deben confirmarse la oferta B2B, la viabilidad operativa y una ventana comercial.`;
}

function useCaseEs(account: any) {
  const use: Record<string, string> = {
    retail: `Evaluar la inclusión de infusiones y bebidas botánicas en el surtido de ${account.account_name}.`,
    hospitality: `Evaluar un piloto de bebida de bienestar o amenidad de spa para huéspedes de ${account.account_name}.`,
    distribution: `Evaluar la incorporación de una categoría colombiana de bebidas botánicas al portafolio de ${account.account_name}.`,
    wellness: `Evaluar una bebida botánica complementaria para las rutinas de bienestar de ${account.account_name}.`,
  };
  return use[account.segment] ?? "Evaluar un caso de uso comercial acotado.";
}

const PATH_ES: Record<string, string> = {
  "Category relevance validation": "Validar relevancia de categoría",
  "Sample/pilot evaluation": "Evaluar muestra o piloto",
  "Commercial negotiation": "Negociar condiciones comerciales",
  "Procurement approval": "Obtener aprobación de compras",
  "Operational implementation": "Implementar operación",
};

const DIMENSION_ES: Record<string, string> = {
  product: "Producto", pricing: "Precio", margin: "Margen", fulfillment: "Cumplimiento",
  geographic: "Cobertura", capacity: "Capacidad", certification: "Certificaciones",
  procurement: "Compras", pilot: "Piloto", sales_cycle: "Ciclo comercial",
  operational_complexity: "Complejidad operativa", implementation_burden: "Carga de implementación",
};

function verificationEs(dimension: string) {
  const next: Record<string, string> = {
    product: "Confirmar formatos B2B.",
    pricing: "Confirmar precio mayorista y pedido mínimo.",
    margin: "Confirmar márgenes requeridos.",
    fulfillment: "Confirmar restricciones de despacho e inventario.",
    geographic: "Confirmar cobertura y radio de entrega.",
    capacity: "Confirmar capacidad productiva mensual.",
    certification: "Confirmar registros y certificaciones.",
    procurement: "Confirmar modalidad comercial preferida.",
    pilot: "Confirmar capacidad de personalización.",
    sales_cycle: "Confirmar tolerancia del ciclo comercial.",
    operational_complexity: "Confirmar restricciones de operación y capacidad.",
    implementation_burden: "Confirmar formatos y certificaciones.",
  };
  return next[dimension] ?? "Requiere confirmación del cliente.";
}

function decisionReason(account: any) {
  return account.decision === "prioritize"
    ? `Merece validación por su encaje de canal y caso de uso. Aún no es una oportunidad inmediata: faltan contexto operativo y una señal temporal.`
    : `Permanece relevante, pero su ruta comercial es menos directa o depende de un evento verificable. Conviene monitorear antes de invertir en contacto.`;
}

function PortfolioMap({ workspace, onSelect }: { workspace: PilotWorkspace; onSelect: (id: string) => void }) {
  return <div className={styles.portfolioMap}>
    <div className={styles.axisY}>Prioridad de validación</div>
    <div className={styles.axisX}>Ruta de categoría directa → Ruta de alianza / canal</div>
    {workspace.accounts.map((account: any) => {
      const role = roleFor(workspace, account.account_id)?.role;
      const peers = workspace.accounts.filter((item: any) => roleFor(workspace, item.account_id)?.role === role);
      const peerIndex = peers.findIndex((item: any) => item.account_id === account.account_id);
      const position = role === "accessible_entry_account" ? { x: 44, y: 17 }
        : role === "channel_account" ? { x: 78, y: 24 }
          : role === "strategic_account" ? { x: 16 + peerIndex * 23, y: 31 }
            : account.segment === "hospitality" ? { x: 61, y: 70 }
              : { x: 82, y: 76 };
      return <button
        key={account.account_id}
        className={`${styles.mapPoint} ${styles[account.segment]}`}
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
        onClick={() => onSelect(account.account_id)}
        aria-label={`Abrir ${account.account_name}`}
      >
        <span>{account.account_name.slice(0, 2).toUpperCase()}</span>
        <small>{account.account_name}</small>
      </button>;
    })}
  </div>;
}

function AccountDetail({ workspace, account }: { workspace: PilotWorkspace; account: any }) {
  const role = roleFor(workspace, account.account_id);
  const sequence = sequenceFor(workspace, account.account_id);
  const official = account.identity?.official_properties?.[0];
  const feasibility = workspace.feasibility.find((item: any) => item.account_id === account.account_id);
  return <div className={styles.accountDetail}>
    <header className={styles.accountHero}>
      <div className={`${styles.identityMark} ${styles[account.segment]}`}>{account.account_name.slice(0, 2).toUpperCase()}</div>
      <div>
        <span className={styles.eyebrow}>{SEGMENT[account.segment] ?? account.segment}</span>
        <h2>{account.account_name}</h2>
        <p className={styles.accountThesis}>{thesisEs(account)}</p>
      </div>
      <div className={styles.accountDecision}>
        <strong>{DECISION[account.decision]}</strong>
        <span>{ROLE[role?.role] ?? "Rol por validar"}</span>
        <small>{decisionReason(account)}</small>
      </div>
    </header>

    <div className={styles.intelligenceGrid}>
      <section>
        <span className={styles.contentType}>RECOMENDACIÓN</span>
        <h3>Qué hacer con esta cuenta</h3>
        <p>{strategicCopy(account, role)}</p>
        <p><strong>Siguiente paso:</strong> {sequence?.next_action === "Answer decision-changing questions." ? "Resolver las confirmaciones de cliente que cambian la decisión." : sequence?.next_action}</p>
      </section>
      <section>
        <span className={styles.contentType}>INFERENCIA</span>
        <h3>Ruta comercial plausible</h3>
        <p>{useCaseEs(account)}</p>
        <p>Propietario probable: <strong>{account.segment === "retail" ? "Compras y gestión de categoría" : account.segment === "distribution" ? "Dirección de distribución" : account.segment === "hospitality" ? "Alimentos, bebidas y experiencia de huésped" : "Operaciones de bienestar"}</strong>. Esta ruta está informada por el sector, no confirmada por la cuenta.</p>
      </section>
      <section>
        <span className={styles.contentType}>LIMITACIÓN</span>
        <h3>Por qué no actuar todavía</h3>
        <p>No se ha identificado una señal comercial reciente con fecha verificable.</p>
        <p>Se desconocen el proceso de incorporación de proveedores, la economía y la viabilidad operativa.</p>
      </section>
    </div>

    <div className={styles.detailColumns}>
      <div>
        <section className={styles.detailSection}>
          <h3>Por qué esta cuenta</h3>
          <ul>
            <li>La identidad y el dominio de la cuenta están verificados en Colombia.</li>
            <li>Su segmento forma parte explícita del mercado objetivo analizado.</li>
            <li>Existe una ruta acotada para investigar al responsable de categoría o alianza.</li>
          </ul>
        </section>
        <section className={styles.detailSection}>
          <h3>Camino de compra probable</h3>
          <ol>{account.buying_path?.approval_sequence?.map((step: string) => <li key={step}>{PATH_ES[step] ?? step}</li>)}</ol>
        </section>
        <section className={styles.detailSection}>
          <h3>Viabilidad por confirmar</h3>
          <div className={styles.feasibilityList}>
            {feasibility?.dimensions?.map((dimension: any) => <div key={dimension.dimension}>
              <strong>{DIMENSION_ES[dimension.dimension] ?? dimension.dimension.replace(/_/g, " ")}</strong>
              <span>{verificationEs(dimension.dimension)}</span>
            </div>)}
          </div>
        </section>
      </div>
      <aside>
        <section className={styles.evidenceCard}>
          <span className={styles.contentType}>HECHO</span>
          <h3>Identidad confirmada</h3>
          <p>Dominio oficial atribuido a {account.account_name} en Colombia.</p>
          {official && <a href={official.url} target="_blank" rel="noreferrer">{official.url}</a>}
          <dl>
            <div><dt>Calidad</dt><dd>Fuente oficial</dd></div>
            <div><dt>Atribución</dt><dd>Alta confianza</dd></div>
            <div><dt>Verificado</dt><dd>{new Date(account.identity.last_verified_date).toLocaleDateString("es-CO")}</dd></div>
          </dl>
        </section>
        <section className={styles.timingCard}>
          <span className={styles.contentType}>TEMPORALIDAD</span>
          <h3>Sin ventana comercial actual</h3>
          <p>No se identificó un evento público reciente que justifique contacto inmediato.</p>
          <strong>Trigger de monitoreo</strong>
          <p>Una expansión de cobertura o surtido verificada puede abrir una nueva ventana de entrada.</p>
        </section>
      </aside>
    </div>

    <details className={styles.advanced}>
      <summary>Riesgos, supuestos y metodología</summary>
      <p><strong>Explicación alternativa:</strong> la afinidad de categoría puede no traducirse en prioridad de compra, capacidad presupuestal o apertura a nuevos proveedores.</p>
      <p><strong>Qué podría invalidar la tesis:</strong> surtido incompatible, economía inviable, requisitos operativos no alcanzables o ausencia de una ruta real de compras.</p>
      <ul><li>No hay evidencia de demanda ni intención de compra.</li><li>La accesibilidad y el proceso de compras todavía son hipótesis.</li><li>El timing permanece sin confirmar.</li></ul>
    </details>

    <section id="review" className={styles.reviewBlock}>
      <h3>Revisión de la tesis</h3>
      <p>Registra una decisión humana sin sobrescribir la tesis original ni habilitar contenido para cliente.</p>
      <PilotReviewOperations pilotId={workspace.pilot.pilot_id} thesis={account} />
    </section>
  </div>;
}

export default function PilotExperience({ workspace, activeSection = "overview", initialAccountId }: { workspace: PilotWorkspace; activeSection?: PilotSection; initialAccountId?: string }) {
  const recs = useMemo(() => recommendations(workspace), [workspace]);
  const [selectedId, setSelectedId] = useState(initialAccountId ?? recs[0]?.account.account_id ?? workspace.accounts[0]?.account_id);
  const selected = workspace.accounts.find((account: any) => account.account_id === selectedId) ?? workspace.accounts[0];
  const entry = workspace.accounts.find((account: any) => roleFor(workspace, account.account_id)?.role === "accessible_entry_account");
  const strategic = workspace.accounts.find((account: any) => roleFor(workspace, account.account_id)?.role === "strategic_account");
  const nextQuestions = ["product_formats", "minimum_order", "delivery_radius", "production_capacity"];
  const affected = useMemo(() => new Set(workspace.questions.filter((question: any) => nextQuestions.includes(question.field)).flatMap((question: any) => question.affected_accounts)).size, [workspace]);
  const groupedSections = useMemo(() => ({
    foundation: workspace.sections.filter((section: any) => section.state === "ready_with_limitations"),
    confirmation: workspace.sections.filter((section: any) => section.state === "blocked" && section.missing_context?.length),
    evidence: workspace.sections.filter((section: any) => section.state === "blocked" && !section.missing_context?.length),
    internal: workspace.sections.filter((section: any) => section.state === "internal_only"),
  }), [workspace]);

  return <div className={styles.workspace}>
    <div className={styles.locationBar}>
      <nav className={styles.breadcrumbs} aria-label="Ruta de navegación">
        <Link href="/admin">Admin</Link><span>/</span><Link href="/admin/intelligence">Intelligence</Link><span>/</span><Link href="/admin/intelligence">Pilotos</Link><span>/</span><strong>Amor de Gea</strong>
      </nav>
      <Link className={styles.commandLink} href="/admin/intelligence">← Volver al Command Center</Link>
      <div className={styles.locationTitle}><div><strong>Amor de Gea</strong><span>Piloto de inteligencia comercial</span></div><span className={styles.internalBadge}>Revisión interna</span></div>
    </div>
    <nav className={styles.workspaceNav} aria-label="Navegación del piloto">
      {PILOT_SECTIONS.map(([section, label]) => <Link
        key={section}
        href={section === "overview" ? "/admin/intelligence/pilots/amor-de-gea" : `/admin/intelligence/pilots/amor-de-gea/${section}`}
        className={activeSection === section ? styles.activeTab : ""}
        aria-current={activeSection === section ? "page" : undefined}
      >{label}</Link>)}
    </nav>

    {activeSection === "overview" && <><header id="brief" className={styles.executive}>
      <div className={styles.executiveTop}>
        <div>
          <span className={styles.eyebrow}>Piloto de oportunidad comercial · Colombia</span>
          <h1>Amor de Gea</h1>
          <p className={styles.lead}>LeadLens identificó seis cuentas colombianas relevantes. Cuatro merecen validación activa y dos deben mantenerse bajo monitoreo. La principal limitación ya no es descubrir empresas: es confirmar la capacidad comercial de Amor de Gea y encontrar una ventana temporal verificable.</p>
        </div>
        <aside>
          <span>Etapa actual</span>
          <strong>Validación con el cliente</strong>
          <small>Inteligencia actualizada {new Date(workspace.pilot.last_intelligence_refresh).toLocaleDateString("es-CO")}</small>
        </aside>
      </div>
      <div className={styles.heroMetrics}>
        <div><strong>6</strong><span>Cuentas evaluadas</span></div>
        <div><strong>4</strong><span>Priorizar para validación</span></div>
        <div><strong>2</strong><span>Monitorear</span></div>
        <div><strong>6</strong><span>Tesis listas para revisar</span></div>
        <div><strong>0</strong><span>Señales de timing actuales</span></div>
      </div>
      <div className={styles.strategicSummary}>
        <div><span>Mejor validación inicial</span><strong>{entry?.account_name ?? "Por determinar"}</strong><p>{entry ? strategicCopy(entry, roleFor(workspace, entry.account_id)) : "Requiere revisión."}</p></div>
        <div><span>Cuenta de valor estratégico</span><strong>{strategic?.account_name ?? "Por determinar"}</strong><p>Su tesis ganará precisión después de aprender del primer caso de validación.</p></div>
        <div><span>Mayor fricción</span><strong>Sin diferenciación confiable</strong><p>Los puntajes de acceso son una base compartida; se requiere evidencia por cuenta antes de señalar una ganadora.</p></div>
        <div className={styles.recommendation}><span>Próxima decisión</span><strong>Confirmar oferta, mínimos y capacidad</strong><p>Estas respuestas desbloquean viabilidad para {affected} cuentas y permiten revisar las seis tesis.</p></div>
      </div>
    </header>
    <section className={styles.overviewBrief}>
      <div><span className={styles.eyebrow}>Perfil de cliente ideal</span><h2>Qué está buscando LeadLens</h2><p>{ICP.summary}</p><Link href="/admin/intelligence/pilots/amor-de-gea/icp">Ver perfil, procedencia y preguntas abiertas →</Link></div>
      <div><span className={styles.eyebrow}>Cuentas recomendadas</span><h2>Secuencia de validación</h2>{recs.slice(0, 4).map(rec => <p key={rec.account.account_id}><strong>{rec.order}. {rec.account.account_name}</strong><br />{rec.rationale}</p>)}<Link href="/admin/intelligence/pilots/amor-de-gea/accounts">Ver shortlist completa →</Link></div>
      <div><span className={styles.eyebrow}>Estado de exportación</span><h2>Dos salidas, dos estados</h2><p><strong>PDF interno:</strong> disponible para revisión.</p><p><strong>Reporte final para cliente:</strong> bloqueado hasta completar contexto y revisión.</p><a className={styles.exportButton} href="/api/admin/intelligence/pilots/amor-de-gea/pdf">Descargar informe interno en PDF</a><small>Documento interno para revisión. El reporte final para cliente continúa bloqueado.</small></div>
    </section></>}

    {activeSection === "icp" && <section id="icp" className={styles.section}>
      <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Perfil de cliente ideal</span><h2>Una hipótesis explícita, no una verdad cerrada</h2></div><p>{ICP.summary}</p></header>
      <div className={styles.icpConfidence}><div><strong>{ICP.provenance.facts.length}</strong><span>criterios verificados</span></div><div><strong>{ICP.provenance.inferences.length}</strong><span>grupos de inferencias</span></div><div><strong>{ICP.provenance.questions.length}</strong><span>grupos por confirmar</span></div></div>
      <div className={styles.icpGrid}>{ICP.dimensions.map(([name, value, state]) => <article key={name}><span className={styles.contentType}>{state === "hecho" ? "HECHO" : state === "inferencia" ? "INFERENCIA" : "PREGUNTA ABIERTA"}</span><h3>{name}</h3><p>{value}</p></article>)}</div>
      <div className={styles.provenanceGrid}>
        <section><h3>Indicadores positivos</h3><ul>{ICP.positive.map(x => <li key={x}>{x}</li>)}</ul></section>
        <section><h3>Descalificadores</h3><ul>{ICP.disqualifiers.map(x => <li key={x}>{x}</li>)}</ul></section>
        <section><h3>Cómo se derivó</h3><h4>Hechos</h4><ul>{ICP.provenance.facts.map(x => <li key={x}>{x}</li>)}</ul><h4>Inferencias</h4><ul>{ICP.provenance.inferences.map(x => <li key={x}>{x}</li>)}</ul><h4>Preguntas abiertas</h4><ul>{ICP.provenance.questions.map(x => <li key={x}>{x}</li>)}</ul></section>
      </div>
    </section>}

    {activeSection === "accounts" && <><section className={styles.section}>
      <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Universo analizado</span><h2>De descubrimiento amplio a una muestra controlada</h2></div><p>{ACCOUNT_UNIVERSE.limitation}</p></header>
      <div className={styles.funnel}>{[
        [ACCOUNT_UNIVERSE.raw, "Brutos"], [ACCOUNT_UNIVERSE.deduplicated, "Deduplicados"], [ACCOUNT_UNIVERSE.verified, "Verificados"], [ACCOUNT_UNIVERSE.probable, "Probables"], [ACCOUNT_UNIVERSE.excluded, "Excluidos"], [ACCOUNT_UNIVERSE.controlled, "Muestra controlada"]
      ].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className={styles.universeNote}><strong>¿Por qué estas seis?</strong><p>Cubren retail especializado, salud, premium, hospitalidad/bienestar, distribución y estilo de vida consciente. Cada una prueba una dimensión del perfil y una ruta comercial distinta; dos se conservan para aprender de triggers, no porque exista timing.</p></div>
    </section>
    <section id="portfolio" className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><span className={styles.eyebrow}>Cuentas recomendadas</span><h2>Una secuencia transparente para validar</h2></div>
        <p>El orden combina encaje con el perfil, claridad del caso de uso, acceso, viabilidad, evidencia, fricción y valor de aprendizaje. No crea un score nuevo ni supone intención de compra.</p>
      </header>
      <div className={styles.portfolioLayout}>
        <div className={styles.accountList}>
          {recs.map((rec) => { const account = rec.account;
            const role = roleFor(workspace, account.account_id);
            return <article key={account.account_id} className={`${styles.accountCard} ${selectedId === account.account_id ? styles.selected : ""}`}>
              <div className={`${styles.identityMark} ${styles[account.segment]}`}>{account.account_name.slice(0, 2).toUpperCase()}</div>
              <div className={styles.accountCardMain}>
                <span>#{rec.order} · {SEGMENT[account.segment] ?? account.segment}</span>
                <h3>{account.account_name}</h3><strong>{rec.category}</strong>
                <p>{rec.rationale}</p>
                <p><strong>Fortaleza:</strong> {rec.strength}</p><p><strong>Bloqueo:</strong> {rec.blocker}</p><p><strong>Próxima acción:</strong> {rec.action}</p>
                <Link href={`/admin/intelligence/pilots/amor-de-gea/account?account=${encodeURIComponent(account.account_id)}`}>Ver análisis completo →</Link>
              </div>
              <div className={styles.accountQualities}>
                <span>{qualitative(account.confidence?.client_fit, "fit")}</span>
                <span>{qualitative(account.confidence?.accessibility, "access")}</span>
                <span>Viabilidad por confirmar</span>
                <span>Sin timing actual</span>
              </div>
            </article>;
          })}
        </div>
        <aside className={styles.mapPanel}>
          <h3>Mapa de roles comerciales</h3>
          <p>Posición categórica derivada de decisión, segmento y rol de portafolio; no inventa precisión numérica.</p>
          <PortfolioMap workspace={workspace} onSelect={setSelectedId} />
          <div className={styles.mapLegend}><span>Retail</span><span>Distribución</span><span>Hospitalidad</span><span>Bienestar</span></div>
        </aside>
      </div>
    </section></>}

    {activeSection === "account" && <section id="account" className={styles.section}>
      <div className={styles.accountSelector}>{recs.map(rec => <Link key={rec.account.account_id} className={selectedId === rec.account.account_id ? styles.selectedAccountLink : ""} href={`/admin/intelligence/pilots/amor-de-gea/account?account=${encodeURIComponent(rec.account.account_id)}`}>{rec.order}. {rec.account.account_name}</Link>)}</div>
      <AccountDetail workspace={workspace} account={selected} />
    </section>}

    {activeSection === "context" && <section id="readiness" className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><span className={styles.eyebrow}>Client Readiness</span><h2>Convertir incertidumbre en decisiones</h2></div>
        <p>Las preguntas están priorizadas por el efecto que tienen sobre cuentas, viabilidad y secciones del reporte.</p>
      </header>
      <div className={styles.categoryStrip}>
        {["Oferta B2B", "Capacidad y operación", "Precios y mínimos", "Cobertura geográfica", "Cumplimiento", "Estrategia comercial"].map(category => <div key={category}><strong>{category}</strong><span>Necesita confirmación</span></div>)}
      </div>
      <div className={styles.exportStates}>
        <div>
          <strong>Cuestionario para el cliente</strong>
          <span>Recoge la información operativa y comercial necesaria para afinar las seis tesis de oportunidad. 17 preguntas · 9 esenciales · 20–30 min. Ninguna respuesta viene precargada; todo queda sujeto a revisión de LeadLens.</span>
          <a className={styles.exportButton} href={`/api/admin/intelligence/pilots/${workspace.pilot.pilot_id}/questionnaire/xlsx`}>Descargar cuestionario editable (.xlsx) — recomendado</a>
          <a className={styles.exportButton} href={`/api/admin/intelligence/pilots/${workspace.pilot.pilot_id}/questionnaire/pdf`}>Descargar cuestionario para revisión (.pdf)</a>
          <a href={`/api/admin/intelligence/pilots/${workspace.pilot.pilot_id}/questionnaire`}><small>Descargar CSV técnico</small></a>
          <small>XLSX es el formato recomendado para completar; el PDF es para revisar o imprimir; el CSV es técnico. Descargar no crea ni acepta contexto: las respuestas se revisan antes de usarse.</small>
        </div>
      </div>
      <PilotContextReview review={workspace.contextReview} />
      <PilotIntake pilotId={workspace.pilot.pilot_id} questions={workspace.questions} />
    </section>}

    {activeSection === "evidence" && <section id="evidence" className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><span className={styles.eyebrow}>Evidence & Monitoring</span><h2>Lo que sabemos y lo que todavía no justifica acción</h2></div>
        <p>La ausencia de una señal no es ausencia de trabajo: es una conclusión temporal honesta.</p>
      </header>
      <div className={styles.timingModule}>
        <div>
          <span className={styles.contentType}>TEMPORALIDAD ACTUAL</span>
          <h3>No existe una ventana pública de contacto inmediato</h3>
          <p>LeadLens no encontró un evento reciente, atribuible y comercialmente relevante que convierta el encaje estructural en urgencia.</p>
        </div>
        <div>
          <h4>Qué se comprobó</h4>
          <ul><li>Expansión y nuevas ubicaciones</li><li>Alianzas y cambios de surtido</li><li>Contratación y lanzamientos</li><li>Actividad relacionada con proveedores</li></ul>
        </div>
        <div>
          <h4>Por qué no calificó una señal</h4>
          <ul><li>Sin evento directamente atribuible</li><li>Fecha de publicación insuficiente</li><li>Relevancia comercial débil</li><li>Sin corroboración independiente</li></ul>
        </div>
        <div>
          <h4>Próximos triggers</h4>
          <ul><li>Nueva ubicación</li><li>Expansión de surtido</li><li>Búsqueda de proveedores</li><li>Anuncio de alianza</li></ul>
        </div>
      </div>
      <div className={styles.evidencePrinciples}>
        <div><span className={styles.contentType}>HECHO</span><p>Identidad, dominio y categoría confirmados.</p></div>
        <div><span className={styles.contentType}>INFERENCIA</span><p>Encaje y comprador probable, sujetos a validación.</p></div>
        <div><span className={styles.contentType}>RECOMENDACIÓN</span><p>Secuencia de validación, no intención de compra.</p></div>
        <div><span className={styles.contentType}>LIMITACIÓN</span><p>Sin timing, economía ni capacidad confirmada.</p></div>
      </div>
    </section>}

    {activeSection === "readiness" && <section id="report" className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><span className={styles.eyebrow}>Review & Finalization</span><h2>Mapa de progreso hacia el reporte</h2></div>
        <p>El análisis ya tiene una base útil. Cada grupo muestra lo completado y la dependencia exacta que falta.</p>
      </header>
      <div className={styles.reportMap}>
        <div>
          <span className={styles.progressTone}>Base sólida con limitaciones</span>
          <h3>{groupedSections.foundation.length} secciones</h3>
          <p>Empresas verificadas, segmentación, decisiones internas, roles de portafolio y tesis estructurales.</p>
          <ul>{groupedSections.foundation.map((section: any) => <li key={section.section}>{SECTION[section.section] ?? section.section}</li>)}</ul>
        </div>
        <div>
          <span className={styles.progressTone}>Necesita confirmación del cliente</span>
          <h3>{groupedSections.confirmation.length} secciones</h3>
          <p>Faltan formatos, precios, mínimos, cobertura, capacidad, certificaciones y estrategia comercial.</p>
          <ul>{groupedSections.confirmation.map((section: any) => <li key={section.section}>{SECTION[section.section] ?? section.section}</li>)}</ul>
        </div>
        <div>
          <span className={styles.progressTone}>Necesita evidencia o revisión</span>
          <h3>{groupedSections.evidence.length + groupedSections.internal.length} secciones</h3>
          <p>Requieren evidencia adicional, revisión humana o deben permanecer como anexo interno.</p>
          <ul>{[...groupedSections.evidence, ...groupedSections.internal].map((section: any) => <li key={section.section}>{SECTION[section.section] ?? section.section}</li>)}</ul>
        </div>
      </div>
      <div className={styles.nextActions}>
        <div>
          <span className={styles.eyebrow}>Próximas 3 acciones</span>
          <ol><li>Confirmar formatos y empaques B2B disponibles.</li><li>Confirmar pedido mínimo y rango mayorista.</li><li>Confirmar cobertura de entrega y capacidad productiva.</li></ol>
        </div>
        <aside><strong>Efecto esperado</strong><p>Desbloquear la evaluación de viabilidad de seis cuentas, mejorar las secciones dependientes del contexto y habilitar una revisión fundada de las seis tesis.</p></aside>
      </div>
      <div className={styles.exportStates}><div><strong>PDF interno del piloto</strong><span>Disponible para revisión interna</span><a className={styles.exportButton} href="/api/admin/intelligence/pilots/amor-de-gea/pdf">Descargar informe interno en PDF</a><small>Documento interno para revisión. El reporte final para cliente continúa bloqueado.</small></div><div><strong>Reporte final para cliente</strong><span>Bloqueado</span><button disabled>Generar reporte final</button><small>Requiere completar contexto, evidencia y revisión.</small></div></div>
      <div className={styles.reportLock}>El reporte final permanecerá deshabilitado hasta completar las confirmaciones y revisiones necesarias.</div>
    </section>}

    <footer className={styles.workspaceFooter}>
      <span>Solo para revisión interna</span>
      <span>Ranking estructural sin cambios</span>
      <span>{workspace.pilot.methodology_version}</span>
    </footer>
  </div>;
}
