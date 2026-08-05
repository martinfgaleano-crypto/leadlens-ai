"use client";

import { useMemo, useState } from "react";
import styles from "./workspace.module.css";
import { adminFetch } from "@/lib/admin/admin-client";
import { AMOR_ACCOUNT_MEMORY, AMOR_MEMORY_COUNTERS, AMOR_PILOT2_READINESS, AMOR_CYCLE_1_ID } from "@/lib/intelligence/amor-de-gea-account-memory";
import { OUTCOME_STATUS_GROUPS, OUTCOME_REASONS, ROUTES } from "@/lib/intelligence/recurring/model";
import { aggregateRouteLearning } from "@/lib/intelligence/recurring/engine";

// Recurring Opportunity Cycle — internal readiness + manual outcome capture.
// Mounted inside the existing pilot Admin (no new top-level dashboard). Reads the
// seeded Account Memory (deterministic); posts outcomes to the append-only API.
export default function PilotRecurringCycle() {
  const counters = AMOR_MEMORY_COUNTERS;
  const readiness = AMOR_PILOT2_READINESS;
  const statuses = useMemo(() => Object.values(OUTCOME_STATUS_GROUPS).flat(), []);
  // No real outcomes yet → every route reports "awaiting real outcomes".
  const routeLearning = ROUTES.map((r) => aggregateRouteLearning(r, []));

  const [accountId, setAccountId] = useState(AMOR_ACCOUNT_MEMORY[0].identity.canonical_id);
  const [status, setStatus] = useState("recommended");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await adminFetch(`/api/admin/intelligence/pilots/amor-de-gea/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, cycle_id: AMOR_CYCLE_1_ID, outcome_date: date || new Date().toISOString().slice(0, 10), primary_status: status, reason_code: reason || null, notes: note }),
      });
      const json = await res.json().catch(() => ({}));
      setMsg(res.status === 201 ? "Outcome registrado." : res.status === 503 ? "Validado; persistencia pendiente (aplicar migración 048)." : `Error: ${json.error ?? res.status}`);
    } catch { setMsg("Error de red."); }
    setBusy(false);
  };

  return <section className={styles.deliveryCenter} data-testid="pilot-recurring-cycle">
    <header className={styles.deliveryHeader}>
      <div><span>RECURRING OPPORTUNITY CYCLE</span><h2>Memoria de cuentas y ciclo mensual</h2>
        <p>Fundación reutilizable: memoria de cuentas, resultados, novedad/anti-repetición y qué cambió. No ejecuta búsquedas ni contacta clientes.</p></div>
      <aside><small>Piloto 2</small><strong>{readiness.state}</strong><span>{readiness.accounts.length} cuentas · autorización pendiente</span></aside>
    </header>

    <div className={styles.deliveryMetrics} aria-label="Estado de la memoria">
      <div><strong>{counters.total}</strong><span>en memoria</span></div>
      <div><strong>{counters.delivered}</strong><span>entregadas</span></div>
      <div><strong>{counters.suppressed}</strong><span>suprimidas como nuevas</span></div>
      <div><strong>{counters.monitored}</strong><span>en monitoreo</span></div>
      <div><strong>{counters.excluded}</strong><span>excluidas</span></div>
    </div>

    <details className={styles.deliveryDetails} open>
      <summary>Política de reaparición por cuenta</summary>
      <table className={styles.simpleTable}><thead><tr><th>Cuenta</th><th>Reaparición</th><th>Novedad por defecto</th><th>Condición de reapertura</th></tr></thead>
        <tbody>{AMOR_ACCOUNT_MEMORY.map((m) => <tr key={m.identity.canonical_id}>
          <td>{m.identity.canonical_name}</td><td>{m.reappearance}</td><td>{m.novelty_default}</td><td>{m.review.reopen_condition ?? "—"}</td>
        </tr>)}</tbody></table>
    </details>

    <details className={styles.deliveryDetails}>
      <summary>Aprendizaje por ruta</summary>
      <div className={styles.artifactGrid}>{routeLearning.map((r) => <article key={r.route}>
        <h4>{r.route.replaceAll("_", " ")}</h4>
        <p>{r.status === "awaiting_real_outcomes" ? "Awaiting real outcomes" : `${r.opportunities} oportunidades · ${r.orders} órdenes`}</p>
      </article>)}</div>
    </details>

    <section className={styles.founderChecklist}>
      <div className={styles.deliverySectionTitle}><div><span>PILOTO 2 · GATE DE ACTIVACIÓN</span><h3>{readiness.activation_gate.filter((g) => g.met).length}/10 requisitos</h3></div>
        <strong>{readiness.activation_ready ? "LISTO PARA AUTORIZACIÓN DEL FUNDADOR" : "PREPARANDO"}</strong></div>
      <div className={styles.checkGrid}>{readiness.activation_gate.map((g) => <label key={g.id}>
        <input type="checkbox" checked={g.met} readOnly /><span>{g.requirement}</span></label>)}</div>
      <small>El Piloto 2 permanece <strong>PLANNED — NOT AUTHORIZED</strong> con cero cuentas hasta la aprobación explícita del fundador. Esta pantalla no ejecuta el ciclo.</small>
    </section>

    <details className={styles.deliveryDetails}>
      <summary>Registrar resultado (manual · no fabricar)</summary>
      <div className={styles.outcomeForm}>
        <label>Cuenta<select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {AMOR_ACCOUNT_MEMORY.map((m) => <option key={m.identity.canonical_id} value={m.identity.canonical_id}>{m.identity.canonical_name}</option>)}</select></label>
        <label>Estado<select value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label>Razón<select value={reason} onChange={(e) => setReason(e.target.value)}><option value="">—</option>{OUTCOME_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Nota<input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} /></label>
        <button disabled={busy} onClick={submit}>Registrar</button>
        {msg && <p role="status">{msg}</p>}
      </div>
    </details>
  </section>;
}
