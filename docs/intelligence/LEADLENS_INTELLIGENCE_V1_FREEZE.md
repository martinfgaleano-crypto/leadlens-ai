# LeadLens — Intelligence V1 Functional Freeze + Controlled Production Enablement

Canonical freeze record for Intelligence V1. Verified truth only. Distinguishes the three release
milestones (§9): **full-order acceptance** (done, controlled env) · **production enablement** (the
control now exists; a founder config step remains) · **real customer-purchase acceptance** (checklist,
not yet performed).

## Verified production state
- `origin/main` = `efbabc9` (supply fix merged via PR #26; one-time enforcement + migration 064 in main).
- Production deployment: Ready, built from main (verified via authenticated `npx vercel`).
- **`VAULT_REUSE_MODE` is NOT set in production → resolves to `OFF`** (verified via `vercel env ls`) —
  reuse fallback is inert in prod today. `INTERNAL_RUN_SECRET` + `CRON_SECRET` set (recovery operational).
- Migration 064 applied (fresh signup → 0 welcome credits, verified live).

## Accepted products (live full-order acceptance, Colombia)
| Product | Price | Companies | Result | Run | COGS (Anthropic) |
|---|---|---|---|---|---|
| Preview | $7 | 2 | 2/2 PASS | `intel_fc3728ed` | $0.22 |
| Brief | $25 | 6 | 6/6 PASS | `intel_fd951ff6` | $0.54 |
| Portfolio | $59 | 12 | 12/12 PASS | `intel_04565690` | $1.22 |
| Premium | $129 | 18 | 18/18 PASS | `intel_84ec8241` | $1.67 |

All with exact per-company one-time consumption (grant→charge=delivered→balance 0), third-run 402,
replay/recovery no double-charge, report reopen free, cross-tenant 404, genuine decision mixes (no
padding), COGS ≈ $0.09–0.11 per valid evaluation. Premium differentiation (`_premium_context`) fires
for `pro`. Preview/Brief/Portfolio/Premium contracts unchanged (catalog frozen).

## Release envelope (accepted)
- **Market:** Colombia. **Commercial objective:** WMS / warehouse-automation seller. **Target
  families:** manufacturers, distributors, logistics/DC operators operating owned facilities.
- **NOT accepted:** USA full-order (prior strict-ICP benchmark ~5/6), other South-American markets,
  other ICPs. These are separate acceptances and must not be inferred from the Colombia result.
- **Higher-tier supply dependency:** Portfolio 12 and Premium 18 depend on Vault reuse fallback for the
  Colombia context (fresh discovery alone yields ~10). Preview 2 needs no fallback; Brief 6 uses it.

## Controlled Vault rollout (the enablement control)
`VAULT_REUSE_MODE` semantics (verified): `OFF` (gate always closed), `CANARY` (allowlist by
`VAULT_REUSE_CANARY_CONTEXTS`, per confirmed-context id — ephemeral, not market-level), `ELIGIBLE_FALLBACK`
(fires whenever fresh coverage is insufficient). `ELIGIBLE_FALLBACK` alone is **global** (all markets/
tiers) — which HQ does not authorize.

**New server-side control (this freeze):** `VAULT_REUSE_ELIGIBLE_GEOS` — a lowercased geography
allowlist. Under `ELIGIBLE_FALLBACK`, reuse now fires **only** when the run's target geography matches
the allowlist; an empty allowlist preserves the (unscoped) acceptance-harness behavior. `CANARY` also
requires the geography scope. Client cannot override (server-resolved config); the flag cannot change
entitlements, bypass qualification, or expose cross-tenant data (reuse supplies only candidate
identities that still pass identity/geography/operating-role/current-source qualification + fresh Deep
Research; historical Vault membership/last_seen/observation_count never become event evidence, timing,
or a decision). Regression: `vault-reuse-config` **26/26** (incl. scoped-Colombia enables, scoped-USA
disabled with flag ON, empty-allowlist unscoped, CANARY+geo).

**Recommended production rollout (founder, reversible):** set in Vercel prod
`VAULT_REUSE_MODE=ELIGIBLE_FALLBACK` **and** `VAULT_REUSE_ELIGIBLE_GEOS=Colombia`. This activates reuse
only for the accepted Colombia envelope; USA and other markets stay OFF even with the flag on.
**Rollback:** unset `VAULT_REUSE_MODE` (→ OFF) — new runs stop using reuse immediately; in-progress
runs finish; completed reports and customer credits are untouched. No global activation is performed by
this branch; production remains OFF until the founder sets the scoped config.

## Frozen canonical components (Intelligence V1)
Hybrid Candidate Universe (account-first + event-first) · canonical company identity · target
qualification + operating-role guards · Deep Research · Opportunity Case generation · canonical
decisions (PRIORITIZE/VALIDATE/MONITOR/HOLD) · Portfolio synthesis · Premium context · Account Memory ·
Monitor · one-time credit enforcement (per-company, atomic, idempotent, fail-closed, delivery gated on
charge) · durable recovery (execution-generation fencing + GitHub Actions recover cron). Each has a
stable contract enforced by deterministic gates (release:check). Do not modify a frozen component
without a demonstrated release-critical defect.

## Quality invariants (never regress)
Memory ≠ Evidence · retrieval/publication date ≠ event date · two URLs ≠ independent support · no
observed event → no Timing claim · absence ≠ counterevidence · current Case before history · canonical
decisions only (no HOT/WARM/COLD or opaque score customer-facing) · tenant isolation · no Apollo / no
new provider on credentials alone.

## Entitlement model (frozen)
One-time: 1 credit per valid company evaluation delivered; grant = catalog `opportunity_target`
(2/6/12/18); charged at materialization, idempotent per (user, runId, account); exhaustion blocks new
billable runs; viewing acquired reports is free. Subscription-period metering is a separate ledger
(§13 separation), unchanged.

## Customer purchase path (status)
Code-proven end to end (Landing → pricing → signup → OTP → verify → checkout → Lemon webhook
`fulfillCanonicalOrder` grant → activation → Intelligence → result); a real TEST-mode Lemon order was
previously verified (order 9414718 → +2). **A real production Lemon purchase for the current release
has NOT been performed this cycle.** Founder-assisted real-purchase checklist: (1) confirm Lemon PROD
variant IDs + `WEBHOOK_SECRET` in Vercel; (2) one real Preview purchase; (3) inbox OTP; (4) confirm
grant = +2 and a delivered 2/2 Preview. Do not spend real money without authorization.

## Known limitations
1. Higher-tier supply depends on Vault reuse (Colombia); production activation is the founder config
   step above (currently OFF).
2. Existing legacy welcome balances (≤6 accounts × 100 credits) await provenance-based reconciliation
   (new signups clean post-064).
3. Post-fix higher-tier runs research the full reused universe (~17–23) rather than target+headroom —
   ~2× research cost, no safety impact.
4. Real production-purchase acceptance not yet performed (checklist above).
5. Only the Colombia WMS context/market is accepted.

## Conditions for reopening V1 (§31)
Reproducible security / tenant-isolation / billing-entitlement defects; fabricated or mis-attributed
evidence; systematic target-relevance failures; material customer-fulfillment failures; critical
runtime/recovery defects. Cosmetic or speculative feature work does NOT reopen V1 — it belongs to a
separate planned phase.
