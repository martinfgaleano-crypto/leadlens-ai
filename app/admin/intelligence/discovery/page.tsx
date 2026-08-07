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
import { runBenchmark } from "@/lib/discovery/source-intelligence/benchmark";
import { buildLiveBenchmark } from "@/lib/discovery/source-intelligence/live";

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

      <div style={{ borderTop: `2px solid ${C.gold}`, margin: "18px 0 6px" }} />
      <LiveBenchmarkSection />
      <div style={{ borderTop: `2px solid ${C.line}`, margin: "18px 0 6px" }} />
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>La sección siguiente es el benchmark DETERMINÍSTICO por FIXTURE (valida el pipeline; no es rendimiento real). Nunca se mezcla con el benchmark en vivo.</div>
      <BenchmarkSection />

      <p style={{ fontSize: 11.5, color: C.muted }}>Rendimiento comercial por fuente: <b>awaiting_real_outcomes</b> — se activa cuando existan resultados reales de ciclos. Ninguna reprioridad se aplica automáticamente; requiere aprobación del fundador.</p>
    </main>
  );
}

function LiveBenchmarkSection() {
  const b = buildLiveBenchmark();
  const acc = { direct_access: "#4E6A54", parser_required: C.gold, javascript_heavy: "#b45", pagination_complex: "#b45", provider_accessible: "#3E6B8A", operationally_unsuitable: "#b45", manually_accessible_only: C.gold } as Record<string, string>;
  return (
    <>
      <h2 style={{ color: C.navy, fontSize: 17 }}>
        <span style={{ background: "#b45", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11, marginRight: 8 }}>EN VIVO</span>
        Benchmark en vivo · {b.id}
      </h2>
      <div style={{ ...box, background: "#EAF4EC" }}>
        <div style={{ fontSize: 12 }}><b>data_basis:</b> {b.data_basis} · <b>live_execution:</b> {String(b.live_execution)} · <b>llamadas a proveedores:</b> {b.total_provider_calls} · <b>muestra:</b> {b.entities_company_level.length} · <b>cohortes ejecutadas:</b> {b.cohorts.filter((c) => c.status === "executed").length}/3</div>
        <div style={{ fontSize: 11.5, color: "#8a6d3b", marginTop: 6 }}>⚠ {b.warnings[0]}</div>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Accesibilidad operativa de fuentes</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 6 }}>
          <thead><tr style={{ background: C.navy, color: "#fff", textAlign: "left" }}><th style={{ padding: 5 }}>Fuente</th><th style={{ padding: 5 }}>Estado</th><th style={{ padding: 5 }}>Método</th><th style={{ padding: 5 }}>Rol recomendado</th><th style={{ padding: 5 }}>Nota</th></tr></thead>
          <tbody>{b.accessibility.map((a, i) => (
            <tr key={a.source_id} style={{ background: i % 2 ? C.cream : "#fff", verticalAlign: "top" }}>
              <td style={{ padding: 5, fontWeight: 600 }}>{a.source_name}</td>
              <td style={{ padding: 5 }}>{a.states.map((s) => <span key={s} style={{ background: acc[s] ?? C.muted, color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 10, marginRight: 3, display: "inline-block", marginBottom: 2 }}>{s}</span>)}</td>
              <td style={{ padding: 5, color: C.muted }}>{a.access_method}</td>
              <td style={{ padding: 5 }}>{a.recommended_role}</td>
              <td style={{ padding: 5, color: C.muted }}>{a.failure_reason ?? a.notes}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Cohortes + economía de verificación</div>
        {b.cohorts.map((c) => (
          <div key={c.cohort} style={{ fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${C.line}` }}>
            <b>{c.cohort}</b>: <span style={{ color: c.status === "executed" ? "#4E6A54" : "#b45" }}>{c.status}</span>
            {c.status === "executed" && c.verification ? ` · raw ${c.verification.raw_candidates} → verificados ${c.verification.verified_accounts} · dominios verificados ${c.funnel?.official_domains_verified}/${c.verification.raw_candidates} (directos) · costo/verificado ≈${c.verification.cost_per_verified_account} (est.) · 0 proveedores` : ` — ${c.reason}`}
          </div>
        ))}
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Profundidad de investigación (L0–L5)</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 6 }}>
          <thead><tr style={{ background: C.navy, color: "#fff", textAlign: "left" }}><th style={{ padding: 5 }}>Nivel</th><th style={{ padding: 5 }}>Entran</th><th style={{ padding: 5 }}>Sobreviven</th><th style={{ padding: 5 }}>Rechazados</th><th style={{ padding: 5 }}>Llamadas</th><th style={{ padding: 5 }}>Costo</th></tr></thead>
          <tbody>{b.depth.map((d, i) => (<tr key={d.level} style={{ background: i % 2 ? C.cream : "#fff" }}><td style={{ padding: 5 }}>{d.level}</td><td style={{ padding: 5 }}>{d.entrants}</td><td style={{ padding: 5 }}>{d.survivors}</td><td style={{ padding: 5 }}>{d.rejected}</td><td style={{ padding: 5 }}>{d.calls}</td><td style={{ padding: 5 }}>{d.cost}</td></tr>))}</tbody>
        </table>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Fixture vs. vivo (dónde falló la suposición)</div>
        {b.fixture_vs_live.map((x, i) => (<div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.line}` }}><b>{x.assumption}</b><br /><span style={{ color: C.muted }}>fixture:</span> {x.fixture}<br /><span style={{ color: "#4E6A54" }}>vivo:</span> {x.live}</div>))}
      </div>

      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Recomendaciones (requieren aprobación del fundador)</div>
        {b.recommendations.map((r) => (<div key={r.id} style={{ fontSize: 12.5, padding: "4px 0" }}><span style={{ background: C.gold, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10.5 }}>{r.kind}</span> <b>{r.source_id}</b> — {r.rationale} <i style={{ color: C.muted }}>[{r.data_basis} · n={r.sample_size} · conf {r.confidence} · sin auto-aplicar]</i></div>))}
      </div>
    </>
  );
}

function BenchmarkSection() {
  const b = runBenchmark();
  const rows: { k: string; get: (f: (typeof b.strategies)[number]) => string | number }[] = [
    { k: "Resultados de fuente", get: (f) => f.source_results }, { k: "Candidatos crudos", get: (f) => f.raw_candidates },
    { k: "Entidades resueltas", get: (f) => f.entity_resolved }, { k: "Dominios oficiales", get: (f) => f.official_domains },
    { k: "Contexto compatible", get: (f) => f.context_compatible }, { k: "Evidencia suficiente", get: (f) => f.evidence_sufficient },
    { k: "Oportunidad plausible", get: (f) => f.opportunity_plausible }, { k: "Nuevos calificados", get: (f) => f.genuinely_new_qualified },
    { k: "Tasa duplicados", get: (f) => (f.raw_candidates ? (f.duplicates / f.raw_candidates).toFixed(2) : "N/A") },
    { k: "Costo (est.)", get: (f) => f.cost }, { k: "Costo marginal / calificado", get: (f) => f.marginal_cost_per_incremental_qualified ?? "N/A" },
    { k: "Latencia (ms)", get: (f) => f.latency_ms },
  ];
  return (
    <>
      <h2 style={{ color: C.navy, fontSize: 16 }}>Benchmark medido · {b.id}</h2>
      <div style={{ ...box, background: "#FFF7E6" }}>
        <div style={{ fontSize: 11.5, color: "#8a6d3b" }}><b>Base:</b> {b.data_basis} · {b.provider_calls} llamadas a proveedores · ejecución en vivo: {String(b.live_execution)}. {b.warnings[0]} {b.warnings[1]}</div>
      </div>
      <div style={box}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: C.navy, color: "#fff", textAlign: "left" }}><th style={{ padding: 6 }}>Métrica</th>{b.strategies.map((f) => <th key={f.strategy} style={{ padding: 6 }}>{f.strategy}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.k} style={{ background: i % 2 ? C.cream : "#fff" }}>
              <td style={{ padding: 6, fontWeight: 600 }}>{r.k}</td>
              {b.strategies.map((f) => <td key={f.strategy} style={{ padding: 6 }}>{r.get(f)}</td>)}
            </tr>
          ))}</tbody>
        </table>
        <div style={{ fontSize: 12, color: C.ink, marginTop: 8 }}>Estrategia preferida (esta muestra): <b>{b.founder_decisions.preferred_strategy}</b> · mayor pérdida de candidatos: <b>{b.rejection_analysis[0]?.reason}</b> ({b.rejection_analysis[0]?.pct}% · fuente {b.rejection_analysis[0]?.top_source}) · bloqueador principal: <b>{b.founder_decisions.biggest_blocker}</b>.</div>
      </div>
      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Análisis de rechazos</div>
        {b.rejection_analysis.map((r) => (<div key={r.reason} style={{ fontSize: 12.5, padding: "3px 0", color: C.muted }}><b style={{ color: C.ink }}>{r.reason}</b> — {r.count} ({r.pct}%) · concentrado en {r.top_source}</div>))}
      </div>
      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Recomendaciones (requieren aprobación del fundador)</div>
        {b.recommendations.map((r) => (<div key={r.id} style={{ fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${C.line}` }}><span style={{ background: C.gold, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10.5 }}>{r.kind}</span> <b>{r.source_id}</b> — {r.rationale} <i style={{ color: C.muted }}>[conf {r.confidence} · fixture-based · sin auto-aplicar]</i></div>))}
      </div>
    </>
  );
}
