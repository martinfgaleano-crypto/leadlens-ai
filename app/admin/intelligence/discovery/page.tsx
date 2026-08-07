// Discovery Intelligence Observatory (read-only). Answers "WHERE does LeadLens
// know how to search?" — country coverage, source registry by tier/role, example
// source plans, and coverage gaps. Protected by the /admin/* middleware boundary.
// Pure/deterministic: no provider calls, no search.
import {
  COUNTRY_REGISTRY, COLOMBIA_SOURCES, SOURCE_MAPPINGS, REGISTRY_VERSION,
} from "@/lib/discovery/source-intelligence/registry";
import {
  buildSourcePlan, detectCoverageGaps, seedResearchQueue, type DiscoveryContext, ROUTER_VERSION,
} from "@/lib/discovery/source-intelligence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discovery Intelligence · LeadLens", robots: { index: false, follow: false } };

const HOSPITALITY: DiscoveryContext = { country: "CO", industry_labels: ["hospitality", "spa", "premium_consumer"], business_models: ["hotel_operator"], routes: ["hospitality_guest_experience"], mechanisms: ["guest_amenity"] };
const MANUFACTURING: DiscoveryContext = { country: "CO", industry_labels: ["manufacturing"], business_models: ["manufacturer"], routes: ["procurement"], mechanisms: ["procurement_replacement"] };

const C = { ink: "#24332C", navy: "#17352C", gold: "#B48A4A", muted: "#6B7873", line: "#CAD8CD", cream: "#F8F5ED", sage: "#EAF0E9" };
const box: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 8, padding: 16, marginBottom: 16, background: "#FBFAF5" };
const tierColor: Record<string, string> = { tier_1_primary: C.navy, tier_2_secondary: "#4E6A54", tier_3_gap_filler: C.muted, tier_4_signal_only: C.gold, low_priority: "#9aa8a1", avoid: "#b45", inaccessible: "#b45", deprecated: "#b45" };

function Plan({ title, ctx }: { title: string; ctx: DiscoveryContext }) {
  const plan = buildSourcePlan(ctx);
  return (
    <div style={box}>
      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{title}</div>
      <div style={{ color: C.muted, fontSize: 12, margin: "4px 0 10px" }}>
        {ctx.industry_labels.join(" · ")} → {ctx.routes.join(", ")} / {ctx.mechanisms.join(", ")} · cobertura país: <b>{plan.country_coverage}</b> · mapping <code>{plan.matched_mapping_id ?? "none"}</code>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr style={{ background: C.navy, color: "#fff", textAlign: "left" }}>
          <th style={{ padding: 6 }}>Fuente</th><th style={{ padding: 6 }}>Prioridad</th><th style={{ padding: 6 }}>Rol</th><th style={{ padding: 6 }}>Ecosistema</th><th style={{ padding: 6 }}>Provider</th><th style={{ padding: 6 }}>Por qué</th>
        </tr></thead>
        <tbody>{plan.steps.map((s, i) => (
          <tr key={s.source_id} style={{ background: i % 2 ? C.cream : "#fff", verticalAlign: "top" }}>
            <td style={{ padding: 6, fontWeight: 600 }}>{s.source_name}</td>
            <td style={{ padding: 6 }}><span style={{ background: tierColor[s.priority], color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 10.5 }}>{s.priority}</span></td>
            <td style={{ padding: 6 }}>{s.role}</td><td style={{ padding: 6 }}>{s.ecosystem}</td>
            <td style={{ padding: 6, color: C.muted }}>{s.provider_hint}</td>
            <td style={{ padding: 6, color: C.muted }}>{s.why_higher_than_alternatives}</td>
          </tr>
        ))}</tbody>
      </table>
      <div style={{ fontSize: 12, color: C.ink, marginTop: 8 }}><b>Explicación:</b> {plan.explanation}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Fallback: {plan.fallback_source_ids.join(", ") || "—"} · Stop: {plan.stop_conditions.slice(0, 4).join(", ")}…</div>
    </div>
  );
}

export default function DiscoveryObservatory() {
  const co = COUNTRY_REGISTRY.CO;
  const gaps = detectCoverageGaps("CO");
  const queue = seedResearchQueue("CO");
  const byRole = COLOMBIA_SOURCES.length;
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, color: C.ink, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ color: C.gold, fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>LEADLENS · INTELLIGENCE</div>
      <h1 style={{ color: C.navy, margin: "2px 0 2px" }}>¿Dónde sabe buscar LeadLens?</h1>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Country × Industry Source Intelligence · {REGISTRY_VERSION} · {ROUTER_VERSION} · sin llamadas a proveedores</div>

      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Países</div>
        <div style={{ marginTop: 6 }}><b>{co.name}</b> ({co.code}) — cobertura <b>{buildSourcePlan(HOSPITALITY).country_coverage}</b> · {byRole} fuentes · {(SOURCE_MAPPINGS.CO ?? []).length} mappings contextuales · datos estructurados: {co.structured_data_availability}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Asociaciones: {co.sector_associations.join(" · ")}</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Próximos mercados (marco reutilizable, no poblados): MX · US · ES · CL · AR · PE · BR</div>
      </div>

      <h2 style={{ color: C.navy, fontSize: 16 }}>Planes de fuentes (ejemplos)</h2>
      <Plan title="Colombia · hotelería + spa · hotel_operator · guest_amenity" ctx={HOSPITALITY} />
      <Plan title="Colombia · manufactura · manufacturer · procurement" ctx={MANUFACTURING} />

      <h2 style={{ color: C.navy, fontSize: 16 }}>Brechas de cobertura ({gaps.length})</h2>
      <div style={box}>
        {gaps.map((g, i) => (
          <div key={i} style={{ padding: "6px 0", borderBottom: i < gaps.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ background: g.severity === "high" ? "#b45" : g.severity === "medium" ? C.gold : C.muted, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10.5 }}>{g.severity}</span>{" "}
            <b>{g.dimension}</b> — {g.evidence}. <span style={{ color: C.muted }}>Acción: {g.recommended_action}</span>
          </div>
        ))}
      </div>

      <h2 style={{ color: C.navy, fontSize: 16 }}>Cola de investigación de fuentes ({queue.length})</h2>
      <div style={{ ...box, fontSize: 12.5, color: C.muted }}>
        {queue.map((q) => (<div key={q.id} style={{ padding: "3px 0" }}><code>{q.id}</code> · {q.gap} → {q.proposed_source} <i>[{q.status}]</i></div>))}
      </div>

      <p style={{ fontSize: 11.5, color: C.muted }}>Rendimiento comercial por fuente: <b>awaiting_real_outcomes</b> — se activa cuando existan resultados reales de ciclos. Ninguna reprioridad se aplica automáticamente; requiere aprobación del fundador.</p>
    </main>
  );
}
