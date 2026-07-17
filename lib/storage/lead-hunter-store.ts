// ─── Lead Hunter store v0 ─────────────────────────────────────────────────────
// Server-only (service role). Graceful without Supabase: reads → []/null,
// writes → null with a warning. Bounded lists. No external fetches.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  LeadHunterBrief,
  LeadHunterCandidate,
  LeadHunterRun,
  LeadHunterRunStatus,
  LeadHunterSourceInput,
} from "@/lib/lead-hunter/lead-hunter-types";
import { validateCandidateSafety } from "@/lib/lead-hunter/lead-hunter-policy";
import {
  createVaultCompany,
  createVaultSignal,
  createVaultSource,
  findVaultCompanyByDomain,
} from "@/lib/storage/vault-store";

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}
const warn = (fn: string) => console.warn(`[lead-hunter-store] ${fn}: Supabase not configured — no-op`);
const LIST_LIMIT = 100;

// ─── Briefs ───────────────────────────────────────────────────────────────────

export async function createLeadHunterBrief(input: Partial<LeadHunterBrief> & { name: string }): Promise<LeadHunterBrief | null> {
  const db = await getDb();
  if (!db) { warn("createLeadHunterBrief"); return null; }
  const { data, error } = await db.from("lead_hunter_briefs").insert({
    name: input.name,
    target_market: input.target_market ?? null,
    region: input.region ?? null,
    country: input.country ?? null,
    industry: input.industry ?? null,
    icp_notes: input.icp_notes ?? null,
    signal_types: input.signal_types ?? [],
    allowed_source_categories: input.allowed_source_categories ?? [],
    excluded_source_categories: input.excluded_source_categories ?? [],
    max_candidates: input.max_candidates ?? 25,
    language: input.language ?? "en",
    created_by_email: input.created_by_email ?? null,
  }).select("*").single();
  if (error) { console.error("[lead-hunter-store] createLeadHunterBrief:", error.message); return null; }
  return data as LeadHunterBrief;
}

export async function getLeadHunterBriefById(id: string): Promise<LeadHunterBrief | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("lead_hunter_briefs").select("*").eq("id", id).maybeSingle();
  return (data as LeadHunterBrief) ?? null;
}

export async function listLeadHunterBriefs(): Promise<LeadHunterBrief[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("lead_hunter_briefs").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as LeadHunterBrief[];
}

export async function updateLeadHunterBrief(id: string, patch: Partial<LeadHunterBrief>): Promise<boolean> {
  const db = await getDb();
  if (!db) { warn("updateLeadHunterBrief"); return false; }
  const { error } = await db.from("lead_hunter_briefs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export async function createLeadHunterRun(input: { brief_id: string; provider_mode?: string }): Promise<LeadHunterRun | null> {
  const db = await getDb();
  if (!db) { warn("createLeadHunterRun"); return null; }
  const { data, error } = await db.from("lead_hunter_runs").insert({
    brief_id: input.brief_id,
    provider_mode: input.provider_mode ?? "manual_sources",
    status: "draft",
  }).select("*").single();
  if (error) { console.error("[lead-hunter-store] createLeadHunterRun:", error.message); return null; }
  return data as LeadHunterRun;
}

export async function getLeadHunterRunById(id: string): Promise<LeadHunterRun | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("lead_hunter_runs").select("*").eq("id", id).maybeSingle();
  return (data as LeadHunterRun) ?? null;
}

export async function listLeadHunterRuns(): Promise<LeadHunterRun[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("lead_hunter_runs").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as LeadHunterRun[];
}

export async function updateLeadHunterRunStatus(id: string, status: LeadHunterRunStatus): Promise<boolean> {
  const db = await getDb();
  if (!db) { warn("updateLeadHunterRunStatus"); return false; }
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "processing") patch.started_at = new Date().toISOString();
  const { error } = await db.from("lead_hunter_runs").update(patch).eq("id", id);
  return !error;
}

export async function completeLeadHunterRun(id: string, summary: Record<string, unknown>, candidateCount: number): Promise<boolean> {
  const db = await getDb();
  if (!db) { warn("completeLeadHunterRun"); return false; }
  const { error } = await db.from("lead_hunter_runs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    candidate_count: candidateCount,
    run_summary: summary,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  return !error;
}

export async function failLeadHunterRun(id: string, reason: string): Promise<boolean> {
  const db = await getDb();
  if (!db) { warn("failLeadHunterRun"); return false; }
  const { error } = await db.from("lead_hunter_runs").update({
    status: "failed",
    completed_at: new Date().toISOString(),
    error_message: reason.slice(0, 300),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  return !error;
}

// ─── Source inputs ────────────────────────────────────────────────────────────

export async function addLeadHunterSourceInput(input: {
  run_id: string;
  source_url: string;
  source_title?: string;
  source_category: string;
  pasted_context?: string;
  usage_rights_status?: string;
  safety_status: string;
}): Promise<LeadHunterSourceInput | null> {
  const db = await getDb();
  if (!db) { warn("addLeadHunterSourceInput"); return null; }
  const { data, error } = await db.from("lead_hunter_source_inputs").insert({
    run_id: input.run_id,
    source_url: input.source_url,
    source_title: input.source_title ?? null,
    source_category: input.source_category,
    pasted_context: input.pasted_context ?? null,
    usage_rights_status: input.usage_rights_status ?? "unverified",
    safety_status: input.safety_status,
  }).select("*").single();
  if (error) { console.error("[lead-hunter-store] addLeadHunterSourceInput:", error.message); return null; }
  return data as LeadHunterSourceInput;
}

export async function listLeadHunterSourceInputs(runId: string): Promise<LeadHunterSourceInput[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("lead_hunter_source_inputs").select("*").eq("run_id", runId).order("created_at", { ascending: true }).limit(LIST_LIMIT);
  return (data ?? []) as LeadHunterSourceInput[];
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export async function createLeadHunterCandidate(input: Partial<LeadHunterCandidate> & {
  company_name: string; source_url: string; source_category: string;
}): Promise<LeadHunterCandidate | null> {
  const db = await getDb();
  if (!db) { warn("createLeadHunterCandidate"); return null; }
  const { data, error } = await db.from("lead_hunter_candidates").insert({
    run_id: input.run_id ?? null,
    brief_id: input.brief_id ?? null,
    company_name: input.company_name,
    domain: input.domain ?? null,
    website_url: input.website_url ?? null,
    region: input.region ?? null,
    country: input.country ?? null,
    industry: input.industry ?? null,
    signal_type: input.signal_type ?? null,
    signal_summary: input.signal_summary ?? null,
    signal_date: input.signal_date ?? null,
    source_url: input.source_url,
    source_title: input.source_title ?? null,
    source_category: input.source_category,
    evidence_snippet: input.evidence_snippet ?? null,
    evidence_quality: input.evidence_quality ?? null,
    freshness_status: input.freshness_status ?? null,
    confidence_score: input.confidence_score ?? null,
    fit_rationale: input.fit_rationale ?? null,
    suggested_action: input.suggested_action ?? null,
    usage_rights_status: input.usage_rights_status ?? "unverified",
    safety_status: input.safety_status ?? "needs_review",
  }).select("*").single();
  if (error) { console.error("[lead-hunter-store] createLeadHunterCandidate:", error.message); return null; }
  return data as LeadHunterCandidate;
}

export async function listLeadHunterCandidates(filters: {
  run_id?: string; review_status?: string; safety_status?: string;
  source_category?: string; signal_type?: string;
} = {}): Promise<LeadHunterCandidate[]> {
  const db = await getDb();
  if (!db) return [];
  let q = db.from("lead_hunter_candidates").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (filters.run_id) q = q.eq("run_id", filters.run_id);
  if (filters.review_status) q = q.eq("review_status", filters.review_status);
  if (filters.safety_status) q = q.eq("safety_status", filters.safety_status);
  if (filters.source_category) q = q.eq("source_category", filters.source_category);
  if (filters.signal_type) q = q.eq("signal_type", filters.signal_type);
  const { data } = await q;
  return (data ?? []) as LeadHunterCandidate[];
}

export async function getLeadHunterCandidateById(id: string): Promise<LeadHunterCandidate | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("lead_hunter_candidates").select("*").eq("id", id).maybeSingle();
  return (data as LeadHunterCandidate) ?? null;
}

export async function updateLeadHunterCandidateReview(
  id: string,
  reviewStatus: "pending_review" | "approved" | "rejected" | "reserved",
  notes?: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) { warn("updateLeadHunterCandidateReview"); return false; }
  const { error } = await db.from("lead_hunter_candidates").update({
    review_status: reviewStatus,
    review_notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  return !error;
}

export const approveLeadHunterCandidate = (id: string, notes?: string) => updateLeadHunterCandidateReview(id, "approved", notes);
export const rejectLeadHunterCandidate  = (id: string, notes?: string) => updateLeadHunterCandidateReview(id, "rejected", notes);
export const reserveLeadHunterCandidate = (id: string, notes?: string) => updateLeadHunterCandidateReview(id, "reserved", notes);

// ─── Vault promotion bridge ───────────────────────────────────────────────────
// Approved candidate → Vault source + company (+ signal). Contacts are NOT
// created by Lead Hunter — it discovers companies and signals, never people.
// Provenance and usage rights carry over intact.

export interface PromotionResult {
  ok: boolean;
  reason?: string;
  vault_company_id?: string;
  vault_source_id?: string;
  vault_signal_id?: string;
  company_existed?: boolean;
}

export async function promoteLeadHunterCandidateToVault(candidateId: string): Promise<PromotionResult> {
  const db = await getDb();
  if (!db) { warn("promoteLeadHunterCandidateToVault"); return { ok: false, reason: "Supabase not configured." }; }

  const candidate = await getLeadHunterCandidateById(candidateId);
  if (!candidate) return { ok: false, reason: "Candidate not found." };

  // Policy gates — blocked never promotes; unresolved rights never promote.
  const safety = validateCandidateSafety(candidate);
  if (safety.safety_status === "blocked") {
    return { ok: false, reason: safety.reason ?? "Candidate is blocked by sourcing policy." };
  }
  if (candidate.usage_rights_status === "unverified" || candidate.usage_rights_status === "unknown") {
    return { ok: false, reason: "Usage rights are unverified — set usage_rights_status to permitted/licensed (or reject the candidate) before promotion." };
  }
  if (candidate.vault_company_id) {
    return { ok: false, reason: "Candidate was already promoted to the Vault." };
  }

  // 1. Provenance first.
  const source = await createVaultSource({
    source_type: candidate.source_category,
    source_url: candidate.source_url,
    source_title: candidate.source_title ?? null,
    confidence_score: candidate.confidence_score ?? null,
    usage_rights_status: (candidate.usage_rights_status as "permitted" | "licensed" | "restricted") ?? "permitted",
    notes: candidate.evidence_snippet ? `Lead Hunter evidence: ${candidate.evidence_snippet.slice(0, 400)}` : "Lead Hunter candidate",
  });
  if (!source) return { ok: false, reason: "Could not create Vault source — is migration 029 applied?" };

  // 2. Company (dedupe by domain).
  let company = candidate.domain ? await findVaultCompanyByDomain(candidate.domain.toLowerCase()) : null;
  const companyExisted = !!company;
  if (!company) {
    company = await createVaultCompany({
      name: candidate.company_name,
      domain: candidate.domain?.toLowerCase() ?? null,
      website_url: candidate.website_url ?? null,
      industry: candidate.industry ?? null,
      region: candidate.region ?? null,
      country: candidate.country ?? null,
      source_status: candidate.source_category,
    });
  }
  if (!company) return { ok: false, reason: "Could not create Vault company." };

  // 3. Signal (only when the candidate actually carries one).
  let signalId: string | undefined;
  if (candidate.signal_type || candidate.signal_summary) {
    // Origin: demo/seed markers force isolation; otherwise this is a real,
    // human-approved candidate with a traceable source → production.
    const demoMarked = /\[DEMO\]/i.test(candidate.signal_summary ?? "") || /example\.com/i.test(candidate.source_url ?? "");
    const signal = await createVaultSignal({
      company_id: company.id,
      source_id: source.id,
      signal_type: candidate.signal_type ?? "other",
      signal_summary: candidate.signal_summary ?? null,
      signal_date: candidate.signal_date ?? null,
      confidence_score: candidate.confidence_score ?? null,
      // Promotion happens only after human review approved the candidate —
      // the signal arrives in the Vault already approved.
      review_status: "approved",
      data_origin: demoMarked ? "demo" : "production",
      production_eligible: !demoMarked,
      origin_reason: demoMarked ? "[DEMO]/seed marker on promoted candidate" : "lead-hunter candidate promoted after human review",
      origin_version: "origin-v1",
    });
    signalId = signal?.id;
  }

  // 4. Mark candidate approved + linked.
  const { error: linkErr } = await db.from("lead_hunter_candidates").update({
    review_status: "approved",
    vault_company_id: company.id,
    vault_source_id: source.id,
    vault_signal_id: signalId ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", candidateId);
  if (linkErr) console.error("[lead-hunter-store] promotion link update failed:", linkErr.message);

  console.log(`[lead-hunter] promoted candidate=${candidateId} company=${company.id} existed=${companyExisted} signal=${signalId ?? "-"} source=${source.id}`);
  return { ok: true, vault_company_id: company.id, vault_source_id: source.id, vault_signal_id: signalId, company_existed: companyExisted };
}
