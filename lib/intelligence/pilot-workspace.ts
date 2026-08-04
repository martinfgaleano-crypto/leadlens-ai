import block10 from "../../ml/data/entity-resolution/amor-de-gea-block10-2026-07-30T14-24-06-487Z.json";
import block11 from "../../ml/data/opportunity-synthesis/amor-de-gea-block11-2026-07-30T15-51-48-651Z.json";
import block12 from "../../ml/data/client-context-review/amor-de-gea-block12-2026-07-30T16-09-40-801Z.json";
import { buildAmorRealContextReview } from "./amor-de-gea-real-context-review";
import {
  AMOR_ACCEPTED_CONTEXT,
  AMOR_COMMERCIAL_READINESS,
} from "./amor-de-gea-commercial-readiness";
import {
  AMOR_SEARCH_BLUEPRINT,
  buildAmorAccountRecalibration,
  buildWhatChanged,
} from "./amor-de-gea-search-blueprint";
import * as phase4 from "./amor-de-gea-phase4-intelligence";
import * as phase45 from "./amor-de-gea-phase4-5-review";
import * as phase46 from "./amor-de-gea-phase4-6-portfolio";
import * as phase5a from "./amor-de-gea-phase5a-customer-safe";
import * as phase5a1 from "./amor-de-gea-phase5a1-signoff";
import * as contextImpact from "./amor-de-gea-context-impact-audit";
import * as blueprintV2Replay from "./amor-de-gea-blueprint-v2-replay";
import * as blueprintV2Search from "./amor-de-gea-blueprint-v2-bounded-search";
import * as accountFirstDiscovery from "../discovery/account-first-discovery";
import * as accountFirstValidation from "../discovery/account-first-validation-results";
export const AMOR_PILOT_ID = "amor-de-gea";
export const PILOT_WORKSPACE_VERSION = "amor-pilot-workspace-v1";
export const LEGACY_PILOT_ALIASES = [
  "amor_de_gea",
  "pilot-amor-de-gea",
  "amor-de-gea-pilot",
];
export function canonicalPilotId(value: string) {
  return value === AMOR_PILOT_ID || LEGACY_PILOT_ALIASES.includes(value)
    ? AMOR_PILOT_ID
    : null;
}
export interface PilotWorkspace {
  pilot: {
    pilot_id: string;
    tenant_id: null;
    client_id: string;
    client_name: string;
    slug: string;
    production_status: "internal";
    status: "context_accepted";
    active_context_version: string;
    active_account_ids: string[];
    methodology_version: string;
    source_runs: string[];
    created_at: string;
    updated_at: string;
    last_intelligence_refresh: string;
    last_human_review: string;
    readiness: string;
    blockers: string[];
  };
  overview: {
    context_completeness: number;
    accounts: number;
    decisions: Record<string, number>;
    theses: number;
    reviewed: number;
    signals: number;
    timing_coverage: number;
    evidence_coverage: string;
    critical_blockers: number;
    customer_safe: number;
    report_ready: number;
    diagnosis: string;
    next_action: string;
  };
  contextReview: ReturnType<typeof buildAmorRealContextReview>;
  acceptedContext: typeof AMOR_ACCEPTED_CONTEXT;
  commercialReadiness: typeof AMOR_COMMERCIAL_READINESS;
  searchBlueprint: typeof AMOR_SEARCH_BLUEPRINT;
  recalibratedTheses: ReturnType<typeof buildAmorAccountRecalibration>;
  whatChanged: ReturnType<typeof buildWhatChanged>;
  phase4: typeof phase4;
  phase45: typeof phase45;
  phase46: typeof phase46;
  phase5a: typeof phase5a;
  phase5a1: typeof phase5a1;
  contextImpact: typeof contextImpact;
  blueprintV2Replay: typeof blueprintV2Replay;
  blueprintV2Search: typeof blueprintV2Search;
  accountFirstDiscovery: typeof accountFirstDiscovery;
  accountFirstValidation: typeof accountFirstValidation;
  questions: any[];
  accounts: any[];
  theses: any[];
  portfolio: any;
  feasibility: any[];
  safety: any[];
  sections: any[];
  shortlist: any[];
  activity: Array<{
    event_type: string;
    actor: string;
    timestamp: string;
    object: string;
    summary: string;
    methodology_version: string;
    provenance: string[];
  }>;
  checklist: Array<{
    step: number;
    label: string;
    status: "complete" | "blocked" | "pending";
    owner: string;
    dependency: string | null;
    blocker: string | null;
    completion_criterion: string;
  }>;
  reconciliation: Array<{
    data_type: string;
    expected: number;
    supabase: number | null;
    artifact: number;
    canonical: number;
    orphaned: number | null;
    missing: number;
    action: string;
    production_availability: string;
  }>;
  availability: {
    canonical_artifacts: "available";
    database: "unverified" | "available" | "partial";
    message: string;
  };
  final_report_generation: "disabled";
  internal_only: true;
  ranking_impact: "off";
}
export function buildPilotWorkspace(): PilotWorkspace {
  const accounts = (block11 as any).theses.map((t: any) => {
    const id = (block10 as any).accounts.find(
      (a: any) => a.domain === t.domain,
    );
    const f = (block12 as any).feasibility.find(
      (x: any) => x.account_id === t.account_id,
    );
    const safety = (block12 as any).safety.find(
      (x: any) => x.thesis_id === t.thesis_id,
    );
    return {
      ...t,
      identity: id?.identity_profile ?? null,
      feasibility: f?.dimensions ?? [],
      safety,
    };
  });
  const updated = (block12 as any).generated_at;
  const ids = accounts.map((a: any) => a.account_id);
  const activity = [
    {
      event_type: "pilot_reconciled",
      actor: "system",
      timestamp: updated,
      object: AMOR_PILOT_ID,
      summary:
        "Canonical workspace assembled from reviewed Intelligence artifacts; no client answer created.",
      methodology_version: PILOT_WORKSPACE_VERSION,
      provenance: ["Block 10", "Block 11", "Block 12"],
    },
    ...accounts.map((a: any) => ({
      event_type: "thesis_generated",
      actor: "system",
      timestamp: (block11 as any).generated_at,
      object: a.thesis_id,
      summary: `Internal thesis generated for ${a.account_name}.`,
      methodology_version: a.methodology_version,
      provenance: [a.domain],
    })),
  ];
  const checklist = [
    "Confirm pilot identity",
    "Confirm six-account scope",
    "Complete critical client context",
    "Review accepted context",
    "Recalculate theses",
    "Review six theses",
    "Resolve evidence gaps",
    "Resolve feasibility blockers",
    "Complete customer-safety review",
    "Reassess report sections",
    "Approve report preparation",
    "Generate final report in a later block",
  ].map((label, i) => ({
    step: i + 1,
    label,
    status: (i < 2 ? "complete" : i === 11 ? "pending" : "blocked") as
      "complete" | "blocked" | "pending",
    owner: i < 2 ? "LeadLens" : "Admin reviewer",
    dependency: i ? String(i) : null,
    blocker:
      i < 2 ? null : "Required client context/review gates remain incomplete.",
    completion_criterion:
      i < 2
        ? "Canonical state verified."
        : "All preceding review and evidence gates pass.",
  }));
  const recon = [
    ["identity profiles", 6, 6],
    ["opportunity theses", 6, 6],
    ["context questions", 17, 17],
    ["feasibility assessments", 6, 6],
    ["safety assessments", 6, 6],
    ["report sections", 20, 20],
    ["accepted answers", 0, 0],
  ].map(([data_type, expected, artifact]) => ({
    data_type: String(data_type),
    expected: Number(expected),
    supabase: null,
    artifact: Number(artifact),
    canonical: Number(artifact),
    orphaned: null,
    missing: Math.max(0, Number(expected) - Number(artifact)),
    action:
      "Verify/backfill with idempotent server operation after DB reconciliation.",
    production_availability: "bundled canonical artifact + database overlay",
  }));
  const questions = (block12 as any).questions;
  const recalibratedTheses = buildAmorAccountRecalibration(
    (block11 as any).theses,
  );
  const whatChanged = buildWhatChanged(recalibratedTheses);
  return {
    pilot: {
      pilot_id: AMOR_PILOT_ID,
      tenant_id: null,
      client_id: AMOR_PILOT_ID,
      client_name: "Amor de Gea",
      slug: AMOR_PILOT_ID,
      production_status: "internal",
      status: "context_accepted",
      active_context_version: AMOR_ACCEPTED_CONTEXT.id,
      active_account_ids: ids,
      methodology_version: PILOT_WORKSPACE_VERSION,
      source_runs: [
        (block10 as any).generated_at,
        (block11 as any).generated_at,
        updated,
      ],
      created_at: (block10 as any).generated_at,
      updated_at: AMOR_SEARCH_BLUEPRINT.created_at,
      last_intelligence_refresh: updated,
      last_human_review: AMOR_ACCEPTED_CONTEXT.accepted_at,
      readiness: "context_impact_audit_founder_review_handoff_paused",
      blockers: [
        "Human review of 15-account proposed portfolio pending",
        "No Phase 5 action authorized",
        "No current timing",
        "0 customer-safe outputs",
      ],
    },
    overview: {
      context_completeness: 100,
      accounts: accounts.length,
      decisions: (block11 as any).summary.decisions,
      theses: accounts.length,
      reviewed: (block12 as any).summary.theses_reviewed,
      signals: 0,
      timing_coverage: 0,
      evidence_coverage:
        "Accepted context is applied to internal recalibration; baseline account evidence remains unchanged.",
      critical_blockers: (block12 as any).summary.critical_blockers,
      customer_safe: (block12 as any).summary.customer_safe,
      report_ready: (block12 as any).summary.report_sections_ready,
      diagnosis: `Controlled run ${phase4.AMOR_PHASE4_RUN.run_id} completed with 15 queries and an internal ${phase4.AMOR_PHASE4_FUNNEL.portfolio}-account portfolio; no outreach or outcome inference occurred.`,
      next_action:
        "Human review of portfolio, conflict checks and evidence gaps before any Phase 5 activation.",
    },
    contextReview: buildAmorRealContextReview(),
    acceptedContext: AMOR_ACCEPTED_CONTEXT,
    commercialReadiness: AMOR_COMMERCIAL_READINESS,
    searchBlueprint: AMOR_SEARCH_BLUEPRINT,
    recalibratedTheses,
    whatChanged,
    phase4,
    phase45,
    phase46,
    phase5a,
    phase5a1,
    contextImpact,
    blueprintV2Replay,
    blueprintV2Search,
    accountFirstDiscovery,
    accountFirstValidation,
    questions,
    accounts,
    theses: (block11 as any).theses,
    portfolio: (block11 as any).portfolio,
    feasibility: (block12 as any).feasibility,
    safety: (block12 as any).safety,
    sections: (block12 as any).sections,
    shortlist: (block12 as any).shortlist,
    activity,
    checklist,
    reconciliation: recon,
    availability: {
      canonical_artifacts: "available",
      database: "available",
      message:
        "Phase 4 portfolio is internal and pending human review; V1/V2 history remains preserved.",
    },
    final_report_generation: "disabled",
    internal_only: true,
    ranking_impact: "off",
  };
}

/**
 * React Server Components may pass only serializable values to the client.
 * Several historical intelligence modules also export helper functions; the
 * workspace keeps their data exports but must never leak executable module
 * members across the server/client boundary.
 */
export function buildSerializablePilotWorkspace(): PilotWorkspace {
  const workspace = buildPilotWorkspace();
  const json = JSON.stringify(workspace, (_key, value) => {
    if (typeof value === "function" || typeof value === "undefined") return undefined;
    if (typeof value === "bigint") return value.toString();
    return value;
  });
  if (!json) throw new Error("Pilot workspace serialization produced no data.");
  return JSON.parse(json) as PilotWorkspace;
}

/** Minimal payload for the operational overview. Historical intelligence is
 * available on its dedicated sections and must not delay the main pilot URL. */
export function buildPilotOverviewWorkspace(): PilotWorkspace {
  const workspace = buildSerializablePilotWorkspace();
  const heavy = ["phase4","phase45","phase46","phase5a","phase5a1","contextImpact","blueprintV2Replay","blueprintV2Search","accountFirstDiscovery","accountFirstValidation","contextReview","acceptedContext","commercialReadiness","searchBlueprint","recalibratedTheses","whatChanged","activity","checklist","reconciliation"] as const;
  for (const key of heavy) delete (workspace as unknown as Record<string,unknown>)[key];
  return workspace;
}
export function dryRunPilotBackfill(workspace: PilotWorkspace) {
  return {
    mode: "dry_run",
    writes: 0,
    synthetic_answers: 0,
    records: {
      pilot: 1,
      accounts: workspace.accounts.length,
      theses: workspace.theses.length,
      questions: workspace.questions.length,
      safety: workspace.safety.length,
      sections: workspace.sections.length,
    },
    idempotency_key: `pilot-backfill:${workspace.pilot.pilot_id}:${workspace.pilot.updated_at}`,
    actions: workspace.reconciliation.map((x) => ({
      data_type: x.data_type,
      action: x.action,
    })),
  };
}
