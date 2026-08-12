# LeadLens Conversion Plumbing Handoff

Audited at commit `998fc2b2bae7f88836cfce06969a523beb6ca4a2` on 2026-08-11. This handoff is for the next visual conversion sprint. It does not authorize billing, Discovery, or a visual redesign.

## 1. CTA routing map

| CTA | Handler / destination | Plan | State |
|---|---|---|---|
| Announcement | `goToForm(standard, announcement)` | Intelligence | checkout URL or pending onboarding |
| Nav Get started | `goToForm(standard, nav)` | Intelligence | same |
| Hero primary | `goToForm(standard, hero)` | Intelligence | same |
| Hero See how it works | `#how-it-works` | none | section scroll |
| Hero/sample demo | `goToDemo()` | current/default | demo onboarding |
| Sample bridge paid | `goToForm(sample, sample_bridge)` | Preview | pending onboarding |
| Four pricing CTAs | `goToForm(plan, pricing)` | clicked tier | preselected correctly |
| Monitor waitlist | `goToForm(sample, monitor)` | Preview | **known mismatch:** no true waitlist backend exists |
| FAQ demo | `goToDemo()` | current/default | demo onboarding |
| Final primary | `goToForm(starter, final)` | Brief | pending onboarding |
| Final demo | `goToDemo()` | current/default | demo onboarding |

## 2. CTA bugs and fixes

Fixed the hero secondary CTA, whose “See how it works” label previously scrolled to Pricing. CTA sources are now preserved in privacy-safe analytics. Pricing selection already preselected the clicked plan; this behavior is preserved and tested. Monitor still opens an unrelated Preview form because no waitlist backend exists; changing it without a destination would create a different dead end, so Claude/founder must resolve it explicitly. Copy semantics remain a visual/content task.

## 3. Canonical terminology map

| Term | Current meaning | Conflict | Recommendation |
|---|---|---|---|
| Opportunity Preview / Preview | $7 validation tier | “Preview” also describes free demo | Reserve **Preview** for paid tier |
| Sample / demo | synthetic report experience | sometimes called preview | Use **Sample report** |
| Opportunity Brief / Brief | per-account artifact and $25 product | artifact/product overlap | Product: **Brief**; artifact: **Account Opportunity Brief** |
| Intelligence | $59 portfolio tier/category | broad category | Keep **Intelligence** for tier; **Account Opportunity Intelligence** for category |
| Snapshot | announcement/legacy vocabulary | overlaps Preview/Brief | Retire from new copy |
| Report | delivery format | mistaken for product | Use only for exported deliverable |

## 4. Onboarding trace

Landing state (`form` + `tierExtras`) → client form → `/api/checkout` when self-serve is enabled in the future, or `/api/demo` for sample mode → Zod validation → job/pipeline → ICP → discovery/qualification/report. `/api/process` is admin-only. Retired `/api/onboarding` surfaces must not be revived.

## 5. Field inventory and runtime classification

| Field | Classification | Actual use |
|---|---|---|
| company_name | REQUIRED_TO_START / BEFORE_PIPELINE | sender identity, ICP/report |
| company_description | REQUIRED_BEFORE_PIPELINE | ICP prompt and sender context |
| offer_description | REQUIRED_TO_START / BEFORE_PIPELINE | product detection, pain/ICP |
| value_proposition | REQUIRED_BEFORE_PIPELINE; potentially DERIVABLE | ICP/problem framing |
| target_customer_description | REQUIRED_TO_START / BEFORE_PIPELINE | industry, buyer and ICP inference |
| contact_email | REQUIRED_TO_START for commercial delivery | checkout/job delivery; demo schema also requires it |
| target_countries | REQUIRED_BEFORE_PIPELINE for production-quality discovery | authoritative geography contract/router |
| target_market_region | DERIVABLE from countries, fallback hint | locale/provider routing; global reduces precision |
| average_ticket | OPTIONAL / CAN_ASK_LATER | ICP clarity and account-size calibration |
| tone | OPTIONAL / CAN_ASK_LATER | outreach/report language; default safe |
| output_language | OPTIONAL / DERIVABLE | report/localization |
| campaign_objective | PLAN_SPECIFIC / CAN_ASK_LATER | accepted/persisted; weak direct main-agent use |
| restrictions | PLAN_SPECIFIC / CAN_ASK_LATER | accepted/persisted; useful exclusion context |
| sales_capacity | PLAN_SPECIFIC / CAN_ASK_LATER | accepted/persisted; weak direct main-agent use |
| prioritization_preferences | PLAN_SPECIFIC / CAN_ASK_LATER | accepted/persisted; weak direct main-agent use |
| strategic_priorities | PLAN_SPECIFIC / CAN_ASK_LATER | Premium context; weak direct main-agent use |
| known_objections | PLAN_SPECIFIC / CAN_ASK_LATER | Premium context; weak direct main-agent use |
| opportunity_preferences | LEGACY_UNUSED in current landing | schema/type only |
| risk_tolerance | LEGACY_UNUSED in current landing | schema/type only |
| decision_stakeholders | LEGACY_UNUSED in current landing | schema/type only |
| known_accounts | REQUIRED_BEFORE_PIPELINE when available | Account Memory duplicate suppression; absent from public form |

Current maximum inventory is 21 typed inputs including system/product metadata; the default Intelligence UI shows 11 fields, with tone/region collapsed.

## 6. Geography requirement

`target_countries` is authoritative. `target_market_region` is only a provider/localization fallback. Discovery routing, vertical packs, geography quality contract, and qualification need exact countries. The early visible field should be **Target country/countries**. Region should be derived or retained as an advanced fallback. A hidden default of `global` is unsafe for high-quality paid execution.

## 7. Progressive onboarding blueprint

Initial step (maximum six): company name; offer/business summary; target customer; target countries; commercial objective; delivery email. Before pipeline: derive or confirm company description and value proposition, collect known accounts/exclusions, then require all backend core strings. Optional refinement after payment: average ticket, tone, restrictions, capacity, prioritization, strategic priorities, objections, language. Do not simply delete required schema fields; consolidate UI answers and derive/confirm backend fields.

## 8. Validation constraints

Checkout requires the five core business strings (minimum 1/5 characters depending endpoint), valid email, tone, and valid enums. Tier extras are optional and capped at 300–600 characters. Demo uses `.strict()` and currently rejects tier extras and `product_code`; the present client sends those fields to `/api/demo`, a latent mismatch if demo execution is enabled. Progressive disclosure must build endpoint-specific payloads. Required form inputs now expose native required semantics and label associations.

## 9. Current post-submit/commercial state

When payment links are absent, paid CTA opens onboarding, displays checkout-pending notices, and cannot submit. The user can switch to sample demo. If a public Lemon Squeezy URL exists, CTA redirects before onboarding. No auth dependency exists in this direct-link branch. Current flow is transparent but commercially incomplete.

## 10. Analytics infrastructure and events

Existing internal `/api/events` validates, rate-limits, and structured-logs events; no vendor dependency was added. Implemented: `landing_view`, `hero_cta_click`, `nav_cta_click`, `pricing_view` via IntersectionObserver, `pricing_plan_select`, `onboarding_start`, `onboarding_step_complete`, `onboarding_submit`, `onboarding_error`, and `onboarding_success`.

Allowed conversion metadata is strictly limited to plan, source CTA, step number, and error category. Company names, email, URLs, and free text fail schema validation and must never be sent.

## 11. Pricing/backend consistency

Displayed prices and product codes match the server catalog: Preview $7, Brief $25, Intelligence $59, Premium $129. The server catalog is authoritative. Known content mismatch: Portuguese/Japanese explanatory copy still describes three products in places. Premium advertises capabilities whose catalog flags remain partial or off; Claude must not visually imply automation beyond active entitlements.

## 12. Accessibility

Fixed native required semantics for six backend-required fields, input-label associations, error alert role, language selector names, and `aria-pressed` plan state. Remaining: explicit IDs for tone/region selects, focus-visible styling, larger Sign-in touch target, semantic `<main>`, and localized document `lang`.

## 13. Checkout-readiness map

Pricing CTA → persisted product code/legacy plan → future auth decision → server `/api/checkout` resolves catalog price → payment session → `/success` with job → onboarding continuation/confirmation → authorized pipeline execution. Reuse product catalog, payment gate, checkout schema, job store, and success/cancel routes. Do not trust browser prices or run providers before confirmed payment.

## 14. Files Claude should edit later

- `app/demo-pipeline/page.tsx` for visual CTA, pricing, and progressive form presentation.
- `lib/analytics/conversion-events.ts` only when adding safe funnel stages.
- Localization blocks in the landing component for canonical terminology.
- Endpoint payload builder if the progressive form separates demo from checkout.

## 15. Files Claude should not touch

Discovery/provider/source-intelligence modules, Pilot 1/2 artifacts, payment provider integration, database migrations, product prices/entitlements, `.env*`, or runtime `.leadlens/*` files.

## 16. Tests to preserve

Preserve `conversion-plumbing.test.ts`, product catalog tests, payment-gate tests, demo-safety tests, processing authorization tests, geography contract tests, TypeScript, and production build.

## 17. Founder decisions

Choose the single canonical pre-billing CTA; decide whether the monitor collects email or remains hidden; decide whether onboarding is before or after payment; approve consolidation of company/offer/value-proposition inputs; decide whether exact country is mandatory at first step; and approve canonical retirement of “Snapshot.”
