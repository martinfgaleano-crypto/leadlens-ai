// ─── Client Opportunity Canvas view model ────────────────────────────────────
// The client-level opening surface: the CUSTOMER using LeadLens is the subject;
// the discovered companies are opportunities evaluated FOR that client. Derived
// purely from the already-curated DeliverableViewModel — no new data source, no
// invented client-level intelligence. Every field degrades gracefully when the
// underlying deliverable cannot support it (real institutional reports have no
// client name / objective; Amor has a client but no market-pattern synthesis).

import type { DeliverableViewModel, DecisionState, Strength } from "./deliverable-view-model";
import { decisionLabel } from "./deliverable-view-model";

export interface CanvasOpportunity {
  accountId: string;
  company: string;
  decision: DecisionState;
  role: string | null;
  type: string | null;
  segment: string | null;
  fit: Strength | null;
  timing: Strength | null;
  evidence: Strength | null;
  changed: string | null;   // primary What-Changed event (first, if any)
  freshness: string | null; // age label
}

export interface ClientCanvasVM {
  /** The subject. `client` is the real client name when present; `subject` is
   *  what to display as the header title (client, else a neutral portfolio
   *  title — never a discovered account). `hasClient` says which. */
  client: string | null;
  subject: string;
  hasClient: boolean;
  objective: string | null;      // commercial context / ICP summary (real, may be null)
  market: string | null;
  tierLabel: string | null;
  generatedLabel: string | null;
  language: "en" | "es";
  opportunityCount: number;
  read: string | null;           // deterministic executive read (from real counts)
  landscape: CanvasOpportunity[];
  counts: Record<DecisionState, number>;
  patterns: string[];            // only when the report supports them (else empty)
  coverage: { withDatedEvidence: number; withSources: number; corroborated: number; grade: Strength | null } | null;
  validationAgenda: { accountId: string; company: string; item: string }[];
  sequence: string[];            // deterministic portfolio guidance (allocation / counts)
}

/** Deterministic client-level read — only from real portfolio counts. No LLM. */
function clientRead(vm: DeliverableViewModel, es: boolean): string | null {
  const c = vm.portfolio.counts; const total = vm.portfolio.total;
  if (!total) return null;
  const pri = c.prioritize, val = c.validate;
  const corr = vm.coverage?.corroborated ?? 0;
  if (es) {
    const a = pri > 0 ? `${pri} de ${total} oportunidad${total === 1 ? "" : "es"} merece${pri === 1 ? "" : "n"} atención prioritaria ahora` : `Ninguna oportunidad merece atención prioritaria inmediata todavía`;
    const b = corr > 0 ? `; los casos más sólidos combinan cambio comercial reciente con evidencia corroborada` : ``;
    const d = val > 0 ? `. ${val} requiere${val === 1 ? "" : "n"} validación antes de aumentar la atención.` : `.`;
    return `${a}${b}${d}`;
  }
  const a = pri > 0 ? `${pri} of ${total} opportunit${total === 1 ? "y" : "ies"} merit${pri === 1 ? "s" : ""} priority attention now` : `No opportunity merits immediate priority attention yet`;
  const b = corr > 0 ? `, and the strongest cases combine recent commercial change with corroborated evidence` : ``;
  const d = val > 0 ? `. ${val} still require${val === 1 ? "s" : ""} validation before attention increases.` : `.`;
  return `${a}${b}${d}`;
}

/** Deterministic recommended sequence — prefers the real allocation detail, else
 *  a factual count-based line. Never invents account-specific strategy. */
function clientSequence(vm: DeliverableViewModel, es: boolean): string[] {
  if (vm.portfolio.allocation) return [vm.portfolio.allocation.line, vm.portfolio.allocation.detail].filter(Boolean);
  const c = vm.portfolio.counts;
  const parts: string[] = [];
  if (c.prioritize > 0) parts.push(es ? `Concentra el esfuerzo inmediato en ${c.prioritize} oportunidad${c.prioritize === 1 ? "" : "es"} a priorizar.` : `Concentrate immediate effort on the ${c.prioritize} opportunit${c.prioritize === 1 ? "y" : "ies"} to prioritize.`);
  if (c.validate > 0) parts.push(es ? `Valida ${c.validate} antes de asignar atención activa.` : `Validate ${c.validate} before allocating active attention.`);
  if (c.monitor > 0) parts.push(es ? `Monitorea ${c.monitor} a la espera de una mejor señal.` : `Monitor ${c.monitor} pending a better signal.`);
  return parts;
}

export function toClientCanvasVM(vm: DeliverableViewModel): ClientCanvasVM {
  const es = vm.meta.language === "es";
  const client = vm.meta.client;
  const subject = client ?? (es ? "Portafolio de Oportunidades" : "Opportunity Portfolio");

  const landscape: CanvasOpportunity[] = vm.accounts.map((a) => ({
    accountId: a.id,
    company: a.company,
    decision: a.decision,
    role: a.accountRole,
    type: a.opportunityType,
    segment: a.segment,
    fit: a.dimensions.find((d) => d.label === "Fit")?.value ?? null,
    timing: a.dimensions.find((d) => d.label === "Timing")?.value ?? null,
    evidence: a.evidence.strength,
    changed: a.whatChanged[0]?.event ?? null,
    freshness: a.freshness?.age ?? null,
  }));

  const validationAgenda = vm.validationQueue.slice(0, 5).map((q) => ({ accountId: q.accountId, company: q.company, item: q.items[0] }));

  return {
    client,
    subject,
    hasClient: Boolean(client),
    objective: vm.commercialContext?.summary ?? null,
    market: vm.meta.market,
    tierLabel: vm.meta.tierLabel,
    generatedLabel: vm.meta.generatedLabel,
    language: es ? "es" : "en",
    opportunityCount: vm.accounts.length,
    read: clientRead(vm, es),
    landscape,
    counts: vm.portfolio.counts,
    patterns: [], // no market-pattern synthesis in the current report path — honest empty
    coverage: vm.coverage ? { withDatedEvidence: vm.coverage.withDatedEvidence, withSources: vm.coverage.withSources, corroborated: vm.coverage.corroborated, grade: vm.coverage.grade } : null,
    validationAgenda,
    sequence: clientSequence(vm, es),
  };
}
