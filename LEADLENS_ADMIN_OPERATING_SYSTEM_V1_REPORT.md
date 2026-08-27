# LeadLens Admin Operating System V1

## Executive verdict

The former `Beta Readiness` percentage was not a launch-control system. It averaged runtime configuration, Lemon Squeezy fields and browser-local checkboxes. It could remain stale indefinitely and treated Apollo/payment configuration as Intelligence maturity. It has been replaced by an automatic, evidence-bound launch-readiness model.

Current measured evaluation on 2026-08-27:

- Launch readiness: **39/100 — internal_pilot**.
- Confidence: **high** about the observed limitations, because the largest supporting telemetry sample is `n=1357`; this does not mean commercial quality is high.
- Intelligence capability maturity: capped at **59/100** while the latest bounded positive-control artifact contains zero human-defensible positive Cases.
- Failing launch gate: production configuration is incomplete because `INTERNAL_RUN_SECRET` is absent in the current environment; the model therefore applies the 39-point configuration cap.
- Primary Intelligence limitation: no defensible positive Case in the current `0/8` positive-control sample; independently, this applies the 49-point empirical-quality cap.
- Durable database history: code and migration are ready, but migration `055` is not yet applied to the connected Supabase schema. The attempted write failed closed with `schema cache: table not found`; no history was fabricated.

## Canonical sources of truth

- Capability registry and multidimensional evaluations: `lib/intelligence/capability-control-plane.ts`.
- Automatic launch gates and score caps: `lib/intelligence/launch-readiness.ts`.
- Durable idempotent snapshot adapter: `lib/intelligence/control-plane-store.ts`.
- Server assembly and Admin-only persistence endpoint: `app/api/admin/intelligence/launch-readiness/route.ts`.
- Admin Launch Readiness surface: `app/admin/beta-readiness/page.tsx` (URL preserved to avoid broken links).
- Migration: `supabase/migrations/055_intelligence_control_plane_memory.sql`.
- Operational snapshot command: `npm run admin:snapshot-control-plane`.

## Automatic readiness model

The model evaluates eleven weighted gates:

1. confirmed customer context;
2. account discovery quality;
3. research and evidence integrity;
4. opportunity reasoning;
5. human validation;
6. runtime and failure recovery;
7. tenant isolation and admin safety;
8. provider resilience and COGS;
9. Monitor and Account Memory;
10. customer-safe report delivery;
11. production configuration.

Each gate is derived from canonical capability evaluations and retains capability IDs, evidence references, sample size, reason and next action. Missing evidence is `unmeasured`, not zero disguised as a measurement. Real-world and human evidence overrides code/test presence. Readiness can rise or fall automatically.

Hard anti-inflation policies:

- zero human-defensible positive Cases caps readiness at 49;
- missing production configuration caps readiness at 39;
- a tenant-security failure caps readiness at 24;
- payments are not an Intelligence quality gate;
- Apollo is not part of the canonical provider chain.

## Durable memory

`intelligence_control_plane_snapshots` is append-only in practice and idempotent by a SHA-256 fingerprint of the source cutoff, score, level and every gate's state/score/sample. Repeated Admin refreshes do not create duplicate maturity history. Any changed empirical evidence creates a new snapshot.

RLS is enabled with no anon/authenticated policies. Only trusted service-role Admin paths can read or write internal capability history.

Rollback:

```sql
drop table if exists public.intelligence_control_plane_snapshots;
```

Apply `055` before expecting history or trends. Until then the UI labels history unavailable and continues to compute current readiness without claiming persistence.

## Admin information architecture audit

The repository contains 55 Admin page entrypoints, including dynamic/detail routes. The prior sidebar exposed 27 destinations in one undifferentiated `Operations` list. This mixed control, execution, knowledge, customer operations and legacy implementation surfaces.

The canonical navigation now contains 22 purposeful destinations in four groups:

- Control: Overview, Launch Readiness, Intelligence OS, Provider Health, Runtime Health.
- Execute: Pilot Console, Jobs, Searches, Monitor Operations, Deliverables.
- Intelligence Assets: Lead Hunter, Vault Foundation, Vault, Companies, Source Intelligence, Human Review.
- Customers & Learning: Onboarding, Feedback & Outcomes, Customer Analytics, Orders, Credits, Settings.

Eight routes remain reachable but were removed from primary navigation:

- `/admin/snapshots` — contextual from Jobs/reports;
- `/admin/vault-report-bridge` — legacy implementation surface;
- `/admin/notifications` — contextual operations;
- `/admin/vault-performance` — consolidated into Intelligence OS;
- `/admin/vault-candidates` — consolidated into Lead Hunter;
- `/admin/sources` — consolidated into Source Intelligence;
- `/admin/source-config` — contextual from Source Intelligence;
- `/admin/source-runs` — contextual from Source Intelligence.

No route was deleted in this sprint, so bookmarks and operational deep links remain safe. The disposition registry is machine-readable in `lib/admin/admin-information-architecture.ts`.

## Corrected stale indicators

- Overview now loads and links the canonical automatic Launch Readiness result.
- `System Health` explicitly labels its old aggregate as legacy delivery-configuration coverage, not launch readiness.
- Apollo is shown as disabled/not canonical rather than “required for all lead generation.”
- Lemon Squeezy is no longer part of the core Admin-ready banner or launch score.
- Command Center remains read-only; readiness persistence is isolated behind an Admin-protected, no-store endpoint.

## Verification

- Admin Operating System: 16/16.
- Intelligence capability control plane: 16/16.
- Admin Intelligence Command Center: 40/40.
- Intelligence OS contracts: 25/25.
- Intelligence snapshot: 27/27.
- Intelligence registries: 28/28.
- Admin auth: 48/48.
- Admin login routing: 58/58.
- TypeScript: clean.
- Next.js production build: passed, 151 static pages generated; new `/admin/beta-readiness` and `/api/admin/intelligence/launch-readiness` routes included.
- Browser acceptance: unauthenticated navigation to `/admin/beta-readiness` redirected to `/admin/login?reason=unauthorized`; the Supabase Admin login rendered and no security bypass was used.

The build emitted the repository's existing Edge-runtime/static-generation warning; it did not fail the build.

## Immediate operational action

Apply migration `055_intelligence_control_plane_memory.sql`, then open `/admin/beta-readiness` once. The endpoint will persist the first canonical snapshot and show it in Durable History. After subsequent production evidence changes, re-opening Overview or Launch Readiness computes and persists a new fingerprint automatically.
