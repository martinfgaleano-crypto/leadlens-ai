# LeadLens — OPERATIONAL ENTITLEMENT MATRIX V1

**STATUS: FROZEN FOR SAAS V1 IMPLEMENTATION** (frozen by Pricing owner 2026-09-02). Do not reopen plan naming, prices, limits, lifecycle policy, precedence, Beta policy, annual/monthly semantics, or the commercial usage unit unless implementation reveals a genuine contradiction.

This is the canonical operational source for `Plan → Subscription → Entitlement → Usage → Monitor rights → Billing lifecycle`. Engineering implements this contract and may not reinterpret or invent economics outside it. Provider variant IDs are configuration, not pricing semantics.

---

## 1. Canonical subscription plans (FROZEN)

| | WATCH | MONITOR | INTELLIGENCE |
|---|---|---|---|
| plan_code | `watch` | `monitor` | `intelligence` |
| Display name | WATCH | MONITOR | INTELLIGENCE |
| Commercial status | ACTIVE | ACTIVE | ACTIVE |
| Role | Keep an eye on a few accounts; detect when one becomes worth attention | Operate a monitored portfolio with recurring continuity | Highest-capacity tier: largest portfolio, fastest cadence, strongest continuity |

Names/codes frozen. Not to be reopened without an explicit future Pricing decision.

## 2–3. Price (FROZEN)

| plan_code | Monthly (USD) | Annual (USD) |
|---|---|---|
| `watch` | $7 | $69 |
| `monitor` | $49 | $490 |
| `intelligence` | $149 | $1,490 |

## 4. Billing-interval principle (FROZEN)

**Monthly and annual receive identical product capabilities for the same plan.** Only `billing_interval` and price change; `plan_code` is shared. Annual customers receive **monthly** usage refreshes (not the full annual allowance upfront). The monthly usage period for annual subscriptions is anchored to the **subscription billing/start date**, not the calendar month.

## 5–6. Canonical consumable unit (FROZEN — redlined from "1 run = 1 account")

**Unit = 1 ACCOUNT INTELLIGENCE CREDIT.** One credit = one account receiving a *material* LeadLens Intelligence analysis or re-analysis that produces/updates its customer-facing Opportunity Intelligence state.

- First material analysis of Account A = **1 credit**.
- Later substantive Monitor review/re-analysis of Account A = **1 credit**.
- Infrastructure retry of the same logical analysis = **0**.
- Duplicate/idempotent request = **0**.
- Failed execution that never produces valid Intelligence = **0**.

`run_id` is an **execution primitive** (a job/run may contain multiple accounts). The **Account Intelligence Credit** is the **commercial** primitive. Existing credit infrastructure may be reused underneath, but crediting is **per-account-materialized**, never per-job.

Two independent quantitative meters in V1:
1. **Account Intelligence Credits** per monthly entitlement period.
2. **Maximum active monitored accounts.**

## 7. Active monitor limit (FROZEN)

Active monitored account = an account under a standing recurring-review Monitor definition.

| | WATCH | MONITOR | INTELLIGENCE |
|---|---|---|---|
| Max active monitored accounts | 3 | 20 | 60 |

At limit: **block new Monitor creation / require upgrade**. Existing Monitors are **preserved**.

> **Amendment (2026-09-04, POST-LEMON Option C):** MONITOR 15→**20**, INTELLIGENCE 50→**60**. Monthly Account Intelligence Credits stay **3 / 30 / 100** (single-bucket unchanged). The proposed separate deep-research allowance (0/2/6) and hard market caps (1/1/3) are **DEFERRED — Pricing V2 hypothesis**, not Billing V1 entitlements.

## 8. Monitor cadence rights (FROZEN)

Cadence right = **maximum** review frequency, not a guarantee. Canonical Intelligence/Monitor eligibility still governs whether a re-analysis is warranted; usage limits are an independent constraint. Pricing never forces fake research/change/Timing or unnecessary re-analysis merely because an interval elapsed.

| | WATCH | MONITOR | INTELLIGENCE |
|---|---|---|---|
| Max scheduled eligibility review | 1 / account / 30 days | as frequently as every 14 days | as frequently as every 7 days |
| Trigger-based review | qualifying, per canonical Monitor semantics + available usage | same | same |

**Manual additional review (all tiers): YES** — a customer-requested re-analysis before scheduled cadence is allowed, **consumes 1 Account Intelligence Credit**, and is subject to available allowance + canonical eligibility (no fabricated change).

## 9. Report / Intelligence depth (FROZEN)

**Same canonical Opportunity Intelligence engine across all three tiers.** All tiers preserve the same minimum standards for: canonical Decision, Evidence integrity, freshness, weaknesses/counterevidence, confidence honesty, Account Memory integrity. **No tier receives worse or less trustworthy Intelligence.** Differentiation is quantity, active-monitored capacity, cadence rights, continuity, and amount of Intelligence available — never truth-quality.

## 10. Dossier / deep-research rights

**NOT USED IN V1** as a separate entitlement dimension. All tiers receive the same canonical analysis depth; no separate dossier allowance is metered or implemented.

## 11. History / Account Memory (FROZEN)

History access is **not gated by tier** in V1. All created intelligence — **reports, Evidence, Opportunity Cases, Account Memory, and What Changed history** — is retained and accessible to the customer it was created for, regardless of plan level, downgrade, cancellation, or subscription end, and is **never deleted**. Tier "continuity" is expressed through active-monitor capacity + review cadence + available Account Intelligence Credits + how frequently Account Memory can be refreshed + breadth of the actively monitored portfolio — **never** by removing access to past Intelligence. *(Sign-off note A: CONFIRMED.)*

## 12. Beta access policy — Limited Beta V1 (FROZEN, METERED)

Beta is **metered**, not open access (unmetered beta would be an uncontrolled cost surface and could bypass paid limits).

- accessSource: `beta`.
- Who: authenticated, non-blocked customers authorized for the Limited Beta program.
- How granted: server-controlled Limited Beta authorization; **administratively revocable**. No automatic permanent free entitlement.
- **Account Intelligence Credits: 10 / monthly entitlement period.**
- **Maximum active monitored accounts: 5.**
- **Cadence right:** ≤ 1 scheduled eligibility review / account / **14 days** + canonical qualifying trigger-based reviews, subject to available Beta usage.
- Rollover: **NO.** Top-ups: **NO.**
- Beta period: monthly entitlement periods.
- Usage exhaustion: **same safe behavior as paid plans** — no new material analysis; preserve reports, Monitor definitions, Account Memory; wait for reset or transition to paid.
- Coexistence with paid subscription: **an active subscription overrides Beta.** While a subscription is active, subscription limits apply; Beta limits do **not** stack, provide **no** extra credits, and do **not** bypass subscription exhaustion. If the subscription ends and Beta authorization is still valid, Beta may become the **fallback** access source per precedence.

## 13. One-time + subscription coexistence (FROZEN)

Historical/current one-time purchases remain valid records. While an active subscription exists, **subscription entitlement is primary**; unused one-time credits/rights are **preserved and NOT automatically consumed**. If the subscription later ends, valid unused one-time rights may become available again (before beta/none) per precedence. **Subscribers cannot purchase one-time top-ups in V1.** Non-subscribers may continue using the operational one-time catalog while it remains active. One-time purchases are never deleted or transformed.

## 14. Usage reset — monthly subscriptions (FROZEN)

At each new monthly billing period, allowance **RESETS TO FULL LIMIT** (no carry). Reset boundary source of truth = Lemon **`current_period_start`/`current_period_end`** (provider monthly renewal). A duplicate renewal webhook grants/resets usage **ONCE ONLY** (idempotent on event identity).

## 15. Usage reset — annual subscriptions (FROZEN)

Annual customers receive **monthly usage allowances refreshed each month** inside the annual term — **not** one annual pool, **no** 12-months-upfront. Because Lemon's renewal for an annual subscription fires only yearly, the monthly boundary is computed **internally** from the subscription **start/anniversary day-of-month** (derived from `current_period_start`), independent of the annual Lemon renewal. No rollover between monthly periods.

## 16. Usage exhaustion (FROZEN)

When Account Intelligence Credits reach zero:
- New material Intelligence analysis → **BLOCK.**
- Manual review that consumes Intelligence → **BLOCK.**
- Scheduled Monitor review requiring a new material analysis → **DO NOT EXECUTE** until allowance is available.
- Existing Monitor definitions → **PRESERVE.**
- Existing reports → **ACCESSIBLE.**
- Account Memory → **PRESERVE.**
- Customer path → **WAIT FOR RESET OR UPGRADE.** No overage billing in V1.

## 17. Overage / top-up

**NOT USED IN V1.** No subscription top-ups; engineering must not build top-up billing now.

## 18. Upgrade (FROZEN)

Effective **immediately** after confirmed provider state. Lemon handles monetary proration. Usage already consumed in the current period **remains counted**; available capacity becomes `new_plan_limit − usage_consumed_this_period`. Usage is **not** reset by upgrade. Existing Monitors remain.

## 19. Downgrade (FROZEN)

Effective **next billing period**. If the customer has more active Monitors than the new plan allows: do **not** delete Monitors, history, or Account Memory; **block creation of additional Monitors** until within the new limit. At effective downgrade, excess monitored accounts may remain stored but **do not receive new paid recurring reviews** beyond allowed active capacity until Product UX provides customer selection/reconciliation. Never auto-destroy customer state. Historical intelligence never deleted — **confirmed YES**.

## 20. past_due (FROZEN)

**7 calendar days** of paid-plan entitlement after the provider first marks the subscription `past_due`, measured from the **provider's first past_due timestamp**. During grace: existing paid entitlement active; Intelligence usage continues against normal allowance; Monitor processing continues; results/history accessible. After 7 days without recovery: subscription-derived entitlement **ends**; resolver falls back per precedence. No historical Intelligence deleted.

## 21. cancel_at_period_end (FROZEN)

While `cancel_at_period_end = true` and before `current_period_end`: **full paid entitlement remains active**. At `current_period_end`: subscription entitlement ends. No report/Evidence/Account Memory deletion.

## 22. Immediate cancel / expired / ended (FROZEN)

When terminal with no paid period remaining: subscription entitlement ends. Historical Intelligence remains available. Resolver fallback order: **1. `one_time` → 2. `beta` → 3. `none`.**

## 23. Subscription pause

**NOT USED IN V1.** No custom pause behavior beyond safe normalization: a provider `paused` state normalizes to a **non-access-granting** status (no paid entitlement while paused); no special usage handling.

## 24. Access-source precedence (FROZEN)

1. `internal`
2. `subscription`
3. `one_time`
4. `beta`
5. `none`

An active subscription overrides beta while active; permissive beta access must never override subscription usage limits.

## 25. WATCH — final operational entitlement

| Field | Value |
|---|---|
| plan_code | `watch` |
| price monthly | $7 |
| price annual | $69 |
| active Monitors | 3 |
| Account Intelligence Credits | 3 / monthly entitlement period |
| accounts/opportunities | governed by credits (per-account materialization) |
| cadence right | ≤ 1 scheduled review / account / 30 days + qualifying triggers, subject to usage |
| dossier/deep research | NOT USED IN V1 |
| history | full, retained, never deleted (not tier-gated) |
| manual review rights | YES — consumes 1 credit, subject to allowance + eligibility |
| usage exhaustion | BLOCK new analysis; preserve Monitors/reports/memory; wait for reset or upgrade |
| rollover / top-up | none / none |

## 26. MONITOR — final operational entitlement

| Field | Value |
|---|---|
| plan_code | `monitor` |
| price monthly | $49 |
| price annual | $490 |
| active Monitors | 15 |
| Account Intelligence Credits | 30 / monthly entitlement period |
| accounts/opportunities | governed by credits (per-account materialization) |
| cadence right | as frequently as every 14 days + qualifying triggers, subject to usage |
| dossier/deep research | NOT USED IN V1 |
| history | full, retained, never deleted (not tier-gated) |
| manual review rights | YES — consumes 1 credit, subject to allowance + eligibility |
| usage exhaustion | BLOCK new analysis; preserve Monitors/reports/memory; wait for reset or upgrade |
| rollover / top-up | none / none |

## 27. INTELLIGENCE — final operational entitlement

| Field | Value |
|---|---|
| plan_code | `intelligence` |
| price monthly | $149 |
| price annual | $1,490 |
| active Monitors | 50 |
| Account Intelligence Credits | 100 / monthly entitlement period |
| accounts/opportunities | governed by credits (per-account materialization) |
| cadence right | as frequently as every 7 days + qualifying triggers, subject to usage |
| dossier/deep research | NOT USED IN V1 |
| history | full, retained, never deleted (not tier-gated) |
| manual review rights | YES — consumes 1 credit, subject to allowance + eligibility |
| usage exhaustion | BLOCK new analysis; preserve Monitors/reports/memory; wait for reset or upgrade |
| other | fastest cadence + largest portfolio; same canonical engine/quality |

## 28. One-time product role (FROZEN)

**ACTIVE ALONGSIDE SUBSCRIPTIONS.** Non-subscribers may purchase one-time Intelligence (existing catalog remains active). Subscribers may **not** purchase one-time additional usage in V1. Historical one-time purchases preserved; when a subscription ends, unused one-time rights rank above beta/none per precedence.

- Non-subscriber can purchase one-time Intelligence: **YES.**
- Subscriber can purchase one-time additional usage: **NO.**

## 29. Free / preview / trial (FROZEN)

| | V1 |
|---|---|
| FREE PREVIEW | NO |
| FREE TRIAL | NO |
| PAID SAMPLE | YES — existing one-time catalog (Preview $7 / Brief $25 / Intelligence $59 / Premium $129) remains active for non-subscribers |
| BETA | YES — Limited Beta, server-authorized + revocable, **metered** (10 credits/mo, 5 active monitors, ≤14-day cadence), overridden by active subscription (see §12) |

## 30. Billing provider mapping contract (config, not pricing)

Canonical combinations (all exist; each maps one Lemon variant ID → plan_code + interval):

| plan_code | interval |
|---|---|
| `watch` | month |
| `watch` | year |
| `monitor` | month |
| `monitor` | year |
| `intelligence` | month |
| `intelligence` | year |

Variant IDs are environment configuration (sandbox/prod); never client-authoritative.

## 31. Customer plan display (FROZEN)

Customer-facing names: **WATCH · MONITOR · INTELLIGENCE.** Interval wording: "Monthly" / "Annual". Cancellation: access continues to period end, then ends (no data loss). past_due: brief grace, then paused access (no data loss). Usage-limit: "You've reached your plan's analysis allowance for this period — resets on renewal, or upgrade for more."

## 32. Entitlement-change invariants (FROZEN — all confirmed)

- Plan/billing changes never delete historical reports, Evidence, or Account Memory. ✓
- Entitlement enforcement is server-authoritative; client cannot self-grant. ✓
- Webhook replay never grants usage twice; renewal never resets/grants twice. ✓
- Cancellation never requires founder/admin entitlement edits. ✓
- Normal upgrade/downgrade never requires manual DB edits. ✓
- One-time historical purchases remain intact. ✓

## 33. Final precedence table (FROZEN)

| Scenario | Effective source | Rights |
|---|---|---|
| beta only | `beta` | metered Limited Beta: 10 credits/mo, 5 active monitors, ≤14-day cadence |
| one-time only | `one_time` | per purchased one-time catalog entitlement |
| subscription only | `subscription` | that plan's credits + monitor cap + cadence |
| beta + subscription | `subscription` | subscription rights/limits; beta suppressed while active |
| one-time + subscription | `subscription` | subscription primary; one-time preserved, not consumed |
| subscription past_due (within 7-day grace) | `subscription` | full plan rights during grace |
| subscription past_due (grace expired) | fallback (`one_time`→`beta`→`none`) | per surviving source |
| cancelled but period still active | `subscription` | full plan rights through current_period_end |
| subscription ended + beta valid | `beta` | metered Limited Beta access (10 credits/mo, 5 monitors) |
| subscription ended + unused one-time rights | `one_time` | surviving one-time entitlement |

## 34. Final usage-period table (FROZEN)

| Plan / interval | Reset boundary | Monthly allowance | Rollover | Active monitor cap |
|---|---|---|---|---|
| WATCH monthly | Lemon current_period (monthly renewal) | 3 credits | none | 3 |
| WATCH annual | internal monthly anchor from start date | 3 credits | none | 3 |
| MONITOR monthly | Lemon current_period (monthly renewal) | 30 credits | none | 15 |
| MONITOR annual | internal monthly anchor from start date | 30 credits | none | 15 |
| INTELLIGENCE monthly | Lemon current_period (monthly renewal) | 100 credits | none | 50 |
| INTELLIGENCE annual | internal monthly anchor from start date | 100 credits | none | 50 |
| BETA (Limited Beta) | monthly entitlement period | 10 credits | none | 5 |

## 35. Questions still open

**NONE.** Both prior clarifications resolved by the Pricing owner at freeze:

- **A (§11 history): CONFIRMED.** History access is NOT tier-gated; all created intelligence retained and accessible regardless of plan/downgrade/cancellation/end; "continuity" differentiation via cadence + monitor capacity + credits + memory-refresh frequency + monitored-portfolio breadth, never by removing access to past Intelligence.
- **B (beta metering): CORRECTED → METERED.** Limited Beta V1 = 10 credits / monthly period, 5 active monitors, ≤14-day cadence, no rollover/top-up, safe exhaustion, server-authorized + administratively revocable, overridden by active subscription. See §12.

## 36. Final freeze

Status: **FROZEN FOR SAAS V1 IMPLEMENTATION** (Pricing owner, 2026-09-02). Product & Engineering may implement Billing → Entitlement Live V1 against this contract without further Pricing decisions.

Pricing owner confirms: plan identities · prices · limits · reset semantics · lifecycle policy · precedence · coexistence · Beta policy · monthly/annual semantics · the commercial usage unit (Account Intelligence Credit).

FINAL PRICING VERDICT: **READY FOR BILLING → ENTITLEMENT LIVE V1.**

---

### Engineering implications this matrix creates (non-blocking; for the build, not Pricing decisions)

1. **Per-account crediting, not per-run.** Current `consumeRunSlotAtomic` consumes 1 credit per *new run creation*. Your §5/§6 redline requires consuming **1 credit per materialized account Opportunity Case** (idempotent per account; 0 on retry/failure/duplicate). Implementation must move the consumption seam from run-creation to per-account-materialization, keyed by a stable `(entitlement_period, account_key)` idempotency identity.
2. **Separate subscription allowance from one-time credits.** §13 requires unused one-time credits to be *preserved and not consumed* while subscribed. Today both would live in one `customer_credits.credit_balance`. The build must track the **subscription monthly allowance** distinctly from **one-time purchased credits** (e.g., a period-scoped allowance counter vs. the durable one-time balance) so subscription consumption never draws down one-time rights.
3. **Internal monthly boundary for annual subs.** §15 requires monthly refreshes anchored to the billing anniversary day, independent of Lemon's yearly renewal event. The build needs an internal period calculator (from `current_period_start`) plus an idempotent monthly-refresh mechanism (cron or lazy-on-read) — Lemon will not emit a monthly event for annual plans.

These are engineering tasks I'll carry into implementation; they do not require any further Pricing input.
