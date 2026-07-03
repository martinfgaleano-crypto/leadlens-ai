# Async Run Execution v0

**Documento vivo** — arquitectura de ejecución de monitor runs. Actualizar si cambia el trigger, el processor o el modelo de retry.

## Estado anterior (síncrono)

`POST /api/monitor/[id]/run` y `POST /api/admin/searches/[id]/rerun` ejecutaban
`runLeadLensPipeline` dentro del request/response (minutos). Mitigaciones previas:
`maxDuration = 300` y cutoff de stale processing (15 min) para que un run matado
no bloquee la serie para siempre. Problema restante: el run matado se pierde,
el customer ve estados confusos, y un scheduler futuro no puede reusar el path.

## Arquitectura v0 (este sprint)

```
Customer/Admin "Run"
  → route valida (auth → ownership → entitlement → onboarding → dedup)
  → createMonitorRunJob() crea snapshot `processing` (search_id scoped) + is_baseline
  → route dispara fire-and-forget al processor interno (con secret)
  → route responde RÁPIDO: { job_id, status: "processing", is_baseline }
  → UI hace polling (runs endpoint / results page — ya construido)

Processor interno: POST /api/internal/monitor-runs/[jobId]/process
  → auth por secret (ver Seguridad)
  → snapshot debe estar `processing` y tener `search_id` (nunca legacy unscoped)
  → reconstruye onboardingData desde onboarding_requests
  → runLeadLensPipeline({ jobId, searchId, plan })
  → completeSnapshot / failSnapshot
```

## Seguridad del processor

- Header `x-internal-secret` debe igualar `INTERNAL_RUN_SECRET`; si esa env no
  existe, se acepta `ADMIN_SECRET_TOKEN` como fallback (mismo valor en header).
- Producción sin ningún secret configurado → **rechaza todo** (fail closed).
- Development sin secrets → permite con warning (misma convención que `requireAdmin`).
- El jobId NUNCA es la protección — es solo el identificador del trabajo.
- El processor no acepta jobs `completed`; no procesa jobs sin `search_id`.
- No re-chequea entitlement: el job solo existe si la ruta creadora ya lo autorizó
  (decisión documentada — el snapshot `processing` es el token de autorización).

## Modelo de fallo y recovery

| Escenario | Resultado | Recovery |
|---|---|---|
| Pipeline lanza error | `failSnapshot` → status failed | Admin retry (nuevo job) o customer re-run |
| Función matada mid-run | snapshot queda `processing` | Tras 15 min es "stale": dedup lo ignora, UI lo marca stalled, admin puede retry (re-procesa el MISMO job) |
| Fire-and-forget nunca llega al processor | snapshot `processing` sin worker | Igual que arriba — stale a los 15 min |
| Retry de failed | nuevo job (jobId nuevo) via mismo creator | baseline/comparación se re-derivan |

Retry admin: `POST /api/admin/monitor-runs/[jobId]/retry` —
processing+stale → re-dispara el processor sobre el mismo job;
failed → crea job nuevo con el mismo search_id y dispara el processor.

## Limitación conocida del trigger v0

El trigger es un fetch fire-and-forget server-side (mismo patrón que
`lemon-webhook` → `/api/process/search/[id]`). En serverless, ese fetch puede
morir si la función se congela tras responder. Aceptado en v0 porque:
(1) el snapshot `processing` ya existe y es visible, (2) el cutoff de 15 min
lo convierte en recuperable, (3) el admin retry re-procesa sin crear duplicados.
**Update 2026-07-02:** el drainer existe (`lib/monitor/job-drainer.ts` +
`/api/internal/monitor-runs/drain` + cron diario) — re-dispara jobs stale,
supersede duplicados y abandona jobs > 6h. Ver SELF_HEALING_MONITOR_INFRASTRUCTURE.md.
El upgrade restante es frecuencia (Pro: */15) o queue externa.

## Scheduler futuro

El scheduler mensual NO llamará al endpoint customer — llamará al processor path:
crear job via `createMonitorRunJob` (tras consultar entitlement) y procesarlo.
Sin cron activo hoy; ver SELF_SERVE_SAAS_ARCHITECTURE.md.

## Billing futuro

Punto de deducción de créditos decidido: **al completar exitosamente**
(`completeSnapshot`) — no en creación de job (evita cobrar runs muertos) ni en
delivery (no existe delivery separado). Sin deducción implementada hoy.

## Implementado ahora vs futuro

| Pieza | Estado |
|---|---|
| Shared job creator (`lib/monitor/run-jobs.ts`) | este sprint |
| Processor interno protegido | este sprint |
| Customer run responde rápido | este sprint |
| Admin rerun async | este sprint |
| Stale flags en UI + admin retry | este sprint |
| Queue externa / drenaje por cron | futuro |
| Deducción de créditos | futuro (en completion) |
| Scheduler mensual | futuro (mismo processor) |
