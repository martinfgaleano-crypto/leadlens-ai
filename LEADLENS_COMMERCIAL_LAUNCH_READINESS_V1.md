# LeadLens Commercial Launch Readiness V1

Audit date: 2026-08-11  
Initial/local HEAD: `d61ed5fe290ed141b6ecc1629bd05a8d1acc704c`  
Production: https://leadlensintel.com

## 1. Current HEAD

Local HEAD and `origin/main` both equal `d61ed5f`. The pre-existing runtime diffs in `.leadlens/source-intelligence.json` and `.leadlens/usage.json`, plus the untracked landing audit, were not modified.

## 2. Production state

Production is behind the conversion-plumbing commit: it lacks the new `#how-it-works` anchor and native required controls. The readiness audit remains valid locally; no payment or provider calls were made.

## 3. Current commercial funnel

Landing CTA → `goToForm(plan, source)` → either public Lemon checkout URL (when public env URLs are enabled) or in-page pending onboarding → no paid submission. The sample path uses `/api/demo`, which is production-closed unless `DEMO_MODE=true`. A separate legacy SaaS path exists: payment webhook → `orders` + SaaS `jobs` → optional email-to-profile match/credits → most recent pending `lead_search` → internal processing → delivery package/email. A separate Stripe path creates `batch_jobs`, verifies webhook payment, and has success/cancel pages. These paths are not one coherent funnel.

## 4. Desired paid funnel

Plan selection → authenticate/create account → create persisted commercial intent server-side → checkout provider session/reference → verified webhook → paid order + entitlement bound to user → post-payment onboarding → explicit readiness gate → queued job → pipeline → review/delivery → ownership-protected report/dashboard.

## 5. Pre/post-payment data

Pre-payment should require only authentication/email and server-selected product code; optionally retain non-sensitive acquisition source. Post-payment collects company name, offer summary, target customer, exact countries, objective, known accounts/exclusions, and delivery confirmation. Remaining refinements can follow progressively. Do not collect long business context before payment.

## 6. Plan state contract

Canonical input: `{ product_code, catalog_version, source_cta }`. The server resolves display name, legacy plan, price, currency, billing type, limits, and capabilities from `lib/products/catalog.ts`. Browser price, entitlements, paid status, and quotas are never authoritative. Persist both immutable product code/version and resolved legacy plan for pipeline compatibility.

## 7. Entitlement architecture

The versioned product catalog is a good server authority for product capabilities. Runtime entitlement for customer monitor access instead derives from mutable `profiles.plan` or credits. Legacy webhooks grant lead-count credits (5/25/50/100), while the current catalog promises opportunity targets (2/6/12/18). There is no verified order-to-entitlement record bound to a user. Readiness is partial.

## 8. Product truth matrix

| Product | Price | Catalog permission | Current delivery truth | Gap | Safe today |
|---|---:|---|---|---|---|
| Preview | $7 | 2 opportunities, mini verdict, standard evidence | pipeline can target 2; no coherent paid ownership/delivery | checkout, owner, upgrade continuity | No |
| Brief | $25 | 6 opportunities, basic portfolio/evidence center | pipeline target exists; delivery path fragmented | paid gate and fulfillment contract | No |
| Intelligence | $59 | 12, 4 deep dossiers, full evidence/portfolio | several portfolio features partial | capability truth and paid lifecycle | No |
| Premium | $129 | 18, 6 deep, strategy/playbooks/watchlist | strategy, reinforced evidence, playbooks/watchlist flagged partial/off | material promise gap | No |

## 9. Preview readiness

**NO / YES_WITH_GAPS technically**: coherent as a one-time catalog product and pipeline limit, but not safe to sell until user ownership, post-payment intake, entitlement activation, delivery, failure recovery, and upgrade linkage exist. It must not be treated as recurring.

## 10. Billing code inventory

Present: Lemon checkout URL envs, Lemon variant envs, signed Lemon webhook, Stripe checkout route/client, Stripe webhook, payment fail-closed gate, orders/intakes/jobs/reports tables, credits, success/cancel pages, provider-status/settings screens. Dead/stale elements: old $29/$79/$149 amounts, lead-count product descriptions, conflicting provider readiness, public direct-link checkout bypass, and multiple success pages.

## 11. Checkout contract

Minimum future interface: `createCheckout({ user_id, product_code, source_cta, return_url, idempotency_key })`. Response: `{ commercial_intent_id, provider, checkout_url, status }`. Server resolves catalog and attaches provider metadata containing opaque intent/user identifiers—not price or entitlement from the client.

## 12. Payment states

Use `NOT_STARTED → CHECKOUT_CREATED → PAYMENT_PENDING → PAID | PAYMENT_FAILED | CANCELLED → REFUNDED`. Separate order/payment state from analysis/delivery state. Subscription states belong in a later contract.

## 13. Trust boundary

Never trust browser-supplied price, currency, entitlement, plan capabilities, paid status, quotas, customer identity, or provider success query parameters. Verify provider signature/event, provider checkout/order identity, amount/currency against immutable catalog, user binding, and event uniqueness server-side.

## 14. Webhook requirements

Require signature verification in every environment except isolated tests, raw event persistence, unique provider event ID, transactional idempotency, explicit event schemas, out-of-order reconciliation, retryable 5xx on persistence failure, unknown-product rejection, amount/currency verification, and no pipeline trigger until ownership/payment/intake gates pass.

## 15. Entitlement activation

Only a verified `PAID` order may activate a product entitlement. Persist `user_id`, product code/version, order/payment reference, state, starts/ends timestamps if applicable, and provenance. Current email-match/credits approach is not sufficient and must not grant premium access from a client-selected plan.

## 16. Auth/purchase order

Recommended: **partial before / mostly after payment**, with account authentication before checkout. Existing reports, searches, notifications, credits, and dashboards are user-scoped; guest checkout adds reconciliation risk. Auth-first is the least disruptive path.

## 17. Paid report ownership

Modern snapshot reports are protected through `search_id → lead_searches.user_id`. Legacy SaaS `reports` are admin-only because `orders/jobs/reports` lack `user_id`. Paid launch must write verifiable ownership at intent/order/job/report creation; job IDs or emails must never be access tokens.

## 18. Commercial owner model

Use authenticated `user_id` as launch owner and retain optional `customer_account_id`/organization migration room. Entitlement belongs to the customer account/user, not an ephemeral job. Order, intake, job, and report reference that owner.

## 19. Idempotency

Use one unique key for checkout intent creation, provider event ID for webhooks, provider checkout/order ID uniqueness, one job per order/product fulfillment, and an execution claim/state transition. Success redirects are read-only and must never activate payment or rerun work.

## 20. Pipeline execution gate

Required predicate: authenticated owner + verified paid entitlement + complete/validated intake + product resolved server-side + job state `queued` + idempotent execution claim. Run asynchronously. Optional admin/human approval may remain for initial beta, but should be explicit per job.

## 21. Cost exposure

Public `/api/demo` fails closed unless global `DEMO_MODE=true`; `/api/process` is admin-only; search processing requires ownership/internal authorization; monitor runs check entitlement. Therefore unpaid production users cannot normally trigger provider work. Risk becomes high if production ever enables `DEMO_MODE=true`, or if legacy Lemon webhook automatically triggers an unrelated most-recent pending search after email matching.

## 22. Abuse protection

Events and demo routes are rate-limited. Checkout currently lacks a dedicated creation rate limit/idempotency contract. Future intent/checkout endpoints need authenticated per-user/IP limits. Webhooks need payload caps and event-schema validation. Pipeline gates are generally strong outside the legacy billing bridge.

## 23. Delivery lifecycle

Reuse existing concepts as one normalized lifecycle: `ORDER_ACCEPTED → ANALYSIS_QUEUED → ANALYSIS_PROCESSING → READY → NEEDS_REVIEW → DELIVERED`, with `FAILED` available at processing/delivery. Current SaaS job and snapshot states can map to this; do not build another parallel lifecycle.

## 24. Delivery expectations

The product is asynchronous, not instant. Existing customer page says 15–45 minutes for processing, while marketing/success pages say 24–48 hours and one legacy page says payment at delivery. These are contradictory. Initial paid beta should promise a founder-approved service window with review, not an unverified automated time.

## 25. Notification readiness

Resend delivery email, signed delivery packages, in-app notifications, and failure-visible admin state exist. Missing: canonical purchase confirmation, onboarding confirmation, processing-delay/failure customer notices, verified support identity, and unified templates for the current account-intelligence product.

## 26. Customer success state

Reuse authenticated dashboard plus `/results/[jobId]` once ownership is guaranteed. Success page should show verified order state, required onboarding step, delivery status, support path, and dashboard link. It must not trust URL query parameters as proof of payment.

## 27. Failure/recovery

Missing or fragmented: abandoned checkout recovery, payment failure state, webhook reconciliation, unmatched customer, incomplete intake reminder, delayed job communication, automated rerun/review workflow, refund-to-entitlement revocation, and duplicate checkout handling.

## 28. Upgrade readiness

Catalog and Account Memory provide analytical foundations, but commercial upgrade linkage is absent. Store parent order/report/entitlement references and reuse accepted context and known accounts; never create a totally fresh customer identity. Not launch-ready.

## 29. Recurring plan readiness

All four catalog products are explicitly one-time. Opportunity Monitor is “coming soon” and recurring infrastructure is incomplete. Do not sell it as a subscription yet.

## 30. Cancellation/downgrade

One-time products need cancel-before-payment and refund states, not downgrade. Future subscriptions should keep access through paid term, stop future runs after cancellation/failed grace period, retain historical reports, and never delete customer intelligence automatically.

## 31. Analytics contract

Existing CRO events are safe. Future events: `checkout_created`, `checkout_abandoned` (derived server/client timeout), `payment_success`, `payment_failure`, `entitlement_activated`, `pipeline_started`, `report_ready`, `upgrade_started`, `upgrade_completed`. Metadata: product code, source CTA, stage, non-sensitive error category, opaque intent/order IDs. Payment success is server-only.

## 32. Commercial funnel data model

Add a lightweight `commercial_intents`/`checkout_intents` record. Existing `orders` starts at paid and cannot represent abandoned/pending checkout safely. Minimum fields: id, user_id, product_code/version, provider, provider_checkout_id, status, source, idempotency_key, timestamps. Orders remain immutable verified purchases.

## 33. SEO audit

Title, description, canonical, OG, Twitter card, robots, sitemap, favicon, and indexability are present. Technical status is good. Metadata language still emphasizes “contact first” and Snapshot rather than current account-opportunity positioning; this is content alignment, not a technical blocker. Landing has an H1; dynamic language does not update document `lang`.

## 34. Social sharing audit

LinkedIn/X/WhatsApp-compatible OG title, description, and 1200×630 `/api/og` image are configured and visible in production. The image endpoint should be visually checked by Claude; copy is semantically stale but functional.

## 35. Future env/config

Required categories: `PAYMENTS_ENABLED`, selected `PAYMENT_PROVIDER`, provider test/live API credential, webhook signing secret, product/variant IDs or server-side mapping, canonical app/return URL, Supabase service configuration, internal run secret, Resend key/from identity. Never expose secret/provider state through `NEXT_PUBLIC_*`; public checkout URLs should not be the canonical paid architecture.

## 36. Test/staging strategy

Local: provider SDK mock + webhook fixtures. Preview deployment: payment sandbox/test mode, isolated test products, isolated webhook secret and database namespace/project, no production providers. Production: explicit dual enable gate, live product mapping, one low-value founder transaction, verified webhook/entitlement/delivery, then controlled beta. Test and live event IDs must never share storage uniqueness domains accidentally.

## 37. Migration requirements

Yes. Minimum likely migration: `commercial_intents`; `user_id` and immutable `product_code/product_version` on orders/jobs/reports; verified payment state/event table or hardened order fields; unique provider event/checkout indexes; entitlement table linked to owner/order/product; idempotency indexes. Existing customer migration can be nullable/backfilled and legacy rows remain admin-only.

## 38. Blockers by severity

**P0:** no canonical authenticated intent→payment→entitlement→job chain; paid ownership missing on legacy SaaS records; stale/conflicting billing paths; webhook unknown variant defaults to Starter and does not verify catalog amount; direct public checkout links bypass state; no transactionally idempotent entitlement activation.  
**P1:** Premium promise gaps; contradictory delivery times; incomplete failure/reconciliation; missing checkout rate limit; stale success/cancel content; no canonical confirmation email; production behind current conversion commit.  
**P2:** upgrade continuity, analytics sink/dashboard, support automation, organization ownership, localized metadata.  
**P3:** subscription lifecycle, advanced churn/recovery, billing optimization.

## 39. Minimum paid launch

Deploy current conversion plumbing; choose one provider; implement authenticated commercial intent; server catalog resolution; sandbox checkout; verified idempotent webhook; owner-bound order/entitlement; post-payment six-field onboarding with exact countries; paid execution gate; one async lifecycle; authenticated result; confirmation/ready/failure communication; refund handling; rate limits; E2E test transaction; accurate tier copy. Initially sell only Preview/Brief unless higher-tier capabilities are proven.

## 40. Readiness scores

| Area | Current | After minimum billing sprint |
|---|---:|---:|
| Checkout | 2/10 | 8/10 |
| Entitlement | 4/10 | 8/10 |
| Auth | 6/10 | 8/10 |
| Onboarding | 5/10 | 8/10 |
| Pipeline gating | 7/10 | 9/10 |
| Delivery | 5/10 | 8/10 |
| Failure recovery | 3/10 | 7/10 |
| Analytics | 7/10 | 8/10 |
| Security/abuse | 6/10 | 8/10 |
| Upgrade | 3/10 | 5/10 |

## 41. CODEX next

Build provider-neutral commercial intent/payment contracts; minimal migration; owner-bound entitlement; hardened webhook adapter and event ledger; execution gate; endpoint rate limits; payment/delivery state machine; fixture/E2E sandbox tests; ownership and refund tests. Do not begin until founder chooses provider and auth/payment order.

## 42. CLAUDE next

After the technical contract is fixed: progressive post-payment onboarding UI, honest CTA/pending state, success/failure/status experiences, canonical terminology, pricing truth corrections, mobile/accessibility polish, and refreshed social image/copy. No changes to server trust decisions.

## 43. Founder decisions

Choose payment provider; auth-before-checkout approval; which tiers launch first; whether Preview is paid or diagnostic; exact reviewed delivery SLA; human-review requirement; refund/redelivery policy; support email/domain; whether Monitor remains hidden; whether organizations are deferred; approval to deprecate legacy Lemon/Stripe paths rather than maintain both.

## 44. Exact recommended next technical sprint

**Commercial Intent + Verified Entitlement Foundation**: provider-neutral intent schema, server catalog contract, authenticated ownership, idempotent payment-event ledger, entitlement activation, paid execution gate, sandbox-only adapter, and E2E fixtures. Do not connect live credentials or enable production payments in that sprint.

## 45. Non-negotiable localization rule

All future commercial implementation must follow `docs/LOCALIZATION_RULES.md`: expand `ICP` locally on first use in each user context, never leak an English definition into translated UI, and preserve internal identifiers.
