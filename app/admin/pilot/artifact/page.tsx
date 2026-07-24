"use client";
// ─── Admin · Premium Pilot Report (harness artifact viewer) ──────────────────
// Renders the Amor de Gea pilot artifact as a premium intelligence report from
// REAL run data. Honest by design: separates dynamic opportunities from
// validation candidates and channel-fit accounts, surfaces the delivery
// decision and coverage limits, never promotes weak accounts. Charts derive
// from the same data (single source of truth) and handle 0/1/many.
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;

const C = { ink: "#0f172a", sub: "#64748b", line: "#e2e8f0", card: "#fff", bg: "#f8fafc",
  act: "#dc2626", validate: "#d97706", investigate: "#2563eb", monitor: "#0891b2", channel: "#7c3aed", excluded: "#6b7280", ok: "#16a34a" };

const STATUS_COLOR: Record<string, string> = { act_now: C.act, validate_first: C.validate, investigar: C.investigate, investigate: C.investigate, monitor: C.monitor, monitorear: C.monitor, channel_fit: C.channel, rechazar: C.excluded };

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: C.ink, margin: "0 0 2px" }}>{title}</h2>
      {sub && <p style={{ fontSize: ".8rem", color: C.sub, margin: "0 0 12px" }}>{sub}</p>}
      {children}
    </section>
  );
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "0.9rem 1.1rem", ...style }}>{children}</div>;
}
function Pill({ text, color }: { text: string; color: string }) {
  return <span style={{ background: color + "16", color, border: `1px solid ${color}33`, borderRadius: 999, padding: "0.12rem 0.55rem", fontSize: ".72rem", fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;
}

/* ── Charts (inline SVG, robust to 0/1/many) ── */
function BarChart({ data, title, sub, unit }: { data: Array<{ label: string; value: number; color?: string }>; title: string; sub: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: ".9rem", color: C.ink }}>{title}</div>
      <div style={{ fontSize: ".72rem", color: C.sub, marginBottom: 10 }}>{sub}</div>
      {data.length === 0 ? <div style={{ color: C.sub, fontSize: ".8rem" }}>Sin datos.</div> :
        data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
            <span style={{ width: 148, fontSize: ".74rem", color: C.ink, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <div style={{ flex: 1, background: C.bg, borderRadius: 4, height: 16, position: "relative" }}>
              <div style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? C.investigate, height: "100%", borderRadius: 4, minWidth: d.value > 0 ? 3 : 0 }} />
            </div>
            <span style={{ width: 34, fontSize: ".74rem", fontWeight: 700, color: C.ink }}>{d.value}{unit ?? ""}</span>
          </div>
        ))}
    </Card>
  );
}
function ScatterMatrix({ accounts }: { accounts: Any[] }) {
  const W = 300, H = 220, pad = 34;
  const actScore: Record<string, number> = { act_now: 90, validate_first: 62, investigar: 45, investigate: 45, monitor: 25, monitorear: 25, rechazar: 8 };
  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: ".9rem", color: C.ink }}>Opportunity Portfolio Matrix</div>
      <div style={{ fontSize: ".72rem", color: C.sub, marginBottom: 6 }}>Fit comercial (X) × Accionabilidad (Y) · tamaño = confianza · n={accounts.length}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 360 }}>
        <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke={C.line} />
        <line x1={pad} y1={6} x2={pad} y2={H - pad} stroke={C.line} />
        <text x={W / 2} y={H - 6} fontSize="9" fill={C.sub} textAnchor="middle">Commercial fit →</text>
        <text x={12} y={H / 2} fontSize="9" fill={C.sub} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`}>Actionability →</text>
        {accounts.length === 0 && <text x={W / 2} y={H / 2} fontSize="11" fill={C.sub} textAnchor="middle">0 cuentas accionables</text>}
        {accounts.map((a, i) => {
          const fit = Math.max(0, Math.min(100, a.score ?? 50));
          const act = actScore[a.verdict ?? "investigar"] ?? 40;
          const cx = pad + (fit / 100) * (W - pad - 10);
          const cy = (H - pad) - (act / 100) * (H - pad - 10);
          const r = 5 + (a.confidence ?? 0.5) * 7;
          const col = STATUS_COLOR[a.verdict ?? "investigate"] ?? C.investigate;
          return <g key={i}><circle cx={cx} cy={cy} r={r} fill={col + "cc"} stroke={col} /><text x={cx} y={cy - r - 2} fontSize="8.5" fill={C.ink} textAnchor="middle">{a.company}</text></g>;
        })}
      </svg>
    </Card>
  );
}

export default function PilotArtifactPage() {
  const [d, setD] = useState<Any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const r = await adminFetch("/api/admin/pilot/artifact"); if (!r.ok) throw new Error(`HTTP ${r.status}`); setD(await r.json()); }
    catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (err) return <AdminLayout><div style={{ padding: 16 }}>{/401/.test(err)
    ? <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 8, padding: "0.8rem 1rem" }}>Sesión admin requerida. Inicia sesión en <a href="/admin/login" style={{ color: "#2563eb", fontWeight: 700 }}>/admin/login</a> con tu admin token y vuelve a esta página.</div>
    : <span style={{ color: C.act }}>Error: {err}</span>}</div></AdminLayout>;
  if (!d) return <AdminLayout><div style={{ color: C.sub, padding: 20 }}>Cargando artefacto del piloto…</div></AdminLayout>;
  if (d.error === "no_artifacts") return <AdminLayout><div style={{ padding: 16 }}>No hay artefactos de Amor de Gea en <code>ml/data/pilot-amor-de-gea/</code>. Corre <code>npm run pilot:amor-de-gea</code>.</div></AdminLayout>;

  const m = d.manifest ?? {}, met = d.metrics ?? {}, cands: Any[] = d.candidates ?? [];
  const roles = met.universe_role_counts ?? m.universe_role_counts ?? {};
  const tax = met.error_taxonomy ?? m.error_taxonomy ?? {};
  const opp = met.opp_status_counts ?? {};
  const deliver = m.delivery_decision ?? "—";
  const dynamic = m.dynamic_opportunity_count ?? 0;
  const validationCandidates = cands.filter((c) => (c.verdict ?? "").startsWith("invest"));

  const funnel = [
    { label: "URLs consideradas", value: met.urls ?? 0, color: C.investigate },
    { label: "Extracciones", value: met.extractions ?? 0, color: C.investigate },
    { label: "Empresas verificadas", value: met.companies_verified ?? 0, color: C.monitor },
    { label: "Fechas válidas", value: met.candidates_with_valid_date ?? 0, color: C.validate },
    { label: "Candidatos (investigate)", value: cands.length, color: C.channel },
    { label: "Dynamic opportunities", value: dynamic, color: dynamic > 0 ? C.ok : C.act },
  ];
  const roleData = Object.entries(roles).map(([k, v]) => ({ label: k, value: Number(v), color: k.includes("hospitality") ? C.channel : k.includes("buyer") ? C.investigate : C.excluded }));
  const rejData = Object.entries(tax).filter(([k]) => !k.startsWith("prefilter") && !k.startsWith("channel_access_verified")).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8).map(([k, v]) => ({ label: k, value: Number(v), color: C.excluded }));

  const badge = (t: string, c: string) => <span style={{ background: c + "16", color: c, border: `1px solid ${c}33`, borderRadius: 6, padding: "0.15rem 0.5rem", fontSize: ".72rem", fontWeight: 700 }}>{t}</span>;

  return (
    <AdminLayout>
      {/* Cover */}
      <div style={{ background: `linear-gradient(135deg,${C.ink},#1e293b)`, color: "#fff", borderRadius: 14, padding: "1.3rem 1.5rem", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: ".72rem", letterSpacing: ".08em", opacity: .7, textTransform: "uppercase" }}>LeadLens · Opportunity Intelligence Report</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 2 }}>{d.client}</div>
            <div style={{ fontSize: ".82rem", opacity: .85, marginTop: 4 }}>{d.market}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: ".76rem", opacity: .9 }}>
            <div>Modo: <b>{m.operating_mode ?? "—"}</b></div>
            <div>Tier: {m.discovery_tier ?? "—"} · {m.phase ?? "—"}</div>
            <div>{(m.ran_at ?? "").slice(0, 16).replace("T", " ")}</div>
            <div style={{ marginTop: 6 }}>{badge(String(deliver).toUpperCase(), deliver === "do_not_deliver" ? C.act : C.ok)}</div>
          </div>
        </div>
      </div>

      {/* Origin note (honesty) */}
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 8, padding: "0.5rem 0.8rem", fontSize: ".76rem", marginBottom: 18 }}>
        <b>Reporte en revisión — {String(m.status ?? "").replace(/_/g, " ")}.</b> {d.origin_note}
      </div>

      {/* Executive Decision Brief */}
      <Section title="Executive Decision Brief" sub="Qué encontramos, qué no, y qué hacer — antes que cualquier score.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
          {[["Cuentas investigadas", met.companies_verified ?? 0], ["Dynamic opportunities", dynamic], ["Validation candidates", validationCandidates.length], ["Fechas válidas", `${met.candidates_with_valid_date ?? 0}/${met.companies_verified ?? 0}`], ["Costo total", `$${((m.estimated_discovery_cost_usd ?? 0) + (m.llm_usage_observed?.calculated_list_cost_usd ?? 0)).toFixed(3)}`], ["Delivery", deliver]].map(([k, v], i) => (
            <Card key={i} style={{ textAlign: "center" }}><div style={{ fontSize: "1.35rem", fontWeight: 800, color: C.ink }}>{v as any}</div><div style={{ fontSize: ".72rem", color: C.sub }}>{k as any}</div></Card>
          ))}
        </div>
        <Card>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: ".85rem", color: C.ink, lineHeight: 1.65 }}>
            <li><b>Qué encontramos:</b> {cands.length} cuenta(s) con fit de canal verificable en el mercado wellness/hospitality de Colombia, pero como <b>validation candidates</b>, no oportunidades confirmadas.</li>
            <li><b>Qué no encontramos:</b> ningún <b>evento de compra reciente y fechado</b> (dynamic opportunity = {dynamic}). La búsqueda cubrió el mercado ({met.company_signal_queries ?? met.urls ?? "—"} queries, {met.urls ?? 0} URLs) pero predominó el fit estático.</li>
            <li><b>Patrón principal:</b> las cuentas relevantes exponen portafolio/canal en su sitio, no anuncios de eventos con fecha.</li>
            <li><b>Riesgo principal:</b> tratar fit de canal como intención de compra. El sistema lo evita: channel_access → <i>investigate</i>, nunca <i>act_now</i>.</li>
            <li><b>Siguiente paso:</b> validación humana dirigida (ver dossiers) + estrategia de query orientada a eventos (aperturas, programas wellness, convocatorias de proveedores).</li>
          </ul>
        </Card>
      </Section>

      {/* Charts */}
      <Section title="Research Coverage & Diagnóstico" sub="Todos los gráficos derivan de los mismos datos de la corrida (fuente única).">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          <BarChart title="Research Funnel" sub={`Cobertura: ${m.operating_mode}. Providers: ${(met.providers_available ?? []).join("/") || "—"}${(met.providers_missing ?? []).length ? " · agotado: " + met.providers_missing.join("/") : ""}`} data={funnel} />
          <ScatterMatrix accounts={cands} />
          <BarChart title="Account Role Mix" sub={`Universo verificado: ${met.companies_verified ?? 0} cuentas`} data={roleData} />
          <BarChart title="Rejection Reasons" sub={`${Object.values(tax).reduce((a: number, b: any) => a + Number(b), 0)} descartes (los gates funcionaron)`} data={rejData} />
        </div>
      </Section>

      {/* Portfolio Overview */}
      <Section title="Portfolio Overview" sub="Separado por tipo: dynamic opportunity vs validation candidate vs channel fit. Ninguna cuenta se promociona artificialmente.">
        {cands.length === 0 ? <Card><div style={{ color: C.sub }}>Sin cuentas emitidas.</div></Card> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".8rem" }}>
              <thead><tr style={{ textAlign: "left", color: C.sub, borderBottom: `2px solid ${C.line}` }}>
                {["Empresa", "Rol/Tipo", "What Changed", "Fecha", "Evidencia", "Score", "Status"].map((h) => <th key={h} style={{ padding: "6px 8px" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {cands.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <td style={{ padding: "8px", fontWeight: 700 }}>{c.company}<div style={{ fontSize: ".68rem", color: C.sub, fontWeight: 400 }}>{c.domain}</div></td>
                    <td style={{ padding: "8px" }}>{c.org_type ?? "—"}</td>
                    <td style={{ padding: "8px", maxWidth: 260 }}>{c.fact ? c.fact.slice(0, 120) : (c.title ?? "—")}</td>
                    <td style={{ padding: "8px" }}>{c.date ?? <Pill text="sin fecha" color={C.act} />}{c.objections ? <div style={{ fontSize: ".66rem", color: C.validate }}>{c.objections}</div> : null}</td>
                    <td style={{ padding: "8px" }}>{c.corroboration ?? "—"}</td>
                    <td style={{ padding: "8px", fontWeight: 700 }}>{c.score ?? "—"}</td>
                    <td style={{ padding: "8px" }}><Pill text={`${c.verdict ?? "—"} · channel_fit_not_buying_intent`} color={STATUS_COLOR[c.verdict ?? ""] ?? C.investigate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Account Dossiers */}
      <Section title="Account Dossiers" sub="Hecho vs inferencia separados. Cada tesis es falsificable.">
        <div style={{ display: "grid", gap: 12 }}>
          {cands.map((c, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{c.company} <span style={{ fontSize: ".72rem", color: C.sub, fontWeight: 400 }}>· {c.domain}</span></div>
                <div style={{ display: "flex", gap: 6 }}>{c.score != null && <Pill text={`${c.score}/100`} color={C.investigate} />}<Pill text={c.verdict ?? "—"} color={STATUS_COLOR[c.verdict ?? ""] ?? C.investigate} /><Pill text="channel_fit · no buying intent" color={C.channel} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10, fontSize: ".8rem" }}>
                <div><b style={{ color: C.ok }}>HECHO observado:</b> {c.fact ?? c.title ?? "—"}</div>
                <div><b>Rol / tipo:</b> {c.org_type ?? "—"} · <b>Señal:</b> {c.signal_kind ?? "—"} · <b>Materialidad:</b> {c.materiality ?? "—"}</div>
                <div><b>Fecha:</b> {c.date ?? "sin fecha"} {c.objections ? `· ${c.objections}` : ""} · <b>Corroboración:</b> {c.corroboration ?? "—"}</div>
                <div><b>Identidad:</b> {c.identity ?? "—"}</div>
                <div style={{ color: C.sub }}><b style={{ color: C.investigate }}>INFERENCIA (a validar):</b> encaja como canal para infusiones/botánicos de bienestar; <b>no observamos</b> intención de compra ni evento fechado.</div>
                <div style={{ color: C.act }}><b>Contraevidencia / límite:</b> {c.date ? "señal envejecida" : "sin fecha de evento"} · corroboración {c.corroboration ?? "baja"} · solo fit de canal.</div>
                <div><b>Qué validar:</b> ¿tiene una apertura/renovación/convocatoria de proveedores reciente? ¿decide compras de surtido localmente?</div>
                <div><b>Siguiente acción:</b> contacto de validación (no venta): confirmar canal operativo y ventana comercial antes de proponer.</div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Methodology & Limitations */}
      <Section title="Methodology & Limitations">
        <Card>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: ".82rem", lineHeight: 1.6, color: C.ink }}>
            <li><b>Cobertura:</b> {m.operating_mode} · providers {(met.providers_available ?? []).join("/")}{(met.providers_missing ?? []).length ? ` (agotado: ${met.providers_missing.join("/")})` : ""}.</li>
            <li><b>Hechos vs inferencia:</b> lo marcado HECHO proviene de la fuente corporativa verificada; lo demás es inferencia explícita a validar.</li>
            <li><b>channel_access:</b> demuestra acceso potencial al canal, <b>no</b> intención de compra; nunca produce act_now por sí solo ni supera el delivery gate.</li>
            <li><b>Freshness:</b> {met.candidates_with_valid_date ?? 0}/{met.companies_verified ?? 0} fechas válidas — insuficiente para urgencia; sin fecha ⇒ no reciente.</li>
            <li><b>Delivery:</b> <b>{deliver}</b> — {String(m.status ?? "").replace(/_/g, " ")}: se investigó el mercado pero no hay eventos frescos y accionables. Un cero honesto es un resultado válido.</li>
          </ul>
        </Card>
      </Section>
      <div style={{ fontSize: ".7rem", color: C.sub, textAlign: "center", marginTop: 10 }}>Run {d.run_id} · {d.origin} · datos reales, sin promoción artificial.</div>
    </AdminLayout>
  );
}
