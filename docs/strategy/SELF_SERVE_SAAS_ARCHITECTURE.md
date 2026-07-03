# Self-Serve SaaS Architecture v0

**Documento vivo** — mapa del flujo self-serve. Actualizar cuando una pieza cambie de clasificación.

Clasificación: `implemented` · `partial` · `admin-only` · `self-serve` · `future`

| Pieza | Dónde | Clasificación | Notas |
|---|---|---|---|
| Signup/Login | Supabase auth + `/login` | implemented, self-serve | Onboarding público también crea usuarios |
| Onboarding público | `/api/onboarding/submit` | implemented, self-serve | Crea profile + ICP + lead_search + onboarding_request con `search_id` — el único path que deja un monitor completo |
| Creación de search desde dashboard | `/dashboard/searches` (form) | partial, self-serve | **Crea lead_search SIN onboarding_request** → sirve para Apollo flow pero NO puede correr como monitor AI (falta business context). Warning en UI; linking posterior = future |
| ICP builder | `/dashboard/icp` | implemented, self-serve | |
| Monitor series | `lead_searches.id` + `snapshot_reports.search_id` | implemented | Scope seguro desde migration 027 |
| Monitor run (admin) | `POST /api/admin/searches/[id]/rerun` | implemented, admin-only | Dedup + baseline + 422 sin onboarding |
| Monitor run (customer) | `POST /api/monitor/[id]/run` | **este sprint**, self-serve | Ownership + onboarding + dedup + entitlement |
| Report access | `GET /api/report` | implemented, self-serve | Ownership via snapshot.search_id; legacy admin-only; ver REPORT_ACCESS_MODEL.md |
| `search_id` en report payload | `LeadLensReport.search_id` | **este sprint** | Contexto para feedback/debugging/billing futuro |
| Feedback | `POST /api/feedback/opportunity` | implemented, self-serve | Dedup por job+company+signal; search context este sprint |
| Account Memory / Vault | pipeline (best-effort) | implemented | No demo; feedback `exclude_similar` → do_not_show |
| Readiness status | `lib/monitor/readiness.ts` | implemented | Admin banner + customer-safe copy |
| Lifecycle states | `lib/monitor/lifecycle.ts` | **este sprint** | Estado único por serie para customer/admin |
| Entitlements / usage | `lib/usage/entitlements.ts` | **este sprint**, partial | Gate honesto: plan no-free O credit_balance > 0. Sin deducción por run (future billing) |
| Credits | `plans`, `customer_credits`, `credit_transactions` | implemented | Consumidos por Apollo lead flow; monitor runs no consumen aún |
| Admin QA | runs endpoint qa_flags + banners | implemented, admin-only | |
| Billing (Stripe/Lemon) | — | future | Lemon Squeezy webhook existe para orders; sin suscripciones/entitlement automático |
| Scheduler mensual | — | future | Sin cron. Cadencia manual; copy honesto en UI |
| Public report sharing | — | future (decidido: no todavía) | |

## Flujo self-serve objetivo (post-sprint)

```
Signup/Onboarding → lead_search + onboarding_request (setup completo)
   → [customer] Run monitor (entitlement + dedup + ownership)
      → snapshot processing → completed (search_id scoped)
         → Report ready (ownership-checked) → Feedback (search context)
            → Account Memory / Vault → siguiente run = comparación real
```

Pasos que siguen siendo manuales/asistidos: cadencia mensual (sin scheduler), QA interno pre-entrega (checklist + banners), linking de onboarding a searches creadas por dashboard, billing/upgrades.

## Self-healing y operación (Production Sprint v0 — 2026-07-02)

Drainer + cron diario + ops center + env health implementados — ver
`SELF_HEALING_MONITOR_INFRASTRUCTURE.md`, `PRODUCTION_ARCHITECTURE.md`,
`DEPLOYMENT_READINESS_CHECKLIST.md` y `BETA_OPERATIONS_PLAYBOOK.md`.
Fundaciones inertes: `lib/monitor/scheduling.ts` (scheduler),
`lib/usage/usage-events.ts` (deducción futura), `lib/sources/source-engine-types.ts`
(source engine). Nada de eso ejecuta automatización ni cobra.

## Scheduler readiness (P10 — sin automatización activa)

Estado actual: **cadencia manual**. El dashboard lo comunica honestamente
("Monthly cadence is manual for now… Automatic scheduling is not enabled yet").
No hay cron, no hay background jobs, no hay next_run_at en el schema.

Camino de integración futuro (cuando se decida activar):
1. Migration: `lead_searches.monitor_frequency TEXT` (`manual | monthly`) y
   `lead_searches.next_run_at TIMESTAMPTZ` — nullable, inertes hasta que exista runner.
2. Runner: Vercel Cron (o similar) que drene jobs de forma idempotente usando la
   infraestructura async ya construida: `createMonitorRunJob` (mismos guards de
   dedup/staleness) + `POST /api/internal/monitor-runs/[jobId]/process` (secret-
   protected) — nunca un path paralelo sin guards. Ver ASYNC_RUN_EXECUTION.md.
   Bonus ya disponible: el mismo cron puede re-disparar jobs `processing` stale
   sin worker (auto-recovery), exactamente lo que hace el admin retry hoy.
3. Entitlement: el scheduler consulta `getEntitlements` antes de cada run;
   clientes sin entitlement se saltan con log, sin error visible.
4. Copy: solo cuando el runner exista se cambia "not enabled yet" por fecha real.
   **Nunca prometer scheduling antes de que corra.**

## Billing readiness (referencia)

- Datos reales existentes: `plans` (catálogo con precios), `customer_credits`,
  `credit_transactions` (ledger), `profiles.plan`, webhook Lemon Squeezy para orders.
- `lib/usage/entitlements.ts` es el único punto de decisión de acceso por plan —
  cuando billing exista, solo ese helper cambia (suscripción activa → can_run_monitor,
  monthly_run_limit real, deducción por run vía `credit_transactions type='consume'`).
- Proveedor decidido: **Lemon Squeezy** (no Stripe) — compatible Colombia.
