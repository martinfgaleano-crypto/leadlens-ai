// ─── Deliverable adapters — normalize any report shape into the view model ────
// Two entry points today:
//   • fromInstitutionalReport — the CANONICAL customer path (every real order
//     assembles an InstitutionalOpportunityReportV1 server-side; this maps it),
//   • fromAmorPilot — the legacy Amor de Gea pilot artifact (a bespoke shape),
//     proving the renderer is generic, not hard-coded to one report format.
// Both are PURE and TYPED. Missing data → graceful absence, never fabrication.

import type { InstitutionalOpportunityReportV1, AccountDossier } from "@/lib/reports/institutional-report-types";
import type { ReportExperience } from "@/lib/products/report-experience";
import type { OpportunityCaseIntelligenceV1 } from "@/lib/intelligence/opportunity-case-intelligence";
import { caseDecision } from "@/lib/monitor/canonical-case";
import type { OppStatus } from "@/lib/discovery/opportunity-test";
import { derivePortfolioStatus, deriveAllocation, type StatusVerdict } from "@/lib/products/report-experience";
import {
  type DeliverableViewModel, type AccountBriefVM, type DecisionState, type Strength,
  type SourceVM, type ChangeVM, type EvidenceRelation, type ValidationQueueItemVM,
  ageLabel, daysAgo, hostOf,
} from "./deliverable-view-model";

function slug(s: string, i: number): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base ? `${base}-${i}` : `account-${i}`;
}

/** Aggregate per-account validations into a portfolio decision queue. */
function buildValidationQueue(accounts: AccountBriefVM[]): ValidationQueueItemVM[] {
  return accounts
    .filter((a) => a.validations.length > 0)
    .map((a) => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations }));
}

// ─── Institutional report → view model ────────────────────────────────────────

// The initial deliverable's final Decision now routes through the ONE canonical
// authority (`caseDecision`), the same used by recurring synthesis — no independent
// decision engine. The dossier's validated verdict (actionability_status / tier)
// maps to a canonical OppStatus; caseDecision applies the identical mapping + caps.
const ACTION_STATUS: Record<string, OppStatus> = { act_now: "opportunity", validate_first: "investigate", monitor: "monitor", exclude: "reject" };
const TIER_STATUS: Record<string, OppStatus> = { HOT: "opportunity", WARM: "investigate", COLD: "monitor", DISCARD: "reject" };

function decisionOf(d: AccountDossier): DecisionState {
  const status: OppStatus = (d.actionability_status && ACTION_STATUS[d.actionability_status]) || TIER_STATUS[d.tier] || "monitor";
  return caseDecision(status).decision;
}

function dossierToBrief(d: AccountDossier, i: number, status: StatusVerdict | null): AccountBriefVM {
  const oc = d.opportunity_case ?? null;
  const datedIsos = d.evidence_chain.map((e) => e.date).filter((x): x is string => Boolean(x)).sort().reverse();
  const latestIso = datedIsos[0] ?? null;
  const latestDays = daysAgo(latestIso);

  const dimensions: AccountBriefVM["dimensions"] = [];
  const fit = oc?.fit?.value ?? null;
  if (fit) dimensions.push({ label: "Fit", value: fit, note: d.fit_score !== null ? `${d.fit_score}/10` : null });
  const timing = oc?.timing?.value ?? null;
  if (timing) dimensions.push({ label: "Timing", value: timing, note: latestDays !== null ? `${latestDays}d since signal` : null });
  const evidenceStrength: Strength | null = d.evidence_grounded === true ? "Strong"
    : d.evidence_chain.some((e) => e.url) ? "Moderate"
    : d.evidence_chain.length > 0 ? "Limited" : null;
  if (evidenceStrength) dimensions.push({ label: "Evidence", value: evidenceStrength });

  const sources: SourceVM[] = oc?.evidence.map((e) => ({
    label: e.sourceLabel, url: e.url, date: e.date, age: ageLabel(e.date),
    relation: e.relation === "supporting" ? "corroborating" : e.relation,
    claim: e.claim, observation: e.observation, basis: e.basis, impacts: e.impacts,
  })) ?? d.evidence_chain.map((e) => ({
    label: e.label,
    url: e.url,
    date: e.date,
    age: ageLabel(e.date),
    relation: (e.url ? "direct" : "context") as EvidenceRelation,
    claim: null,
  }));

  const whatChanged: ChangeVM[] = oc?.changes.map((e) => ({ event: e.event, date: e.date, age: ageLabel(e.date), source: e.sourceLabel, kind: "true_change" as const })) ?? [];
  const validationDetails = oc?.validations ?? [];

  return {
    id: slug(d.company, i),
    rank: d.rank,
    company: d.company,
    segment: d.industry,
    geography: d.location,
    domain: d.domain,
    accountRole: oc?.classification.accountRole?.value ?? null,
    opportunityType: oc?.classification.opportunityType?.value ?? null,
    opportunityDescriptor: oc?.classification.opportunityDescriptor ?? null,
    decision: decisionOf(d),
    decisionNote: oc?.decisionRationale?.value ?? status?.because ?? null,
    thesis: d.thesis?.text ?? null,
    whyItMatters: oc?.whyNow?.value ?? null,
    dimensions,
    whatChanged,
    evidence: {
      sourceCount: d.evidence_chain.length,
      datedCount: datedIsos.length,
      corroborated: oc ? oc.independentSupport : d.evidence_grounded,
      latestAge: ageLabel(latestIso),
      strength: evidenceStrength,
    },
    sources,
    counterSignals: oc?.weaknesses.map((x) => x.value) ?? d.risks.filter((r) => r.basis !== "unknown").map((r) => r.text).filter(Boolean),
    limitations: oc?.unknowns.map((x) => x.value) ?? d.actionability_blockers.filter(Boolean),
    validations: validationDetails.length ? validationDetails.map((v) => v.question) : d.hypotheses.map((h) => h.text).filter(Boolean),
    validationDetails,
    nextStep: oc?.recommendedNextStep?.value ?? d.recommended_next_step?.text ?? null,
    revisitWhen: oc?.revisitWhen?.value ?? null,
    freshness: latestIso ? { label: ageLabel(latestIso) ? `${ageLabel(latestIso)} ago` : "dated", age: ageLabel(latestIso) } : null,
    confidence: evidenceStrength,
  };
}

export function fromInstitutionalReport(r: InstitutionalOpportunityReportV1, experience?: ReportExperience | null): DeliverableViewModel {
  const es = experience?.language === "es";
  const deep = experience ? (experience.portfolio_depth === "complete" || experience.portfolio_depth === "advanced") : true;

  const statuses = r.account_dossiers.map((d) =>
    derivePortfolioStatus({
      tier: d.tier,
      evidence_grounded: d.evidence_grounded,
      latest_date: d.evidence_chain.map((e) => e.date).filter(Boolean).sort().reverse()[0] ?? null,
    }),
  );
  const accounts = r.account_dossiers.map((d, i) => dossierToBrief(d, i, deep ? statuses[i] : null));

  const counts: Record<DecisionState, number> = { prioritize: 0, validate: 0, monitor: 0, hold: 0 };
  for (const a of accounts) counts[a.decision] += 1;

  const allocation = deep && statuses.length ? deriveAllocation(statuses) : null;
  const grade: Strength | null = r.quality?.grade === "strong" ? "Strong" : r.quality?.grade === "moderate" ? "Moderate" : r.quality?.grade === "developing" ? "Limited" : null;

  return {
    meta: {
      client: null,
      market: (r.context.regions[0] ?? null),
      generatedAt: r.metadata.generated_at ?? null,
      generatedLabel: r.metadata.generated_at ? r.metadata.generated_at.slice(0, 10) : null,
      tierLabel: experience?.display_name ?? null,
      language: es ? "es" : "en",
      schemaVersion: r.schema_version ?? null,
    },
    headline: r.executive_brief.headline ?? null,
    summary: r.executive_brief.summary?.text ?? null,
    portfolio: {
      total: r.portfolio_summary.total,
      counts,
      allocation,
      funnel: r.portfolio_summary.funnel
        ? { considered: r.portfolio_summary.funnel.considered, rejected: r.portfolio_summary.funnel.rejected, selected: r.portfolio_summary.funnel.selected }
        : null,
      note: r.portfolio_summary.tier_note ?? null,
    },
    accounts,
    commercialContext: {
      objective: null,
      clientDescription: null,
      summary: r.context.icp_summary,
      regions: r.context.regions ?? [],
      industries: r.context.industries ?? [],
      criteria: [],
    },
    validationQueue: buildValidationQueue(accounts),
    coverage: {
      withDatedEvidence: r.coverage.accounts_with_dated_evidence,
      withSources: r.coverage.accounts_with_sources,
      corroborated: accounts.filter((a) => a.evidence.corroborated === true).length,
      grade,
      note: r.quality?.note ?? null,
    },
    methodology: r.methodology ?? [],
    limitations: r.limitations ?? [],
    downloads: { pdf: true, portfolioCsv: true, evidenceCsv: accounts.some((a) => a.sources.length > 0) },
    capabilities: {
      showPortfolioTab: !experience || experience.show_portfolio,
      showCompareTab: accounts.length >= 2,
      showEvidenceTab: accounts.some((a) => a.sources.length > 0),
      showDownloadsTab: true,
      showMethodology: (r.methodology?.length ?? 0) > 0,
    },
  };
}

// ─── Amor de Gea pilot artifact → view model (legacy compatibility) ───────────
// Bespoke pilot shape (output/amor-pilot1-deliverable.data.json). Read-only:
// this NEVER mutates the pilot; it maps it so the same renderer can display it.

interface AmorEvidence { source?: string; fact?: string; retrieved?: string; freshness?: string; proves?: string }
interface AmorAccount {
  name?: string; group?: string; route?: string; route_key?: string;
  why?: string; test?: string; unknown?: string; next?: string;
  evidence?: AmorEvidence; thesis?: string; buyer_hyp?: string; procurement?: string;
  cycle?: string; objections?: string[]; questions?: string[]; prep?: string[];
  opportunity_case?: OpportunityCaseIntelligenceV1;
}
interface AmorDeliverable {
  meta?: { client?: string; pilot?: string; geography?: string; generated_date?: string; generated_label?: string };
  portfolio?: Record<string, unknown>;
  accounts?: AmorAccount[];
  briefs?: AmorAccount[];
  what_changed?: { before?: string[]; after?: string[] };
  readiness?: { strengths?: string[]; gaps?: string[] };
  success?: { objective?: string };
  limitations?: string[];
}

function amorDecision(group: string | undefined, routeIdx: number): DecisionState {
  const g = (group ?? "").toLowerCase();
  if (/priorid|strateg|priorit/.test(g)) return "prioritize";
  if (/validaci|validation|primera/.test(g)) return "validate";
  if (/investig|selectiv|monitor|espera/.test(g)) return "monitor";
  return routeIdx === 0 ? "prioritize" : "validate";
}

function amorFreshnessStrength(freshness: string | undefined): Strength | null {
  const f = (freshness ?? "").toLowerCase();
  if (f === "fresh") return "Strong";
  if (f === "recent" || f === "active") return "Moderate";
  if (f === "stale" || f === "old") return "Limited";
  return null;
}

export function fromAmorPilot(d: AmorDeliverable): DeliverableViewModel {
  const briefsByName = new Map((d.briefs ?? []).map((b) => [b.name ?? "", b]));
  const geography = d.meta?.geography ?? null;
  const rawAccounts = d.accounts ?? [];

  const accounts: AccountBriefVM[] = rawAccounts.map((a, i) => {
    const brief = briefsByName.get(a.name ?? "");
    const ev = a.evidence;
    const date = ev?.retrieved && /\d{4}-\d{2}-\d{2}/.test(ev.retrieved) ? ev.retrieved : null;
    const oc = a.opportunity_case ?? brief?.opportunity_case;
    const strength: Strength | null = oc?.evidence.length ? "Moderate" : amorFreshnessStrength(ev?.freshness);
    const sources: SourceVM[] = oc?.evidence.map((item) => ({
      label: item.sourceLabel,
      url: item.url,
      date: item.date,
      age: ageLabel(item.date, true),
      relation: item.relation === "supporting" ? "corroborating" : item.relation,
      claim: item.claim,
      observation: item.observation,
      basis: item.basis,
      impacts: item.impacts,
    })) ?? (ev?.source
      ? [{ label: ev.source, url: ev.source.includes(".") ? `https://${ev.source.replace(/^https?:\/\//, "")}` : null, date: null, age: null, relation: ev?.proves ? "direct" : "context", claim: ev.proves ?? ev.fact ?? null, observation: ev.fact ?? null, basis: "observed" }]
      : []);
    const whatChanged: ChangeVM[] = oc?.changes.map((change) => ({
      event: change.event, date: change.date, age: ageLabel(change.date, true), source: change.sourceLabel, kind: "true_change",
    })) ?? [];
    const validationDetails = oc?.validations ?? [];
    const validations = validationDetails.length
      ? validationDetails.map((v) => v.question)
      : [a.test, ...(brief?.questions ?? [])].filter((x): x is string => Boolean(x));
    const limitations = oc?.unknowns.map((x) => x.value) ?? [a.unknown].filter((x): x is string => Boolean(x));
    const counterSignals = oc?.weaknesses.map((x) => x.value) ?? [];
    const fit = oc?.fit?.value ?? null;
    const timing = oc?.timing?.value ?? null;
    const dimensions: AccountBriefVM["dimensions"] = [];
    if (fit) dimensions.push({ label: "Fit", value: fit, note: oc?.fit?.rationale ?? null });
    if (timing) dimensions.push({ label: "Timing", value: timing, note: oc?.timing?.rationale ?? null });
    if (strength) dimensions.push({ label: "Evidence", value: strength, note: oc?.independentSupport === false ? "Una fuente oficial; sin soporte independiente" : null });

    return {
      id: slug(a.name ?? "account", i),
      rank: i + 1,
      company: a.name ?? "—",
      segment: a.route ?? null,
      geography,
      domain: ev?.source ?? null,
      accountRole: oc?.classification.accountRole?.value ?? null,
      opportunityType: oc?.classification.opportunityType?.value ?? null,
      opportunityDescriptor: oc?.classification.opportunityDescriptor ?? null,
      decision: amorDecision(a.group, i),
      decisionNote: oc?.decisionRationale?.value ?? a.group ?? null,
      thesis: brief?.thesis ?? a.thesis ?? a.why ?? null,
      whyItMatters: oc?.whyNow?.value ?? null,
      dimensions,
      whatChanged,
      evidence: {
        sourceCount: sources.length,
        datedCount: sources.filter((s) => Boolean(s.date)).length,
        corroborated: oc ? oc.independentSupport : null,
        latestAge: null,
        strength,
      },
      sources,
      counterSignals,
      limitations,
      validations,
      validationDetails,
      nextStep: oc?.recommendedNextStep?.value ?? a.next ?? null,
      revisitWhen: oc?.revisitWhen?.value ?? null,
      freshness: null,
      confidence: strength,
    };
  });

  const counts: Record<DecisionState, number> = { prioritize: 0, validate: 0, monitor: 0, hold: 0 };
  for (const a of accounts) counts[a.decision] += 1;

  const changeSummary = d.what_changed?.after?.length
    ? `El enfoque se precisó en: ${d.what_changed.after.slice(0, 3).map((item) => item.replace(/[.;:\s]+$/g, "")).join("; ")}.`
    : null;

  return {
    meta: {
      client: d.meta?.client ?? null,
      market: geography,
      generatedAt: d.meta?.generated_date ?? null,
      generatedLabel: d.meta?.generated_label ?? d.meta?.generated_date ?? null,
      tierLabel: d.meta?.pilot ?? "Pilot",
      language: "es",
      schemaVersion: null,
    },
    headline: d.meta?.client ? `Portafolio de oportunidades — ${d.meta.client}` : null,
    summary: changeSummary,
    portfolio: {
      total: accounts.length,
      counts,
      allocation: null,
      funnel: null,
      note: null,
    },
    accounts,
    commercialContext: {
      objective: d.success?.objective ?? null,
      clientDescription: d.readiness?.strengths?.[0] ?? null,
      summary: null,
      regions: geography ? [geography] : [],
      industries: Array.from(new Set(rawAccounts.map((a) => a.route).filter((x): x is string => Boolean(x)))),
      criteria: d.what_changed?.after ?? [],
    },
    validationQueue: buildValidationQueue(accounts),
    coverage: {
      withDatedEvidence: accounts.filter((a) => a.evidence.datedCount > 0).length,
      withSources: accounts.filter((a) => a.sources.length > 0).length,
      corroborated: 0,
      grade: null,
      note: null,
    },
    methodology: [],
    limitations: d.limitations ?? [],
    downloads: { pdf: true, portfolioCsv: true, evidenceCsv: accounts.some((a) => a.sources.length > 0) },
    capabilities: {
      showPortfolioTab: true,
      showCompareTab: accounts.length >= 2,
      showEvidenceTab: accounts.some((a) => a.sources.length > 0),
      showDownloadsTab: true,
      showMethodology: false,
    },
  };
}
