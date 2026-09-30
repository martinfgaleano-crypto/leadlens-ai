#!/usr/bin/env node
/**
 * Re-derive canonical decisions for a persisted multi-pass foundation with the CURRENT
 * calibration (no re-research), then re-assemble + re-render the four V2.4 tiers.
 * Reads pilot2-merged-report.json (written by pilot2-multipass-job.mts). Cost: $0.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;

const OUT = process.env.LEADLENS_RENDER_OUT || "/tmp/pilot2-multipass";
const { canonicalCaseForLead } = await import("@/lib/intelligence/productive-spine");
const { assembleInstitutionalReport } = await import("@/lib/reports/institutional-assembler");
const { fromInstitutionalReport } = await import("@/lib/deliverable/adapters");
const { fromDeliverableViewModel } = await import("@/lib/delivery-system/delivery-document");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");
const { resolveReportExperience } = await import("@/lib/products/report-experience");
const { selectDeterministically } = await import("@/lib/intelligence/deterministic-tier-selection");

const merged = JSON.parse(readFileSync(`${OUT}/pilot2-merged-report.json`, "utf8"));
const reportJson: any = merged.reportJson;
const meta = merged.meta;

// Account eligibility gate (§4): drop structurally-ineligible companies (offer-side
// producers/brands, wrong geography) BEFORE selection — they must not consume a slot
// as HOLD. Uses the research summary (authoritative role), not the discovery route.
const { assessAccountEligibility } = await import("@/lib/intelligence/account-eligibility");
const excluded: Array<{ company: string; reason: string }> = [];
const eligibleLeads = (reportJson.processed_leads ?? []).filter((l: any) => {
  const c = l.candidate ?? {}; const e = l.enrichment ?? {};
  const r = assessAccountEligibility({ company: c.company, industry: c.industry ?? null, country: c.country ?? "United States", companySummary: e.company_summary ?? null }, { geographies: ["United States"] });
  if (r.outcome !== "eligible") { excluded.push({ company: c.company, reason: `${r.outcome.toUpperCase()}_${r.reason ?? "UNKNOWN"}` }); return false; }
  return true;
});
const eligibleIds = new Set(eligibleLeads.map((l: any) => l.id));
reportJson.processed_leads = eligibleLeads;
reportJson.ranked_opportunities = (reportJson.ranked_opportunities ?? []).filter((o: any) => eligibleIds.has(o.lead_id));
console.log(`eligibility: ${eligibleLeads.length} eligible, ${excluded.length} EXCLUDED —`, excluded.map((x) => `${x.company}[${x.reason}]`).join(" | ") || "(none)");

// Re-derive canonical cases with the current calibration.
const cases = (reportJson.processed_leads ?? []).map((l: any) => canonicalCaseForLead(l)).filter(Boolean);
reportJson.canonical_cases = cases;

// Reconcile ranked_opportunities' decision to the re-derived canonical (presentation only).
const byLead = new Map(cases.map((c: any) => [c.lead_id, c]));
for (const o of reportJson.ranked_opportunities ?? []) { const c: any = byLead.get(o.lead_id); if (c && o.decision) o.decision = { ...o.decision, decision: c.decision }; }
// Rank through the deterministic, auditable tier selector rather than incidental input order.
const selectable = (reportJson.ranked_opportunities ?? []).map((o: any) => {
  const lead = reportJson.processed_leads.find((l: any) => l.id === o.lead_id); const cc: any = byLead.get(o.lead_id); const ar = lead?.enrichment?.account_research;
  return { id: o.lead_id, company: lead?.candidate?.company ?? o.lead_id, decision: cc?.decision ?? "hold", fit: cc?.fit ?? null, timing: cc?.timing ?? null, evidence: cc?.evidence ?? null,
    evidenceCount: (lead?.enrichment?.evidence_discipline ?? []).length, hasSource: Boolean(lead?.candidate?.source_url), hasValidatedDate: Boolean(lead?.candidate?.signal_date),
    independentlyCorroborated: Boolean(ar?.corroboration_attempted && (ar?.corroborating_domains ?? 0) >= 1), commercialMechanismVerified: lead?.candidate?.opportunity_kind === "channel_fit",
    accessVerified: lead?.candidate?.opportunity_kind === "channel_fit" && ["strong", "moderate"].includes(lead?.candidate?.channel_evidence_grade ?? ""), counterevidenceMaterial: ar?.counterevidence_material_found === true };
});
const selection = selectDeterministically(selectable, 18);
const orderedIds = selection.selected.map((a: any) => a.id);
reportJson.ranked_opportunities = [...(reportJson.ranked_opportunities ?? [])].filter((o: any) => orderedIds.includes(o.lead_id))
  .sort((a: any, b: any) => orderedIds.indexOf(a.lead_id) - orderedIds.indexOf(b.lead_id)).map((o: any, i: number) => ({ ...o, rank: i + 1 }));
reportJson.processed_leads = reportJson.processed_leads.filter((l: any) => orderedIds.includes(l.id));
reportJson.canonical_cases = cases.filter((c: any) => orderedIds.includes(c.lead_id));
console.log("qualified-not-selected:", selection.qualifiedNotSelected.map((x: any) => `${x.account.company}: ${x.reason}`).join(" | ") || "(none)");

const dist: Record<string, number> = { prioritize: 0, validate: 0, monitor: 0, hold: 0 };
for (const c of cases) dist[(c as any).decision] = (dist[(c as any).decision] ?? 0) + 1;
console.log("re-derived decision distribution:", JSON.stringify(dist), "of", cases.length);
console.log("validate/monitor accounts:", cases.filter((c: any) => c.decision === "validate" || c.decision === "monitor").map((c: any) => { const l = reportJson.processed_leads.find((x: any) => x.id === c.lead_id); return `${l?.candidate?.company}[${c.decision}]`; }).join(" | "));

const institutional = assembleInstitutionalReport(reportJson, meta);
console.log("institutional dossiers:", institutional.account_dossiers.length);

const TIERS: Array<[string, string, string]> = [["preview", "Preview", "preview_launch_v0"], ["brief", "Brief", "brief_launch_v0"], ["intelligence", "Portfolio", "intelligence_launch_v0"], ["premium", "Premium", "premium_launch_v0"]];
for (const [tier, label, code] of TIERS) {
  const experience = resolveReportExperience(code, "en");
  const vm = fromInstitutionalReport(institutional, experience);
  const doc = { ...fromDeliverableViewModel(vm), premiumContext: null };
  const pm = toPresentationModel(doc as any, tier as any, "pdf");
  const pdf = await renderPdfBuffer(pm as any);
  writeFileSync(`${OUT}/LeadLens_AmorDeGea_Pilot2_${label}.pdf`, pdf);
  console.log(`ok ${label.padEnd(10)} bytes=${pdf.length}`);
}
// Persist the re-derived distribution into the job telemetry for Admin.
try {
  const tel = JSON.parse(readFileSync(`${OUT}/pilot2-job-telemetry.json`, "utf8"));
  if (tel.job?.qualified) for (const q of tel.job.qualified) { const c: any = cases.find((x: any) => { const l = reportJson.processed_leads.find((y: any) => y.id === x.lead_id); return (l?.candidate?.company ?? "").toLowerCase() === q.company.toLowerCase(); }); if (c) q.decision = c.decision; }
  writeFileSync(`${OUT}/pilot2-job-telemetry.json`, JSON.stringify(tel, null, 2));
} catch { /* telemetry update best-effort */ }
// Persist the job state (with calibrated decisions) to Supabase so Admin reflects it.
try {
  const { SupabaseCustomerJobStore } = await import("@/lib/intelligence/customer-job-store");
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  const tel = JSON.parse(readFileSync(`${OUT}/pilot2-job-telemetry.json`, "utf8"));
  const job = tel.job;
  if (db && job) {
    const byCompany = new Map(cases.map((c: any) => { const l = reportJson.processed_leads.find((y: any) => y.id === c.lead_id); return [(l?.candidate?.company ?? "").toLowerCase(), c.decision]; }));
    // Drop structurally-excluded accounts from the customer foundation; keep them as an
    // auditable excluded list (§4). Then re-derive tier readiness from the eligible set.
    const excludedSet = new Set(excluded.map((x) => x.company.toLowerCase()));
    job.excluded = excluded;
    job.qualified = (job.qualified ?? []).filter((q: any) => !excludedSet.has(q.company.toLowerCase()));
    for (const q of job.qualified) { const d = byCompany.get(q.company.toLowerCase()); if (d) q.decision = d; }
    const N = job.qualified.length;
    job.tierReadiness = { Preview: { target: 2, actual: Math.min(2, N), full: N >= 2 }, Brief: { target: 6, actual: Math.min(6, N), full: N >= 6 }, Portfolio: { target: 12, actual: Math.min(12, N), full: N >= 12 }, Premium: { target: 18, actual: Math.min(18, N), full: N >= 18 } };
    await new SupabaseCustomerJobStore(db as any).save(job, null);
    console.log("persisted Supabase job state with calibrated decisions");
  } else { console.log("no db/job for persistence"); }
} catch (e) { console.log("job-state persist skipped:", e instanceof Error ? e.message : e); }
console.log("done");
