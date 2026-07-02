// ─── Usage / Entitlements v0 ──────────────────────────────────────────────────
// Self-serve usage gate WITHOUT billing integration. Derives entitlement from
// data that already exists (profiles.plan, customer_credits.credit_balance).
//
// Honest gate: a customer may run monitors when they are an "active customer" —
// a non-free plan OR a positive credit balance. Monitor runs do NOT consume
// credits yet; per-run pricing/deduction is future billing work (see
// SELF_SERVE_SAAS_ARCHITECTURE.md). Nothing here fakes paid status: the
// values come straight from the plan/credits tables.
//
// Admin routes are never gated by this helper.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Entitlements {
  plan_name: string;
  credits_remaining: number;
  can_create_monitor: boolean;
  can_run_monitor: boolean;
  /** Inert for now — surfaced when billing lands. null = no enforced limit. */
  monthly_run_limit: number | null;
  blocked_reason: string | null;
}

const FREE_PLANS = new Set(["free"]);

export async function getEntitlements(db: any, userId: string): Promise<Entitlements> {
  let planName = "free";
  let credits = 0;

  try {
    const [{ data: profile }, { data: creditRow }] = await Promise.all([
      db.from("profiles").select("plan").eq("id", userId).maybeSingle(),
      db.from("customer_credits").select("credit_balance").eq("user_id", userId).maybeSingle(),
    ]);
    if (profile?.plan) planName = String(profile.plan);
    if (creditRow?.credit_balance != null) credits = Number(creditRow.credit_balance) || 0;
  } catch {
    // Fail closed for runs, open for reads: unknown state blocks nothing that
    // is already public, but a run gate with no data should not fake access.
  }

  const isActiveCustomer = !FREE_PLANS.has(planName) || credits > 0;

  return {
    plan_name: planName,
    credits_remaining: credits,
    can_create_monitor: true, // search creation is already self-serve and cheap
    can_run_monitor: isActiveCustomer,
    monthly_run_limit: null,
    blocked_reason: isActiveCustomer
      ? null
      : "Monitor runs are available on paid plans. Contact us to activate your plan.",
  };
}
