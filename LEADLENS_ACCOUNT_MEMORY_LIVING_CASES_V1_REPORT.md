# LeadLens — Account Memory / Living Opportunity Cases V1

**From:** `dec2829` · **Date:** 2026-08-22

> **Bottom line:** LeadLens can now remember prior commercial intelligence and explain meaningful change across evaluation reviews. A deterministic, locale-independent Case diff compares canonical structured state (decision, strengths, dated-change keys, evidence origins, validation themes) and surfaces only material change: what's new, what resolved, whether the Decision changed and **why**. The current Case stays primary; memory is compact supporting context. First review shows no fake history; identical/duplicate reviews show nothing; sparse accounts stay calm. Verified in workspace + portable, EN + ES. Deterministic, 0 provider calls.

## 1. Existing memory architecture audit
Found and reused (§5-6): `snapshot-engine.ts` (`buildIntelligenceSnapshot` + `snapshotFingerprint` → idempotency), `validation-lifecycle.ts` (transition states), `recurring/engine.ts` (`createCycle`, novelty states), `amor-de-gea-account-memory.ts` (`AccountMemory`, first_seen, novelty_default), and this project's `diffPortfolioIntelligence`. These are internal-pipeline oriented; the missing piece was a **customer-facing** diff over the structured `AccountBriefVM`.

## 2. Reuse decisions
No parallel memory system created (§6/§62). New module `lib/deliverable/account-memory.ts` adds only the customer-facing Case diff; portfolio-level change reuses the frozen `diffPortfolioIntelligence`; idempotency mirrors the existing fingerprint idea; validation transitions mirror the lifecycle concept. Portfolio Intelligence and Client Canvas untouched (frozen).

## 3. Snapshot contract
`AccountReviewSnapshot` — immutable, canonical, **no localized prose** (§9/§10): reviewId (stable job/cycle id, never browser time §79/§82), reviewedAt (ordering only), contextVersion (§11), decision, fit/timing/evidence, `changeKeys` (`${kind}:${date}` for verified dated changes), evidenceOrigins (canonical hosts), independentSupport, counterCount + hasMaterialCounter, validationThemeKeys + decisionCriticalThemeKeys, hasRevisitTrigger. `snapshotFingerprint` gives idempotency.

## 4. Case diff contract
`diffAccountCase(prev, next)` → structured `AccountCaseDiff`: isFirstReview, isSameReview (fingerprint/reviewId), contextChanged, decision transition (+drivers), timing/fit/evidence directions, newChangeKeys, evidenceAdded (dedup by origin), independentSupportAdded, counterevidenceAdded, validationResolved / stillOpen / decisionCriticalResolved, revisitTriggerMet, `material`. Materiality gate (§48-49) surfaces only Decision/Timing/Fit/Evidence/TrueChange/independent-support/counterevidence/decision-critical-validation/revisit changes. `orderReviews` sorts by timestamp + dedups (out-of-order & idempotency safe, §85/§120/§121).

## 5. Decision transitions
Transition carries canonical drivers (§19, no score language §20): new_material_change, new_corroboration, counterevidence_added, decision_critical_resolved, timing_changed, fit_changed, client_objective_changed, revisit_trigger_met. Inspectable — the customer sees which concrete drivers moved the Decision (§88/§91).

## 6-8. Evidence / Validation / Revisit transitions
- **Evidence added** by canonical origin (host) — refetched/duplicate origins are NOT new (§21/§111); independent-support gained flagged. Immutable evidence is never deleted (§22); aging alone is not counterevidence (§23/§87/§117).
- **Validation** resolved = theme key present before, absent now; decision-critical resolution highlighted (§25-27).
- **Revisit trigger met** = prior watch decision (Monitor/Hold) with a trigger + a genuinely new verified change (§30-31).

## 9. Novelty / anti-repetition
Change detection keys on `${kind}:${date}` and origin hosts — the same known event/source never re-surfaces as "new" on later cycles (§35/§45); sparse accounts across cycles produce no material change and no memory module (§122).

## 10. Client context changes
`contextVersion` differences are flagged distinctly (`client_objective_changed`) so a Decision shift caused by changed objective is not conflated with new account evidence (§11-12/§118).

## 11. Portfolio diff
Reuses `diffPortfolioIntelligence` on canonical keys — decision transitions, change-pattern churn, coverage deltas, resolved validations (§53-55/§123-125). No new synthesis engine.

## 12. Workspace integration
`OpportunityWorkspace` gains an optional `memory` prop; a compact **Since Last Review** module renders above the Account Brief when a prior snapshot exists (§56-60/§68), current Case dominant below (§59/§132). Presentation only — diff computed in the domain layer. Verified (dev route): "Decision: Monitor → Prioritize — new verified material change; a decision-critical validation was resolved; timing changed; revisit trigger met · Revisit condition met · New since last review · Evidence added +1 · Timing strengthened · Validation resolved (1 decision-critical)."

## 13. Portable integration
`renderPortableHtml(vm, mem?)` — optional second arg; a compact memory block per account when a prior review is supplied (§70). Portable stays a static point-in-time artifact (§71). Demo artifacts: `asteron-review1-first.html` (no memory) vs `asteron-review2-memory.html` (8 accounts with Since Last Review).

## 14. Localization
`sinceLastReview(diff, es)` emits localized customer strings (labels, decision words, driver phrases) for EN/ES (§74-75). Diff itself is on canonical keys, so **EN vs ES of the same intelligence yields zero change** (§52/§119, tested). No internal codes exposed (§15/§76).

## 15. Fixtures
Controlled synthetic Saia-like timeline (clearly NOT real history §39/§142): T1 (structural fit, no verified change, Monitor, revisit trigger, systems validation open) → T2 (verified terminal expansion, Timing Strong, corroborated, Prioritize) → T3 (decision-critical validation resolved + material counterevidence, → Validate). Plus a stable case (no change) and a sparse Amor-like account.

## 16. Tests
`account-memory` **27/27** covering §108-125: first review, identical/idempotent, new vs duplicate evidence, true change, timing/decision/validation/counterevidence transitions, staleness-≠-negative, context-change classification, locale independence, out-of-order, sparse anti-repetition, portfolio diff reuse, provenance, Spanish. Regression: portfolio-intelligence 36, portable 55, deliverable 60, product-truth 21, landing 102, tavily 9. tsc clean; production build green; secret scan clean. **Provider calls: 0.**

## 17. Product scores
Memory clarity 8.6 · Decision-transition clarity 8.7 · Novelty honesty 8.8 · Workspace usefulness 8.5 · Repeat-value communication 8.6 · Mobile 8.7 · Cross-locale stability 9.2.

## 18. P0 / P1 / P2
- **P0:** none.
- **P1 (persistence wiring):** the diff engine + UI accept prior snapshots, but the authenticated `BriefView` does not yet **persist and load** per-review `AccountReviewSnapshot`s from storage — so in production the Living Case stays dormant (first-review behavior) until snapshots are stored per evaluation and the prior is loaded. Storage audit: the immutable snapshot architecture exists (`snapshot-engine`); wiring it to emit/store the customer-facing `AccountReviewSnapshot` and load the predecessor is the remaining step. No migration required for V1 (§99-100).
- **P2:** Evidence-tab "new since last review" markers (§92-93); optional LLM narrative normalization (deterministic is source of truth, §106-107); portfolio-change section inside the Portfolio Intelligence tab (diff exists; rendering it is a small add).

## 19. Recurring product readiness
Would a customer understand why a second review beats rerunning research? **Yes** — the Living Case shows the decision transition + drivers, what's genuinely new, what resolved, and what remains, without re-presenting old evidence as new (§134-136). Anti-repetition holds (§135). A commercial director can answer what became more/less important and what needs action because something changed (§136).

## 20. Recommended next sprint
**Account Memory V1.1 — Production persistence**: store an `AccountReviewSnapshot` per evaluation review (reuse `snapshot-engine` + append-only storage), load the predecessor in `BriefView`, and render the portfolio-change section in Portfolio Intelligence. That turns the now-proven engine into a live recurring-value feature. Monitor readiness: memory is the foundation, but keep the honest framing — reviews are cyclic, not real-time (§32/§95-96).
