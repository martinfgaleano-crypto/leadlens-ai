# LeadLens Intelligence — Data Map (Block 0 audit)

Source of truth: repo at commit `17a0dbf`. This document reflects **verified code/schemas**, not aspirations. Where a capability was discussed but not found in code, it is marked `NOT FOUND`.

---

## 1. Current page map — `/admin/intelligence`

| Route | File | Purpose (verified) |
|---|---|---|
| `/admin/intelligence` | `app/admin/intelligence/page.tsx` | "Customer Intelligence". Client component. Feedback-observability counters + observation-only learned-preferences list with Freeze/Revoke. Observation-mode banner. Ranking impact "Off" everywhere. |
| `/admin/intelligence/growth` | `app/admin/intelligence/growth/page.tsx` | Growth Observatory (Growth Index + ML registry). |
| `/admin/intelligence/review` | `app/admin/intelligence/review/page.tsx` | Review Queue. |
| `/admin/intelligence/sources` | `app/admin/intelligence/sources/page.tsx` | Source Access. |
| `/admin/intelligence/source-review` | `app/admin/intelligence/source-review/page.tsx` | Source Review. |

### API routes (all `requireAdmin`-gated, server-side aggregation)
- `GET /api/admin/intelligence/overview` — feedback metrics + `learned_preferences` list. Graceful when migration 031 missing (`migration_missing:true`). Free-text notes never returned.
- `POST /api/admin/intelligence/learn` — runs deterministic preference learner.
- `GET /api/admin/intelligence/growth` — `computeGrowthIndex()` + ML registry (`ml_models`, `ml_dataset_versions`, `ml_predictions`).
- `GET /api/admin/intelligence/review`, `/sources`, `/source-review`.
- `POST /api/admin/intelligence/preferences/[id]/[action]` — freeze/revoke.

---

## 2. Current data-source map

| Concern | Table(s) | Migration | State |
|---|---|---|---|
| Structured feedback | `opportunity_feedback` (`reason_codes`, `normalized_sentiment`, `feature_snapshot`, `versions`, `feedback_dimension`, `commercial_outcome`, `idempotency_key`) | 023 / 031 / 038 / 039 | Applied. ~5 events (low volume). |
| Commercial outcomes | `opportunity_feedback.commercial_outcome` ∈ {progressed, terminal_positive, terminal_negative}; `feedback_dimension` ∈ {research_quality, commercial_outcome, workflow} | 039 | Applied; **near-empty** (no outcome data yet). |
| Learned patterns | `learned_preferences` (obs counts, confidence, effective_confidence, status inferred_weak/inferred_validated/explicit/frozen/revoked, direction, version) | 031 | Applied; observation-only, **ranking impact OFF**. |
| Vault knowledge | `vault_companies`, `vault_signals` (`review_status`), `vault_sources` | 008 / 029 / 034 | Applied. |
| ML foundation | `ml_training_examples`, `ml_labels`, `ml_models`, `ml_dataset_versions`, `ml_predictions` | 032 | **NOT applied / blocked** — growth-index reports `blocked_by_migration_032`. |
| Account memory / anti-repetition | `account_memory` (+ feedback link) | 025 / 026 | Applied. |
| Snapshots (reports) | `snapshot_reports`, search-scope | 024 / 027 | Applied. |
| Institutional snapshots | `institutional_snapshots` | 035 | Applied. |
| Delivery readiness / processing state | `019_delivery_readiness` | 019 | Applied (delivery-state, not the 5-level readiness this program wants). |
| Harness artifacts (non-DB) | `ml/data/pilot-amor-de-gea/<ts>/{segment-universe,staged-pipeline,discovery,manifest}.json` | — | File-based; latest run `2026-07-27T01-35-36-464Z` (21 verified / 29 probable / 114 excluded). |

---

## 3. Existing capability map (implicit in code — no formal registry exists)

| Program capability | Backing code (verified) | Observed mode |
|---|---|---|
| market_interpretation | `lib/reports/market-landscape.ts`, `lib/discovery/market-to-account.ts` (`buildMarketLandscape`) | production (deterministic) |
| buyer_segment_modeling | `market-to-account.ts` (7 segments, `classifyBuyerSegment`, `deriveBuyerSegments`) | production |
| company_discovery | `lib/discovery/segment-universe.ts`, `company-first-discovery.ts` | production (search-title extraction; honest quality limits) |
| entity_resolution | `entity-resolution-v3` (versions block), `company-first-discovery` | production |
| company_verification | `segment-universe.ts` `statusFor` + hardened predicate | production |
| business_model_classification | `commercial-fit.ts` | production |
| structural_account_ranking | `market-to-account.ts` `computeStructuralScores` (separate fit/attractiveness/timing/evidence) | production |
| commercial_accessibility_analysis | `channel-access.ts`, `channel-evidence-contract.ts` | production |
| signal_detection / interpretation | `company-first-discovery` per-company signal search + `opportunity-test.ts` | production |
| temporal_reasoning / what_changed_detection | `lib/memory/change-classifier.ts` (`classifyAccountChange`, `classifyRichAccountChange`, change-since-last-report) | production but **coverage-limited** (dated-signal sparse) |
| counterevidence_analysis | `lib/discovery/counterevidence.*` (test present) | production, low sample |
| cross_account/segment/market pattern detection | **NOT FOUND** (only `learned_preferences`, single-feature) | none / shadow |
| deep_account_research / buying_path_reasoning | **NOT FOUND** (Block 5 of prior sprint, deferred) | inactive |
| client_specific_opportunity_assessment | partial via `premium-intelligence-contract.ts` `assemblePremiumReport` | foundation |
| portfolio_strategy | `premium-intelligence-contract.ts` `PortfolioStrategy` (type only) | foundation (no outcome validation) |
| recommendation_generation | `premium-intelligence-contract.ts` `toRecommendation` (channel-only never act_now) | production |
| confidence_calibration | growth-index / evidence-quality heuristics | partial |
| account_memory / anti_repetition | `lib/memory/account-memory.ts` (`classifyAccountNovelty`, `applyAccountMemoryHints`) | production |
| feedback_learning | `lib/intelligence/preference-learner.ts` + `shadow-preference.ts` | observation/shadow only |
| outcome_learning | 039 columns exist; **no linkage engine** | not_instrumented |
| report_readiness_assessment | `delivery_decision` (deliver/review/do_not_deliver); `lib/quality/actionability-gate.ts` | partial (not 5-level) |

---

## 4. Schema reuse map (existing → reuse → missing → adapter)

| Program entity | Reuse from | Reusable fields | Missing | Adapter / new persistence? |
|---|---|---|---|---|
| maturity dimensions | `growth-index.ts` (`GrowthComponent`, honest states) | score/status/details/insufficient states, maturity level rules | 8 intelligence dims (only 5 growth components), confidence, sample_size, trend | **Typed projection** (new contract, reads existing data). No new table for compute. |
| capability registry | code modules + `_versions` block | version ids, module presence | mode/maturity/evidence/sample fields | **Typed projection** derived from code + artifact evidence. |
| intelligence outputs | `learned_preferences`, market-to-account artifacts | statement, direction, confidence, obs counts | typed output taxonomy, fact/inference separation, novelty/actionability | **Adapter** from learned_preferences + artifacts. |
| patterns | `learned_preferences` | sample size, confidence, status, freeze/revoke | pattern types, counterexamples, commercial meaning | **Adapter** + sample-size gate. |
| validation/outcome | `opportunity_feedback` (+039) | sentiment, reason_codes, commercial_outcome, dimension | linkage output→action→outcome→lesson | **Adapter** (reuse table; no new table needed initially). |
| gaps | derivable from evidence-quality, growth blockers, segment-universe verdicts | blockers already surfaced | gap taxonomy + severity/priority | **Typed projection** (computed). |
| next actions | derivable from gaps | — | prioritization engine | **Typed projection** (computed). |
| report readiness | `delivery_decision`, actionability-gate, premium contract | delivery decision, evidence coverage | 5-level readiness + per-section safety | **Typed projection**. |
| intelligence snapshot / trends | growth-index computed live (NOT persisted) | compute logic | **historical persistence** | **New table `intelligence_index_snapshots`** — the *only* clearly-justified new persistence (trends impossible otherwise). Confirm in Block 2. |

---

## 5. Current instrumentation map

- **Honest-state discipline already exists**: growth-index emits `measured` / `insufficient_evidence` / `blocked_by_migration`; decision_performance requires ≥20 rated events else null. This is the pattern to extend to the 8-dim index.
- **Observation/shadow safety enforced**: `preference-learner` + `shadow-preference` never touch ranking; UI shows "ranking: Off". Must be preserved.
- **Auth**: every API route calls `requireAdmin(req)` and fails closed (503 without Supabase). Server-side aggregation; PII/free-text excluded.
- **No historical snapshotting** of any index → **no real trend is computable today**.

---

## 6. Current gaps (that block the OS)

1. No 8-dimension Intelligence Maturity Index (only 5-component Growth Index).
2. No formal capability registry (capabilities implicit in modules).
3. No intelligence-output or pattern registry beyond single-feature `learned_preferences`.
4. No Intelligence Lift / baseline contract.
5. No output→validation→outcome linkage (039 columns unused).
6. No gap taxonomy, next-best-action engine, or self-knowledge generator.
7. No persisted index snapshots → no trends.
8. Migration 032 (ML) not applied → ML dims stay `blocked_by_migration_032`.
9. Report readiness is delivery-decision only, not the 5-level model.

---

## 7. Metrics calculable **today** (real data)

- Feedback: total events, reason-code distribution, sentiment split, snapshot/version coverage, already-known/weak-explanation %.
- Learned preferences: obs counts, confidence, effective_confidence, status.
- Growth Index components (data_foundation, label_quality, market_coverage, decision_performance*, learning_velocity) — *decision_performance needs ≥20 rated events.
- Vault counts; distinct regions/industries.
- Segment-universe artifact metrics; market-to-account staged metrics + reason codes.
- Evidence quality, account novelty, change classification (what-changed) — where dated data exists.

## 8. Metrics **not measurable today** (must be `not_measured` / `not_instrumented`)

- Differentiation, Client Specificity, Temporal Intelligence (sparse dates), Outcome Performance (no outcomes), Intelligence Lift (no baselines).
- Any trend (no persisted snapshots).
- Cross-account/segment pattern confidence (no registry, insufficient sample).
- 5-level report readiness distribution.

---

## 9. Minimal architecture proposal

- Add **typed contracts** (Block 1) for the 8-dim index, capability, output, pattern, validation, gap, action, readiness, snapshot — all **reading existing data**, emitting explicit honest states. No broad migrations.
- Add a **deterministic snapshot engine** (Block 2) that assembles the above from real data; persist **only** `intelligence_index_snapshots` for trends (confirm need in Block 2).
- Adapters (Blocks 3–4) over `learned_preferences`, market-to-account artifacts, `opportunity_feedback`/039.
- Rebuild Admin (Block 5) on the snapshot contract with intelligent empty states.

## 10. Block-by-block plan
See `LEADLENS_INTELLIGENCE_OS_ARCHITECTURE.md` §Implementation.
