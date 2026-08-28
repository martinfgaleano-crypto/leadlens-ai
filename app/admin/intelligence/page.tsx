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
import type { CapabilityMaturityEvaluation } from "@/lib/intelligence/capability-control-plane";

const TABS = [
  ["overview", "Overview"], ["control-plane", "Control Plane"], ["capabilities", "Legacy Capabilities"], ["outputs", "Outputs"],
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
  const control = model.control_plane;
  const intelligence = model.intelligence_score;
  const primaryBlocker = intelligence.blockers[0] ?? intelligence.components.find((item) => item.main_blocker)?.main_blocker ?? "No explicit blocker in canonical telemetry.";
  const weakest = intelligence.weakest[0] ?? intelligence.components.find((item) => item.score === null)?.label ?? "Not measured";
  const evidenceComponent = intelligence.components.find((item) => item.id === "evidence");
  const highestLeverage = evidenceComponent?.score === null
    ? "Measure source quality, association, corroboration, counterevidence and traceability as separate Evidence dimensions."
    : primaryBlocker;
  const headline = intelligence.score === null
    ? "Canonical Intelligence telemetry is unavailable; no score was substituted."
    : `Canonical Intelligence is ${intelligence.score}/100 from ${words(model.canonical.source)} telemetry. Inspect the components and evidence before trusting the score.`;
  return <>
    <section className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>LeadLens Intelligence Control Plane</span>
        <h1>Intelligence Score</h1>
        <div className={styles.measurement}><StatePill value={control.overall.state}/><strong className={styles.score}>{intelligence.score ?? "Not measured"}{intelligence.score !== null && <small>/100</small>}</strong><span className={styles.muted}>confidence {words(intelligence.confidence)} · n={intelligence.sample_size}</span></div>
        <p className={styles.muted}>{intelligence.trend === "insufficient_history" ? "No durable prior score; no trend inferred." : `Previous ${intelligence.previous}/100 · ${intelligence.delta! >= 0 ? "+" : ""}${intelligence.delta} · trend ${intelligence.trend}.`}</p>
        <p className={styles.diagnosis}>{headline}</p>
      </div>
      <dl className={styles.heroFacts}>
        <div><dt>Maturity confidence</dt><dd>{words(control.overall_confidence)}</dd></div>
        <div><dt>Human-validated Cases</dt><dd>{model.canonical.human_validation.positive_cases} positive / {model.canonical.human_validation.reviewed_cases} reviewed</dd></div>
        <div><dt>Degraded / blocked</dt><dd>{control.state_counts.degraded + control.state_counts.blocked}</dd></div>
        <div><dt>Strongest component</dt><dd>{intelligence.strongest.join(" · ") || "Not measured"}</dd></div>
        <div><dt>Weakest component</dt><dd>{weakest}</dd></div>
        <div><dt>Primary bottleneck</dt><dd>{primaryBlocker}</dd></div>
        <div><dt>Highest-leverage action</dt><dd>{highestLeverage}</dd></div>
        <div><dt>Launch stage</dt><dd>{words(model.canonical.launch_readiness?.level ?? model.launch_readiness_summary?.level)}</dd></div>
      </dl>
      <footer>
        <span>Evaluated {new Date(control.generated_at).toLocaleString()}</span>
        <span>Evidence cutoff {model.canonical.source_data_cutoff ?? "Unavailable"}</span>
        <span>{control.version}</span>
      </footer>
    </section>

    <div className={styles.availability} role="status">
      <strong>Canonical telemetry · {words(model.canonical.telemetry_state)}</strong><span>{model.canonical.explanation}</span>
      <StatePill value={model.canonical.source} />
    </div>

    <section className={styles.panel}>
      <SectionHeader eyebrow="Canonical automatic metrics" title="Intelligence quality and launch safety are separate" text="Intelligence measures reasoning quality from canonical capability telemetry. Launch Readiness additionally consumes runtime, configuration, security, report safety and operational blockers."/>
      <div className={styles.metricGrid}>
        <Metric label="Intelligence Score" value={intelligence.score === null ? "Not measured" : `${intelligence.score}/100`} note={`${intelligence.confidence} confidence · n=${intelligence.sample_size}`}/>
        <Metric label="Launch Readiness" value={model.launch_readiness_summary ? `${model.launch_readiness_summary.score}/100` : "Open Launch Readiness"} note={model.launch_readiness_summary ? `${model.launch_readiness_summary.confidence} confidence` : "No durable readiness snapshot available"}/>
        <Metric label="Strongest" value={intelligence.strongest.join(" · ") || "Not measured"}/>
        <Metric label="Weakest" value={intelligence.weakest.join(" · ") || "Not measured"}/>
      </div>
      {intelligence.movement_reasons.length > 0 && <p><strong>Last material movement:</strong> {intelligence.movement_reasons.join("; ")}.</p>}
      {intelligence.blockers.length > 0 && <div><strong>What would materially raise Intelligence:</strong><ul>{intelligence.blockers.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </section>

    <section className={styles.panel}>
      <SectionHeader eyebrow="Explainable subscores" title="Intelligence components" text="Unmeasured domains reduce confidence; they are never converted to zero or perfect performance."/>
      <div className={styles.tableWrap}><table><thead><tr><th>Domain</th><th>Score</th><th>Confidence</th><th>Sample</th><th>Main blocker</th></tr></thead><tbody>{intelligence.components.map((component) => <tr key={component.id}><td>{component.label}</td><td>{component.score === null ? "Not measured" : `${component.score}/100`}</td><td>{component.confidence === null ? "—" : pct(component.confidence)}</td><td>n={component.sample_size}</td><td>{component.main_blocker ?? "No explicit blocker in current evidence."}</td></tr>)}</tbody></table></div>
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
    {model.client_context_review && <section className={styles.panel}>
      <SectionHeader eyebrow="Block 12 · production context · internal" title="Client context completion & thesis review" text="Unanswered fields remain unknown. Submission is not acceptance; no fixture answer enters this view."/>
      <div className={styles.metricGrid}>
        <Metric label="Context completeness" value={`${model.client_context_review.summary.context_completeness}%`}/>
        <Metric label="Critical blockers" value={model.client_context_review.summary.critical_blockers}/>
        <Metric label="Unanswered questions" value={model.client_context_review.summary.unanswered}/>
        <Metric label="Theses reviewed" value={model.client_context_review.summary.theses_reviewed}/>
        <Metric label="Feasibility assessed" value={model.client_context_review.summary.feasibility_assessed}/>
        <Metric label="Safety reviewed" value={model.client_context_review.summary.customer_safety_reviewed}/>
        <Metric label="Customer-safe" value={model.client_context_review.summary.customer_safe}/>
        <Metric label="Sections blocked" value={model.client_context_review.summary.report_sections_blocked}/>
      </div>
      <p><strong>Primary blocker:</strong> verified operational, compliance and economic client answers are missing. Intake: {words(model.client_context_review.summary.intake_status)} · accepted context version: {model.client_context_review.summary.accepted_context_version ?? "none"}.</p>
      <h3>Highest-priority intake questions</h3>
      <ol>{model.client_context_review.questions.slice(0,10).map(q=><li key={q.question_id}><strong>{words(q.category)} · {words(q.field)}:</strong> {q.text} <small>{q.who_should_answer} · {words(q.answer_format)} · {q.affected_accounts.length} accounts</small></li>)}</ol>
      <h3>Validation-ready shortlist</h3>
      <ul>{model.client_context_review.shortlist.map(x=><li key={x.account}><strong>{x.account}:</strong> {words(x.state)} — {x.next_reviewer_action}</li>)}</ul>
      <p><strong>Report sections:</strong> {model.client_context_review.summary.report_sections_ready} ready · {model.client_context_review.summary.report_sections_ready_with_limitations} ready with limitations · {model.client_context_review.summary.report_sections_blocked} blocked.</p>
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

function CapabilityDimensionSummary({ evaluation }: { evaluation: CapabilityMaturityEvaluation }) {
  const measuredDimensions = Object.entries(evaluation.dimensions).filter(([, value]) => value.state === "measured");
  return <div className={styles.detail}>
    <strong>Dimension evidence</strong>
    <ul>{Object.entries(evaluation.dimensions).map(([name, value]) => <li key={name}>
      {words(name)}: {value.state === "measured" ? `${value.score}/100 · confidence ${pct(value.confidence)} · n=${value.sample_size}` : `${words(value.state)} · ${value.reason}`}
    </li>)}</ul>
    <strong>Supporting metrics</strong>
    {Object.keys(evaluation.supporting_metrics).length ? <ul>{Object.entries(evaluation.supporting_metrics).map(([name, value]) => <li key={name}>{words(name)}: {value ?? "Unavailable"}</li>)}</ul> : <p>No runtime metrics mapped yet.</p>}
    <strong>Blockers</strong>
    {evaluation.blockers.length ? <ul>{evaluation.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>No explicit blocker recorded.</p>}
    <p><strong>Measured dimensions:</strong> {measuredDimensions.length}/9 · <strong>Evidence freshness:</strong> {evaluation.evidence_freshness_days === null ? "Unavailable" : `${evaluation.evidence_freshness_days} days`}</p>
  </div>;
}

function ControlPlane({ model }: { model: AdminIntelligenceViewModel }) {
  const control = model.control_plane;
  const [domain, setDomain] = useState("all");
  const [state, setState] = useState("all");
  const capabilities = control.capabilities.filter((item) => (domain === "all" || item.capability.domain === domain) && (state === "all" || item.state === state));
  return <section>
    <SectionHeader eyebrow={`${capabilities.length} of ${control.capabilities.length} canonical capabilities`} title="Automatic capability control plane" text="Implementation, runtime quality, reliability, economics and validation are evaluated separately. Real runs override tests when they conflict." />
    <div className={styles.metricGrid}>
      <Metric label="Overall" value={control.overall.state === "measured" ? `${control.overall.score}/100` : "Not measured"} note={`confidence ${control.overall_confidence}`} />
      <Metric label="Production wired" value={control.state_counts.production_wired}/>
      <Metric label="Live validated" value={control.state_counts.live_validated}/>
      <Metric label="Soak validated" value={control.state_counts.soak_validated}/>
      <Metric label="Degraded" value={control.state_counts.degraded}/>
      <Metric label="Blocked" value={control.state_counts.blocked}/>
    </div>
    {control.critical_blockers.length > 0 && <section className={styles.panel}><h3>Evidence-driven blockers</h3><ul>{control.critical_blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></section>}
    <div className={styles.filters}>
      <label>Domain<select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">All</option>{Array.from(new Set(control.capabilities.map((item) => item.capability.domain))).map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>State<select value={state} onChange={(event) => setState(event.target.value)}><option value="all">All</option>{Array.from(new Set(control.capabilities.map((item) => item.state))).map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className={styles.tableWrap}><table>
      <thead><tr><th>Capability</th><th>Domain</th><th>State</th><th>Score</th><th>Confidence</th><th>Validation sample</th><th>Freshness</th></tr></thead>
      <tbody>{capabilities.map((item) => <tr key={item.capability.id}>
        <td><details><summary>{item.capability.name}</summary><CapabilityDimensionSummary evaluation={item}/></details></td>
        <td>{words(item.capability.domain)}</td><td><StatePill value={item.state}/></td>
        <td>{item.score.state === "measured" ? item.score.score : "Not measured"}</td><td>{item.confidence}</td>
        <td>{item.score.state === "measured" ? `n=${item.score.sample_size}` : item.score.sample_size !== undefined ? `n=${item.score.sample_size}` : "—"}</td>
        <td>{item.evidence_freshness_days === null ? "Unavailable" : `${item.evidence_freshness_days}d`}</td>
      </tr>)}</tbody>
    </table></div>
    <section className={styles.panel}><h3>Scoring evidence policy</h3><ol>{control.evidence_policy.map((rule) => <li key={rule}>{rule}</li>)}</ol></section>
  </section>;
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
    <section className={styles.panel}><h3>Canonical controlled validation</h3><div className={styles.metricGrid}><Metric label="Human-reviewed Cases" value={model.canonical.human_validation.reviewed_cases}/><Metric label="Customer-safe human-positive Cases" value={model.canonical.human_validation.positive_cases}/></div><p>These durable QA labels validate commercial defensibility without mutating the original system Decisions.</p></section>
    <div className={styles.funnel} aria-label="Validation funnel">{funnel.map(([name, count], index) => <div key={name}><span>{index+1}</span><strong>{count}</strong><small>{name}</small></div>)}</div>
    {!s.reviewed_count && model.canonical.human_validation.reviewed_cases === 0 && <EmptyState title="No persisted human reviews">{model.empty_states.validation} This is expected until an Admin reviews an output through the server-mediated lifecycle.</EmptyState>}
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
    <section className={styles.panel}><h3>Canonical score blockers</h3>{model.intelligence_score.blockers.length ? <ul>{model.intelligence_score.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No explicit blocker in current canonical telemetry.</p>}<p className={styles.muted}>The artifact-derived queue below is secondary diagnostic context and does not determine the canonical Intelligence Score.</p></section>
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
  const r = model.canonical.launch_readiness;
  if (!r) return <section><SectionHeader eyebrow="Canonical automatic assessment" title="Launch Readiness"/><EmptyState title="Readiness unavailable">No valid canonical readiness evaluation is available. No legacy report-readiness state was substituted.</EmptyState></section>;
  const levels = ["not_ready","internal_pilot","guided_beta","limited_launch","launch_ready"];
  const current = levels.indexOf(r.level);
  return <section><SectionHeader eyebrow="Canonical automatic assessment" title="Launch Readiness" text="The same durable capability authority used by Beta Readiness; Intelligence quality and launch safety remain separate." />
    <div className={styles.readiness}>{levels.map((level, i) => <div className={i <= current ? styles.reached : ""} key={level}><span>{i+1}</span><strong>{words(level)}</strong></div>)}</div>
    <div className={styles.metricGrid}><Metric label="Score" value={`${r.score}/100`}/><Metric label="Stage" value={words(r.level)}/><Metric label="Confidence" value={words(r.confidence)}/><Metric label="Sample" value={`n=${r.sample_size}`}/></div>
    <div className={styles.twoCol}><section className={styles.panel}><h3>Current blockers</h3>{r.blockers.length ? <ul className={styles.cleanList}>{r.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No failing launch gate in the canonical evaluation.</p>}</section>
      <section className={styles.panel}><h3>Degraded or unmeasured gates</h3><ul className={styles.cleanList}>{r.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section></div>
    <div className={styles.tableWrap}><table><thead><tr><th>Gate</th><th>State</th><th>Score</th><th>Sample</th><th>Reason</th></tr></thead><tbody>{r.gates.map((gate) => <tr key={gate.id}><td>{gate.label}</td><td><StatePill value={gate.state}/></td><td>{gate.score ?? "Not measured"}</td><td>n={gate.sample_size}</td><td>{gate.reason}</td></tr>)}</tbody></table></div>
  </section>;
}

function Evidence({ model }: { model: AdminIntelligenceViewModel }) {
  const e = model.evidence;
  const deep = model.deep_accounts;
  const canonicalEvidence = model.intelligence_score.components.find((item) => item.id === "evidence");
  return <section><SectionHeader eyebrow="Availability ≠ quality" title="Evidence integrity" text={e.explanation}/>
    <section className={styles.panel}><h3>Canonical Evidence component</h3><div className={styles.metricGrid}><Metric label="State" value={words(canonicalEvidence?.state)}/><Metric label="Score" value={canonicalEvidence?.score === null || canonicalEvidence?.score === undefined ? "Not measured" : `${canonicalEvidence.score}/100`}/><Metric label="Sample" value={`n=${canonicalEvidence?.sample_size ?? 0}`}/></div><p>{canonicalEvidence?.main_blocker ?? "No explicit canonical Evidence blocker."} The overall Intelligence Score remains independently measurable when sufficient other domains have evidence.</p></section>
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
    if (tab === "control-plane") return <ControlPlane model={model}/>;
    if (tab === "capabilities") return <Capabilities capabilities={model.snapshot.capability_assessments}/>;
    if (tab === "outputs") return <Outputs model={model}/>;
    if (tab === "patterns") return <Patterns model={model}/>;
    if (tab === "validation") return <Validation model={model} reload={load}/>;
    if (tab === "gaps") return <Gaps model={model}/>;
    if (tab === "readiness") return <Readiness model={model}/>;
    return <Evidence model={model}/>;
  }, [model, tab, load]);

  return <AdminLayout><main className={styles.shell}>
    <header className={styles.commandHeader}><div><span>Intelligence OS · Internal</span><h1>LeadLens Intelligence Command Center</h1><p>Operational truth about capabilities, outputs, evidence, validation and next improvements.</p></div><div className={styles.links}><a href="/admin/intelligence/pilots/amor-de-gea">Pilot Workspace</a><a href="/admin/intelligence/growth">Growth Observatory</a><a href="/admin/intelligence/review">Review Queue</a><a href="/admin/intelligence/sources">Source Access</a><a href="/admin/intelligence/source-review">Source Review</a></div></header>
    <nav className={styles.tabs} aria-label="Intelligence Command Center sections">{TABS.map(([id, name]) => <a key={id} href={`#${id}`} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{name}</a>)}</nav>
    {error ? <EmptyState title="Command Center unavailable">{error} No values have been replaced with fabricated zeros. <button className={styles.button} onClick={load}>Retry</button></EmptyState>
      : !model ? <div className={styles.loading} aria-live="polite"><span/>Assembling the latest protected intelligence snapshot…</div>
        : active}
  </main></AdminLayout>;
}
