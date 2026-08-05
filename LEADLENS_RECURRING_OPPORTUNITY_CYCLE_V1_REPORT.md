# LeadLens — Recurring Opportunity Cycle V1

Reusable foundation that turns LeadLens from one-time reports into a recurring account-opportunity system: Account Memory, memory events, outcomes, anti-repetition/novelty, What Changed, and the monthly Opportunity Cycle. **No provider calls, no new search, no client contact, Pilot 1 untouched, Pilot 2 not executed.**

## 1. Initial HEAD and Git state
HEAD `d80c26e` (`feat: release final Amor de Gea Pilot 1 package`), branch `main`, origin in sync; working tree clean except the intentional `.leadlens/*.json` runtime files.

## 2. Production state
`/login` → 200; Admin protected; Amor de Gea Pilot 1 accessible and unchanged; Pilot 2 `PLANNED — NOT AUTHORIZED`.

## 3. Scope
Account Memory · Memory events · Outcome capture · Anti-repetition/novelty · What Changed · Opportunity Cycle · Pilot 2 readiness. Client-agnostic models; Amor de Gea is a seeded instance. No cycle executed.

## 4. Account Memory model
`lib/intelligence/recurring/model.ts` — `AccountMemory` with identity (canonical id/name, alternate names, domain, geography, route, entity type, parent), first-seen (date/cycle/source/run/route/status), append-only historical decisions, evidence memory (facts+source+date+freshness, signals, inferences, counterevidence, unknowns, stale), commercial memory (buyer function, decision structure, procurement, initial test, recurrence, cycle, logistics, size/route fit), client relationship states, outcome summary, review memory (last/next review, priority, reopen condition, suppression), reappearance state and default novelty.

## 5. Memory event model
`AccountMemoryEvent` — 24 event types (`MEMORY_EVENT_TYPES`): discovered, identity_resolved, qualified, prioritized, lowered, excluded, monitored, delivered, client_relationship_recorded, outcome_recorded, buyer_path_confirmed/rejected, evidence_added/expired/contradicted, signal_detected/expired, blocker_added/resolved, reopened, suppressed, reconsidered, removed, client_feedback_applied. Each event carries id/account/tenant/client/cycle/type/timestamp/actor/source/previous+new state/reason/evidence-ref/note. `appendEvents` is append-only (dedup by id across batches, time-sorted, never overwrites).

## 6. Outcome taxonomy
`AccountOutcome` — 28 statuses across pre-action/action/response/commercial groups + 17 learning reason codes (`OUTCOME_STATUSES`, `OUTCOME_REASONS`). Every outcome supports date, account, cycle, client, actor, primary status, reason + secondary reason, notes, evidence/statement, follow-up date, confidence, buyer-path (confirmed/rejected), route hypothesis (supported/unsupported), and `changes_future_recommendation`.

## 7. Outcome capture
API `app/api/admin/intelligence/pilots/[pilotId]/outcomes/route.ts` (POST/GET): `requireAdmin` → `canonicalPilotId` 404 → deterministic `validateOutcome` (rejects invalid status/reason) → append to `intelligence_account_events`. **Fail-closed 503** when the durable store (migration 048) is not applied (outcome validated, never fabricated). GET returns `awaiting_real_outcomes` when empty — never a misleading zero-performance metric. Admin form in `pilot-recurring-cycle.tsx` (manual entry, no CRM).

## 8. Anti-repetition policy
10 novelty states + 12 meaningful-change conditions (`NOVELTY_STATES`, `MEANINGFUL_CHANGES`). An account cannot be presented as new if it appears in prior memory. **Rediscovery alone is not a meaningful change** (rule R5/R7). Old accounts reappear only via a meaningful change (signal, business change, new route/mechanism, blocker resolved, evidence repaired, client request, outcome reinterpretation, procurement viable, buyer path clearer, timing event, route-priority change).

## 9. Novelty decision trace
`decideNovelty()` returns a `NoveltyDecisionTrace` for every candidate: canonical id, prior appearances, prior delivery/exclusion state, prior outcomes/evidence, latest meaningful change, decision, eligible-as new/update/reconsidered, suppression reason, and the **exact rule applied** (R1–R7). No account is labeled new without this trace.

## 10. What Changed model
`buildWhatChanged()` compares cycles/memory/outcomes/evidence/signals across 5 categories (account, evidence, commercial, client, signal) with the full change-type taxonomy (`CHANGE_TYPES`). Each item carries previous/current state, evidence, reason, effect on priority + next action, and customer-safe wording.

## 11. Customer-safe What Changed
`WhatChanged.internal` (rule ids, deltas) vs `customer_safe` (what / why it matters / recommendation / uncertainty). `isCustomerSafe()` asserts no internal tokens (`WC:`, `R\d:`, rule_applied, reason_code, blueprint, compiler, provider, confidence, counterevidence) leak to the client version.

## 12. Opportunity Cycle object
`OpportunityCycle` + `createCycle()` — cycle id/tenant/client/number/name/dates/status, prior-cycle link, accepted context + blueprint versions, memory/feedback/outcome snapshots, novelty policy version, monitored/new-candidate/final-portfolio/updated/removed sets, What Changed, briefs, report artifact, delivery/feedback/closure. 15 states (`CYCLE_STATES`); **searching not activated** this sprint.

## 13. Amor de Gea memory baseline
`lib/intelligence/amor-de-gea-account-memory.ts` — **15 records** seeded deterministically from the Pilot 1 modules (phase4 evidence + phase4-5 verdicts + finalization). 10 active accounts → `delivered` / `previously_delivered`; 5 inactive with founder-approved reappearance states. First-seen cycle `amor-de-gea-cycle-1`. No outcomes fabricated (all `awaiting`).

## 14. Account consolidation
`consolidateIdentity()` — deterministic, conservative: merges only on a shared non-social official domain (high confidence); refuses to merge on name similarity alone when domains conflict or are absent (records the rejected merge + reason). Handles www/protocol/social-domain normalization and accents.

## 15. Reappearance policy
Seeded DATA (never hardcoded in the engine): active/delivered → `do_not_repeat`; BioPlaza → `eligible_if_evidence_repaired`; Distribuidora DAM → `monitor_only`; Hotel Spa La Colina → `eligible_if_evidence_repaired`; Tu Tienda Saludable → `permanently_excluded` (unless business model materially changes); Somos Consiente → `permanently_excluded` (unless a repeatable purchasing mechanism is evidenced). Each carries a reopen condition + suppression reason.

## 16. Learning recommendations
`LearningRecommendation` — deterministic layer that **only recommends** (never rewrites ranking); each recommendation carries supporting outcomes, account count, cycle refs, confidence, counterevidence, proposed change and `human_approval_required: true`.

## 17. Route-level learning
`aggregateRouteLearning()` / `routeLearningReport()` over specialty_retail / hospitality_spa / gifting_cobranding / distribution / other. With no data → `awaiting_real_outcomes` (no misleading zeros). With data → recommended/selected/contacted, response rate, buyer-path confirmations, objections, opportunities/tests/orders/losses, blockers, evidence quality.

## 18. Pilot 2 readiness
`AMOR_PILOT2_READINESS` — state `PLANNED — NOT AUTHORIZED`, **0 accounts**, `provider_calls: 0`. References Pilot 1 delivered/excluded/monitored sets, unresolved questions, feedback + outcome placeholders, anti-repetition + novelty + What Changed + cycle versions. 10-item activation gate: **9/10 met**, blocked only on explicit founder approval (`activation_ready: true`, `authorized: false`). `next_cycle` links `prior_cycle_id`.

## 19. Admin changes
Compact **RECURRING OPPORTUNITY CYCLE** panel mounted inside the existing pilot overview (no new top-level dashboard): memory counters (total/delivered/suppressed/monitored/excluded), per-account reappearance + novelty + reopen condition, route learning (awaiting), Pilot 2 activation gate, and a manual outcome-capture form. Pilot 1 Delivery Center unchanged.

## 20. Persistence
Reusable models are deterministic TS (mirroring the existing `amor-de-gea-*` modules); the legacy `account_memory` lead-pipeline table is untouched. Durable events/outcomes use a single append-only table.

## 21. Migration
`supabase/migrations/048_recurring_opportunity_cycle.sql` — append-only `intelligence_account_events` (memory events + outcomes, discriminated by `kind`), RLS on, `select+insert` to `service_role` only (no update/delete), indexed by (client, account), (client, cycle), tenant, occurred_at; rollback note included. **Generated, NOT applied** — founder approval required; until applied, capture returns 503 (validated, not persisted).

## 22. Tests
`test:recurring-cycle` — **50 checks**: canonical identity, alternate-name/duplicate handling, append-only events, historical decisions, seed (10 delivered / 5 inactive / first-seen / exclusion reasons), outcome taxonomy completeness + valid/invalid capture + buyer-path/follow-up, anti-repetition (delivered blocked as new, rediscovery ≠ change, meaningful change → update, evidence repair/client request → reconsider, permanently-excluded stays suppressed), novelty trace, What Changed (new/promoted/lowered/removed/evidence/outcome) + customer-safe isolation, cycle links/snapshots, Pilot 2 planned + 0 accounts, Pilot 1 unchanged, no provider calls, route learning awaiting, and API auth/tenant/validation/fail-closed. Regression: `amor-pilot1-finalization/-delivery/-content` green.

## 23. TypeScript
`npx tsc --noEmit` clean.

## 24. Build
`npm run build` (production) succeeded — new `/api/.../outcomes` route + Admin panel compiled.

## 25. Files changed
New: `lib/intelligence/recurring/{model,engine,index}.ts`, `lib/intelligence/amor-de-gea-account-memory.ts`, `app/api/admin/intelligence/pilots/[pilotId]/outcomes/route.ts`, `app/admin/intelligence/pilots/[pilotId]/pilot-recurring-cycle.tsx`, `supabase/migrations/048_recurring_opportunity_cycle.sql`, `scripts/fixtures/recurring-opportunity-cycle.test.ts`, this report. Modified: `app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx` (+panel mount), `workspace.module.css` (+panel styles), `package.json` (+test script), checkpoints.

## 26. Commit
`feat: build recurring opportunity cycle foundation`.

## 27. Push/deployment
Push via GitHub Desktop (no CLI push credentials). Runtime code (API + panel) deploys on push; migration 048 stays unapplied pending founder approval.

## 28. Exact founder decision required
(a) Approve applying migration 048 to enable durable outcome/event persistence; (b) when real outcomes exist and the 10th gate item is approved, authorize Pilot 2 execution.

## 29. Exact Pilot 2 activation event
`AMOR_PILOT2_READINESS.state` moves from `PLANNED — NOT AUTHORIZED` to `READY FOR FOUNDER AUTHORIZATION` when gate items 1–9 hold (they do) **and** the founder explicitly approves execution (item 10). Execution itself remains a separate, unauthorized step.

## 30. Stop confirmation
Account Memory, memory events, outcome capture, anti-repetition, traceable novelty, What Changed and the cycle object all exist; the Amor de Gea baseline is seeded; Pilot 2 references memory but is unexecuted with 0 accounts; no provider calls; no new search; Pilot 1 unchanged; tests + tsc + build pass; one commit. Pilot 2 not started.
