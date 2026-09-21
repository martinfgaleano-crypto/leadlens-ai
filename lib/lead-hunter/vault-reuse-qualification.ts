// ─── Reused-identity Research qualification — safe current operating-role check ──
//
// Closes the Hybrid Candidate Universe blocker: a neutral Vault-reused identity carries
// only name/domain/country (no org type, by design), so the frozen research-readiness gate
// (which needs a confirmed target-matching organization type) holds it out of Research. This
// stage establishes the company's operating ROLE from its OWN current public source, so a
// genuinely relevant reused operator can reach normal Research while wrong-target and
// non-operating identities are rejected.
//
// TRUTH / TENANCY BOUNDARIES:
//   • The observed role is a NEUTRAL, currently-verifiable fact about the company itself
//     (its own official content) — NOT the customer-ICP-derived Vault `industry` field, and
//     NOT another customer's Fit/Timing/Decision. It never reads or writes customer-relative
//     Vault attributes, and it runs on the in-memory research-handoff universe (the persisted
//     discovery snapshot is left immutable).
//   • Role qualification is NOT Timing/Evidence/Decision. It only makes a candidate eligible
//     for Research; canonical Research still independently establishes current events, Evidence,
//     Fit, Timing and Decision (Hold remains valid).
//   • wrong_target_type is preserved and strengthened: a verified role outside the customer's
//     target families is rejected, not admitted.
//   • Provider failure ≠ wrong target: an unreachable source leaves the candidate held
//     (unresolved), never excluded.

import type { CandidateAccount, CandidateAccountUniverse, DiscoveryPlan } from "./candidate-universe";
import { families } from "./research-readiness";
import { classifyOrganization } from "@/lib/discovery/organization-type";

export type QualificationStatus =
  | "QUALIFIED_FOR_RESEARCH"
  | "REJECTED_WRONG_TARGET_TYPE"
  | "REJECTED_WRONG_GEOGRAPHY"
  | "REJECTED_NON_COMPANY"
  | "UNRESOLVED_INSUFFICIENT_EVIDENCE"
  | "OPS_BLOCKED_PROVIDER_FAILURE";

/** Neutral current public evidence about a company, fetched from its own official domain. */
export interface CompanyEvidence {
  domain: string;
  /** Bounded official content (markdown/text). Empty when the fetch failed. */
  content: string;
  sourceUrl: string;
  /** false → the source could not be retrieved (provider failure, NOT a negative signal). */
  ok: boolean;
}

export type CompanySourceFetcher = (input: { domain: string; name: string; country?: string; path?: string }) => Promise<CompanyEvidence>;

/** Bounded official subpages tried when a homepage yields NO operating-role signal (§16). Spanish
 * paths first (Colombia), then English. Never tried when the homepage already showed a role family
 * (a real wrong-target signal is preserved, §20) or a non-company/provider failure. */
export const QUALIFICATION_SUBPAGES = ["/nosotros", "/productos", "/quienes-somos", "/about", "/products", "/what-we-do"] as const;
/** Max official-source fetches (homepage + subpages) across a whole run — caps cost/latency. */
export const DEFAULT_MAX_TOTAL_FETCHES = 24;
/** Max subpages tried per unresolved candidate. */
export const MAX_SUBPAGES_PER_CANDIDATE = 2;

export interface QualificationResult {
  status: QualificationStatus;
  /** A neutral FAMILY key (manufacturer/distributor/logistics/…) when QUALIFIED. */
  observedRole?: string;
  sourceRef?: string;
  reason: string;
}

// Role evidence for clearly non-operating entities (publisher / wire / job board), detected
// from CONTENT role phrases — not from a domain extension or a broad keyword blacklist (§18).
const NON_OPERATING_ROLE =
  /\b(press release|newswire|news wire|prnewswire|business ?wire|globe ?newswire|press releases distributed|editorial team|our newsroom|subscribe to our newsletter|breaking news|job (board|listings|openings|vacanc)|apply (now|today) for|browse (jobs|vacancies)|post a job|thousands of jobs|classifieds)\b/i;

/** PURE decision over fetched neutral evidence. No I/O. */
export function qualifyFromEvidence(ev: CompanyEvidence, targetFamilies: string[], name: string): QualificationResult {
  if (!ev.ok) return { status: "OPS_BLOCKED_PROVIDER_FAILURE", reason: "Official source could not be retrieved (provider failure)." };
  const content = ev.content ?? "";
  if (content.trim().length < 40) return { status: "UNRESOLVED_INSUFFICIENT_EVIDENCE", reason: "Official source returned insufficient content to establish an operating role." };

  // Non-company organizations (association/guild/government/program) from name + current content.
  const org = classifyOrganization({ name, description: content, domain: ev.domain });
  if (!org.eligible_for_icp) return { status: "REJECTED_NON_COMPANY", reason: `Not a commercial operating company: ${org.organization_type}.` };
  // Publisher / wire / job-board role evidence in the content itself.
  if (NON_OPERATING_ROLE.test(content)) return { status: "REJECTED_NON_COMPANY", reason: "Current source reads as a publisher / news wire / job board, not an operating company." };

  const observedFamilies = families(content);
  if (!observedFamilies.length) return { status: "UNRESOLVED_INSUFFICIENT_EVIDENCE", reason: "Current source does not establish a recognizable operating-role family." };

  const match = observedFamilies.find((f) => targetFamilies.includes(f));
  if (match) return { status: "QUALIFIED_FOR_RESEARCH", observedRole: match, sourceRef: ev.sourceUrl, reason: `Current official source indicates ${match}, matching the customer target.` };
  return { status: "REJECTED_WRONG_TARGET_TYPE", reason: `Current official source indicates ${observedFamilies.join("/")}, outside the customer target families (${targetFamilies.join("/") || "none"}).` };
}

export interface ReuseQualificationDeps { fetchCompanyEvidence: CompanySourceFetcher }
export interface ReuseQualificationBudget { maxQualify: number; maxTotalFetches?: number }
/** Bound the number of candidates + total source fetches per run. Preview economics + fairness (§15/§16). */
export const DEFAULT_REUSE_QUALIFICATION_BUDGET: ReuseQualificationBudget = { maxQualify: 12, maxTotalFetches: DEFAULT_MAX_TOTAL_FETCHES };

/** Adaptive qualification budget (§17/§18): when the thin-universe fallback fires, attempt enough
 * eligible reused identities to plausibly fill the commercial delivery target, given observed
 * per-batch yield, WITHOUT becoming an unbounded search. Scales with the delivery target and is hard-
 * capped. It never lowers the bar (wrong_target/non-company gates are unchanged) — it only widens how
 * many verified identities are checked when fresh Discovery under-supplies. */
export const MAX_ADAPTIVE_QUALIFY = 30;
export function adaptiveQualificationBudget(deliveryTarget: number): ReuseQualificationBudget {
  const maxQualify = Math.min(MAX_ADAPTIVE_QUALIFY, Math.max(12, Math.ceil(deliveryTarget) * 3));
  return { maxQualify, maxTotalFetches: maxQualify * 2 };
}

export interface ReuseQualificationMetrics {
  targetFamilies: string[];
  eligibleForQualification: number;
  attempted: number;
  totalFetches: number;
  qualified: number;
  recoveredViaSubpage: number;
  rejectedWrongTarget: number;
  rejectedNonCompany: number;
  rejectedWrongGeography: number;
  unresolved: number;
  opsBlocked: number;
}

/** Bounded official subpages to try for a domain, Spanish-first for Colombian TLDs. */
export function subpagesFor(domain: string): string[] {
  const co = /\.co($|\.)/.test(domain.toLowerCase());
  const ordered = co
    ? ["/nosotros", "/productos", "/quienes-somos", "/about", "/products"]
    : ["/about", "/products", "/what-we-do", "/company", "/nosotros"];
  return ordered.slice(0, MAX_SUBPAGES_PER_CANDIDATE);
}

/** True when a candidate should undergo qualification: a Vault-reused, in-scope, domain-verified
 * identity whose operating role is not yet observed (so research-readiness currently holds it). */
export function needsReuseQualification(c: CandidateAccount): boolean {
  return !!c.originFlags?.includes("VAULT_REUSED")
    && c.status !== "excluded"
    && !!c.identity.domain
    && !c.identity.organizationType;
}

const targetFamiliesForPlan = (plan: DiscoveryPlan): string[] => families([...plan.organizationTypes, ...plan.industries].join(" "));

/** Enrich a WORKING COPY of the universe: qualified reused identities receive a neutral,
 * source-verified organizationType (so research-readiness can admit them); clearly wrong /
 * non-company identities are excluded; provider failures and unresolved cases are left held.
 * The persisted discovery snapshot is never mutated. Fail-closed per candidate. */
export async function qualifyReusedCandidates(
  universe: CandidateAccountUniverse,
  deps: ReuseQualificationDeps,
  budget: ReuseQualificationBudget = DEFAULT_REUSE_QUALIFICATION_BUDGET,
  onTelemetry?: (m: ReuseQualificationMetrics) => void,
): Promise<{ universe: CandidateAccountUniverse; metrics: ReuseQualificationMetrics }> {
  const targetFamilies = targetFamiliesForPlan(universe.plan);
  const metrics: ReuseQualificationMetrics = {
    targetFamilies, eligibleForQualification: 0, attempted: 0, totalFetches: 0, qualified: 0, recoveredViaSubpage: 0,
    rejectedWrongTarget: 0, rejectedNonCompany: 0, rejectedWrongGeography: 0, unresolved: 0, opsBlocked: 0,
  };
  const candidates = universe.candidates.map((c) => ({ ...c, identity: { ...c.identity } }));
  const maxTotalFetches = budget.maxTotalFetches ?? DEFAULT_MAX_TOTAL_FETCHES;
  let attempts = 0;
  for (const c of candidates) {
    if (!needsReuseQualification(c)) continue;
    metrics.eligibleForQualification++;
    if (attempts >= budget.maxQualify || metrics.totalFetches >= maxTotalFetches) continue; // bounded; rest stay held
    attempts++;
    metrics.attempted++;
    const name = c.identity.canonicalName;
    const domain = c.identity.domain!;
    let result: QualificationResult;
    try {
      metrics.totalFetches++;
      const ev = await deps.fetchCompanyEvidence({ domain, name, country: c.identity.country });
      result = qualifyFromEvidence(ev, targetFamilies, name);
      // Bounded subpage cascade — ONLY when the homepage gave no role signal (ambiguous). A real
      // wrong-target / non-company / provider-failure signal is never overridden by subpage fishing (§20).
      if (result.status === "UNRESOLVED_INSUFFICIENT_EVIDENCE" && ev.ok) {
        let accContent = ev.content;
        for (const path of subpagesFor(domain)) {
          if (metrics.totalFetches >= maxTotalFetches) break;
          metrics.totalFetches++;
          const sev = await deps.fetchCompanyEvidence({ domain, name, country: c.identity.country, path });
          if (!sev.ok || sev.content.trim().length < 40) continue;
          accContent = `${accContent}\n${sev.content}`.slice(0, 12_000);
          const r2 = qualifyFromEvidence({ domain: ev.domain, content: accContent, sourceUrl: sev.sourceUrl, ok: true }, targetFamilies, name);
          if (r2.status !== "UNRESOLVED_INSUFFICIENT_EVIDENCE") {
            result = r2;
            if (r2.status === "QUALIFIED_FOR_RESEARCH") metrics.recoveredViaSubpage++;
            break;
          }
        }
      }
    } catch {
      result = { status: "OPS_BLOCKED_PROVIDER_FAILURE", reason: "Qualification fetch threw (failure-isolated)." };
    }
    applyResult(c, result, metrics);
  }
  if (onTelemetry) onTelemetry(metrics);
  return { universe: { ...universe, candidates }, metrics };
}

function applyResult(c: CandidateAccount, result: QualificationResult, metrics: ReuseQualificationMetrics): void {
  switch (result.status) {
    case "QUALIFIED_FOR_RESEARCH":
      metrics.qualified++;
      // Neutral, source-verified operating role → lets research-readiness admit it. This is a
      // structural descriptor from the company's OWN current content, never Evidence/Timing.
      c.identity.organizationType = result.observedRole;
      c.status = "needs_validation";
      c.statusReason = `Reused identity qualified for Research: ${result.reason}`;
      break;
    case "REJECTED_WRONG_TARGET_TYPE":
      metrics.rejectedWrongTarget++;
      c.status = "excluded"; c.statusReason = result.reason;
      break;
    case "REJECTED_NON_COMPANY":
      metrics.rejectedNonCompany++;
      c.status = "excluded"; c.statusReason = result.reason;
      break;
    case "REJECTED_WRONG_GEOGRAPHY":
      metrics.rejectedWrongGeography++;
      c.status = "excluded"; c.statusReason = result.reason;
      break;
    case "UNRESOLVED_INSUFFICIENT_EVIDENCE":
      metrics.unresolved++; // left held (needs_validation) — not researched, not excluded
      break;
    case "OPS_BLOCKED_PROVIDER_FAILURE":
      metrics.opsBlocked++; // provider failure ≠ wrong target; left held
      break;
  }
}
