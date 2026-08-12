# LeadLens — Commercial Continuity Contract V1

**Purpose.** One canonical product/commercial contract across
`LANDING → PLAN → AUTH → COMMERCIAL INTENT → ONBOARDING → ENTITLEMENT → PIPELINE → DASHBOARD → REPORT`,
so a later visual sprint can redesign the customer journey without guessing what
LeadLens calls things, how plans persist, what onboarding truly requires, how
entitlements work, what "success" means, or which product states are real.

**This sprint is technical/product continuity only — no visual redesign, no
billing, no provider calls, no Discovery.** Code changes are limited to stale
metadata terminology + a deterministic guard test. Everything else is a
definition/contract for the next sprint.

---

## 1. Initial HEAD & production state

- **Local HEAD:** `f06764711bfbcfc8b6080a74f50feaaec4b96b08` — `fix: localize ICP terminology on first use`.
- **origin/main:** same commit (`f067647`); local branch is neither ahead nor behind.
- **Production current:** **yes** (behaviorally verified in the V3 audit — production renders the four localized first-use ICP strings and the current `#how-it-works` architecture from this commit; the host does not expose a trustworthy deploy SHA).
- **Working tree at sprint start:** clean except always-excluded runtime files (`.leadlens/source-intelligence.json`, `.leadlens/usage.json`) and two untracked audit docs (`LEADLENS_FULL_WEBSITE_AUDIT_V3.md`, `LEADLENS_LANDING_PAGE_POST_REDESIGN_AUDIT_V2.md`).
- **Prior relevant commits present:** landing conversion (`998fc2b`, `3f3ad2a`), conversion plumbing (`d61ed5f`), commercial-readiness audit (`45664bf`), ICP localization (`f067647`). Conversion-plumbing handoff and full website audit V3 both present.

## 2. Canonical vocabulary

Confirmed against code; this is the **starting hypothesis, corrected by audit**.

| Concept | Canonical customer-facing term | Backend/internal identifier | Safe to migrate now? |
|---|---|---|---|
| Product | **LeadLens** | `LeadLens` | n/a (stable) |
| Category | **Account Opportunity Intelligence** | — | Yes (metadata fixed this sprint) |
| Primary commercial object | **Account** | `company` / `account` entities | UI-label only |
| Reason an account matters | **Opportunity** | opportunity/qualification output | Yes |
| Observable evidence | **Signal** | signal/evidence structures | Yes |
| Meaningful recent change | **What Changed** | `what_changed` (entitlement flag) | Yes |
| Supporting source data | **Evidence** | evidence center / sources | Yes |
| Evidence against the thesis | **Counterevidence** | `counterevidence` entitlement | Yes |
| Confidence in the intelligence | **Confidence** | confidence/uncertainty model | Yes |
| Entry product ($7) | **Preview** | `preview_launch_v0` (legacy `sample`) | Yes |
| Deep account output | **Account Brief** (artifact) / **Brief** ($25 product) | `brief_launch_v0` (legacy `starter`) | Yes |
| Prioritized account set | **Opportunity Portfolio** | portfolio_* entitlements (Intelligence+) | Yes, where entitled |

Canonical answers for the final response: **category = Account Opportunity
Intelligence; primary object = Account; entry product = Preview (Opportunity
Preview); deep output = Account Brief.**

## 3. Legacy terminology map

| Legacy term | Where it appears | Class | Recommendation |
|---|---|---|---|
| **Lead / Leads** | dashboard ("Avg Leads", "Ready to get leads?"), notifications, `PLAN_LEAD_COUNT`, legal, `lib/stripe.ts`, report-agent | B/D customer-facing legacy; A internal (`PLAN_LEAD_COUNT` legacy fence) | Replace UI with **Account/Opportunity**; keep internal identifiers |
| **Lead Search / Search** | `/dashboard/searches` ("Your monitors" over search internals), "Create your first search" | B legacy UI over A internal routing | UI → **Monitor / target profile**; keep route/internal |
| **Credits / Lead Credits** | dashboard stat card + Credits card, `customer_credits` table, `/api/credits` | A internal allowance ledger, currently C customer-facing | **Internal-only**; remove from customer UI (founder decision) |
| **Prospects / Lead Finder / Apollo** | legacy processing/notification copy, monitor detail | B/D legacy lead-gen model | Remove from customer surfaces |
| **Snapshot** | announcement/legacy copy, `lib/utils/export.ts`, OG (fixed) | B legacy | Retire from new copy |
| **Report** | delivery format, mixed with product nouns | C required (deliverable), D when used as product | Use only for the **exported deliverable** |
| **Starter ($29) / Beta Starter/Pro** | dashboard plan labels | D misleading (contradicts $7/$25/$59/$129 catalog) | Replace with catalog display names |

## 4. Product object model (customer-facing → backend)

```
Customer / User (Supabase auth user; customer_credits.user_id)
 └─ Commercial Context (onboarding: company, offer, target customer, geography, objective)
     └─ Opportunity Portfolio  ── Intelligence+ entitlement (portfolio_* levels)
         └─ Account            ── company/account entity in pipeline output
             └─ Account Intelligence  ── fit/timing/why-now/evidence/counterevidence
                 └─ Account Brief      ── results/[jobId]/brief (institutional brief)
                     └─ Monitoring / What Changed  ── monitoring_eligible (Intelligence+), manual cadence
```

**Gaps:** no single persisted `CommercialIntent` object links plan → auth → job
(see §10). Portfolio exists as report structure, not a first-class dashboard
object. Monitoring is `monitoring_eligible` + manual re-run, not automated.

## 5. Plan catalog source of truth

**Single source of truth: `lib/products/catalog.ts`** (`CATALOG_VERSION =
"launch_tier_architecture_v0"`). Prices/entitlements resolve **only** server-side
via `resolveProduct()` / `resolveEntitlementsForJob()`; browser-sent amounts are
never trusted.

| product_code | Tier / display | Price | Billing | ICPs·Regions | Opp target | Deep dossiers | Monitoring | Portfolio | Legacy plan | Impl state |
|---|---|---:|---|---|---:|---:|---|---|---|---|
| `preview_launch_v0` | Preview | $7 | one_time | 1·1 | 2 | 0 | no | none | `sample` | active |
| `brief_launch_v0` | Brief | $25 | one_time | 1·1 | 6 | 0 | no | basic/summary | `starter` | active |
| `intelligence_launch_v0` | Intelligence *(Recommended)* | $59 | one_time | 1·2 | 12 | 4 | eligible | complete | `standard` | active (portfolio partial) |
| `premium_launch_v0` | Premium *(anchor)* | $129 | one_time | 2·3 | 18 | 6 | eligible | advanced | `pro` | active (strategy flagged_off) |

**Duplicated/parallel definitions:** the catalog is the only price/entitlement
source. The **customer dashboard still renders a legacy plan model** (free /
starter / standard / pro, "Starter ($29)") — a display-layer contradiction, not a
second catalog. `PLAN_LEAD_COUNT` (types) is the deprecated legacy fence, read
only for historic jobs. **Do not change prices.**

## 6. Plan claims vs implementation (product-truth matrix)

| Plan | Landing claim | Backend entitlement | Actual pipeline capability | Customer output | Status |
|---|---|---|---|---|---|
| Preview | Validate quality, 2 opps, mini-verdict | `opportunity_target:2`, `mini_verdict` | company-first discovery + qualification | mini executive report + proceed/refine/stop | **SUPPORTED** |
| Brief | Focused comparable set, 6 opps | `opportunity_target:6`, basic portfolio | discovery + ranking | brief report + basic portfolio | **SUPPORTED** |
| Intelligence | Prioritized portfolio, 12 opps, allocation, clusters, momentum | complete portfolio + `monitoring_eligible` | ranking/statuses/allocation exist; clusters/momentum/decay **partial** (`portfolio_intelligence_v0=partial`) | complete report + portfolio | **PARTIALLY_SUPPORTED** |
| Premium | Strategy, playbooks, stakeholders, scenarios, 18 opps | `playbooks/stakeholder_hypotheses/discovery_questions:true`, reinforced evidence | `premium_strategy_v0`, `opportunity_playbooks_v0`, `reinforced_evidence_v0` = **flagged_off** (guided/manual, never simulated) | strategic brief; strategy sections honest-gated | **PARTIALLY_SUPPORTED (guided/manual)** |

**Overall: PARTIAL.** Prices/codes/opportunity targets align; higher-tier
*advanced* capabilities are honestly staged behind capability flags. Premium must
be sold as **guided/manual**, never as automated guarantees. Locked by
`test:commercial-continuity` (assertions 6–11) + `test:product-catalog`.

## 7. Four-plan contract

Canonical current commercial products = **Preview / Brief / Intelligence /
Premium** (the four `*_launch_v0` codes). Keep all four. Each has a consistent
identity through the resolvable chain: **pricing card → `plan`/`product_code`
selection → (future) auth → commercial intent → `resolveProduct()` entitlement →
`legacy_plan` pipeline run → tier-resolved report**. No plan silently becomes
another: legacy names map 1:1 (`sample→preview`, `starter→brief`,
`standard→intelligence`, `pro→premium`) and unknown strings fail closed.
**Continuity break to fix in the visual sprint:** the dashboard still displays the
legacy free/starter/standard/pro labels (and "Starter ($29)").

## 8. Preview ($7) contract

- **One-time**, `billing_type:"one_time"`, `price_amount:7`, `legacy_plan:"sample"`.
- **Accounts:** `opportunity_target:2`, 1 ICP · 1 region, `deep_dossiers:0`.
- **Depth:** same analytical floor as every tier (`what_changed`, sources,
  `why_now`, `evidence_quality:"standard"`, counterevidence when found); **no
  portfolio**; unique feature `mini_verdict` (proceed / refine / stop).
- **Output:** mini executive report.
- **Auth requirement:** none today (direct-link/demo branch); **target = auth
  before checkout** (§10).
- **Current delivery path:** paid CTA → onboarding form → checkout-pending
  (self-serve checkout closed) → manual/guided delivery; or sample demo via `/api/demo`.
- **Upgrade relationship:** validates before Intelligence; `tier_upgrade_credit_v0`
  is flagged_off (needs payment provider).
- **Commercial readiness:** product SUPPORTED; **purchase not self-serve yet**.
- **Guardrail:** Preview must not redefine LeadLens as a cheap lead product — it is
  a low-risk validation of Account Opportunity Intelligence.

## 9. Commercial Intent contract

**Needed: YES (as a typed contract; minimal implementation).** No single persisted
object currently links plan → auth → onboarding → job. Landing preserves
`plan` + source CTA in client state and privacy-safe analytics; jobs persist
`plan`/`product_code`; but there is no continuous record surviving auth/checkout.

Minimal `CommercialIntent` shape (type-safe now, storage when billing lands):
`{ user_id, product_code, source_cta, created_at, status, onboarding_ref?,
job_ref?, report_ref? }`. Statuses (only those that can occur today are live;
the rest are future-safe): `STARTED → AUTHENTICATED → READY_FOR_CHECKOUT →
CHECKOUT_CREATED → PAID → ONBOARDING → READY_TO_RUN → PROCESSING → DELIVERED`
(+ `CANCELLED/FAILED`). Do not implement billing states that cannot yet fire
beyond the type contract. Do not overengineer.

## 10. Auth-first contract

**Confirmed: AUTH BEFORE CHECKOUT is the correct target and is achievable.**
Customer auth = Supabase (`signInWithPassword`, `getSession`; `/login`,
`/signup`, `/auth/callback`). Today the paid direct-link branch has **no auth
dependency** — checkout is closed, so onboarding runs pre-auth and cannot submit.
Canonical path to build in the checkout sprint:
`CTA → persist product_code + source_cta → auth → return to same commercial
intent → /api/checkout (server-resolved price) → payment → onboarding →
authorized run`. **State loss today:** selected plan and locale do not survive a
detour through `/login` or `/signup` (auth screens are disconnected from plan).

## 11. Signup/login continuity

**Status: BROKEN (not yet wired).** After a commercial CTA, auth does **not**
preserve product / plan / source CTA / commercial context. `/signup` is
disconnected from the selected plan (V3 §33). Fix belongs to the checkout sprint
(add a return-URL + product_code carry). Guard added conceptually; a functional
return-URL test should accompany the implementation (not landed this sprint
because no auth-return code path exists yet to test).

## 12. Pre-payment data contract

**Target minimum before (future) checkout:** authenticated user + selected
`product_code` + source-CTA attribution. **Nothing else is architecturally
required before payment** — `/api/checkout` resolves price from the catalog, not
from onboarding. Preview may add at most a short qualifier, never the full
intake. Current inversion (7–13 fields before discovering checkout is closed) is
the core conversion defect (V3 §31). **Do not require full ICP/context before
payment.**

## 13. Post-payment onboarding contract

Canonical groups (data needed **after** payment, **before** pipeline):

- **CORE_CONTEXT:** company name, business description/offering, target customer, delivery email.
- **DISCOVERY_CONTEXT:** target countries (authoritative geography, §14), commercial objective, known accounts/exclusions.
- **OPTIONAL_REFINEMENT:** value proposition (derivable), average ticket, tone, output language, restrictions.
- **PLAN_SPECIFIC_REFINEMENT:** sales capacity, prioritization preferences (Intelligence+), strategic priorities, known objections (Premium) — guided.

Initial step ≤ 6 fields: company name; offer/business summary; target customer;
target countries; commercial objective; delivery email. Derive/confirm company
description + value proposition before pipeline. **Do not delete required schema
fields — consolidate UI answers and derive/confirm backend fields.**

## 14. Geography contract (authoritative)

**Confirmed by code:** `target_countries` is **authoritative**;
`target_market_region` is a **derived/fallback locale + provider-routing hint**.
`lib/quality/geography-contract.ts` (`assertGeographyContract`,
`enforceCandidateGeography`) is invoked inside `runLeadLensPipeline` and enforces
countries against discovery output. Discovery routing, vertical packs and
qualification need exact countries; a hidden `global` default is unsafe for paid
runs. **Authoritative field: `target_countries`.** The early visible onboarding
field must be **Target country/countries**. Region stays derived/advanced.
Locked by `test:geography-contract` (5/5).

## 15. Onboarding field contract

| Field | Classification | Actual use |
|---|---|---|
| company_name | REQUIRED_PRE_PIPELINE (early) | sender identity, ICP/report |
| offer_description | REQUIRED_PRE_PIPELINE (early) | product detection, pain/ICP |
| target_customer_description | REQUIRED_PRE_PIPELINE (early) | industry/buyer/ICP inference |
| target_countries | REQUIRED_PRE_PIPELINE (early) | **authoritative geography** |
| campaign/commercial objective | REQUIRED_POST_PAYMENT (early UI) | direction; persisted |
| contact_email | REQUIRED_POST_PAYMENT | delivery |
| company_description | REQUIRED_PRE_PIPELINE / DERIVABLE | ICP prompt/sender context |
| value_proposition | DERIVABLE (confirm) | ICP/problem framing |
| known_accounts | REQUIRED_PRE_PIPELINE when available | Account Memory dedupe; absent from public form |
| average_ticket | OPTIONAL | account-size calibration |
| tone | OPTIONAL (safe default) | report/outreach language |
| output_language | OPTIONAL / DERIVABLE | localization |
| restrictions | PLAN_SPECIFIC | exclusion context |
| sales_capacity, prioritization_preferences | PLAN_SPECIFIC (Intelligence+) | persisted; weak direct agent use |
| strategic_priorities, known_objections | PLAN_SPECIFIC (Premium) | guided context |
| target_market_region | DERIVABLE | locale/provider fallback |
| opportunity_preferences, risk_tolerance, decision_stakeholders | LEGACY/UNUSED | schema/type only |

**Duplicate concepts:** company_description / offer_description /
value_proposition / target_customer overlap → consolidate UI answers, derive
backend strings. **Do not delete data paths casually.**

## 16. ICP terminology contract

Preserve `docs/LOCALIZATION_RULES.md`: first-use `ICP` per active language must
expand — EN `ICP (Ideal Customer Profile)`, ES `ICP (Perfil de Cliente Ideal)`,
PT `ICP (Perfil de Cliente Ideal)`, JA `ICP（理想顧客プロファイル）`. Backend
identifiers stay `icp`. **Customer-facing UI:** prefer **Target Customer** in
onboarding entry; use **ICP** (expanded on first use) where precision matters;
avoid unexplained jargon. Landing first-use rule passes in all four languages
(V3 §11); legal/`/success`/dashboard still use ICP without a localized experience.

## 17. Pipeline input contract

`runLeadLensPipeline({ onboardingData, plan, jobId, searchId })` →
`runICPAgent(onboardingData, plan)` → `assertGeographyContract` → discovery →
qualification → report.

- **Required by type/schema:** the five core business strings + valid email +
  tone + valid enums (checkout schema); demo schema is `.strict()`.
- **Required in practice:** company, offer, target customer, **target_countries**
  (geography contract throws otherwise), ICP-derivable context.
- **Optional enrichment:** ticket, tone, restrictions, capacity, prioritization,
  strategic priorities, objections.
- **Legacy:** `PLAN_LEAD_COUNT`, `opportunity_preferences`, `risk_tolerance`,
  `decision_stakeholders`.
- **Default-hiding risk:** `target_market_region` defaulting to `global`, and
  tone defaulting, can mask missing context — geography must come from explicit
  countries, not a region default.

## 18. Execution gate

Canonical condition for a commercial job to run:
**`AUTHENTICATED + ENTITLED (server-resolved product) + ONBOARDING_COMPLETE →
READY_TO_RUN`.** No commercial run may depend on client-provided plan state alone.
Current fail-closed behavior is preserved: `lib/auth/authorize-processing.ts`
gates `/api/process` (admin-only), payment-gate tests hold, and pipeline throws on
geography-contract violation. The gate is **defined**; wiring `ENTITLED` to a
persisted paid state is a checkout-sprint task.

## 19. Entitlement contract

**Server-side source of truth = `lib/products/catalog.ts`.** Entitlement derives
from `resolveEntitlementsForJob({ plan, onboarding.product_code })`: stored
`product_code` wins, legacy `plan` is the fallback, unknown → `null` (caller must
fail closed). **Never** from a client-selected plan string alone. `/api/checkout`
resolves price from the catalog. **Secure: partial** — resolution is secure and
tested; the open item is that no persisted *paid* entitlement record yet exists to
bind a run to a payment (checkout closed). Locked by `test:commercial-continuity`
(3–5) + `test:product-catalog` + `test:payment-gate`.

## 20. Entitlement lifecycle

Products are **one-time** (no recurring billing). Applicable states:
`PENDING (intent/awaiting payment) → ACTIVE (paid, run available) → EXHAUSTED
(delivered / allowance used)`; `CANCELLED/REFUNDED` on payment reversal;
`EXPIRED` not applicable to one-time deliverables. `customer_credits` is the
existing per-user allowance ledger (migration 010, RLS own-user) — internal
mechanic, not a customer-facing unit (§25). **Do not implement recurring billing.**

## 21. Ownership contract

- **Commercial intent:** owned by the authenticated `user_id` (to persist).
- **Job:** `lib/storage/job-store.ts` `BatchJob` keys on `customer_email`
  (legacy); `lib/storage/snapshot-store.ts` carries `user_id` (nullable) + RLS.
- **Report/Brief:** `results/[jobId]` is ownership-protected; brief inherits.
- **Monitoring state:** tied to monitor/search rows (user-scoped).

**Rule:** every **new paid** commercial record must have an explicit `user_id`
owner — new paid flows must **not** inherit legacy anonymous/link-access
assumptions. **Defined: YES.** Legacy email/link jobs keep compatibility (§22).

## 22. Report access contract

- **New commercial report:** authenticated owner access (`user_id`), RLS-enforced.
- **Legacy reports:** may preserve link/email compatibility where current
  architecture requires it (historic jobs).
- **Migration boundary:** the introduction of paid checkout — every report created
  by a paid `CommercialIntent` is owner-bound; pre-existing jobs stay on the
  legacy access path. Do not retroactively break legacy access.

## 23. Dashboard conceptual model

**Do not redesign.** The dashboard *should* represent, in priority order:
**Latest Opportunity + What Changed → Opportunity Portfolio → Accounts → Account
Intelligence → Reports/Briefs → Monitoring.** Current widget mapping:

| Current widget | Verdict |
|---|---|
| Latest report / "review latest opportunity" | **KEEP** (promote to hero) |
| Suggested next action / empty states | **KEEP** |
| Account/Plan stat cards | **RENAME_UI** (catalog display names, drop "Starter ($29)") |
| ICPs / target profile (`/dashboard/icp`) | **RENAME_UI** ("Target customer / ICP") |
| Monitors (`/dashboard/searches`) | **RENAME_UI** ("Monitors"), **DEMOTE** search/lead internals |
| Credits stat card + Credits card | **LEGACY** → remove from customer UI (internal ledger) |
| "Search Statistics" / "Avg Leads" / "Ready to get leads?" | **LEGACY / REMOVE_LATER** |
| Apollo references, monitor-detail lead/credit concepts | **LEGACY / REMOVE_LATER** |

## 24. Credits policy

**What a credit technically is:** a per-user allowance balance in
`customer_credits` (migration 010: one row/user, `credit_balance INTEGER ≥ 0`, RLS
own-user; `add/consume/get-balance/get-history` in `lib/credits`). It is an
internal entitlement/allowance mechanic (a historic pricing token), **not** the
current commercial promise (opportunity targets are).

**Classification: INTERNAL-ONLY (currently leaking as CUSTOMER-FACING).**
**Recommendation:** stop showing "Credits" in customer surfaces; express
remaining value as entitlement/allowance in product nouns. Keep the table/code as
an internal ledger. **Do not remove code.** → **Founder decision** (§55): confirm
credits never return as a customer-facing unit.

## 25. Search / discovery terminology

| Term | Current meaning | Recommendation |
|---|---|---|
| Search / Lead Search / "Create your first search" | user-created monitor over internal routing | **Monitor** / **Target profile** (customer-facing) |
| Find Leads / Lead Finder | legacy lead-gen label | remove |
| Discovery / Opportunity Discovery | internal engine (Discovery Engine) | keep **internal**; customer sees "we find accounts" |

The user does **not** manually search for leads under the new model. Canonical
customer language: **"Monitor your target market → LeadLens finds and prioritizes
accounts."** Do not redesign.

## 26. Product success event

**Primary success event: `first_usable_opportunity_delivered`** — the first time
an authenticated customer can open a delivered report and see a prioritized
account with dated evidence, why-now and a next action (the real Aha, V3 §37).
**Secondary milestones:** `commercial_intent_created`, `payment_success`
(future), `onboarding_completed`, `job_started`, `brief_ready`. This anchors
analytics, onboarding, dashboard home, and the billing funnel. Not "created a
search."

## 27. Analytics contract

Existing internal `/api/events` (validates, rate-limits, structured-logs; **no
vendor dependency**) + `lib/analytics/conversion-events.ts`. Implemented:
`landing_view`, `hero_cta_click`, `nav_cta_click`, `pricing_view`,
`pricing_plan_select`, `onboarding_start`, `onboarding_step_complete`,
`onboarding_submit`, `onboarding_error`, `onboarding_success`.

Normalized funnel against the commercial contract (add as each state becomes
real): `landing_view → cta_click → commercial_intent_created → auth_started →
auth_completed → plan_selected → checkout_started (future) → payment_success
(future) → onboarding_started → onboarding_completed → job_started →
portfolio_ready → brief_ready → first_value_reached`. **Payload stays limited to
plan, source CTA, step number, error category — never company/email/URL/free
text.** Do not add payment events that cannot fire yet.

## 28. Dashboard analytics

Define (implementation optional — trivial only once dashboard is instrumented):
`dashboard_view, portfolio_open, account_open, brief_open, what_changed_open,
monitoring_open`. Anonymized identifiers only; **no sensitive business data**.
Not landed this sprint (no dashboard event wiring exists yet; adding it is a
dashboard-sprint task).

## 29. Delivery state contract

Reuse existing async lifecycle — **do not create a parallel one**. Backend states:
`LeadStatus = pending | processing | completed | error` (types),
snapshot `status = processing | completed | failed`, `PaymentStatus = pending |
paid`. Canonical customer-facing mapping:
`QUEUED (pending) → PROCESSING (processing) → READY (completed) → FAILED
(error/failed)`, plus `NEEDS_REVIEW` for human-review exceptions. **Duplication to
reconcile in UI copy:** `completed` vs `ready`, `error` vs `failed` — unify the
*labels*, keep the backend enums.

## 30. Delivery truth by plan

| Plan | Portfolio | Brief/dossier | Monitoring | Corroboration | Strategy | Delivery UI | Manual review |
|---|---|---|---|---|---|---|---|
| Preview | none | mini report | no | standard, when-found counterevidence | none | report + mini-verdict | basic QA |
| Brief | basic | brief report | no | standard | basic sequence | report + basic portfolio | basic QA |
| Intelligence | complete (clusters/momentum **partial**) | complete report + 4 deep | eligible (manual cadence) | full + counterevidence | complete sequence | report + portfolio | exceptions |
| Premium | advanced | strategic brief + 6 deep | eligible (manual) | reinforced (**flagged_off → guided**) | playbooks/stakeholders/scenarios (**flagged_off → guided/manual**) | strategic brief | priority exceptions |

No marketing optimism: Intelligence portfolio depth and all Premium *strategy*
capabilities are **guided/manual or partial**, not automated.

## 31. SLA / timing claims

| Claim | Status |
|---|---|
| "24–48h managed delivery" | **SUPPORTED** as guided/manual delivery |
| "auto-detected" / Monitor "recurring" | **UNSUPPORTED as automated** — cadence is manual → qualify |
| "100% source-verified" | **AMBIGUOUS** — broader than the system's own evidence/uncertainty model → qualify |
| "active signals now / vendor window open" | **AMBIGUOUS** — inference from public change, not confirmed intent → qualify |

**Safe product-truth for Claude:** managed/guided delivery within a stated window;
public-change inference ≠ buying intent; evidence coverage varies and uncertainty
is first-class. Do not invent a numeric SLA.

## 32. Monitor contract

**What it is today:** a user-created monitor over the target market that produces
account-level opportunity reports; **cadence is manual** (`monitoring_eligible`
Intelligence+, no automated scheduler, no waitlist backend). The landing Monitor
CTA misroutes to a Preview form.
**Canonical status: BETA (manual re-run), NOT a subscription.** Recommend
`BETA` or `REMOVE_FROM_PRIMARY_FLOW` until automation/billing exist. Do not invent
a waitlist. → **Founder decision** (§55).

## 33. Premium capability truth

From `CAPABILITY_FLAGS`:

| Capability | Flag default | Truth |
|---|---|---|
| Portfolio intelligence (clusters/momentum/decay) | `partial` | ranking/statuses/allocation real; rest partial |
| Premium strategy (playbooks/stakeholders/scenarios) | `flagged_off` | **not automated — guided/manual, never simulated** |
| Opportunity playbooks | `flagged_off` | depends on premium strategy |
| Reinforced evidence | `flagged_off` | extra corroboration pass not automated |
| Account memory snapshot | `partial` | institutional snapshots exist; customer-facing later |
| Initial watchlist | `flagged_off` | interest capture only |
| Tier upgrade credit | `flagged_off` | needs payment provider |

**Handoff:** Premium UI must not imply automated guarantees for any flagged_off
capability; present them as guided/manual. Locked by `test:commercial-continuity`.

## 34. Support identity

Existing references are **inconsistent**: customer legal/success pages use the
personal `martinfgaleano@gmail.com`; `app/start/success` uses
`support@leadlensai.com`; delivery uses `leads@leadlens.ai` / `reports@leadlens.ai`;
`.env.local` sets `SEC_EDGAR_CONTACT=operations@leadlensintel.com`. Production
domain is **leadlensintel.com**.

**Classification:** personal Gmail = legacy (customer-facing, weakens trust);
`operations@leadlensintel.com` / a `support@leadlensintel.com` = corporate,
domain-aligned. **A corporate identity on the production domain exists
(`operations@leadlensintel.com`).** Recommend consolidating customer support to
one branded `…@leadlensintel.com` inbox. → **Founder decision** (§55): confirm the
canonical support address. Did not send email; did not invent an address.

## 35. Legal continuity

Contradictions found (factual, not a legal rewrite):
- `/terms` still promises "qualified B2B leads", "lead data, qualification scores,
  and personalized outreach copy".
- `/privacy` calls LeadLens "a B2B lead research service … qualified prospects …
  personalized outreach copy".
- `/refund` uses "beta batch purchases".
- All legal pages brand "LeadLens AI", are English-only, use the personal Gmail,
  and predate the four-tier one-time catalog.

**This sprint:** documented only. Terminology/legal body copy is left unchanged
(founder/legal decision — hard scope forbids legal rewrite beyond obvious factual
consistency). Recommended: align nouns to Account Opportunity Intelligence,
one-time products, and branded support in a dedicated legal pass.

## 36. Language support matrix

| Language | Landing | Auth | Onboarding | Dashboard | Results | Legal | Verdict |
|---|---|---|---|---|---|---|---|
| English | full | full | full | full | full | full | **FULLY_SUPPORTED** |
| Spanish | full | ✗ | partial | ✗ | partial (brief) | ✗ | **PARTIALLY_SUPPORTED** |
| Portuguese | full (some 3-product copy) | ✗ | partial | ✗ | ✗ | ✗ | **MARKETING_ONLY** |
| Japanese | landing + first-use ICP; mixed EN nouns | ✗ | ✗ | ✗ | ✗ | ✗ | **MARKETING_ONLY** |

Only **English is launch-ready end-to-end**. Do not claim four-language product
support because the landing is translated. → **Founder decision** (§55): initial
launch languages.

## 37. Language persistence

Locale is **component state**, not URL/route-level. It resets across landing →
auth → onboarding → dashboard → report; `<html lang>` stays `en` (`app/layout.tsx`
line 48). **Status: does not persist.** A low-risk functional fix (dynamic `lang`
+ locale carry) is a dashboard/auth-sprint item; not landed here because it spans
auth + dashboard surfaces and needs cross-route testing.

## 38. Route map

| Route | Class | Status | Canonical? |
|---|---|---|---|
| `/` (`app/demo-pipeline/page.tsx`) | marketing + pre-checkout onboarding | live | **canonical** |
| `/demo-pipeline` | legacy | 308 → `/` | redirect (stop linking) |
| `/login`, `/signup`, `/auth/callback` | customer auth (Supabase) | live | canonical; no forgot-password entry |
| `/dashboard`, `/dashboard/icp`, `/dashboard/searches[/[id]]`, `/dashboard/notifications` | customer product | auth-protected | canonical; legacy vocabulary |
| `/results/[jobId]`, `/results/[jobId]/brief` | report | ownership-protected | canonical |
| `/upload/[jobId]` | support/upload | job entry | utility |
| `/start`, `/start/success` | legacy onboarding/success | present | **obsolete** (redundant) |
| `/success`, `/cancel` | post-purchase | present | `/success` copy contradicts embedded onboarding; billing-only |
| `/privacy`, `/terms`, `/refund` | legal | live | canonical (legacy copy) |
| `/admin/**` | internal | protected | out of scope |

No dedicated `/pricing` route (pricing lives in `/`). No single continuous route
carries a product through auth → payment → entitlement → delivery. **Do not delete
routes yet.**

## 39. Success-state contract

| State | Canonical page | Issue |
|---|---|---|
| Signup success | `/dashboard` (post-auth) | fine; no plan context carried |
| Payment success (future) | `/success` | copy assumes email ICP collection — contradicts embedded onboarding |
| Onboarding success | in-flow confirmation | fine |
| Analysis submitted | job/processing state | ok |
| Report ready | `/results/[jobId]` | strongest surface |

Obsolete/duplicate: `/start/success` and `/success` overlap; `/success` copy must
be rewritten for the real (embedded) flow when billing lands. Do not redesign.

## 40. Error contract

Categories: `AUTH_ERROR` (invalid credentials/rate-limit — friendly in auth),
`VALIDATION_ERROR` (onboarding Zod, `role=alert`), `ENTITLEMENT_ERROR` (unknown/
unpaid plan — fail closed), `PIPELINE_ERROR` (run failure), `DELIVERY_ERROR`
(report/email), `COMMERCIAL_ERROR` (checkout unavailable / no entitlement).
**Leaks to fix (documented):** dashboard errors are plain containers; some
technical configuration errors can surface in customer copy; checkout-unavailable
is framed as "almost ready" rather than a clear guided-pilot path. No UI rewrite
this sprint.

## 41. Empty-state contract (behavior/content requirements)

- **No portfolio yet:** explain the value of the first report + the required
  sequence (target profile → run → delivery); do **not** say "Create your first
  search / Ready to get leads?".
- **Analysis pending:** name the output ("Building your opportunity report…") + a
  status/owner path.
- **No monitoring:** describe monitoring as manual re-run over the target market;
  no waitlist language.
- **No briefs:** point to running the first opportunity analysis.
- **Entitlement inactive:** honest guided-pilot / checkout-unavailable state, not
  "almost ready". Claude designs these later; content requirements defined here.

## 42. Password reset status

- **Implemented:** partial — `/auth/callback` handles a recovery type and comments
  "send to dashboard or a reset-password page **if we have one**".
- **Reachable:** **no** — there is no forgot-password link on `/login` and no
  dedicated reset-password page.
- **Broken/missing:** the entry point + the reset page.
**Status: PARTIAL — callback-ready, no entry point.** Not implemented this sprint
(a new reset page + email template + flow test is not a low-risk one-liner);
flagged **P1** for the checkout/auth sprint.

## 43. Accessibility findings

Strengths: real headings, labeled auth inputs, language combobox label,
comparison-table semantics, region label, `aria-pressed` plan state, onboarding
`role=alert`. Priority objective issues (documented; low-risk visual-adjacent fixes
belong to Claude's sprint): fragile keyboard focus (outline removed + inline mouse
focus handlers), FAQ rows are static containers not disclosure buttons, in-page
nav uses buttons instead of links, sub-44px touch targets (Sign in, sample link,
language selector), `<html lang>` doesn't follow locale, no skip link, dashboard
errors are plain containers, mobile clipped content at 375/360. No objective a11y
defect was safely fixable in isolation without touching the frozen visual layer.

## 44. Metadata terminology

**Fixed this sprint (textual metadata only, no new visual asset):**
- `app/layout.tsx`: `OG_TITLE`/`OG_DESC`/`siteName`/OG `alt` → "LeadLens — Account
  Opportunity Intelligence for B2B" and account-level description; removed
  "LeadLens AI" and "Opportunity Snapshots".
- `app/api/og/route.tsx`: replaced "Qualified B2B leads + personalized outreach
  drafts." / "We research, qualify, and write the outreach." with the frozen
  "Find the B2B accounts worth working now." + evidence subhead; logo lockup now
  reads "LeadLens · Account Opportunity Intelligence".

**Remaining (documented, not changed):** legal-page `<title>`s still say "LeadLens
AI"; no structured data; global canonical `/`; no hreflang/dynamic `lang`; sitemap
`lastModified` at build time. **Metadata terminology current: partially — root/OG
now correct; legal titles pending a legal pass.**

## 45. Monolith risk

Dangerous-to-edit files (too much unrelated logic combined): `app/demo-pipeline/
page.tsx` (~3,448 lines: 4-language copy + styles + all states), `app/dashboard/
searches/[id]/page.tsx` (~1,030), `app/results/[jobId]/page.tsx` (~1,063),
`app/dashboard/page.tsx` (694). **No refactor this sprint** (behavior-preservation
risk outweighs benefit and it is visual-adjacent). Safe future extraction
boundaries: (1) the 4-language `COPY` dictionary → `lib/i18n/landing-copy.ts`;
(2) shared inline style objects → a tokens module; (3) landing form state → a
hook. Extract behind stable behavior before the visual sprint.

## 46. Claude safe-edit map

**SAFE TO EDIT VISUALLY:** `app/demo-pipeline/page.tsx` (hero/sample/pricing/form
presentation), `app/login/page.tsx`, `app/signup/page.tsx`, `app/dashboard/**`
overview + labels, `app/results/[jobId]` entry header, landing localization blocks,
`app/success` / `/cancel` copy.
**CAN EDIT COPY ONLY:** legal pages (`/privacy`, `/terms`, `/refund`) — nouns only,
in a legal pass; OG/metadata text; dashboard display labels.
**DO NOT TOUCH:** `lib/products/catalog.ts` (prices/entitlements),
`lib/pipeline.ts` + `lib/agents/**`, `lib/quality/geography-contract.ts`,
`lib/auth/**` + `authorize-processing`, `/api/checkout` + payment gate,
`lib/discovery/**` + `lib/providers/**` (Discovery/Source Intelligence),
Account/Market Memory, DB migrations, `.env*`, `.leadlens/*`, Pilot 1/2 artifacts.

## 47. Tests

- **Added:** `scripts/fixtures/commercial-continuity.test.ts`
  (`npm run test:commercial-continuity`) — 17/17 passing, 0 provider calls.
  Locks: 4-product catalog + tier order; entitlement derives from stored
  `product_code`; unknown plan fails closed; legacy names resolve 1:1; capability
  honesty (premium strategy/playbooks/reinforced/upgrade-credit flagged_off,
  portfolio partial, Premium playbooks-vs-flag honesty gap flagged); metadata
  terminology invariants (no "LeadLens AI"/"Opportunity Snapshots"/"Qualified B2B
  leads"/"outreach drafts"; category present).
- **Preserved/green:** `test:product-catalog` (27/27), `test:geography-contract`
  (5/5), `test:payment-gate` (5/5), `conversion-plumbing` (ok). No brittle
  full-page snapshot tests added.

## 48. Continuity scores (before → after this contract sprint)

Scores reflect *contract/continuity clarity*, not visual polish (visual is a later
sprint). Honest, not inflated.

| Continuity dimension | Before | After |
|---|---:|---:|
| Landing → Auth | 3.5 | 4.5 |
| Auth → Plan | 3.0 | 4.5 |
| Plan → Onboarding | 5.0 | 6.5 |
| Onboarding → Pipeline | 6.5 | 7.5 |
| Pipeline → Dashboard | 4.5 | 5.5 |
| Dashboard → Report | 5.5 | 6.0 |
| Terminology continuity | 4.0 | 6.0 |
| Entitlement continuity | 6.5 | 7.5 |
| Localization continuity | 3.5 | 4.0 |
| Analytics continuity | 6.0 | 7.0 |

The larger jumps (Auth→Plan, Terminology) come from a defined contract + metadata
fix + guard tests; the remaining gap to 8+ requires the checkout/auth wiring and
the visual sprint, which are intentionally out of scope.

## 49. P0 / P1 / P2 / P3

**P0 (blocks coherent paid launch):**
1. No canonical working purchase → entitlement → delivery flow (checkout closed).
2. Public promise vs legacy dashboard product model (leads/searches/credits/Apollo/"Starter ($29)").
3. Purchase CTA ends in unavailable checkout after a long pre-payment form.

**P1 (before meaningful traffic):**
4. Pre-payment onboarding 7–13 fields; explicit target countries not collected early.
5. Auth loses selected plan + locale; no forgot-password entry point.
6. Stale legal titles + legal body nouns; personal Gmail support identity.
7. Mobile pricing/length + 375/360 hero clipping (visual sprint).
8. Success/cancel/start legacy route contradictions.
9. No real anonymized proof asset.

**P2 (beta improvement):** landing multilingual vs app English-only; giant client
monoliths; CTA noun proliferation + Monitor waitlist mismatch; accessibility
focus/touch/semantic gaps.
**P3 (later):** structured data / hreflang / dynamic `lang`; recurring Monitor
subscription; upgrade/reorder + order history.

## 50. Code changes

Allowed-category changes made (normalize stale customer-facing metadata + add
tests):
- `app/layout.tsx` — metadata terminology (title/desc/siteName/alt).
- `app/api/og/route.tsx` — OG image **text** terminology (no layout/asset redesign).
- `scripts/fixtures/commercial-continuity.test.ts` — new guard test.
- `package.json` — `test:commercial-continuity` script.

No design modifications; no prices/entitlements/auth/pipeline/provider/DB changes;
no billing; no Discovery; zero provider calls.

## 51. Files changed

1. `app/layout.tsx`
2. `app/api/og/route.tsx`
3. `scripts/fixtures/commercial-continuity.test.ts` (new)
4. `package.json`
5. `LEADLENS_COMMERCIAL_CONTINUITY_CONTRACT_V1.md` (this document, new)

## 52. Commit

`refactor: unify LeadLens commercial continuity` (single focused commit; push via
GitHub Desktop — no CLI push credentials).

## 53. Founder decisions (do not guess)

1. **Self-serve vs guided service** positioning — the UI must state one truth.
2. Whether all four plans stay publicly visible, or lead with Preview + recommended
   Intelligence and reveal advanced.
3. Whether **Credits** ever remain customer-facing (recommendation: internal-only).
4. **Monitor** commercial status (recommendation: BETA / manual, not subscription).
5. Which **Premium** capabilities are guaranteed now vs guided/manual/future.
6. **Initial supported languages** for the full journey (recommendation: English
   launch-ready; others marketing-only).
7. **Primary success event** (recommendation: `first_usable_opportunity_delivered`).
8. **Support email identity** (recommendation: consolidate to
   `…@leadlensintel.com`; `operations@leadlensintel.com` already exists in env).
9. **Future checkout provider** (Lemon Squeezy pending — `tier_upgrade_credit_v0`
   flagged_off).

## 54. Claude handoff summary

The visual sprint can proceed on `/` hero/sample/pricing/form, `/login`,
`/signup`, `/dashboard` overview, and the report-entry header — using the **§46
safe-edit map** and the canonical vocabulary (§2), legacy map (§3), object model
(§4), plan truth (§6/§30), geography contract (§14), success event (§26), and
dashboard model (§23). Do not imply automation for any flagged_off Premium
capability. Do not touch the catalog/pipeline/auth/provider/DB. Prices and
entitlements are fixed by the server catalog and locked by tests.

---

### Final response index → see the numbered answers in the chat reply.
