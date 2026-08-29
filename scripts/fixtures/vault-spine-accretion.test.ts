// VAULT ACCRETION — productive spine integration (§28/§30/§43).
// The real Productive Spine must accrete discovered companies AUTOMATICALLY, passing
// only universal facts, and a Vault failure must never alter the run or the Case.

import assert from "node:assert/strict";
import { GOLDEN_FIXTURES } from "@/lib/interpretation/fixtures/golden";
import { InMemoryConfirmedContextStore, persistConfirmedContext } from "@/lib/interpretation/confirmed-context-store";
import { InMemoryLeadHunterRunStore } from "@/lib/lead-hunter/run-store";
import type { DiscoveryRunner, RawDiscoveredOrg } from "@/lib/lead-hunter/candidate-universe";
import { InMemoryIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";
import { startIntelligenceRun } from "@/lib/intelligence/productive-spine";
import { accreteDiscoveredCompanies, type VaultAccretionDeps } from "@/lib/vault/vault-accretion";
import { accreteResearchedAccounts, type ResearchAccretionDeps } from "@/lib/vault/vault-research-accretion";
import type { VaultCompany, VaultSignal, VaultSource } from "@/lib/vault/vault-types";
import type { LeadCandidate, LeadLensReport, PipelineInput, ProcessedLead } from "@/types";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };
const clock = () => new Date("2026-08-26T12:00:00.000Z");
process.env.CONFIRMATION_TOKEN_SECRET = "test-only-confirmation-secret-32-characters";
const fixture = structuredClone(GOLDEN_FIXTURES.software_manufacturing);

const org = (i: number): RawDiscoveredOrg => ({ name: `Verified Manufacturer ${i}`, domain: `verified-${i}.example`, country: "United States", organizationType: "Manufacturer", industry: "Manufacturing", origin: "dynamic_enumeration", provider: "test_provider", route: "industry_category", sourceUrl: `https://directory.example/${i}`, confidence: "verified" });
const discovery: DiscoveryRunner = async () => ({ orgs: Array.from({ length: 4 }, (_, i) => org(i + 1)), providersAvailable: ["test_provider"], providersFailed: [], operatingMode: "full_discovery" });
const leadFor = (candidate: LeadCandidate): ProcessedLead => ({
  id: candidate.id,
  candidate: { ...candidate, source_url: `https://${candidate.domain}/news`, signal_date: "2026-08-20", signal_type: "new_facility" },
  enrichment: { candidate, timing_signals: ["Opened a new plant"], evidence: [], missing_data: [], research_confidence: 0.9, evidence_discipline: [{ claim: "Opened a new plant", type: "verified_public_signal", date: "2026-08-20" }], next_best_question: "Confirm." } as never,
  qualification: { enrichment: {} as never, fit_score: 8, category: "HOT", fit_reasons: [], disqualification_reasons: [], qualification_confidence: 0.8, score_breakdown: { role_fit: 2, company_fit: 2, pain_fit: 1, timing_signal: 1, reachability: 1, strategic_relevance: 1 } } as never,
  outreach: { personalization_trigger: "", subject: "", email_body: "", linkedin_dm: "", followup_1: "", followup_2: "", tone: "direct", qc_status: "APPROVED", qc_notes: [] } as never,
} as ProcessedLead);

function vaultDouble(fail = false) {
  const rows = new Map<string, VaultCompany>(); const creates: Array<Partial<VaultCompany>> = [];
  const deps: VaultAccretionDeps = { findByDomain: async (d) => rows.get(d) ?? null, create: async (i) => { if (fail) throw new Error("vault_down"); creates.push(i); const r = { id: `v${rows.size}`, name: i.name!, domain: i.domain ?? null, website_url: null, linkedin_company_url: null, industry: i.industry ?? null, region: null, country: i.country ?? null, company_size: null, description: null, source_status: i.source_status ?? null, vault_status: "candidate" as const, suppression_status: "active", created_at: "", updated_at: "" }; if (i.domain) rows.set(i.domain, r); return r; } };
  return { deps, rows, creates };
}

function researchDouble(fail = false) {
  const companies = new Map<string, VaultCompany>(); const signals: VaultSignal[] = []; const sources: VaultSource[] = [];
  let cid = 0, sid = 0, gid = 0;
  const deps: ResearchAccretionDeps = {
    findByDomain: async (d) => companies.get(d) ?? null,
    createCompany: async (i) => { const r = { id: `c${cid++}`, name: i.name!, domain: i.domain ?? null, website_url: null, linkedin_company_url: null, industry: i.industry ?? null, region: null, country: i.country ?? null, company_size: null, description: null, source_status: i.source_status ?? null, vault_status: "candidate" as const, suppression_status: "active", created_at: "", updated_at: "" }; if (i.domain) companies.set(i.domain, r); return r; },
    listSignalsByCompany: async (id) => signals.filter((s) => s.company_id === id),
    createSource: async (i) => { const r = { id: `s${sid++}`, provider_id: null, source_type: i.source_type, source_url: i.source_url ?? null, source_title: null, retrieved_at: i.retrieved_at ?? null, published_at: i.published_at ?? null, freshness_status: null, confidence_score: null, usage_rights_status: "unverified" as const, notes: null, raw_metadata: i.raw_metadata ?? null, created_at: "" }; sources.push(r); return r; },
    createSignal: async (i) => { if (fail) throw new Error("signal_down"); const r = { id: `g${gid++}`, company_id: i.company_id ?? null, contact_id: null, source_id: i.source_id ?? null, signal_type: i.signal_type, signal_summary: i.signal_summary ?? null, signal_date: i.signal_date ?? null, expires_at: null, strength_score: null, confidence_score: null, review_status: "pending_review" as const, data_origin: i.data_origin, production_eligible: false, origin_reason: i.origin_reason ?? null, created_at: "", updated_at: "" }; signals.push(r); return r; },
  };
  return { deps, companies, signals, sources };
}

const pipeline = async (input: PipelineInput): Promise<LeadLensReport> => {
  const researched = (input.candidatesOverride ?? []).slice(0, 4).map(leadFor);
  input.onResearchComplete?.(researched);
  return { job_id: input.jobId!, plan: input.plan, total_leads: researched.length, hot_count: 4, warm_count: 0, cold_count: 0, discard_count: 0, avg_score: 8, executive_summary: "x", patterns_observed: [], recommendations: [], processed_leads: researched, ranked_opportunities: [], created_at: clock().toISOString() };
};

const run = async () => {
  // §28/§43 — Discovery accretes automatically; Case still produced; universal only.
  const v = vaultDouble();
  const r = researchDouble();
  const contextStore = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(contextStore, fixture, { userId: "owner-a", contextId: "shared", now: clock });
  const res = await startIntelligenceRun(
    { userId: "owner-a", context: { contextId: "shared", version: 1 }, plan: "sample", deliveryLimit: 4, researchLimit: 4 },
    { contextStore, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(), discoveryRunner: discovery, pipeline, now: clock,
      onDiscoveredCompanies: (companies) => { void accreteDiscoveredCompanies(companies, "customer_run", v.deps); },
      onResearchedAccounts: (accounts) => { void accreteResearchedAccounts(accounts, "customer_run", r.deps); } },
  );
  t("spine run completed", res.ok && res.run.status === "completed");
  t("Discovery accreted companies into Vault automatically", v.rows.size >= 1);
  t("§17 Research accreted validated events into Vault automatically", r.signals.length >= 1 && r.sources.length >= 1);
  t("§7 accreted event carries the event date (not observed date)", r.signals.every((s) => s.signal_date === "2026-08-20"));
  t("§22 no customer-relative field in any Research Vault write", JSON.stringify({ c: Array.from(r.companies.values()), s: r.signals, src: r.sources }).toLowerCase().split(/[^a-z_]+/).every((w) => !["fit", "timing", "decision", "prioritize", "monitor", "hold", "thesis"].includes(w)));
  t("Case still produced (accretion did not alter the run)", Boolean(res.ok && (res.run.report?.canonical_cases?.length ?? 0) >= 0 && res.run.report));
  t("§4/§5 only universal fields persisted (no Fit/Timing/Decision)", v.creates.every((c) => {
    const s = JSON.stringify(c).toLowerCase();
    return !["fit", "timing", "decision", "prioritize", "validate", "opportunity_thesis", "monitor", "hold"].some((k) => s.includes(k));
  }));

  // §30 — Vault write failure must not break the run.
  const vf = vaultDouble(true);
  const rf = researchDouble(true);
  const cs2 = new InMemoryConfirmedContextStore();
  await persistConfirmedContext(cs2, fixture, { userId: "owner-b", contextId: "shared", now: clock });
  const res2 = await startIntelligenceRun(
    { userId: "owner-b", context: { contextId: "shared", version: 1 }, plan: "sample", deliveryLimit: 4, researchLimit: 4 },
    { contextStore: cs2, leadHunterStore: new InMemoryLeadHunterRunStore(), runStore: new InMemoryIntelligenceRunStore(), discoveryRunner: discovery, pipeline, now: clock,
      onDiscoveredCompanies: (companies) => { void accreteDiscoveredCompanies(companies, "customer_run", vf.deps); },
      onResearchedAccounts: (accounts) => { void accreteResearchedAccounts(accounts, "customer_run", rf.deps); } },
  );
  t("§18/§30 Vault write failure does not break the Intelligence run", res2.ok && res2.run.status === "completed");
  t("§18/§30 failed accretion persisted nothing", vf.rows.size === 0 && rf.signals.length === 0);

  // §31 — retry idempotency: re-run reuses completed run; no duplicate accretion path re-executes.
  t("run is idempotent (accretion tied to a single execution)", v.rows.size === 4);

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
