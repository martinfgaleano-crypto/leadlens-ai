// ─── Deliverable adapters — normalize any report shape into the view model ────
// Two entry points today:
//   • fromInstitutionalReport — the CANONICAL customer path (every real order
//     assembles an InstitutionalOpportunityReportV1 server-side; this maps it),
//   • fromAmorPilot — the legacy Amor de Gea pilot artifact (a bespoke shape),
//     proving the renderer is generic, not hard-coded to one report format.
// Both are PURE and TYPED. Missing data → graceful absence, never fabrication.

import type { InstitutionalOpportunityReportV1, AccountDossier } from "@/lib/reports/institutional-report-types";
import type { ReportExperience } from "@/lib/products/report-experience";
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

function fitStrength(score: number | null): Strength | null {
  if (score === null) return null;
  return score >= 7 ? "Strong" : score >= 4 ? "Moderate" : "Limited";
}
function timingStrength(days: number | null): Strength | null {
  if (days === null) return null;
  return days <= 30 ? "Strong" : days <= 90 ? "Moderate" : "Limited";
}

// ─── Institutional report → view model ────────────────────────────────────────

const TIER_DECISION: Record<string, DecisionState> = { HOT: "prioritize", WARM: "validate", COLD: "monitor", DISCARD: "hold" };
const ACTION_DECISION: Record<string, DecisionState> = { act_now: "prioritize", validate_first: "validate", monitor: "monitor", exclude: "hold" };

function decisionOf(d: AccountDossier): DecisionState {
  if (d.actionability_status && ACTION_DECISION[d.actionability_status]) return ACTION_DECISION[d.actionability_status];
  return TIER_DECISION[d.tier] ?? "monitor";
}

function dossierToBrief(d: AccountDossier, i: number, status: StatusVerdict | null): AccountBriefVM {
  const datedIsos = d.evidence_chain.map((e) => e.date).filter((x): x is string => Boolean(x)).sort().reverse();
  const latestIso = datedIsos[0] ?? null;
  const latestDays = daysAgo(latestIso);

  const dimensions: AccountBriefVM["dimensions"] = [];
  const fit = fitStrength(d.fit_score);
  if (fit) dimensions.push({ label: "Fit", value: fit, note: d.fit_score !== null ? `${d.fit_score}/10` : null });
  const timing = timingStrength(latestDays);
  if (timing) dimensions.push({ label: "Timing", value: timing, note: latestDays !== null ? `${latestDays}d since signal` : null });
  const evidenceStrength: Strength | null = d.evidence_grounded === true ? "Strong"
    : d.evidence_chain.some((e) => e.url) ? "Moderate"
    : d.evidence_chain.length > 0 ? "Limited" : null;
  if (evidenceStrength) dimensions.push({ label: "Evidence", value: evidenceStrength });

  const sources: SourceVM[] = d.evidence_chain.map((e) => ({
    label: e.label,
    url: e.url,
    date: e.date,
    age: ageLabel(e.date),
    relation: (e.url ? "direct" : "context") as EvidenceRelation,
    claim: null,
  }));

  const whatChanged: ChangeVM[] = d.evidence_chain
    .filter((e) => e.date)
    .filter((e) => e.date_basis === "fact")
    .map((e) => ({ event: e.label, date: e.date, age: ageLabel(e.date), source: hostOf(e.url), kind: "recent_event" as const }));

  return {
    id: slug(d.company, i),
    rank: d.rank,
    company: d.company,
    segment: d.industry,
    geography: d.location,
    domain: d.domain,
    accountRole: null,        // current institutional reports do not emit role/type
    opportunityType: null,
    decision: decisionOf(d),
    decisionNote: status?.because ?? null,
    thesis: d.thesis?.text ?? null,
    whyItMatters: d.why_now?.text ?? null,
    dimensions,
    whatChanged,
    evidence: {
      sourceCount: d.evidence_chain.length,
      datedCount: datedIsos.length,
      corroborated: d.evidence_grounded,
      latestAge: ageLabel(latestIso),
      strength: evidenceStrength,
    },
    sources,
    counterSignals: d.risks.map((r) => r.text).filter(Boolean),
    limitations: d.actionability_blockers.filter(Boolean),
    validations: d.hypotheses.map((h) => h.text).filter(Boolean),
    nextStep: d.recommended_next_step?.text ?? null,
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
    const relation: EvidenceRelation | null = ev?.proves ? "direct" : ev?.source ? "context" : null;
    const strength = amorFreshnessStrength(ev?.freshness);
    const sources: SourceVM[] = ev?.source
      ? [{ label: ev.source, url: ev.source.includes(".") ? `https://${ev.source.replace(/^https?:\/\//, "")}` : null, date, age: ageLabel(date, true), relation, claim: ev.fact ?? null }]
      : [];
    // `retrieved` is an access date, not proof that the underlying fact changed.
    // Preserve the useful fact but label it as observed context, never change.
    const whatChanged: ChangeVM[] = ev?.fact ? [{ event: ev.fact, date: null, age: null, source: ev.source ?? null, kind: "static_context" }] : [];
    const validations = [a.test, ...(brief?.questions ?? [])].filter((x): x is string => Boolean(x));
    const limitations = [a.unknown].filter((x): x is string => Boolean(x));
    const counterSignals = [...(brief?.objections ?? [])].filter(Boolean);

    return {
      id: slug(a.name ?? "account", i),
      rank: i + 1,
      company: a.name ?? "—",
      segment: a.route ?? null,
      geography,
      domain: ev?.source ?? null,
      accountRole: null,        // Amor pilot has no role/type fields
      opportunityType: null,
      decision: amorDecision(a.group, i),
      decisionNote: a.group ?? null,
      thesis: a.thesis ?? a.why ?? null,
      whyItMatters: a.why ?? null,
      dimensions: strength ? [{ label: "Evidence", value: strength, note: null }] : [],
      whatChanged,
      evidence: {
        sourceCount: sources.length,
        datedCount: date ? 1 : 0,
        corroborated: null,
        latestAge: ageLabel(date, true),
        strength,
      },
      sources,
      counterSignals,
      limitations,
      validations,
      nextStep: a.next ?? null,
      freshness: date ? { label: ageLabel(date, true) ? `${ageLabel(date, true)}` : "con fecha", age: ageLabel(date, true) } : null,
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
