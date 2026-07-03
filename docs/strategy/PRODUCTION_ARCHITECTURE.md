# Production Architecture v0

**Documento vivo** — estado de la arquitectura de producción, qué existe, qué es manual, qué es futuro. Complementa: `ASYNC_RUN_EXECUTION.md`, `SELF_HEALING_MONITOR_INFRASTRUCTURE.md`, `SELF_SERVE_SAAS_ARCHITECTURE.md`, `REPORT_ACCESS_MODEL.md`.

## Flujo self-serve actual (implementado)

```
Signup/Onboarding → lead_search + onboarding_request
  → Run monitor (customer 202 / admin 202)   [guards: auth→ownership→entitlement→setup→dedup]
    → snapshot `processing` = job state durable (search_id scoped)
      → trigger fire-and-forget → processor interno (secret-protected)
        → completed / failed  (upsert por job_id — auditable)
          → Report (ownership-checked) → Feedback (dedup + search context)
            → Account Memory / Vault → siguiente run = comparación real
```

Self-healing: drainer (`lib/monitor/job-drainer.ts` + `/api/internal/monitor-runs/drain`)
re-dispara jobs stale, supersede duplicados, abandona jobs > 6h. Cron diario + botón admin.
Admin ops center: `/admin/monitor-runs` (totales, STALLED, retry, drain).

## Riesgos técnicos conocidos y su mitigación

| Riesgo | Mitigación actual | Upgrade futuro |
|---|---|---|
| Trigger fire-and-forget perdido | stale a los 15 min → drainer/retry | cron más frecuente (Pro) o queue externa |
| Función matada mid-pipeline | mismo path stale | ídem |
| Retry infinito de un job que siempre muere | techo de recovery 6h → abandoned | contador de intentos persistido |
| Dos pipelines racing por serie | dedup fresh en creator + retry + drainer (supersede) | lock a nivel DB |
| Secrets faltantes en prod | processor/drainer fail closed; env health center (P7) | — |

## Qué existe vs qué falta

| Capa | Estado |
|---|---|
| Async runs + processor + drainer + retry + ops center | **implementado** |
| Env health center | este sprint (P7) |
| Scheduler mensual | **futuro** — metadata inerte + diseño (P8); sin automation |
| Deducción de créditos | **futuro** — regla decidida (completion), stub no-op (P9) |
| Billing checkout (Lemon Squeezy) | **futuro** — webhook de orders existe; sin suscripciones |
| Source engine (discovery de cuentas) | **el gap de valor más grande** — arquitectura en P10; sin scraping |
| QA en vivo browser/Supabase | **manual pendiente** — BETA_SMOKE_QA + playbook |
| Public report sharing / email delivery | futuro (decidido: no todavía) |

## Qué sigue siendo manual (operación beta)

- Disparar runs (customer o admin) — sin cadencia automática.
- QA pre-entrega (banners + checklist; sin approval workflow).
- Recovery más rápido que el cron diario (botón drainer / retry).
- Onboarding-linking de searches creadas por dashboard.
- Upgrades de plan / créditos (admin vía Supabase o Lemon orders).

## Narrativa de production-readiness

El sistema puede operar clientes beta con: runs async confiables y recuperables,
acceso a reportes con ownership, feedback durable, memoria por cuenta, QA admin,
y visibilidad operacional — todo sin tocar la base de datos a mano para los casos
comunes. Lo que falta para "producción completa" es: scheduling mensual real,
billing, un source engine más fuerte, y QA en vivo del deploy.
