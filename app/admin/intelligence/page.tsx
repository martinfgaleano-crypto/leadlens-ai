"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";
import type { AdminIntelligenceViewModel } from "@/lib/intelligence/admin-view-model";
import type {
  IntelligenceCapabilityAssessment, IntelligenceGap, IntelligenceOutput,
  IntelligencePattern, MeasurementResult, NextBestIntelligenceAction,
} from "@/lib/intelligence/os-contracts";
import styles from "./page.module.css";

const TABS = [
  ["overview", "Overview"], ["capabilities", "Capabilities"], ["outputs", "Outputs"],
  ["patterns", "Patterns"], ["validation", "Validation"], ["gaps", "Gaps & Actions"],
  ["readiness", "Readiness"], ["evidence", "Evidence"],
] as const;
type Tab = (typeof TABS)[number][0];
const LABELS: Record<string, string> = {
  analytical_depth: "Analytical Depth", differentiation: "Differentiation",
  evidence_integrity: "Evidence Integrity", commercial_relevance: "Commercial Relevance",
  client_specificity: "Client Specificity", temporal_intelligence: "Temporal Intelligence",
  learning_maturity: "Learning Maturity", outcome_performance: "Outcome Performance",
};
const words = (value: string | null | undefined) => value ? value.replace(/_/g, " ") : "Unavailable";
const pct = (value: number | null) => value === null ? "Not measured" : `${Math.round(value * 100)}%`;
const stateTone = (state: string) => state === "measured" || state === "production" || state === "confirmed"
  ? styles.good : state.includes("not_") || state === "blocked" || state === "refuted"
    ? styles.bad : styles.warn;

function StatePill({ value }: { value: string }) {
  return <span className={`${styles.pill} ${stateTone(value)}`}>{words(value)}</span>;
}

function Measurement({ value, compact = false }: { value: MeasurementResult; compact?: boolean }) {
  return (
    <div className={styles.measurement}>
      <StatePill value={value.state} />
      {value.state === "measured" ? (
        <>
          <strong className={compact ? styles.scoreSmall : styles.score}>{value.score}</strong>
          <span className={styles.muted}>confidence {pct(value.confidence)} · n={value.sample_size}</span>
        </>
      ) : <span className={styles.muted}>{value.reason}{value.sample_size !== undefined ? ` · n=${value.sample_size}` : ""}</span>}
    </div>
  );
}

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={styles.empty}><strong>{title}</strong><p>{children}</p></div>;
}

function Metric({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function SectionHeader({ title, eyebrow, text }: { title: string; eyebrow?: string; text?: string }) {
  return <header className={styles.sectionHeader}>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2>{text && <p>{text}</p>}</header>;
}

function Overview({ model }: { model: AdminIntelligenceViewModel }) {
  const { snapshot } = model;
  return <>
    <section className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>LeadLens Intelligence Maturity</span>
        <h1>{words(snapshot.index.level)}</h1>
        <Measurement value={snapshot.index.overall} />
        <p className={styles.diagnosis}>{snapshot.diagnosis.headline}</p>
      </div>
      <dl className={styles.heroFacts}>
        <div><dt>Maturity confidence</dt><dd>{pct(snapshot.index.level_confidence)}</dd></div>
        <div><dt>Strongest capability</dt><dd>{words(snapshot.diagnosis.strongest_capability)}</dd></div>
        <div><dt>Weakest capability</dt><dd>{words(snapshot.diagnosis.weakest_capability)}</dd></div>
        <div><dt>Primary bottleneck</dt><dd>{words(snapshot.diagnosis.top_bottleneck) ?? "None identified"}</dd></div>
        <div><dt>Highest-leverage action</dt><dd>{words(snapshot.diagnosis.highest_leverage_action)}</dd></div>
        <div><dt>Report readiness</dt><dd>{words(snapshot.readiness.readiness_level)}</dd></div>
      </dl>
      <footer>
        <span>Calculated {new Date(snapshot.calculated_at).toLocaleString()}</span>
        <span>Cutoff {snapshot.source_data_cutoff}</span>
        <span>{snapshot.methodology_version}</span>
      </footer>
    </section>

    <div className={styles.availability} role="status">
      <strong>Data availability</strong><span>{model.availability.message}</span>
      <StatePill value={`database ${model.availability.database}`} />
      <StatePill value={`artifact ${model.availability.artifact}`} />
      <StatePill value={`validation ${model.availability.validation_persistence}`} />
    </div>
    {model.research_quality && <section className={styles.panel}>
      <SectionHeader eyebrow="Block 7 · internal only" title="Research quality" text={model.research_quality.comparison.quality_changes.join(" ")}/>
      <div className={styles.metricGrid}>
        <Metric label="Accounts researched" value={model.research_quality.summary.accounts_researched}/>
        <Metric label="Qualified" value={model.research_quality.summary.qualification_coverage}/>
        <Metric label="Evidence accepted" value={model.research_quality.summary.accepted_evidence}/>
        <Metric label="Evidence rejected" value={model.research_quality.summary.rejected_evidence}/>
        <Metric label="Actionable now" value={model.research_quality.summary.actionable_accounts}/>
        <Metric label="Primary bottleneck" value={model.research_quality.summary.commercially_relevant_claims ? "Corroboration / timing" : "No current commercial claims"}/>
      </div>
    </section>}
    {model.signal_temporal && <section className={styles.panel}>
      <SectionHeader eyebrow="Block 8 · observation only" title="Temporal monitoring" text={`${model.signal_temporal.summary.unchanged_or_no_current_signal} of ${model.signal_temporal.summary.accounts} accounts produced an honest no-change or no-current-signal result. Ranking and reports remain off.`}/>
      <div className={styles.metricGrid}>
        <Metric label="Accounts monitored" value={model.signal_temporal.summary.accounts}/>
        <Metric label="Triggers checked" value={model.signal_temporal.summary.triggers_checked}/>
        <Metric label="Queries executed" value={model.signal_temporal.summary.queries_executed}/>
        <Metric label="Signal candidates" value={model.signal_temporal.summary.signal_candidates}/>
        <Metric label="Accepted signals" value={model.signal_temporal.summary.accepted_signals}/>
        <Metric label="Material changes" value={model.signal_temporal.summary.accounts_with_material_change}/>
        <Metric label="Database ledger" value={model.signal_temporal.migration_043_applied ? "Available" : "Migration 043 pending"}/>
        <Metric label="Provider cost" value={model.signal_temporal.summary.measured_cost_usd === null ? "Not measured" : `$${model.signal_temporal.summary.measured_cost_usd}`}/>
      </div>
    </section>}
    {model.signal_benchmark && <section className={styles.panel}>
      <SectionHeader eyebrow="Block 9 · benchmark · preliminary" title="Signal recovery health" text="Curated benchmark measurements are not production outcomes and do not affect ranking, Outcome Performance or report readiness."/>
      <div className={styles.metricGrid}>
        <Metric label="Signal system status" value={model.signal_benchmark.metrics.false_positives ? "Precision gap" : "Precision protected"}/>
        <Metric label="Sample" value={model.signal_benchmark.metrics.sample_size}/>
        <Metric label="Precision" value={model.signal_benchmark.metrics.precision.value === null ? "Insufficient sample" : pct(model.signal_benchmark.metrics.precision.value)}/>
        <Metric label="Recall" value={model.signal_benchmark.metrics.recall.value === null ? "Insufficient sample" : pct(model.signal_benchmark.metrics.recall.value)}/>
        <Metric label="Identity precision" value={model.signal_benchmark.metrics.identity_precision.value === null ? "Insufficient sample" : pct(model.signal_benchmark.metrics.identity_precision.value)}/>
        <Metric label="Date-valid coverage" value={model.signal_benchmark.metrics.date_valid_coverage.value === null ? "Insufficient sample" : pct(model.signal_benchmark.metrics.date_valid_coverage.value)}/>
        <Metric label="False positives / negatives" value={`${model.signal_benchmark.metrics.false_positives} / ${model.signal_benchmark.metrics.false_negatives}`}/>
        <Metric label="Primary recovery bottleneck" value={Object.entries(model.signal_benchmark.gate_failures).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "None measured"}/>
      </div>
      {model.signal_monitoring_operation && <p>Latest operation: {model.signal_monitoring_operation.summary.raw_results} raw results, {model.signal_monitoring_operation.summary.correct_entity_results} correct-entity results, {model.signal_monitoring_operation.summary.valid_signals} valid signals. Persistence is operational; monitoring remains manually triggered.</p>}
    </section>}
    {model.entity_resolution && <section className={styles.panel}>
      <SectionHeader eyebrow="Block 10 · internal only" title="Colombian entity resolution" text="Identity is resolved before event search. Results remain outside ranking and customer reports."/>
      <div className={styles.metricGrid}>
        <Metric label="Entity coverage" value={`${model.entity_resolution.summary.accounts}/6`}/>
        <Metric label="Confirmed accounts" value={model.entity_resolution.summary.confirmed}/>
        <Metric label="Unresolved accounts" value={model.entity_resolution.summary.unresolved}/>
        <Metric label="Verified domains" value={model.entity_resolution.summary.verified_domains}/>
        <Metric label="Official properties" value={model.entity_resolution.summary.official_properties}/>
        <Metric label="Event eligible" value={model.entity_resolution.summary.event_eligible}/>
        <Metric label="Direct events" value={model.entity_resolution.summary.directly_attributable_events}/>
        <Metric label="Primary bottleneck" value={model.entity_resolution.summary.dated_event_results ? "Event attribution" : "No dated attributable event"}/>
      </div>
      <p><strong>Provider health:</strong> {Object.entries(model.entity_resolution.summary.provider_health).map(([provider,health]) => `${provider}: ${health.state}${health.automatic_fallback === false ? " (fallback off)" : ""}`).join(" · ")}</p>
    </section>}
    {model.opportunity_synthesis && <section className={styles.panel}>
      <SectionHeader eyebrow="Block 11 · internal · unreviewed" title="Account opportunity synthesis" text="Client-specific fit, accessibility and strategy are separated from timing and buying intent. Premium readiness remains blocked."/>
      <div className={styles.metricGrid}>
        <Metric label="Opportunity theses" value={model.opportunity_synthesis.summary.theses}/>
        <Metric label="Client context" value={model.opportunity_synthesis.summary.context_quality}/>
        <Metric label="Usable client fit" value={model.opportunity_synthesis.summary.usable_client_fit}/>
        <Metric label="Use cases" value={model.opportunity_synthesis.summary.use_cases}/>
        <Metric label="Access paths" value={model.opportunity_synthesis.summary.access_paths}/>
        <Metric label="Without current timing" value={model.opportunity_synthesis.summary.blocked_by_timing}/>
        <Metric label="Unreviewed" value={model.opportunity_synthesis.summary.review_state}/>
        <Metric label="Customer-safe" value={model.opportunity_synthesis.summary.customer_safe_outputs}/>
      </div>
      <p><strong>Primary bottleneck:</strong> {model.opportunity_synthesis.summary.blocked_by_timing} accounts lack current timing and {model.opportunity_synthesis.summary.blocked_by_evidence} retain evidence gaps. Missing client fields: {model.opportunity_synthesis.summary.context_unknown_fields}.</p>
      <ul>{model.opportunity_synthesis.theses.map(t=><li key={t.account_id}><strong>{t.account_name} · {words(t.decision)}:</strong> {t.why_now.statement} Why not now: {t.why_not_now[0]} Limiter: {words(t.confidence.limiting_factor)}.</li>)}</ul>
    </section>}

    <SectionHeader eyebrow="Eight dimensions" title="Maturity scorecard" text="Scores appear only when the underlying dimension is genuinely measured." />
    <div className={styles.dimensionGrid}>
      {snapshot.index.dimensions.map((dimension) => (
        <article className={styles.dimension} key={dimension.id}>
          <div className={styles.rowBetween}><h3>{LABELS[dimension.id] ?? words(dimension.id)}</h3><span>{words(dimension.trend)}</span></div>
          <Measurement value={dimension.measurement} />
          {dimension.id === "differentiation" && dimension.measurement.state !== "measured" && <p>Baseline comparison has not been run.</p>}
          {dimension.id === "outcome_performance" && dimension.measurement.state !== "measured" && <p>Fewer than five attributable outcomes are available.</p>}
          {dimension.id === "evidence_integrity" && <p>{model.evidence.explanation}</p>}
          <dl>
            <div><dt>Evidence</dt><dd>{dimension.evidence[0]?.ref ?? "No supporting reference available"}</dd></div>
            <div><dt>Principal limitation</dt><dd>{dimension.limitations[0] ?? "No recorded limitation"}</dd></div>
            <div><dt>Next improvement</dt><dd>{dimension.next_improvement ?? "No next step recorded"}</dd></div>
          </dl>
        </article>
      ))}
    </div>

    <div className={styles.twoCol}>
      <section className={styles.panel}>
        <SectionHeader eyebrow="Responsible claims" title="What LeadLens can claim today" />
        {model.responsible_claims.length ? <ul className={styles.cleanList}>{model.responsible_claims.map((x) => <li key={x}>{x}</li>)}</ul>
          : <EmptyState title="No validated claims available">Operational claims need exercised capabilities or supported outputs.</EmptyState>}
      </section>
      <section className={styles.panel}>
        <SectionHeader eyebrow="System limitations" title="What LeadLens cannot responsibly claim yet" />
        <ul className={styles.cleanList}>{model.unsupported_claims.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
    </div>

    <section className={styles.panel}>
      <SectionHeader eyebrow="Secondary inventory" title={model.knowledge.label} text={model.knowledge.disclaimer} />
      <div className={styles.metricGrid}>
        <Metric label="Verified companies" value={model.knowledge.verified_companies ?? "Unavailable"} />
        <Metric label="Probable companies" value={model.knowledge.probable_companies ?? "Unavailable"} />
        <Metric label="Excluded candidates" value={model.knowledge.excluded_candidates ?? "Unavailable"} />
        <Metric label="Buyer segments" value={model.knowledge.buyer_segments ?? "Unavailable"} />
        <Metric label="Markets represented" value={model.knowledge.markets_represented ?? "Unavailable"} />
        <Metric label="Vault records" value={model.knowledge.vault_records ?? "Unavailable"} />
        <Metric label="Account Memory" value={model.knowledge.account_memory_records ?? "Unavailable"} />
        <Metric label="Latest artifact" value={model.knowledge.latest_run ?? "Unavailable"} />
      </div>
    </section>
  </>;
}

function Capabilities({ capabilities }: { capabilities: IntelligenceCapabilityAssessment[] }) {
  const [mode, setMode] = useState("all");
  const [measurement, setMeasurement] = useState("all");
  const [exercised, setExercised] = useState("all");
  const filtered = capabilities.filter((cap) =>
    (mode === "all" || cap.mode === mode) &&
    (measurement === "all" || (measurement === "measured" ? cap.measurement_state === "measured" : cap.measurement_state !== "measured")) &&
    (exercised === "all" || (exercised === "yes" ? Boolean(cap.last_exercised) : !cap.last_exercised)));
  return <section>
    <SectionHeader eyebrow={`${filtered.length} of ${capabilities.length}`} title="Capability map" text="Operational maturity, evidence and impact—without treating database volume as intelligence." />
    <div className={styles.filters} aria-label="Capability filters">
      <label>Mode<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="all">All</option>{Array.from(new Set(capabilities.map((c) => c.mode))).map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Measurement<select value={measurement} onChange={(e) => setMeasurement(e.target.value)}><option value="all">All</option><option value="measured">Measured</option><option value="unmeasured">Unmeasured</option></select></label>
      <label>Exercised<select value={exercised} onChange={(e) => setExercised(e.target.value)}><option value="all">All</option><option value="yes">Exercised</option><option value="no">Not exercised</option></select></label>
    </div>
    <div className={styles.tableWrap}><table>
      <thead><tr><th>Capability</th><th>Maturity</th><th>Mode</th><th>Measurement</th><th>Sample</th><th>Evidence</th><th>Impact</th><th>Last exercised</th></tr></thead>
      <tbody>{filtered.map((cap) => <tr key={cap.capability_id}>
        <td><details><summary>{words(cap.capability_id)}</summary><div className={styles.detail}>
          <strong>Known limitations</strong><ul>{cap.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
          <strong>Failure modes</strong><ul>{cap.known_failure_modes.map((x) => <li key={x}>{x}</li>)}</ul>
          <strong>Evidence</strong><ul>{cap.evidence.map((x) => <li key={x.id}>{x.kind}: {x.ref}</li>)}</ul>
          <strong>Promotion criteria</strong><ul>{cap.promotion_criteria.map((x) => <li key={x}>{x}</li>)}</ul>
          <p><strong>Next milestone:</strong> {cap.next_milestone ?? "Not defined"}</p>
        </div></details></td>
        <td>{words(cap.maturity_level)}</td><td><StatePill value={cap.mode} /></td><td><StatePill value={cap.measurement_state} /></td>
        <td>{cap.sample_size}</td><td>{cap.evidence.length}</td><td>ranking {cap.ranking_impact}<br/>report {cap.report_impact}</td>
        <td>{cap.last_exercised ? new Date(cap.last_exercised).toLocaleDateString() : "Never"}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

function OutputCard({ output }: { output: IntelligenceOutput }) {
  const claims = [output.claim.kind, ...output.supporting_facts.map((x) => x.kind), ...output.supporting_signals.map((x) => x.kind)];
  return <article className={styles.output}>
    <header><div><span className={styles.eyebrow}>{words(output.type)}</span><h3>{output.claim.statement}</h3></div><strong>{Math.round(output.confidence * 100)}%</strong></header>
    <p>{output.summary}</p>
    <div className={styles.pills}>{Array.from(new Set(claims)).map((x) => <StatePill key={x} value={x} />)}<StatePill value={output.validation_state}/><StatePill value={output.report_eligibility}/></div>
    <dl className={styles.outputFacts}>
      <div><dt>Market</dt><dd>{output.affected_market ?? "Unspecified"}</dd></div>
      <div><dt>Segments</dt><dd>{output.affected_segments.join(", ") || "None"}</dd></div>
      <div><dt>Accounts</dt><dd>{output.affected_accounts.length || "Market-level"}</dd></div>
      <div><dt>Scope</dt><dd>{output.scope.kind}</dd></div>
      <div><dt>Review</dt><dd>{words(output.human_review_state)}</dd></div>
      <div><dt>Ranking impact</dt><dd>{output.ranking_impact}</dd></div>
    </dl>
    <div className={styles.measureRow}><Measurement compact value={output.novelty}/><Measurement compact value={output.actionability}/><Measurement compact value={output.commercial_relevance}/></div>
    <details><summary>Reasoning, evidence and limitations</summary><div className={styles.detail}>
      <p><strong>Reasoning:</strong> {output.reasoning_summary}</p>
      <strong>Evidence</strong><ul>{output.supporting_evidence.map((x) => <li key={x.id}>{x.kind}: {x.ref}</li>)}</ul>
      <strong>Counterevidence</strong><ul>{output.counterevidence.length ? output.counterevidence.map((x) => <li key={x.id}>{x.ref}</li>) : <li>None recorded</li>}</ul>
      <strong>Alternative explanations</strong><ul>{output.alternative_explanations.map((x) => <li key={x}>{x}</li>)}</ul>
      <strong>Unresolved questions</strong><ul>{output.unresolved_questions.map((x) => <li key={x}>{x}</li>)}</ul>
    </div></details>
  </article>;
}

function Outputs({ model }: { model: AdminIntelligenceViewModel }) {
  const outputs = model.snapshot.outputs;
  const [type, setType] = useState("all"), [validation, setValidation] = useState("all");
  const filtered = outputs.filter((o) => (type === "all" || o.type === type) && (validation === "all" || o.validation_state === validation));
  const v = model.snapshot.validation_summary;
  return <section>
    <SectionHeader eyebrow="Intelligence registry" title="Intelligence outputs" text="Generated conclusions remain distinct from validated conclusions and customer-safe content." />
    <div className={styles.metricGrid}>
      <Metric label="Total outputs" value={outputs.length}/><Metric label="Reviewed" value={v.reviewed_count}/><Metric label="Unreviewed" value={outputs.length-v.reviewed_count}/>
      <Metric label="Customer-safe" value={outputs.filter((o) => o.report_eligibility === "eligible").length}/><Metric label="Internal-only" value={outputs.filter((o) => o.report_eligibility !== "eligible").length}/>
      <Metric label="Confirmed" value={v.confirmed_count}/><Metric label="Refuted" value={v.refuted_count}/><Metric label="Acted upon" value={v.acted_upon_count}/>
    </div>
    <div className={styles.filters}><label>Output type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option>{Array.from(new Set(outputs.map((o) => o.type))).map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Validation<select value={validation} onChange={(e) => setValidation(e.target.value)}><option value="all">All</option>{Array.from(new Set(outputs.map((o) => o.validation_state))).map((x) => <option key={x}>{x}</option>)}</select></label></div>
    <div className={styles.outputList}>{filtered.map((output) => <OutputCard key={output.id} output={output}/>)}</div>
    {model.research_quality && <section className={styles.panel}><h3>Account qualification outputs · internal</h3>
      <div className={styles.tableWrap}><table><thead><tr><th>Account</th><th>Decision</th><th>Claims</th><th>Passed gates</th><th>Failed gates</th><th>Next action</th></tr></thead>
        <tbody>{model.research_quality.accounts.map((account) => <tr key={account.domain}><td>{account.account}<br/><small>{account.domain}</small></td><td><StatePill value={account.qualification.state}/></td><td>{account.claims.length}</td><td>{account.qualification.passed_gates.join(", ") || "None"}</td><td>{account.qualification.failed_gates.join(", ") || "None"}</td><td>{account.qualification.justified_next_action}</td></tr>)}</tbody>
      </table></div>
    </section>}
  </section>;
}

function Patterns({ model }: { model: AdminIntelligenceViewModel }) {
  const patterns = model.snapshot.patterns;
  return <section><SectionHeader eyebrow="Observation only" title="Pattern Observatory" text="Outputs never become patterns automatically; every pattern remains sample- and review-gated." />
    {!patterns.length ? <EmptyState title="No valid patterns yet">{model.empty_states.patterns} Next: collect compatible, distinct observations and request human review.</EmptyState>
      : <div className={styles.outputList}>{patterns.map((p: IntelligencePattern) => <article className={styles.output} key={p.id}><header><div><span className={styles.eyebrow}>{words(p.type)}</span><h3>{p.statement}</h3></div><StatePill value={p.state}/></header><p>{p.explanation}</p><div className={styles.metricGrid}><Metric label="Sample" value={`${p.sample_size}/${model.pattern_threshold}`}/><Metric label="Remaining" value={Math.max(0, model.pattern_threshold-p.sample_size)}/><Metric label="Mode" value={words(p.mode)}/><Metric label="Ranking" value={p.ranking_impact}/><Metric label="Report" value={p.report_impact}/></div><details><summary>Evidence and exceptions</summary><div className={styles.detail}><p>{p.commercial_meaning}</p><ul>{p.evidence.map((x) => <li key={x.id}>{x.ref}</li>)}</ul><p>Counterexamples: {p.counterexamples.join(", ") || "None recorded"}</p><p>Exceptions: {p.exceptions.join(", ") || "None recorded"}</p></div></details></article>)}</div>}
    <section className={styles.panel}><h3>Pattern readiness</h3><p>Minimum compatible rated sample: <strong>{model.pattern_threshold}</strong>. Human review remains required after reaching the floor. Candidate categories include source quality, timing, false positives, client-specific preferences and cross-account tendencies.</p></section>
  </section>;
}

function Validation({ model, reload }: { model: AdminIntelligenceViewModel; reload: () => void }) {
  const [running, setRunning] = useState(false), [result, setResult] = useState("");
  const s = model.snapshot.validation_summary;
  const funnel = [
    ["Generated", s.output_count], ["Reviewed", s.reviewed_count], ["Corrected", s.corrected_count],
    ["Client relevant", s.client_relevant_count], ["Acted upon", s.acted_upon_count],
    ["Confirmed", s.confirmed_count], ["Partially confirmed", s.partially_confirmed_count], ["Refuted", s.refuted_count],
  ] as const;
  async function runLearner() {
    setRunning(true);
    try {
      const res = await adminFetch("/api/admin/intelligence/learn", { method: "POST", body: JSON.stringify({}) });
      const body = await res.json();
      setResult(res.ok ? `Learner complete: ${body.result?.events_read ?? 0} events read. Ranking remains off.` : `Learner unavailable: ${body.error ?? res.status}`);
      reload();
    } finally { setRunning(false); }
  }
  return <section><SectionHeader eyebrow="Output → outcome → learning" title="Validation and learning funnel" text={`Primary lifecycle bottleneck: ${words(s.lifecycle_bottleneck)}`} />
    <div className={styles.funnel} aria-label="Validation funnel">{funnel.map(([name, count], index) => <div key={name}><span>{index+1}</span><strong>{count}</strong><small>{name}</small></div>)}</div>
    {!s.reviewed_count && <EmptyState title="No persisted human reviews">{model.empty_states.validation} This is expected until an Admin reviews an output through the server-mediated lifecycle.</EmptyState>}
    {!s.acted_upon_count && <EmptyState title="No acted-upon outputs">No commercial action has yet been linked to an intelligence output. Link a real action before recording an outcome.</EmptyState>}
    {!s.confirmed_count && !s.partially_confirmed_count && !s.refuted_count && <EmptyState title="No attributable outcomes">{model.empty_states.outcomes}</EmptyState>}
    <div className={styles.twoCol}>
      <section className={styles.panel}><h3>Learning implications</h3><div className={styles.metricGrid}>{Object.entries(s.implications_by_type).map(([name, count]) => <Metric key={name} label={words(name)} value={count}/>)}</div>{!Object.keys(s.implications_by_type).length && <p className={styles.muted}>No implications yet. The system will not update ranking automatically.</p>}</section>
      <section className={styles.panel}><div className={styles.rowBetween}><h3>Feedback observability</h3><button className={styles.button} onClick={runLearner} disabled={running}>{running ? "Running…" : "Run observation learner"}</button></div>
        {model.feedback.available ? <div className={styles.metricGrid}><Metric label="Events" value={model.feedback.total_events}/><Metric label="With reasons" value={model.feedback.with_reason_codes}/><Metric label="With snapshot" value={model.feedback.with_snapshot}/><Metric label="With versions" value={model.feedback.with_versions}/></div>
          : <p className={styles.muted}>{model.feedback.reason}</p>}{result && <p role="status">{result}</p>}</section>
    </div>
  </section>;
}

function GapCard({ gap }: { gap: IntelligenceGap }) {
  return <article className={styles.gap}><header><StatePill value={gap.severity}/><strong>Priority {gap.priority}</strong><span>{words(gap.category)}</span></header><h3>{gap.impact}</h3><p>{gap.recommended_action}</p><dl><div><dt>Capability</dt><dd>{words(gap.affected_capability)}</dd></div><div><dt>Readiness impact</dt><dd>{gap.report_readiness_impact}</dd></div><div><dt>Effort</dt><dd>{gap.effort}</dd></div><div><dt>Confidence</dt><dd>{pct(gap.confidence)}</dd></div><div><dt>Dependency</dt><dd>{gap.dependency ?? "None"}</dd></div><div><dt>Status</dt><dd>{gap.status}</dd></div></dl></article>;
}
function ActionRow({ action }: { action: NextBestIntelligenceAction }) {
  return <article className={styles.action}><strong>{action.priority}</strong><div><h3>{words(action.action_type)}</h3><p>{action.rationale}</p><small>Success: {action.success_metric}</small></div><div><StatePill value={action.status}/><span>effort {action.effort} · confidence {pct(action.confidence)}</span></div></article>;
}
function Gaps({ model }: { model: AdminIntelligenceViewModel }) {
  const [severity, setSeverity] = useState("all");
  const gaps = model.snapshot.gaps.filter((g) => severity === "all" || g.severity === severity);
  const actions = model.snapshot.actions;
  const fastest = [...actions].sort((a,b) => ["xs","s","m","l","xl"].indexOf(a.effort)-["xs","s","m","l","xl"].indexOf(b.effort) || b.priority-a.priority)[0];
  return <section><SectionHeader eyebrow={`${gaps.length} active gaps`} title="Intelligence gaps and action queue" text="Priorities are ordinal decision aids, not precise forecasts." />
    {model.signal_benchmark && <section className={styles.panel}><h3>Signal calibration gaps · benchmark preliminary</h3>
      <ul>
        {Object.entries(model.signal_benchmark.gate_failures).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name,count]) => <li key={name}><strong>{words(name)}:</strong> {count} fixture gate failures. Next action: calibrate the category-specific recovery path without weakening the gate.</li>)}
        <li><strong>Coverage:</strong> add reviewed cases for signal categories not represented in the 19-case benchmark.</li>
        <li><strong>Provider/date:</strong> retain Brave for dated search discovery and Tavily for extraction; keep Serper disabled while HTTP 400 persists.</li>
      </ul>
    </section>}
    <div className={styles.filters}><label>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="all">All</option>{["critical","high","medium","low"].map((x) => <option key={x}>{x}</option>)}</select></label></div>
    <div className={styles.gapGrid}>{gaps.map((gap) => <GapCard gap={gap} key={gap.id}/>)}</div>
    <SectionHeader eyebrow="Impact × effort" title="Next best intelligence actions" text={`Highest leverage: ${words(actions[0]?.action_type)}. Fastest meaningful: ${words(fastest?.action_type)}.`}/>
    <div className={styles.actionList}>{actions.map((action) => <ActionRow action={action} key={action.id}/>)}</div>
  </section>;
}

function Readiness({ model }: { model: AdminIntelligenceViewModel }) {
  const r = model.snapshot.readiness;
  const levels = ["not_ready","snapshot_ready","brief_ready","intelligence_report_ready","premium_report_ready"];
  const current = levels.indexOf(r.readiness_level);
  return <section><SectionHeader eyebrow="System-level assessment" title="Report readiness" text="Brief-ready is not equivalent to premium intelligence." />
    <div className={styles.readiness}>{levels.map((level, i) => <div className={i <= current ? styles.reached : ""} key={level}><span>{i+1}</span><strong>{words(level)}</strong></div>)}</div>
    <div className={styles.metricGrid}><Metric label="Current level" value={words(r.readiness_level)}/><Metric label="Confidence" value={pct(r.confidence)}/><Metric label="Customer-safe outputs" value={r.customer_safe_outputs.length}/><Metric label="Internal-only outputs" value={r.unsafe_outputs.length}/></div>
    <div className={styles.twoCol}><section className={styles.panel}><h3>Current blockers</h3><ul className={styles.cleanList}>{r.blockers.map((b, i) => <li key={`${b.gap_id}-${i}`}><StatePill value={b.severity}/> {b.description}</li>)}</ul></section>
      <section className={styles.panel}><h3>Supportable sections</h3><ul className={styles.cleanList}>{r.supportable_sections.map((x) => <li key={x}>{x}</li>)}</ul><h3>Still superficial</h3><ul className={styles.cleanList}>{r.superficial_sections.map((x) => <li key={x}>{x}</li>)}</ul></section></div>
    <EmptyState title="Intelligence Lift">{model.empty_states.lift}</EmptyState><EmptyState title="Historical trends">{model.empty_states.trends}</EmptyState>
  </section>;
}

function Evidence({ model }: { model: AdminIntelligenceViewModel }) {
  const e = model.evidence;
  const deep = model.deep_accounts;
  return <section><SectionHeader eyebrow="Availability ≠ quality" title="Evidence integrity" text={e.explanation}/>
    <div className={styles.evidenceHero}><Measurement value={e.availability}/><p>Evidence availability, quality, corroboration, freshness and counterevidence are tracked separately.</p></div>
    <div className={styles.metricGrid}><Metric label="Evidence items" value={e.total ?? "Unavailable"}/><Metric label="Dated" value={e.dated ?? "Unavailable"}/><Metric label="Corroborated" value={e.corroborated ?? "Unavailable"}/><Metric label="Stale" value={e.stale ?? "Unavailable"}/><Metric label="Source classes" value={e.source_classes ?? "Unavailable"}/><Metric label="Counterevidence" value={e.counterevidence_instrumented === null ? "Unavailable" : e.counterevidence_instrumented ? "Instrumented" : "Not instrumented"}/></div>
    {model.signal_benchmark && <section className={styles.panel}><h3>Signal benchmark diagnostics · preliminary</h3>
      <div className={styles.metricGrid}><Metric label="Benchmark sample" value={model.signal_benchmark.metrics.sample_size}/><Metric label="True positives" value={model.signal_benchmark.metrics.true_positives}/><Metric label="True negatives" value={model.signal_benchmark.metrics.true_negatives}/><Metric label="False positives" value={model.signal_benchmark.metrics.false_positives}/><Metric label="False negatives" value={model.signal_benchmark.metrics.false_negatives}/><Metric label="Event accuracy" value={model.signal_benchmark.metrics.event_normalization_accuracy.value === null ? "Insufficient sample" : pct(model.signal_benchmark.metrics.event_normalization_accuracy.value)}/></div>
      <p>These are curated benchmark results, not client outcomes. Denominators are preserved in the benchmark artifact and no metric affects structural ranking.</p>
    </section>}
    {model.research_quality && <section className={styles.panel}><h3>Research acceptance ledger</h3>
      <div className={styles.metricGrid}><Metric label="Accepted" value={model.research_quality.summary.accepted_evidence}/><Metric label="Rejected" value={model.research_quality.summary.rejected_evidence}/><Metric label="Wrong entity rejected" value={model.research_quality.summary.wrong_entity_rejections}/><Metric label="Dated coverage" value={pct(model.research_quality.summary.dated_evidence_coverage)}/><Metric label="Corroboration attempts" value={model.research_quality.summary.corroboration_attempts}/><Metric label="Counterevidence checks" value={`${model.research_quality.summary.counterevidence_checks}/${model.research_quality.summary.accounts_researched}`}/></div>
      <p>Source tiers: {Object.entries(model.research_quality.summary.source_quality_distribution).map(([tier, count]) => `${tier}: ${count}`).join(" · ")}. Provider cost: {model.research_quality.summary.provider_cost.state === "measured" ? `$${model.research_quality.summary.provider_cost.usd}` : "not measured"}.</p>
    </section>}
    {deep ? <section className={styles.panel}>
      <h3>Deep account intelligence · controlled pass</h3>
      <p>{deep.summary.accounts_researched} shortlisted accounts researched with {deep.summary.provider_calls} bounded provider calls. Search presence is not treated as purchase intent.</p>
      <div className={styles.metricGrid}><Metric label="Review candidates" value={deep.summary.review_candidates}/><Metric label="Current opportunities" value={deep.summary.current_opportunities}/><Metric label="Monitor" value={deep.summary.monitor_accounts}/><Metric label="Contradicted claims" value={deep.summary.contradicted_claims}/></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Account</th><th>Independent sources</th><th>Corroborated claims</th><th>Timing</th><th>Decision</th><th>Confidence</th></tr></thead>
        <tbody>{deep.accounts.map((account) => <tr key={account.domain}><td>{account.account}<br/><small>{account.domain}</small></td><td>{account.dossier.evidence.independent_sources}</td><td>{account.dossier.evidence.corroborated_claims}</td><td><StatePill value={account.dossier.temporal.timing_state}/></td><td><StatePill value={account.dossier.decision.state}/><br/><small>{account.dossier.decision.reason}</small></td><td>{pct(account.dossier.confidence)}</td></tr>)}</tbody>
      </table></div>
    </section> : <EmptyState title="No deep-account artifact yet">Run the controlled 5–6 account enrichment pass. Missing evidence is not replaced with synthetic intelligence.</EmptyState>}
    <section className={styles.panel}><h3>Evidence operations</h3><p>Review rights, source quality and contradictions before any customer use.</p><div className={styles.links}><a href="/admin/intelligence/sources">Source Access</a><a href="/admin/intelligence/source-review">Source Review</a><a href="/admin/intelligence/review">Review Queue</a><a href="/admin/intelligence/growth">Growth Observatory</a></div></section>
  </section>;
}

export default function IntelligencePage() {
  const [model, setModel] = useState<AdminIntelligenceViewModel | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const load = useCallback(async () => {
    setError("");
    try {
      const res = await adminFetch("/api/admin/intelligence/command-center");
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? body.error ?? `Request failed (${res.status})`);
      setModel(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Command Center unavailable."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as Tab;
    if (TABS.some(([id]) => id === fromHash)) setTab(fromHash);
    const onHash = () => { const next = window.location.hash.replace("#", "") as Tab; if (TABS.some(([id]) => id === next)) setTab(next); };
    window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const active = useMemo(() => {
    if (!model) return null;
    if (tab === "overview") return <Overview model={model}/>;
    if (tab === "capabilities") return <Capabilities capabilities={model.snapshot.capability_assessments}/>;
    if (tab === "outputs") return <Outputs model={model}/>;
    if (tab === "patterns") return <Patterns model={model}/>;
    if (tab === "validation") return <Validation model={model} reload={load}/>;
    if (tab === "gaps") return <Gaps model={model}/>;
    if (tab === "readiness") return <Readiness model={model}/>;
    return <Evidence model={model}/>;
  }, [model, tab, load]);

  return <AdminLayout><main className={styles.shell}>
    <header className={styles.commandHeader}><div><span>Intelligence OS · Internal</span><h1>LeadLens Intelligence Command Center</h1><p>Operational truth about capabilities, outputs, evidence, validation and next improvements.</p></div><div className={styles.links}><a href="/admin/intelligence/growth">Growth Observatory</a><a href="/admin/intelligence/review">Review Queue</a><a href="/admin/intelligence/sources">Source Access</a><a href="/admin/intelligence/source-review">Source Review</a></div></header>
    <nav className={styles.tabs} aria-label="Intelligence Command Center sections">{TABS.map(([id, name]) => <a key={id} href={`#${id}`} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{name}</a>)}</nav>
    {error ? <EmptyState title="Command Center unavailable">{error} No values have been replaced with fabricated zeros. <button className={styles.button} onClick={load}>Retry</button></EmptyState>
      : !model ? <div className={styles.loading} aria-live="polite"><span/>Assembling the latest protected intelligence snapshot…</div>
        : active}
  </main></AdminLayout>;
}
