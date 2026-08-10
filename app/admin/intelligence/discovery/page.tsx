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
import { fiveCountryReadiness, countryCoverageGaps, INTL_BENCHMARK_QUEUE, INTL_RESEARCH_QUEUE, SOURCE_TYPE_LEARNING, MULTI_COUNTRY_VERSION } from "@/lib/discovery/source-intelligence/multi-country";
import { buildRetailBenchmark } from "@/lib/discovery/source-intelligence/retail-live";
import { FOUNDATION_VALIDATIONS, empiricalReadiness, CROSS_COUNTRY_FOUNDATION } from "@/lib/discovery/source-intelligence/foundation-validation";
import {
  COLOMBIA_PRIORITY_CLUSTERS, COLOMBIA_SOURCE_ATLAS, COLOMBIA_BENCHMARK_QUEUE,
  SOURCE_RESEARCH_QUEUE_V2, buildCountryCoverage, routeCoverage, businessModelCoverage,
  coverageGapsV2, internationalReadiness, providerDiagnostic, v22Audit,
} from "@/lib/discovery/source-intelligence/coverage";
import { MANUFACTURING_RESEARCH_QUEUE } from "@/lib/discovery/source-intelligence/manufacturing-live";
import manufacturingArtifact from "@/artifacts/discovery/discovery-v2-colombia-manufacturing-live-001.json";
import retailLiveArtifact from "@/artifacts/discovery/discovery-v2-colombia-retail-live-001.json";
import usaManufacturingArtifact from "@/artifacts/discovery/discovery-v2-usa-manufacturing-live-001.json";

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

export default function DiscoveryObservatory({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const co = COUNTRY_REGISTRY.CO;
  const gaps = detectCoverageGaps("CO");
  const queue = seedResearchQueue("CO");
  const byRole = COLOMBIA_SOURCES.length;
  const pick = (key: string) => typeof searchParams?.[key] === "string" ? searchParams[key] as string : "";
  const clusterFilter = pick("cluster"), modelFilter = pick("business_model"), routeFilter = pick("route"), ecosystemFilter = pick("ecosystem"), confidenceFilter = pick("confidence"), accessibilityFilter = pick("accessibility");
  const coverage = buildCountryCoverage();
  const atlas = COLOMBIA_SOURCE_ATLAS.filter(s => (!clusterFilter || s.clusters.includes(clusterFilter)) && (!modelFilter || s.business_models.includes(modelFilter)) && (!routeFilter || s.routes.includes(routeFilter)) && (!ecosystemFilter || s.ecosystem === ecosystemFilter) && (!confidenceFilter || s.confidence === confidenceFilter) && (!accessibilityFilter || s.accessibility.includes(accessibilityFilter as never)));
  const routeRows = routeCoverage(), modelRows = businessModelCoverage(), v2gaps = coverageGapsV2().slice(0, 10), readiness = internationalReadiness(), audit = v22Audit();
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, color: C.ink, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ color: C.gold, fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>LEADLENS · INTELLIGENCE</div>
      <h1 style={{ color: C.navy, margin: "2px 0 2px" }}>¿Dónde sabe buscar LeadLens?</h1>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Country × Industry Source Intelligence · {REGISTRY_VERSION} · {ROUTER_VERSION} · sin llamadas a proveedores</div>

      <FiveCountrySection />

      <div style={box}>
        <div style={{ fontWeight: 700, color: C.navy }}>Colombia · detalle</div>
        <div style={{ marginTop: 6 }}><b>{co.name}</b> ({co.code}) — cobertura <b>{buildSourcePlan(HOSPITALITY).country_coverage}</b> · {byRole} fuentes · {(SOURCE_MAPPINGS.CO ?? []).length} mappings contextuales · datos estructurados: {co.structured_data_availability}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Asociaciones: {co.sector_associations.join(" · ")}</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Próximos mercados (marco reutilizable, no poblados): MX · US · ES · CL · AR · PE · BR</div>
      </div>

      <h2 style={{ color: C.navy, fontSize: 18 }}>Colombia Discovery Market Map V2.2</h2>
      <div style={{ ...box, background: C.sage, fontSize: 12.5 }}>
        <b>{COLOMBIA_PRIORITY_CLUSTERS.length}/20</b> clusters prioritarios modelados · <b>{coverage.filter(x => x.specialized_sources > 0).length}/20</b> con fuente especializada registrada · <b>{coverage.filter(x => x.depth === "manually_validated" || x.depth === "benchmarked").length}/20</b> con fuente validada manualmente o benchmarkeada · <b>{coverage.filter(x => x.benchmarked_sources > 0).length}/20</b> benchmarkeados. El denominador es la lista explícita de 20 clusters, no “todas las empresas de Colombia”.
      </div>

      <form style={{ ...box, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8 }}>
        <Filter name="cluster" label="Cluster" values={COLOMBIA_PRIORITY_CLUSTERS.map(x => x.id)} selected={clusterFilter}/>
        <Filter name="business_model" label="Modelo" values={Array.from(new Set(COLOMBIA_PRIORITY_CLUSTERS.flatMap(x => x.business_models)))} selected={modelFilter}/>
        <Filter name="route" label="Ruta" values={Array.from(new Set(COLOMBIA_PRIORITY_CLUSTERS.flatMap(x => x.routes)))} selected={routeFilter}/>
        <Filter name="ecosystem" label="Ecosistema" values={Array.from(new Set(COLOMBIA_SOURCE_ATLAS.map(x => x.ecosystem)))} selected={ecosystemFilter}/>
        <Filter name="confidence" label="Confianza" values={Array.from(new Set(COLOMBIA_SOURCE_ATLAS.map(x => x.confidence)))} selected={confidenceFilter}/>
        <Filter name="accessibility" label="Accesibilidad" values={Array.from(new Set(COLOMBIA_SOURCE_ATLAS.flatMap(x => x.accessibility)))} selected={accessibilityFilter}/>
        <button style={{ border: 0, borderRadius: 5, background: C.navy, color: "white", padding: 7, alignSelf: "end" }}>Filtrar atlas</button>
      </form>

      <h2 style={{ color: C.navy, fontSize: 16 }}>Matriz de clusters: amplitud ≠ profundidad</h2>
      <div style={{ ...box, overflowX: "auto" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5 }}><thead><tr style={{background:C.navy,color:"white",textAlign:"left"}}><th style={{padding:5}}>Cluster</th><th>Amplitud</th><th>Profundidad</th><th>Fuentes</th><th>Especializadas</th><th>Benchmarked</th><th>Brecha principal</th></tr></thead><tbody>{coverage.map((x,i)=><tr key={x.cluster_id} style={{background:i%2?C.cream:"white"}}><td style={{padding:5,fontWeight:600}}>{x.cluster_id}</td><td>{x.breadth}</td><td>{x.depth}</td><td>{x.registered_sources}</td><td>{x.specialized_sources}</td><td>{x.benchmarked_sources}</td><td>{x.biggest_gap}</td></tr>)}</tbody></table></div>

      <h2 style={{ color: C.navy, fontSize: 16 }}>Source Atlas ({atlas.length}/{COLOMBIA_SOURCE_ATLAS.length})</h2>
      <div style={{ ...box, overflowX:"auto" }}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.navy,color:"white",textAlign:"left"}}><th style={{padding:5}}>Fuente</th><th>Clusters</th><th>Roles</th><th>Acceso</th><th>Confianza</th><th>Uso / límite</th></tr></thead><tbody>{atlas.map((s,i)=><tr key={s.id} style={{background:i%2?C.cream:"white",verticalAlign:"top"}}><td style={{padding:5}}><b>{s.name}</b><br/><code>{s.domain}</code><br/>{s.geography.join(" · ")}</td><td>{s.clusters.join(", ")}</td><td>{s.roles.join(", ")}</td><td>{s.accessibility.join(", ")}</td><td>{s.confidence}</td><td>{s.notes}<br/><span style={{color:C.muted}}>{s.limitation}</span></td></tr>)}</tbody></table></div>

      <h2 style={{ color:C.navy,fontSize:16 }}>Cobertura por ruta y modelo de negocio</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}><CoverageList title="Rutas" rows={routeRows.map(x=>({name:x.route,detail:`${x.specialized_sources} fuentes especializadas · ${x.clusters} clusters`}))}/><CoverageList title="Modelos" rows={modelRows.map(x=>({name:x.business_model,detail:`${x.specialized_sources} fuentes especializadas · ${x.clusters} clusters`}))}/></div>

      <h2 style={{color:C.navy,fontSize:16}}>Cola de benchmarks</h2><QueueTable rows={COLOMBIA_BENCHMARK_QUEUE.map(x=>({priority:x.priority,name:x.id,state:x.benchmark_state,why:x.rationale}))}/>
      <ManufacturingBenchmarkSection />
      <UsaManufacturingSection />
      <h2 style={{color:C.navy,fontSize:16}}>Top 10 investigación de fuentes</h2><QueueTable rows={SOURCE_RESEARCH_QUEUE_V2.map((x,i)=>({priority:i+1,name:`${x.candidate_source} · ${x.cluster}`,state:x.status,why:`${x.gap}: ${x.objective}`}))}/>
      <h2 style={{color:C.navy,fontSize:16}}>Top brechas accionables</h2><CoverageList title="Brechas" rows={v2gaps.map(x=>({name:`${x.severity} · ${x.type}${x.cluster?` · ${x.cluster}`:""}`,detail:`${x.evidence} → ${x.next_action}`}))}/>

      <div style={box}><b>Expansión internacional</b><div style={{fontSize:12,marginTop:5}}>Schema {readiness.schema} · router {readiness.router} · taxonomía {readiness.taxonomy} · benchmark {readiness.benchmark_framework}. Próximo país recomendado: <b>{readiness.next_country}</b>, {readiness.start_when}</div></div>
      <div style={box}><b>Diagnóstico seguro de providers</b>{providerDiagnostic().map(p=><div key={p.provider} style={{fontSize:12,paddingTop:4}}>{p.provider}: configurado <b>{p.configured?"sí":"no"}</b> · runtime {p.runtime_available?"sí":"no"} · rol {p.intended_role} · estado {p.last_known_working_state}</div>)}<div style={{fontSize:11,color:C.muted,marginTop:6}}>Sprint: {audit.provider_calls}/{audit.limits.provider_calls} llamadas provider · {audit.source_access_validations}/{audit.limits.source_access_validations} validaciones · {audit.deep_source_inspections}/{audit.limits.deep_source_inspections} inspecciones. Nunca se muestran valores de secretos.</div></div>

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

function Filter({name,label,values,selected}:{name:string;label:string;values:string[];selected:string}){return <label style={{fontSize:11,color:C.muted}}>{label}<select name={name} defaultValue={selected} style={{display:"block",width:"100%",padding:6,border:`1px solid ${C.line}`,borderRadius:4,background:"white"}}><option value="">Todos</option>{values.sort().map(v=><option key={v}>{v}</option>)}</select></label>}
function CoverageList({title,rows}:{title:string;rows:{name:string;detail:string}[]}){return <div style={box}><b>{title}</b>{rows.map(x=><div key={x.name} style={{fontSize:11.5,padding:"4px 0",borderBottom:`1px solid ${C.line}`}}><code>{x.name}</code> — {x.detail}</div>)}</div>}
function QueueTable({rows}:{rows:{priority:number;name:string;state:string;why:string}[]}){return <div style={box}>{rows.map(x=><div key={x.name} style={{fontSize:12,padding:"5px 0",borderBottom:`1px solid ${C.line}`}}><b>#{x.priority} {x.name}</b> <i>[{x.state}]</i><br/><span style={{color:C.muted}}>{x.why}</span></div>)}</div>}

function ManufacturingBenchmarkSection(){
 const a=manufacturingArtifact;
 const pct=(x:number|null)=>x===null?"n/d":`${Math.round(x*100)}%`;
 return <section>
  <h2 style={{color:C.navy,fontSize:17}}><span style={{background:"#3E6B8A",color:"white",padding:"2px 7px",borderRadius:4,fontSize:10,marginRight:7}}>CELDA #2 · EN VIVO</span>Manufacturing · procurement · supplier addition</h2>
  <div style={{...box,background:"#EDF3F7",fontSize:12}}><b>{a.id}</b> · muestra {a.candidates.length} · 2 fuentes especializadas · {a.provider_calls.length} llamadas auditadas · manufacturer precision <b>{pct(a.manufacturer_precision)}</b> · digital resolution <b>{pct(a.digital_resolution_rate)}</b> · divergencia <b>{a.subindustry_divergence.state}</b>. Todos los porcentajes describen esta muestra, no la población colombiana.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}>
   <div style={box}><b>Comparación de fuentes</b>{a.source_comparison.map(s=><div key={s.source} style={{fontSize:11.5,padding:"5px 0",borderBottom:`1px solid ${C.line}`}}><b>{s.source}</b> · n={s.sample} · fabricantes {pct(s.manufacturer_precision)} · digital {pct(s.digital_resolution)} · nuevos calificados {s.novel_qualified}<br/><span style={{color:C.muted}}>{s.recommended_role} · {s.subindustries_added.join(", ")}</span></div>)}</div>
   <div style={box}><b>Composición observada / sesgo</b>{a.source_bias_profiles.map(s=><div key={s.source} style={{fontSize:11.5,padding:"5px 0",borderBottom:`1px solid ${C.line}`}}><b>{s.source}</b> · exportador {pct(s.exporter_share)} · {s.geographic_tendency}<br/><span style={{color:C.muted}}>{s.company_size_tendency} · {s.industry_tendency} · conf {s.confidence}</span></div>)}</div>
  </div>
  <div style={box}><b>Divergencia por subindustria — {a.subindustry_divergence.state}</b><table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5,marginTop:6}}><thead><tr style={{background:C.navy,color:"white",textAlign:"left"}}><th style={{padding:5}}>Subindustria</th><th>Fuente</th><th>Raw</th><th>Fabricantes</th><th>Precisión</th><th>Brecha</th></tr></thead><tbody>{a.subindustry_divergence.profiles.map((x,i)=><tr key={x.subindustry} style={{background:i%2?C.cream:"white"}}><td style={{padding:5}}>{x.subindustry}</td><td>{x.sources.join(", ")}</td><td>{x.entities}</td><td>{x.verified_manufacturers}</td><td>{pct(x.manufacturer_precision)}</td><td>{x.biggest_gap}</td></tr>)}</tbody></table><p style={{fontSize:11,color:C.muted}}>{a.subindustry_divergence.reason}</p></div>
  <div style={box}><b>Saturación observada</b>{a.saturation.map(x=><div key={x.processed} style={{fontSize:11.5,padding:"5px 0"}}>{x.processed} procesadas → {x.qualified} calificadas · incremento último tramo {x.incremental_qualified} · duplicados {pct(x.duplicate_rate)}<div style={{height:5,background:C.sage}}><div style={{height:5,width:`${Math.round(x.qualified/x.processed*100)}%`,background:C.gold}}/></div></div>)}</div>
  <div style={box}><b>Complementariedad</b>{Object.entries(a.complementarity).map(([k,v])=><div key={k} style={{fontSize:11.5,padding:"3px 0"}}><code>{k}</code> — {v}</div>)}</div>
  <div style={box}><b>Revisión del fundador</b><div style={{fontSize:11.5,marginTop:5}}>Aceptadas fuertes: {a.review.strong.length} · borderline: {a.review.borderline.length} · rechazadas: {a.review.rejected.length}. La decisión automatizada original se conserva.</div>{a.review.strong.slice(0,5).map(x=><div key={x.canonical_account} style={{fontSize:11,padding:"3px 0"}}><b>{x.raw_entity}</b> → {x.legal_entity} · {x.subindustry} · {x.manufacturer_status} · {x.geography} · {x.domain??"dominio no resuelto"}</div>)}</div>
  <h3 style={{color:C.navy,fontSize:14}}>Investigación Manufacturing priorizada</h3><QueueTable rows={MANUFACTURING_RESEARCH_QUEUE.map(x=>({priority:x.priority,name:x.task,state:"open",why:`${x.gap} → ${x.candidate_source}`}))}/>
 </section>;
}

function UsaManufacturingSection(){
 const u=usaManufacturingArtifact,c=manufacturingArtifact,pct=(x:number)=>`${Math.round(x*100)}%`;
 const states=Object.entries(u.observed_sample_bias.states).sort((a,b)=>b[1]-a[1]);
 return <section>
  <h2 style={{color:C.navy,fontSize:17}}><span style={{background:"#3E6B8A",color:"white",padding:"2px 7px",borderRadius:4,fontSize:10,marginRight:7}}>USA · CELDA #1 · EN VIVO</span>Manufacturing · procurement · supplier addition</h2>
  <div style={{...box,background:"#EDF3F7",fontSize:12}}><b>{u.id}</b> · llamadas contabilizadas <b>{u.recovery.total_calls_counted}/28</b> ({u.recovery.original_lost_calls.count} ejecutadas sin resultados persistidos + {u.recovery.recovery_calls_persisted} recuperadas) · raw persistido <b>{u.metrics.raw_candidates}</b> → cuentas <b>{u.metrics.canonical_accounts}</b> → fabricantes compatibles <b>{u.metrics.manufacturer_compatible}</b> · precisión <b>{pct(u.metrics.manufacturer_precision)}</b>.</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(285px,1fr))",gap:12}}>
   <div style={box}><b>Funnel y evidencia</b><div style={{fontSize:11.5,marginTop:5}}>Dominio oficial {pct(u.metrics.official_domain_yield)} · evidencia {pct(u.metrics.evidence_yield)} · procurement estructural {u.metrics.procurement_plausible} · buying intent inferido {u.metrics.buying_intent_inferred}.</div>{Object.entries(u.cohort_funnel).map(([k,v])=><div key={k} style={{fontSize:11,padding:"3px 0"}}><code>{k}</code>: {v.raw} raw → {v.manufacturer_compatible} fabricantes</div>)}</div>
   <div style={box}><b>Exa incremental</b><div style={{fontSize:11.5,marginTop:5}}>{u.metrics.exa_calls} llamada recuperada · {u.metrics.exa_raw} raw · <b>{u.metrics.exa_incremental_qualified} fabricantes incrementales</b> · overlap {u.metrics.exa_overlap} · {u.exa_decision} · coste observado ${u.metrics.exa_cost_usd??"n/d"}.</div></div>
   <div style={box}><b>Geografía observada</b><div style={{fontSize:11.5,marginTop:5}}>{u.metrics.states_observed} estados: {states.map(([s,n])=>`${s} ${n}`).join(" · ")}. Muestra digital, no representatividad nacional.</div></div>
   <div style={box}><b>Reliability recovery</b><div style={{fontSize:11.5,marginTop:5}}>Primera corrida: <b>executed_but_results_not_persisted</b>. Persistencia incremental activa · resume verificado · protección de duplicados activa · parcial recuperable: {u.recovery.partial_state_path}.</div></div>
  </div>
  <div style={box}><b>Colombia vs USA Manufacturing</b><div style={{fontSize:11.5,marginTop:5}}>CO: precisión {pct(c.manufacturer_precision)} · resolución digital {pct(c.digital_resolution_rate)} · asociaciones/exportadores estructurados pero sesgados. USA: precisión {pct(u.metrics.manufacturer_precision)} · resolución digital {pct(u.metrics.digital_resolution_yield)} · identidad estatal fragmentada, superficie especializada pública de bajo rendimiento y mayor valor incremental de búsqueda semántica.</div></div>
  <div style={box}><b>Contextual providers</b><div style={{fontSize:11.5,marginTop:5}}>SEC: 0 llamadas, sin trigger CIK confiable. SAM: 0 llamadas, omitido por 404 operativo y ausencia de ruta federal necesaria. Ninguno se ejecuta por defecto.</div></div>
 </section>;
}

function FiveCountrySection() {
  const readiness = fiveCountryReadiness();
  const gaps = countryCoverageGaps();
  const bcol: Record<string, string> = { none: "#b45", weak: "#c88", partial: C.gold, good: "#4E6A54", strong: C.navy };
  return (
    <>
      <div style={{ ...box, background: "#EAF4EC" }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Cinco mercados de descubrimiento · {MULTI_COUNTRY_VERSION}</div>
        <div style={{ fontSize: 11.5, color: "#8a6d3b", marginTop: 4 }}>Breadth (cuánto Atlas existe) vs Depth (cuánto se validó en vivo). Fuera de Colombia, depth = untested hasta correr un benchmark en vivo. Atlas nuevos = investigados desde conocimiento, NO validados en vivo (confianza discovered/hypothesized).</div>
      </div>
      <div style={box}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: C.navy, color: "#fff", textAlign: "left" }}><th style={{ padding: 5 }}>País</th><th style={{ padding: 5 }}>Rol descubrimiento</th><th style={{ padding: 5 }}>Rol comercial</th><th style={{ padding: 5 }}>Breadth</th><th style={{ padding: 5 }}>Depth</th><th style={{ padding: 5 }}>Foundation</th><th style={{ padding: 5 }}>Esp.</th><th style={{ padding: 5 }}>Benchmarks</th><th style={{ padding: 5 }}>Gap principal</th><th style={{ padding: 5 }}>Próximo</th></tr></thead>
          <tbody>{readiness.map((r, i) => (
            <tr key={r.country} style={{ background: i % 2 ? C.cream : "#fff", verticalAlign: "top" }}>
              <td style={{ padding: 5, fontWeight: 700 }}>{r.name} <span style={{ color: C.muted }}>({r.country})</span></td>
              <td style={{ padding: 5, color: C.muted, fontSize: 11 }}>{r.discovery_role}</td>
              <td style={{ padding: 5 }}>{r.commercial_role}</td>
              <td style={{ padding: 5 }}><span style={{ background: bcol[r.breadth], color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 10.5 }}>{r.breadth}</span></td>
              <td style={{ padding: 5 }}>{r.depth}</td>
              <td style={{ padding: 5, fontSize: 11 }}>{r.foundation_source_state} ({r.foundation_source_count})</td>
              <td style={{ padding: 5 }}>{r.specialized_source_count}</td>
              <td style={{ padding: 5 }}>{r.live_benchmark_count}</td>
              <td style={{ padding: 5, color: C.muted, fontSize: 11 }}>{r.biggest_gap}</td>
              <td style={{ padding: 5, fontSize: 11 }}>{r.next_benchmark}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Cola de benchmarks internacional (planeados, NO ejecutados): {INTL_BENCHMARK_QUEUE.map((b) => b.id).join(" · ")}</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Cola de investigación: {INTL_RESEARCH_QUEUE.slice(0, 5).map((q) => q.task).join(" · ")}…</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Brechas por país: {gaps.length} · aprendizaje por tipo de fuente (hipótesis): {SOURCE_TYPE_LEARNING.length}</div>
      </div>
      <FoundationValidationSection />
      <RetailSection />
    </>
  );
}

function FoundationValidationSection() {
  const v = FOUNDATION_VALIDATIONS; const er = empiricalReadiness();
  return (
    <div style={box}>
      <div style={{ fontWeight: 700, color: C.navy }}>Validación real de Foundation Sources (acceso público, 0 proveedores)</div>
      <div style={{ fontSize: 11.5, color: C.muted, margin: "4px 0 8px" }}>Inspección de acceso real (navegador, sin bypass, sin datos personales) → <b>operationally_validated</b> (NO es benchmark). Foundation = identidad, no dominios/oportunidad.</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: C.navy, color: "#fff", textAlign: "left" }}><th style={{ padding: 5 }}>País</th><th style={{ padding: 5 }}>Fuente</th><th style={{ padding: 5 }}>Identificador</th><th style={{ padding: 5 }}>Identidad</th><th style={{ padding: 5 }}>Dominio</th><th style={{ padding: 5 }}>Account-first</th><th style={{ padding: 5 }}>Estado</th><th style={{ padding: 5 }}>Límite</th></tr></thead>
        <tbody>{v.map((x, i) => (
          <tr key={x.source_id} style={{ background: i % 2 ? C.cream : "#fff", verticalAlign: "top" }}>
            <td style={{ padding: 5, fontWeight: 700 }}>{x.country}</td><td style={{ padding: 5 }}>{x.source_name}</td>
            <td style={{ padding: 5 }}>{x.identifier_observed}</td><td style={{ padding: 5 }}>{x.identity_usefulness}</td>
            <td style={{ padding: 5 }}>{x.provides.official_domain ? "sí" : "no"}</td><td style={{ padding: 5 }}>{x.account_first_feasible ? "sí" : "no"}</td>
            <td style={{ padding: 5 }}><span style={{ background: "#4E6A54", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>{x.validation_state}</span></td>
            <td style={{ padding: 5, color: C.muted, fontSize: 11 }}>{x.primary_limitation}</td>
          </tr>
        ))}</tbody>
      </table>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Arquitectura de foundation: {CROSS_COUNTRY_FOUNDATION.map((c) => `${c.country}=${c.foundation_kind}`).join(" · ")}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Readiness empírica (depth = benchmarks en vivo): {er.map((e) => `${e.country} foundation=${e.foundation_readiness} depth=${e.live_benchmark_depth}`).join(" · ")}</div>
    </div>
  );
}

function RetailSection() {
  const r = buildRetailBenchmark();
  const live = retailLiveArtifact;
  return (
    <><div style={{ ...box, background: "#FBF7F0" }}>
      <div style={{ fontWeight: 700, color: C.navy }}>Colombia · Retail #3 · MUESTRA CONTROLADA · {r.id}</div>
      <div style={{ fontSize: 11.5, color: "#8a6d3b", margin: "4px 0 4px" }}>data_basis <b>{r.data_basis}</b> · depth <b>{r.depth_state}</b> · benchmark en vivo <b>{r.retail_live_status}</b> (id reservado: {r.live_id_reserved})</div>
      <div style={{ fontSize: 11.5, color: "#8a6d3b", marginBottom: 8 }}>⚠ {r.warnings[0]}</div>
      <div style={{ fontSize: 12.5 }}>
        Listados crudos <b>{r.raw_listings}</b> → cuentas canónicas <b>{r.canonical_accounts}</b> · <b>Location Inflation Ratio {r.location_inflation_ratio}</b> · assortment yield <b>{r.assortment_evidence_yield}</b> · plausibilidad product-listing: {Object.entries(r.product_listing_plausibility).map(([k, v]) => `${k} ${v}`).join(", ")}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Marketplace: {Object.entries(r.marketplace_breakdown).map(([k, v]) => `${k} ${v}`).join(", ")}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Sesgo de fuente: {r.source_bias.join(" · ")}</div>
      <div style={{ fontSize: 11.5, color: C.ink, marginTop: 6 }}><b>Capacidades reutilizables:</b> {r.reusable_capabilities.join(" · ")}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{r.novelty_note}</div>
    </div>
    <div style={{ ...box, background: "#EAF4EC" }}>
      <div style={{ fontWeight: 700, color: C.navy }}>Colombia · Retail #3 · EN VIVO · {live.id}</div>
      <div style={{ fontSize: 11.5, color: C.muted, margin: "4px 0 8px" }}>data_basis <b>{live.data_basis}</b> · llamadas <b>{live.budget.actual_calls}/{live.budget.hard_max_provider_calls}</b> · muestra observada, no representatividad del mercado</div>
      <div style={{ fontSize: 12.5 }}>Resultados <b>{live.metrics.raw_results}</b> → únicos <b>{live.metrics.unique_results}</b> → cuentas canónicas <b>{live.metrics.canonical_accounts}</b> → compatibles retail <b>{live.metrics.retail_compatible}</b></div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>Precisión observada <b>{Math.round(live.metrics.retailer_precision*100)}%</b> · resolución digital <b>{Math.round(live.metrics.digital_resolution_rate*100)}%</b> · evidencia de surtido <b>{Math.round(live.metrics.assortment_evidence_yield*100)}%</b> · inflation ratio <b>{live.metrics.location_inflation_ratio.toFixed(2)}</b></div>
      <div style={{ fontSize: 11.5, color: "#8a6d3b", marginTop: 5 }}>Exa: {live.metrics.exa_executed ? `${live.metrics.exa_incremental_accounts} cuentas incrementales` : "no ejecutado: cobertura base superó el umbral de escalamiento"} · intención de compra inferida: {live.metrics.buying_intent_inferred}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>Saturación observada: {live.saturation.map(x=>`${x.processed}→${x.useful_accounts} útiles`).join(" · ")}</div>
    </div></>
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
