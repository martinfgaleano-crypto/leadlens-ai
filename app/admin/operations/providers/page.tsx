"use client";
// ─── Admin · Provider Health & Credits Console ───────────────────────────────
// Estado real de cada proveedor externo: configuración, disponibilidad,
// créditos (solo datos reales, con su origen), uso observado, fallbacks e
// impacto. Nunca muestra secretos; nunca inventa créditos.
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/app/admin/_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

interface Usage { calls_today: number; calls_month: number; errors_today: number; last_success: string | null; last_failure: string | null; last_error: string | null; latency_avg_ms: number; }
interface Status { id: string; name: string; role: string; configured: boolean; state: string; detail: string | null; latency_ms: number | null; credits: { value: string | null; kind: string }; usage: Usage | null; fallback: string; impact: string; probed_at: string | null; }
interface Alert { level: "red" | "yellow"; provider: string; message: string; }

const SEM: Record<string, { bg: string; label: string }> = {
  ok: { bg: "#16a34a", label: "OK" },
  degraded: { bg: "#d97706", label: "Degradado" },
  rate_limited: { bg: "#dc2626", label: "Rate limit" },
  exhausted: { bg: "#dc2626", label: "Agotado" },
  invalid: { bg: "#dc2626", label: "Credencial inválida" },
  missing: { bg: "#6b7280", label: "No configurado" },
  unknown: { bg: "#6b7280", label: "Desconocido" },
  not_tested: { bg: "#2563eb", label: "No probado" },
};
const KIND: Record<string, string> = {
  confirmed_by_provider: "confirmado por proveedor",
  observed_by_leadlens: "observado por LeadLens",
  estimated: "estimado",
  unavailable: "no disponible",
};

function Chip({ state }: { state: string }) {
  const s = SEM[state] ?? SEM.unknown;
  return <span style={{ background: s.bg + "18", color: s.bg, fontWeight: 700, fontSize: "0.78rem", padding: "0.18rem 0.6rem", borderRadius: "1rem", border: `1px solid ${s.bg}30`, whiteSpace: "nowrap" }}>{s.label}</span>;
}
function KindTag({ kind }: { kind: string }) {
  return <span style={{ fontSize: "0.68rem", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 4, padding: "0.05rem 0.35rem", marginLeft: 6 }}>{KIND[kind] ?? kind}</span>;
}

export default function ProvidersPage() {
  const [data, setData] = useState<{ statuses: Status[]; alerts: Alert[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async (probe = false) => {
    setBusy(true); setErr(null);
    try {
      const r = await adminFetch(`/api/admin/operations/providers${probe ? "?probe=1" : ""}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    setBusy(false);
  }, []);
  useEffect(() => { void load(false); }, [load]);

  const testOne = async (id: string) => {
    setTesting(id);
    try {
      const r = await adminFetch("/api/admin/operations/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: id }) });
      if (r.ok) await load(false);
    } finally { setTesting(null); }
  };

  return (
    <AdminLayout>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: 4 }}>Provider Health &amp; Credits</h1>
      <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: 14 }}>Estado real de cada proveedor: disponibilidad, créditos, uso observado, fallbacks e impacto.</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => void load(true)} disabled={busy} style={{ padding: "0.4rem 0.9rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#111827", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          {busy ? "Probando…" : "Probar todos (live)"}
        </button>
        <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>Probes en vivo con caché de 5 min y límite interno 1/min. Nunca se muestran secretos ni se inventan créditos.</span>
      </div>

      {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "0.6rem 0.9rem", borderRadius: 8, marginBottom: 12 }}>Error: {err}</div>}

      {data && data.alerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {data.alerts.map((a, i) => (
            <div key={i} style={{ background: a.level === "red" ? "#fef2f2" : "#fffbeb", border: `1px solid ${a.level === "red" ? "#fecaca" : "#fde68a"}`, color: a.level === "red" ? "#b91c1c" : "#92400e", padding: "0.5rem 0.8rem", borderRadius: 8, marginBottom: 6, fontSize: "0.85rem" }}>
              <strong>{a.provider}:</strong> {a.message}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {(data?.statuses ?? []).map((s) => (
          <div key={s.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem 1.1rem", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: "1rem" }}>{s.name}</strong>
                <Chip state={s.state} />
                {s.detail && <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>{s.detail}</span>}
              </div>
              <button onClick={() => void testOne(s.id)} disabled={testing === s.id} style={{ padding: "0.25rem 0.7rem", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", fontSize: "0.78rem", cursor: "pointer" }}>
                {testing === s.id ? "…" : "Probar"}
              </button>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#374151", marginTop: 6 }}>{s.role}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginTop: 10, fontSize: "0.8rem" }}>
              <div><span style={{ color: "#6b7280" }}>Créditos:</span> {s.credits.value ?? "—"}<KindTag kind={s.credits.kind} /></div>
              <div><span style={{ color: "#6b7280" }}>Latencia probe:</span> {s.latency_ms != null ? `${s.latency_ms} ms` : "—"}</div>
              <div><span style={{ color: "#6b7280" }}>Hoy:</span> {s.usage ? `${s.usage.calls_today} llamadas · ${s.usage.errors_today} errores` : "—"}<KindTag kind="observed_by_leadlens" /></div>
              <div><span style={{ color: "#6b7280" }}>Mes:</span> {s.usage ? `${s.usage.calls_month} llamadas` : "—"}</div>
              <div><span style={{ color: "#6b7280" }}>Último éxito:</span> {s.usage?.last_success ? new Date(s.usage.last_success).toLocaleString("es-CO") : "—"}</div>
              <div><span style={{ color: "#6b7280" }}>Última falla:</span> {s.usage?.last_failure ? new Date(s.usage.last_failure).toLocaleString("es-CO") : "—"}</div>
            </div>
            <div style={{ marginTop: 10, padding: "0.55rem 0.75rem", background: "#f9fafb", borderRadius: 8, fontSize: "0.78rem" }}>
              <div><strong>Fallback:</strong> {s.fallback}</div>
              <div style={{ marginTop: 3 }}><strong>Impacto si falla:</strong> {s.impact}</div>
            </div>
          </div>
        ))}
      </div>
      {!data && !err && <div style={{ color: "#6b7280", padding: 20 }}>Cargando estado de proveedores…</div>}
    </AdminLayout>
  );
}
