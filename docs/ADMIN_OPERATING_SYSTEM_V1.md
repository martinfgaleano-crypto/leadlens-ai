# Admin Operating System V1 — continuation guide

## Runtime flow

`Admin Overview or Launch Readiness → /api/admin/intelligence/launch-readiness → loadAdminIntelligenceViewModel → buildCapabilityControlPlane → buildLaunchReadiness → idempotent Supabase snapshot → Admin gates/history`

The Command Center API remains read-only. Launch history writes occur only through the protected launch-readiness endpoint or the explicit operational snapshot script.

## Main files

- `lib/intelligence/capability-control-plane.ts`: canonical capability inventory and current state.
- `lib/intelligence/launch-readiness.ts`: weighted gates, levels and anti-inflation caps.
- `lib/intelligence/control-plane-store.ts`: record fingerprint, persistence and history reads.
- `lib/admin/admin-information-architecture.ts`: primary and deprecated-navigation registries.
- `app/api/admin/intelligence/launch-readiness/route.ts`: Admin-only assembly/persistence API.
- `app/admin/beta-readiness/page.tsx`: automatic launch-control UI (legacy URL retained).
- `app/admin/_components/AdminLayout.tsx`: grouped canonical navigation.
- `supabase/migrations/055_intelligence_control_plane_memory.sql`: durable global telemetry table.

## Commands

```bash
npm run test:admin-operating-system
npm run test:admin-intelligence-control-plane
npm run test:admin-intelligence-command-center
npm run admin:snapshot-control-plane
npx tsc --noEmit
npm run build
```

## Applying persistence

Migration `055` is required. It is idempotent and RLS-on with no customer policies. After applying it, run `npm run admin:snapshot-control-plane` or open `/admin/beta-readiness` under a legitimate Admin session. Never add anon/authenticated read policies to this global internal telemetry table.

## Evidence semantics

- `pass`: sufficient current capability evidence for this gate.
- `degraded`: measured weakness or score below the gate floor.
- `fail`: a blocked capability or production control failure.
- `unmeasured`: insufficient multidimensional evidence; never display as a measured 0.

The score is a control aid, not product truth. Always inspect gate reasons, `n`, evidence links and blockers.

## Known blocker

At implementation time the connected Supabase schema did not expose `intelligence_control_plane_snapshots`; the first persistence attempt returned a schema-cache table-not-found error. Current readiness still computes live, but history must remain labeled unavailable until migration 055 is applied.
