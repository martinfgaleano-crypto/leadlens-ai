# LeadLens — Admin Final Closure V1

Closes the Admin observability workstream. Verified truth only. No readiness percentage was
hand-edited, no evidence was fabricated, no synthetic Vault company was inserted. The central finding:
**the Admin is already evidence-driven and live-deployed; Launch Readiness is correctly low because
real launch gates are genuinely unmet — it is not static-broken.**

## Verified production state
- `origin/main` = **`0c4673f`**; production deployment **Ready**, built from current main (deploy ~7m
  after the merge). The prior observability + fail-close branches are merged (PRs #28/#29).
- Live in the deployed source: operational-activity route (`app/api/admin/operational-activity`),
  Vault growth/freshness (`summarize()`), geo-scoped fail-closed Vault fallback.
- `VAULT_REUSE_MODE` unset → **OFF** in production (verified previously via `vercel env ls`).

## Launch Readiness — the honest answer to "why is it here?"
Recomputed from current production-authoritative evidence (canonical `buildLaunchReadiness`, not a
fixture): **score 39 · level `internal_pilot` · confidence high.** It is genuinely computed and
responds to evidence + config — not hardcoded. Gate states:
`account_discovery` PASS 90 · `research_evidence` PASS 90 · `provider_economics` PASS 89 ·
`monitor_memory` PASS 90 · `opportunity_reasoning` DEGRADED 82 · `report_safety` DEGRADED 82 ·
`runtime_reliability` DEGRADED 80 · `human_validation` DEGRADED 90 · `customer_context` UNMEASURED ·
`tenant_security` UNMEASURED · `production_configuration` FAIL.

**Why the score is 39 (the three material gates that cap it):**
1. **No human-validated customer-safe Case** — `human_validation.customer_safe_cases = 0`, so
   `applyControlPlaneValidationEvidence` **hard-caps overall ≤ 59** and `human_validation` stays
   degraded. Blocker: *"diagnostic events were captured, but no customer-safe Case has been
   human-confirmed."* Lifting this requires a **real, human-reviewed customer Case** — a formal human
   acceptance decision (§17), not an engineering action, and not something to fabricate.
2. **Runtime ceiling** — measured p95/max 304912ms > the 300000ms operating ceiling (higher-tier
   orders legitimately exceed the process window and complete via durable recovery). Blocker holds
   truthfully until runtime is brought under the ceiling or the recovery-backed model is formally
   accepted as the ceiling.
3. **`production_configuration` FAIL** — pulls the score to ≤39 (calc rule). Reflects
   still-incomplete production configuration (scoped Vault rollout not yet enabled, real production
   purchase unverified).

**This is the §19 outcome:** new engineering milestones (Sept full-order acceptances) do **not** move
the score, because they are isolated acceptances (disposable tenants), not human-validated real-customer
Cases, and the runtime/config gates persist. Incorporating them as evidence would refresh provenance
but would **not** lift the ≤59 cap. Raising readiness is gated on real launch conditions, correctly.

## Repeatable, auditable readiness-evidence update path (already exists — §18)
Mechanism: `POST /api/admin/intelligence/launch-readiness` with a validation-evidence artifact
(`ControlPlaneValidationEvidenceV1`) — validated by `validateControlPlaneValidationEvidence`, applied
via `applyControlPlaneValidationEvidence` (dedupe by `source_fingerprint`, supersede, recompute), and
persisted to the control-plane store. `use_bundled_evidence: true` ingests the canonical bundled
artifact. Tested: `control-plane-evidence-ingestion`, `control-plane-evidence-route`. To incorporate a
newly verified milestone: author an evidence artifact (provenance refs, verification level, honest
metrics) and POST it — **no manual score edit, no silent PASS**. The `customer_safe_cases` /
`human_validation` metrics require a genuine human acceptance decision before they may be non-zero.

## Intelligence operational observability (live, deployed)
`/api/admin/operational-activity` (admin-only, `force-dynamic`) reports from canonical tables, 24h/7d/30d
+ last-activity: intelligence runs (`snapshot_reports` `intel_*`, `distinct_runs` de-dup), delivered
evaluations (`account_intelligence_charges`, `distinct_analyses` de-dup), new Vault companies
(`first_seen_at`). Fail-visible per source. Distinguishes capability-maturity (curated artifacts) from
operational activity (live). Acceptance/disposable runs self-delete, so live run-counts trend to real
activity (currently ~1 persisted intel run, 28 historical delivered-evaluation charges) — this is
truthful, not a lost history. Deterministic: `operational-activity` 10/10. Refresh: per-request (no
redeploy needed).

## Vault (live + growing)
Live read of `vault_companies`: **185 unique** (was 98) · new by `first_seen_at` **2/24h, 20/7d,
118/30d** · `lastWriteAt`/`lastObservationAt` now surfaced. Persistence works (accretion in the process
route); reuse ≠ new (new = `first_seen_at`); duplicate observation updates `reobserved`, not the unique
count. `vault-view` 39/39.

## Production-admin visual verification — NOT performed
The deployed Admin pages (Observatory / Operational Activity / Launch Readiness / Vault) were **not
opened this sprint** — that requires an authenticated admin browser session on the deployed app, which
was not exercised here. The data paths are deployed and live-verified against the production DB; the
visual render on the deployed Admin remains **PRODUCTION_DEPLOYED, not PRODUCTION_ADMIN_VERIFIED**.

## Remaining limitations
1. **Readiness is gated on real launch conditions** (human-validated customer Case, runtime ceiling,
   production configuration) — a real paid-customer Case is the highest-leverage unblocker and a human
   acceptance decision, not an engineering one.
2. **Deployed-Admin visual acceptance** pending an admin session on production.
3. **Two Intelligence views coexist** (capability maturity vs live operational activity); unifying them
   is a follow-up, not a blocker.

## Workstream status
Admin observability is **CLOSED**: surfaces are evidence-driven, live, and deployed; readiness is
correctly computed with a documented, tested, auditable update path. Next workstream: **Customer
Deliverables V2**.
