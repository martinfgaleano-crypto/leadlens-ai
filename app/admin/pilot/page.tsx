"use client";
// ─── Pilot Console (managed_pilot_v0) ────────────────────────────────────────
// Admin cockpit for complimentary tier pilots with a real client (Colombia
// first): create a pilot per tier, watch processing, open the tier report,
// run the debrief (tier-level feedback), and compare tiers for one client.
// Tier + price + entitlements resolve server-side; nothing here is authority.

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

const S = {
  h1: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.2rem" } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.7rem", padding: "0.9rem 1.1rem", marginBottom: "0.9rem" } as React.CSSProperties,
  label: { display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", margin: "0.5rem 0 0.15rem", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  input: { width: "100%", fontSize: "0.8rem", padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" as const },
  btn: (bg: string) => ({ background: bg, color: "#fff", border: "none", borderRadius: "0.4rem", padding: "0.45rem 0.9rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", marginRight: "0.4rem", marginTop: "0.6rem" }) as React.CSSProperties,
  pill: (bg: string, fg: string) => ({ display: "inline-block", background: bg, color: fg, borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.66rem", fontWeight: 700, marginRight: "0.3rem" }) as React.CSSProperties,
};

const TIERS = [
  { code: "preview_launch_v0", name: "Preview", price: 7, target: 2, depth: 0, readiness: "listo para piloto (QA manual)" },
  { code: "brief_launch_v0", name: "Brief", price: 25, target: 6, depth: 0, readiness: "listo con revisión manual" },
  { code: "intelligence_launch_v0", name: "Intelligence", price: 59, target: 12, depth: 4, readiness: "listo con revisión manual" },
  { code: "premium_launch_v0", name: "Premium", price: 129, target: 18, depth: 6, readiness: "SOLO INTERNO — estrategia aún no implementada" },
];

type Pilot = {
  pilot_id: string; job_id: string; status: string; client_name: string; client_company: string;
  client_country: string; client_email: string; product_code: string; reference_price: number;
  estimated_cost_usd: number; complimentary_reason: string; language: string;
  created_at: string; completed_at: string | null; report_url: string; brief_url: string;
};

export default function PilotConsolePage() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    client_name: "", client_company: "", client_country: "Colombia", client_email: "",
    product_code: "preview_launch_v0", complimentary_reason: "Concierge beta pilot — Colombia validation",
    output_language: "es", target_market_region: "latin_america",
    city_or_department: "", local_context: "",
    company_name: "", company_description: "", offer_description: "", value_proposition: "",
    target_customer_description: "", average_ticket: "", commercial_objective: "", restrictions: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/pilot");
    if (res.ok) setPilots((await res.json()).pilots ?? []);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  function icpWarnings(): string[] {
    const w: string[] = [];
    if ((form.target_customer_description ?? "").length < 60) w.push("Describe mejor las empresas objetivo: sector, tamaño y qué señales indican que necesitan la solución (mínimo 2-3 frases).");
    if (!/(señal|expan|bodega|inversi|flota|contrat|crecimiento|apertura|moderniz|automatiz|tecnolog)/i.test(form.target_customer_description ?? "")) w.push("Incluye qué señales buscar (ej.: apertura de bodegas, crecimiento de flota, inversión tecnológica).");
    if ((form.offer_description ?? "").length < 30) w.push("Explica con más detalle qué vende la empresa y a qué precio aproximado.");
    if (!form.company_name) w.push("Falta el nombre comercial de la empresa cliente.");
    return w;
  }

  async function createPilot() {
    const warnings = icpWarnings();
    if (warnings.length > 0) {
      setMsg("El ICP necesita más claridad antes de ejecutar:\n• " + warnings.join("\n• "));
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const res = await adminFetch("/api/admin/pilot", { method: "POST", body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) { setMsg(`Error: ${typeof j.error === "string" ? j.error : JSON.stringify(j.error).slice(0, 200)}`); return; }
      setMsg(`Pilot ${j.pilot_id} → ${j.tier} · ref $${j.reference_price} · est. cost $${j.estimated_cost_usd} · procesando (${j.opportunity_target} oportunidades máx.)`);
      await load();
    } finally { setBusy(false); }
  }

  async function debrief(p: Pilot) {
    const wp = window.confirm(`¿El cliente pagaría $${p.reference_price} por este ${p.product_code}? OK = sí, Cancelar = no`);
    const usefulness = parseInt(window.prompt("Utilidad 1–5:", "4") ?? "0", 10) || undefined;
    const accounts = parseInt(window.prompt("¿Cuántas cuentas trabajaría?", "2") ?? "0", 10) || undefined;
    const comments = window.prompt("Comentarios del cliente:") ?? undefined;
    const res = await adminFetch("/api/admin/pilot/feedback", { method: "POST", body: JSON.stringify({
      pilot_job_id: p.job_id, pilot_id: p.pilot_id, product_code: p.product_code,
      tier: TIERS.find((t) => t.code === p.product_code)?.name.toLowerCase() ?? p.product_code,
      reference_price: p.reference_price, would_pay: wp, usefulness, accounts_would_work: accounts, comments,
    }) });
    const j = await res.json();
    setMsg(res.ok ? "Debrief guardado." : `Feedback error: ${j.error}`);
  }

  // Per-client comparison groups (controlled comparison = same client/ICP across tiers)
  const byClient = new Map<string, Pilot[]>();
  for (const p of pilots) { const k = `${p.client_company} <${p.client_email}>`; byClient.set(k, [...(byClient.get(k) ?? []), p]); }

  return (
    <AdminLayout>
      <h1 style={S.h1}>Pilot Console — complimentary tier runs</h1>
      <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1rem" }}>
        Pilotos gratuitos administrados con trazabilidad comercial completa (tier, precio de referencia, entitlements, costos estimados). Quality gates activos; sin pagos; límite por cliente. Comparación controlada: crea varios tiers para el mismo cliente con el mismo ICP.
      </p>
      {msg && <div style={{ ...S.card, borderColor: msg.startsWith("Error") || msg.includes("error") ? "#fecaca" : "#bbf7d0", fontSize: "0.78rem" }}>{msg}</div>}

      <div style={S.card}>
        <strong style={{ fontSize: "0.85rem" }}>Nuevo piloto</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "0 1rem" }}>
          <div><label style={S.label}>Cliente (persona)</label><input style={S.input} value={form.client_name} onChange={set("client_name")} /></div>
          <div><label style={S.label}>Empresa cliente</label><input style={S.input} value={form.client_company} onChange={set("client_company")} /></div>
          <div><label style={S.label}>Email cliente</label><input style={S.input} value={form.client_email} onChange={set("client_email")} /></div>
          <div><label style={S.label}>País</label><input style={S.input} value={form.client_country} onChange={set("client_country")} /></div>
          <div><label style={S.label}>Tier</label>
            <select style={S.input} value={form.product_code} onChange={set("product_code")}>
              {TIERS.map((t) => <option key={t.code} value={t.code}>{t.name} — ref ${t.price} · máx {t.target} cuentas{t.depth ? ` · ${t.depth} dossiers profundos` : ""} · {t.readiness}</option>)}
            </select></div>
          <div><label style={S.label}>Idioma del reporte</label>
            <select style={S.input} value={form.output_language} onChange={set("output_language")}><option value="es">Español</option><option value="en">English</option></select></div>
          <div><label style={S.label}>Ciudad / departamento (opcional)</label><input style={S.input} value={form.city_or_department} onChange={set("city_or_department")} placeholder="Bogotá, Antioquia…" /></div>
          <div><label style={S.label}>Ticket promedio (opcional)</label><input style={S.input} value={form.average_ticket} onChange={set("average_ticket")} /></div>
        </div>
        <label style={S.label}>Nombre comercial de la empresa cliente (aparece en el reporte)</label>
        <input style={S.input} value={form.company_name} onChange={set("company_name")} />
        <label style={S.label}>Descripción del negocio</label>
        <textarea style={{ ...S.input, minHeight: 44 }} value={form.company_description} onChange={set("company_description")} placeholder="Ej.: Desarrollamos software de gestión de flotas para transporte de carga en Colombia." />
        <label style={S.label}>Oferta</label>
        <textarea style={{ ...S.input, minHeight: 44 }} value={form.offer_description} onChange={set("offer_description")} placeholder="Ej.: Plataforma SaaS de trazabilidad de flota, ~USD 700/mes por cliente." />
        <label style={S.label}>Propuesta de valor</label>
        <textarea style={{ ...S.input, minHeight: 44 }} value={form.value_proposition} onChange={set("value_proposition")} placeholder="Ej.: Reducimos costos operativos de flota 10-15% con visibilidad en tiempo real. (¿Qué problema resuelve?)" />
        <label style={S.label}>Empresas objetivo — a quién le vende (lo más importante)</label>
        <textarea style={{ ...S.input, minHeight: 56 }} value={form.target_customer_description} onChange={set("target_customer_description")} placeholder="Ej.: Empresas de logística y distribución en Colombia con 50-500 empleados que estén abriendo bodegas, creciendo su flota o invirtiendo en tecnología. Incluye: sector, tamaño, geografía y las SEÑALES que indican necesidad." />
        <label style={S.label}>Objetivo comercial (opcional)</label>
        <input style={S.input} value={form.commercial_objective} onChange={set("commercial_objective")} />
        <label style={S.label}>Empresas o sectores que NO quiere recibir (opcional)</label>
        <input style={S.input} value={form.restrictions} onChange={set("restrictions")} placeholder="Ej.: entidades públicas, competidores directos, empresas menores a 50 empleados" />
        <label style={S.label}>Contexto local (opcional)</label>
        <textarea style={{ ...S.input, minHeight: 44 }} value={form.local_context} onChange={set("local_context")} placeholder="Ej.: siguen a La República y Portafolio; regulados por Supertransporte; clientes ideales tipo Coordinadora o TCC (como referencia de perfil)" />
        <label style={S.label}>Razón del piloto gratuito</label>
        <input style={S.input} value={form.complimentary_reason} onChange={set("complimentary_reason")} />
        <button style={S.btn("#166534")} disabled={busy} onClick={createPilot}>{busy ? "Creando…" : "Crear y ejecutar piloto"}</button>
      </div>

      {Array.from(byClient.entries()).map(([client, runs]: [string, Pilot[]]) => (
        <div key={client} style={S.card}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.4rem" }}>{client}
            {runs.length > 1 && <span style={{ ...S.pill("#eef2ff", "#3730a3"), marginLeft: "0.5rem" }}>comparación {runs.length} tiers</span>}
          </div>
          {runs.map((p) => (
            <div key={p.pilot_id} style={{ borderTop: "1px solid #f1f5f9", padding: "0.45rem 0", fontSize: "0.76rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <span style={S.pill(p.status === "completed" ? "#dcfce7" : p.status === "failed" ? "#fee2e2" : "#fef3c7", "#334155")}>{p.status}</span>
              <strong>{TIERS.find((t) => t.code === p.product_code)?.name ?? p.product_code}</strong>
              <span style={{ color: "#64748b" }}>ref ${p.reference_price} · est ${p.estimated_cost_usd} · {p.language} · {p.created_at?.slice(0, 16).replace("T", " ")}</span>
              <a href={p.brief_url} target="_blank" rel="noreferrer" style={{ color: "#0369a1", fontWeight: 600 }}>brief</a>
              <a href={p.report_url} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>report</a>
              {p.status === "completed" && <button style={{ ...S.btn("#7c3aed"), marginTop: 0, padding: "0.2rem 0.6rem" }} onClick={() => debrief(p)}>Debrief</button>}
              <span style={{ color: "#94a3b8", fontSize: "0.68rem" }}>{p.pilot_id}</span>
            </div>
          ))}
        </div>
      ))}
      {pilots.length === 0 && <div style={{ ...S.card, color: "#94a3b8", fontSize: "0.8rem" }}>Sin pilotos todavía. Creá el primero arriba — recomendado: empezar con Preview para el cliente colombiano.</div>}

      <div style={{ ...S.card, background: "#fffbeb", border: "1px solid #fde68a" }}>
        <strong style={{ fontSize: "0.82rem", color: "#92400e" }}>Checklist de calidad — revisar ANTES de compartir un reporte</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "0 1.5rem", fontSize: "0.75rem", color: "#92400e", marginTop: "0.4rem" }}>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
            <li>¿La empresa existe? (búscala en Google)</li>
            <li>¿La señal corresponde realmente a esa empresa?</li>
            <li>¿La fecha es correcta y la señal es reciente?</li>
            <li>¿La fuente abre y dice lo que el reporte afirma?</li>
            <li>¿La oportunidad encaja con lo que vende el cliente?</li>
          </ul>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
            <li>¿Las inferencias están marcadas como Análisis/Hipótesis?</li>
            <li>¿Hay una acción comercial clara por cuenta?</li>
            <li>¿Ninguna cuenta es relleno? (mejor 1 buena que 2 flojas)</li>
            <li>¿El reporte ahorra investigación y ayuda a priorizar?</li>
            <li>¿El resultado justificaría el precio del tier?</li>
          </ul>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#b45309", margin: "0.5rem 0 0" }}>Si el veredicto es REFINAR o DETENER: ajustá la descripción de empresas objetivo (más específica, con señales) y creá un nuevo intento. Guía completa: docs/PILOT_PACK_COLOMBIA.md</p>
      </div>
    </AdminLayout>
  );
}
