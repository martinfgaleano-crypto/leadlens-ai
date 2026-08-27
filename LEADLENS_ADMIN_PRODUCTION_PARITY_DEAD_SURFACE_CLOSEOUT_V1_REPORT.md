# LeadLens Admin Production Parity + Dead-Surface Closeout V1

## 1. Git / deployment parity

- Local starting HEAD and `origin/main`: `4c34cdd1252c20470f18fa27b85f79c256f0c18c`.
- Production served the Admin route and wrote the erroneous 0 snapshot at 2026-08-27 22:15 UTC, but the deployed SHA was not observable. This sprint adds `VERCEL_GIT_COMMIT_SHA` visibility.
- The parity fix requires deployment; no push is performed by this sprint.

## 2. Founder screenshot findings

- `/admin/beta-readiness` showed 0/100 because Vercel lacked ignored local acceptance JSON and the evaluator rebuilt almost entirely unmeasured telemetry.
- `/admin/system-health` displayed a competing 46% legacy delivery score containing Apollo, payments, credits and exports.
- `/admin/companies` read contact-era `company_profiles`, not the durable account universe, and therefore displayed misleading zeroes.

## 3. 0/100 root cause

Production reconstructed the Control Plane from filesystem acceptance artifacts under `ml/data`, which are ignored and absent on Vercel. It then persisted that telemetry failure as an `admin_observation` with readiness 0. The production configuration gate also treated `ADMIN_SECRET_TOKEN` as canonical Admin auth even though production uses signed sessions backed by `ADMIN_SESSION_SECRET`.

The fix selects current operational evidence when present, otherwise the latest durable canonical Control Plane. A telemetry outage cannot become readiness zero. If neither current nor durable evidence exists, the route returns explicit 503/unavailable without a score.

## 4. Production configuration breakdown

The route now reports independently: database, signed Admin auth, application URL, demo isolation, internal worker secret and service-role query access. Missing `INTERNAL_RUN_SECRET` degrades closed-alpha/self-serve only; it does not claim database or Admin auth failure.

## 5. Migration 055 production verification

The connected runtime project contains `intelligence_control_plane_snapshots`. Service-role reads succeed. RLS is enabled; anonymous access returns no rows. Three physical rows were observed: valid baseline 39, valid operational 49 and erroneous telemetry-failure 0. Canonical-history filtering excludes the zero row because it has no source cutoff or operational evidence.

## 6. Snapshot verification

- Baseline: `9dbd6b724633…`, 39/internal_pilot.
- Operational: `6dc04c6b9c71…`, 49/internal_pilot, source cutoff 2026-08-27T19:16:18.441Z.
- Erroneous observation: `47153d2c6acb…`, 0/not_ready, null source cutoff.
- Evaluator: `launch-readiness-v1`; Control Plane: `capability-control-plane-v1`.

## 7. Evaluator/API/UI parity

Direct production-style route acceptance now returns 49/internal_pilot, high confidence, n=1787. It exposes telemetry provenance and config subchecks. UI consumes the same payload, labels durable fallback, displays build/environment and explains an unavailable source cutoff. Browser authentication remained fail-closed and redirected an unauthenticated localhost request to the legitimate Admin login.

## 8. Controlled acceptance persistence

Migration 055 stores compact Control Plane and readiness summaries plus evidence references/fingerprints. Runtime no longer requires large acceptance JSON. `selectCanonicalControlPlane` can consume this durable compact summary. Ingestion remains explicit through `admin:snapshot-control-plane` and idempotent by material fingerprint.

## 9. Launch gates

Canonical local acceptance after the fix: 49/internal_pilot, high confidence, n=1787. Missing worker auth remains degraded. No gate includes Apollo or payments. Controlled-evidence gates retain their last durable sample when artifacts are absent in deployment and are labeled as durable fallback.

## 10. System Health audit

The old percentage was not runtime health. It mixed onboarding, Lemon Squeezy, Apollo, Vault, credits, delivery, access and exports. The score and cards were removed from the Runtime surface.

## 11. Apollo cleanup

Apollo is absent from Runtime Health calculations and UI. Its absence cannot lower Runtime Health or Launch Readiness.

## 12. Company Intelligence audit

Decision: **MERGE**. `/admin/companies` used `company_profiles`, `contacts_count`, average score and top score from the lead/contact ontology. It now redirects to Lead Hunter. Verified reusable account evidence remains in Vault Foundation. The legacy API/detail route remains contextual but is removed from primary navigation.

## 13. Navigation changes

- `Runtime Health` becomes primary `Runtime & Exceptions`.
- `Companies` leaves navigation and enters the deprecated/merged registry.
- Lead Hunter and Vault Foundation remain canonical account operations.

## 14. Empty/stale surface resolution

- Telemetry unavailable is no longer score zero.
- Runtime sample zero is labeled as an observed sample size, with latency `Not measured`.
- Legacy company zero dashboard is removed from navigation and redirects.

## 15. Runtime Health

Runtime now measures Productive Intelligence Spine status, stale processing, p50/p90/p95, recent failures, Monitor status/latency, worker configuration, database availability and Control Plane availability. Current durable DB sample: Productive runs n=0 after disposable E2E cleanup; Monitor n=1 completed; Control Plane available.

## 16. Operations Overview overlap

Operations Overview remains the high-level operational entry point. Launch Readiness owns launch gates. Runtime & Exceptions owns execution health. The legacy infrastructure score no longer competes with either.

## 17. Version visibility

Launch Readiness and Runtime & Exceptions expose commit and environment when Vercel provides `VERCEL_GIT_COMMIT_SHA`. Local non-Vercel runs honestly show unavailable/unknown.

## 18. Tests

Added deterministic coverage for unknown-not-zero, durable fallback, production Admin session, worker-secret scope, config subchecks, canonical runtime stores, Apollo/payments exclusion, no competing score and Companies redirect. Full regression/build results are recorded in the final handoff.

## 19. Production deployment requirements

Deploy the parity commit. Confirm `ADMIN_SESSION_SECRET`, Supabase variables and `NEXT_PUBLIC_APP_URL` remain configured. Add `INTERNAL_RUN_SECRET` only before closed-alpha asynchronous customer execution. Cron remains OFF.

## 20. Final parity verdict

`ADMIN PRODUCTION PARITY CODE-COMPLETE, DEPLOYMENT REQUIRED`
