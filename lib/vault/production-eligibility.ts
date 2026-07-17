// ─── Production eligibility (eligibility-v1) ─────────────────────────────────
// data_origin=production means REAL ORIGIN only. production_eligible means the
// signal currently passes EVERY active governance gate and may enter a
// customer-like selection. Persisted on vault_signals and recalculated by the
// single function below on every governance transition (approve, revoke,
// reject, rights/tier change) — never set ad-hoc anywhere else.
// Fail-closed: missing evidence on any gate → not eligible.

import { isTitleLikeName } from "@/lib/vault/entity-resolution";

export const ELIGIBILITY_VERSION = "eligibility-v1";

const CUSTOMER_SAFE_RIGHTS = new Set(["link_and_summary_allowed", "short_excerpt_allowed", "customer_display_allowed"]);
const CUSTOMER_SAFE_SOURCE_RIGHTS = new Set(["permitted", "customer_display_allowed"]);
const OK_TIERS = new Set(["A", "B", "C"]);
const CATEGORY_LIKE = /\b(compan(y|ies)|agenc(y|ies)|staffing|providers?|vendors?|trends)\s*$/i;

export interface EligibilityInput {
  data_origin: string | null | undefined;
  signal_date: string | null;
  active_review: {
    review_status: string;
    rights_status: string | null;
    evidence_tier: string | null;
    reason_codes?: string[] | null;
    company_match_verdict?: boolean | null;
  } | null;
  source: { source_url: string | null; usage_rights_status: string | null } | null;
  company: { name: string } | null;
}

export interface EligibilityVerdict { eligible: boolean; reasons: string[] }

/** Pure, deterministic. ALL gates must hold; every failure names its reason. */
export function computeProductionEligibility(i: EligibilityInput): EligibilityVerdict {
  const reasons: string[] = [];
  const r = i.active_review;
  const rc = r?.reason_codes ?? [];

  if (i.data_origin !== "production") reasons.push("not_production_origin");
  if (!r) reasons.push("no_active_review");
  else {
    if (r.review_status !== "approved") reasons.push(`active_review_${r.review_status || "unknown"}`);
    if (rc.includes("contradiction")) reasons.push("contradiction");
    if (rc.includes("duplicate_event")) reasons.push("duplicate");
    if (r.company_match_verdict === false) reasons.push("company_mismatch");
    if (!r.evidence_tier || !OK_TIERS.has(r.evidence_tier)) reasons.push("evidence_tier_below_C");
    const rightsOk = (r.rights_status && CUSTOMER_SAFE_RIGHTS.has(r.rights_status))
      || (i.source?.usage_rights_status && CUSTOMER_SAFE_SOURCE_RIGHTS.has(i.source.usage_rights_status));
    if (!rightsOk) reasons.push("rights_not_customer_safe");
  }
  if (!i.signal_date && !rc.includes("continuing_signal")) reasons.push("no_valid_date");
  if (!i.source?.source_url) reasons.push("no_provenance");
  if (!i.company?.name) reasons.push("no_company");
  else if (isTitleLikeName(i.company.name) || CATEGORY_LIKE.test(i.company.name)) reasons.push("identity_suspect");

  return { eligible: reasons.length === 0, reasons };
}

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

/** Recalculate + persist production_eligible for one signal from current
 *  governance state. Central function — the ONLY writer of this flag after
 *  insert. Never touches data_origin or reviews. */
export async function recalculateProductionEligibility(signalId: string): Promise<EligibilityVerdict | null> {
  const db = await getDb();
  if (!db) return null;
  const { data: sig } = await db.from("vault_signals")
    .select("id, data_origin, production_eligible, signal_date, source_id, company_id").eq("id", signalId).maybeSingle();
  if (!sig) return null;

  const [{ data: reviews }, { data: source }, { data: company }] = await Promise.all([
    db.from("vault_signal_reviews")
      .select("review_status, rights_status, evidence_tier, reason_codes, company_match_verdict, reviewed_at, review_version")
      .eq("signal_id", signalId).order("reviewed_at", { ascending: false }).order("review_version", { ascending: false }).limit(1),
    sig.source_id ? db.from("vault_sources").select("source_url, usage_rights_status").eq("id", sig.source_id).maybeSingle() : Promise.resolve({ data: null }),
    sig.company_id ? db.from("vault_companies").select("name").eq("id", sig.company_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const verdict = computeProductionEligibility({
    data_origin: sig.data_origin,
    signal_date: sig.signal_date,
    active_review: (reviews ?? [])[0] ?? null,
    source: source ?? null,
    company: company ?? null,
  });
  if (verdict.eligible !== sig.production_eligible) {
    const { error } = await db.from("vault_signals").update({ production_eligible: verdict.eligible }).eq("id", signalId);
    if (error) console.error("[production-eligibility] update:", error.message);
  }
  return verdict;
}
