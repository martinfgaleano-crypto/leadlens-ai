# LeadLens Intelligence OS — Architecture (Block 0)

Companion to `LEADLENS_INTELLIGENCE_DATA_MAP.md`. Defines the target architecture and the controlled block plan. Source of truth: commit `17a0dbf`.

---

## Purpose

Turn `/admin/intelligence` from a feedback-observability page into the **Intelligence Command Center**: make LeadLens intelligence *measurable, evidenced, governable and improvable* — and keep **knowledge** (stored) visibly distinct from **intelligence** (reasoned), **validation** (confirmed), and **improvement** (next).

Non-goal for this program: Amor de Gea report redesign, PDF/Brief, billing, public landing. Amor de Gea stays only as a real-artifact test dataset.

---

## Four-layer model (must be explicit in domain + UI)

1. **Knowledge** — vault companies/signals/sources, account memory, snapshots, feedback records, artifacts. *Never presented as intelligence by itself.*
2. **Intelligence** — patterns, market interpretations, counterevidence, prioritization, hypotheses, client-specific recommendations.
3. **Validation** — human review, client relevance, action taken, meeting/proposal/win/loss, hypothesis confirmed/refuted.
4. **Improvement** — knowledge/evidence/reasoning/learning/capability gaps → prioritized next actions.

---

## Maturity model (5 levels) + Index (8 dimensions)

- Levels: Retrieval → Structured Knowledge → Analytical → Strategic → Adaptive.
- **Do not hardcode the level.** Compute/defend from evidence. Current *estimate* (to be proven, not asserted): **Level 2 → early Level 3**.
- Index dimensions: Analytical Depth, Differentiation, Evidence Integrity, Commercial Relevance, Client Specificity, Temporal Intelligence, Learning Maturity, Outcome Performance.
- Each dimension returns: score **only when measurable**, score-state, confidence, sample size, methodology, evidence, limitation, trend, next improvement, last-calculated, version.
- Score states: `measured | not_measured | insufficient_evidence | not_instrumented | blocked | no_observations | shadow_only`.
- **Anti-inflation (hard rules):** volume ≠ maturity; passing tests ≠ maturity; schema existence ≠ maturity; unvalidated LLM ≠ outcome; shadow ≠ production; uncorroborated → lowers Evidence Integrity; missing outcomes → `not_measured`, never a neutral/positive number; no unsupported decimal precision.

The existing `growth-index.ts` is a **precedent, not the index** — it already models honest `insufficient_evidence`/`blocked_by_migration` states and demanding maturity rules. The new 8-dim index reuses that discipline and feeds from the same real counts, but is a separate, richer contract.

---

## Registries (typed projections unless persistence proven necessary)

- **Capability Registry** — code-derived list; maturity/mode **assessed from evidence** (artifacts, exercised runs, reviews, replay), never from file existence. Modes: `inactive|foundation|observation|shadow|human_reviewed|production|frozen|revoked|not_measured`.
- **Intelligence Output Registry** — typed outputs with strict fact/signal/inference/hypothesis/recommendation/validated-conclusion separation. Adapts `learned_preferences` + market-to-account artifacts. No fabrication from empty data.
- **Pattern Registry** — replaces "Observed patterns". Sample-size + confidence gated; states `candidate|insufficient_sample|observation|shadow|human_approved|production|rejected|expired|frozen`. **Never affects production ranking in observation/shadow.**
- **Validation/Outcome** — reuses `opportunity_feedback` + 039 `commercial_outcome`. Links output → review → action → outcome → lesson. Generation ≠ validation.
- **Gaps + Next Actions** — computed taxonomies; priority = expected lift × scope × confidence × readiness-impact ÷ (effort × dependency), with transparent rules and no fake precision.
- **Report Readiness** — 5 levels (`not_ready|snapshot_ready|brief_ready|intelligence_report_ready|premium_report_ready`); evaluated from evidence quality/freshness/corroboration/client-specificity, not field completeness.

---

## Snapshot engine

Deterministic assembly of index + capabilities + evidence integrity + gaps + actions + readiness + diagnosis. Replayable with **no provider/LLM calls**. Idempotent. Explicit source-data cutoff + methodology version. **Persist `intelligence_index_snapshots`** (the one justified new table) so trends are real; everything else stays a typed projection over existing data. Confirm the persistence decision in Block 2 before writing the migration.

---

## Security / compatibility

- Reuse `requireAdmin`; fail closed; server-side assembly; no raw protected JSON public; no cross-tenant leakage; pagination/lazy-load for growth.
- **Must not break:** ranking, Market-to-Account, staged pipeline, verification, Vault, source review, provider health, feedback, learner, observation/shadow safety, Admin auth, report ownership, RLS, release checks, deterministic replay, existing report contracts.
- Observation/shadow patterns remain non-production-impacting; production promotion requires explicit evidence + approval.

---

## Implementation plan (controlled blocks — one per session, commit + checkpoint each)

- **Block 0 — Directed audit** ✅ (this doc + data map + checkpoint). No migrations, no redesign.
- **Block 1 — Domain contracts**: TS types for capability, assessment, maturity dimension, index, output, pattern, validation, outcome, gap, action, readiness, snapshot, unknown/unmeasured states. Tests: required fields, honesty states, no-false-production-maturity. No UI, no broad persistence.
- **Block 2 — Snapshot engine**: deterministic assembly from real data + `not_measured` elsewhere; methodology version; replay + idempotency + missing/sparse-data tests; persist snapshots only if audit-confirmed.
- **Block 3 — Output & pattern registry**: adapters from learner + market-to-account/evidence; fact/inference separation; sample/confidence gates; no ranking impact.
- **Block 4 — Validation & learning loop**: reuse structured feedback + 039 outcomes; learner stays safe; ranking unchanged.
- **Block 5 — Admin Command Center**: rebuild `/admin/intelligence` (Command Center, Maturity Scorecard, Capability Map, Outputs, Pattern Observatory, Validation/Outcomes, Gaps, Improvement Agenda, Report Readiness, Evidence Integrity, Trends). Feedback observability becomes a subsection. Intelligent empty states; server-side assembly.
- **Block 6 — Self-knowledge & improvement queue**: diagnosis + prioritized next-best actions + gap→action mapping + promotion/freeze recommendations.
- **Block 7 — Trends & baselines**: historical trends where snapshots exist; Intelligence Lift baseline contract; `not_measured` without baselines.
- **Block 8 — QA/security/release**: full release check (once), determinism, RLS/tenant, auth, regression, browser screenshots.

Stop cleanly at ~65–70% session usage: finish current unit, update checkpoint, commit, report next exact prompt.

---

## Honesty gates (enforced across domain, snapshot, UI)
Stored volume ≠ intelligence · no score without methodology · no trend without history · no invented patterns · no hidden small samples · no impact claim without outcomes · tests/schemas don't promote maturity · shadow ≠ production · generation ≠ validation · no hidden gaps · missing instrumentation ≠ zero · no fabricated baselines · no unsupported decimals · LLM judgment ≠ ground truth · polished UI must not mask weak intelligence · readiness gate before customer-safe · preserve `channel_fit_not_buying_intent` and separate structural/timing reasoning · facts/signals/inferences/recommendations stay distinct.
