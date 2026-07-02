# Self-Healing Monitor Infrastructure v0

**Documento vivo** — cómo los monitor runs se recuperan de triggers perdidos, jobs stalled y fallos, sin trabajo manual en la base de datos.

## Lifecycle async actual (base)

Ruta valida → job `processing` (search_id scoped) → 202 → trigger fire-and-forget
→ processor interno ejecuta → completed/failed → UIs hacen polling.
Cutoff de staleness: 15 min (`PROCESSING_STALE_MS`).

Debilidad conocida: el trigger fire-and-forget puede perderse en serverless.
Sin drainer, la recuperación era manual (admin retry).

## Drainer (este sprint)

`lib/monitor/job-drainer.ts` + `POST|GET /api/internal/monitor-runs/drain`

Reglas del drainer (bounded y seguro):
1. Solo considera jobs `processing` **con `search_id`** — unscoped legacy nunca.
2. Solo re-dispara jobs **STALE** (> 15 min). Un job fresh puede estar corriendo
   de verdad — re-dispararlo crearía dos pipelines racing sobre el mismo job.
   Consecuencia: un trigger perdido se auto-recupera en el siguiente drain
   posterior al cutoff.
3. **Supersede**: si una serie tiene varios jobs stale, solo el más nuevo se
   re-dispara; los anteriores se marcan `failed` ("Superseded by newer run") —
   auditables, nunca borrados.
4. **Skip por fresh**: si la serie tiene un job fresh en vuelo, sus stale se
   marcan superseded, nada se re-dispara.
5. **Techo de recovery (anti-loop)**: jobs `processing` con más de
   `MAX_RECOVERY_AGE_MS` (6 h) se marcan `failed` ("Abandoned — exceeded
   recovery window"). Un job que muere siempre por timeout no se re-dispara
   infinitamente: con drain horario son ~5 intentos máx; con drain diario, 1.
6. **Batch limit**: default 10, máx 25 por invocación.
7. `dry_run=true` clasifica sin tocar nada.

Resumen estructurado: `{ scanned, retriggered, superseded, abandoned, skipped_fresh, errors }`.

## Seguridad del drainer

Acepta cualquiera de:
- `x-internal-secret` == `INTERNAL_RUN_SECRET` (o fallback `ADMIN_SECRET_TOKEN`),
- `x-admin-token` válido (para el botón "Run drainer" del admin ops),
- `Authorization: Bearer <CRON_SECRET>` — **Vercel Cron envía este header
  automáticamente cuando la env var CRON_SECRET existe en el proyecto.**

Producción sin ningún secret → rechaza todo (fail closed). Dev sin secrets →
permite con warning (convención requireAdmin).

## Invocación

- **Cron**: entrada en `vercel.json` — diaria (compatible con plan hobby; el
  cron existente ya es diario). En plan Pro, bajar a `*/15 * * * *` para
  recovery de ~15 min.
- **Manual**: `curl -X POST "$APP/api/internal/monitor-runs/drain" -H "x-internal-secret: $SECRET"`
  o botón "Run drainer" en admin ops.

## Recovery paths por escenario

| Escenario | Auto (drainer) | Manual (admin) |
|---|---|---|
| Trigger perdido | re-trigger al pasar cutoff | Retry en run row / ops page |
| Worker muerto mid-run | igual (stale) | igual |
| Job failed | no (auditable; requiere decisión) | Retry → job NUEVO (dedup aplica) |
| Job stale duplicado | superseded → failed | — |
| Job processing > 6 h | abandoned → failed | Retry → job nuevo |
| Job unscoped legacy | ignorado siempre | rechazado (422) |

## Estados customer-visibles

Processing → "Processing" · stale → "Taking longer than expected — you can start a new run" · failed → "Needs internal review" · completed → "Report ready". El drainer no introduce estados nuevos para el customer: recupera hacia completed/failed.

## Relación con el scheduler futuro

El scheduler mensual creará jobs via `createMonitorRunJob` (tras entitlement) y
los disparará via processor. El drainer es su red de seguridad: cualquier job
programado cuyo trigger se pierda se recupera solo. Sin scheduling activo hoy.

## Implementado ahora vs futuro

| Pieza | Estado |
|---|---|
| Drainer helper + endpoint protegido | este sprint |
| Cron diario del drainer | este sprint (hobby-safe) |
| Admin ops overview + acciones | este sprint |
| Env health (processor/drainer/cron ready) | este sprint |
| Cron de alta frecuencia | futuro (plan Pro) |
| Scheduling mensual de customers | futuro |
| Deducción de créditos | futuro (en completion; ver ASYNC_RUN_EXECUTION.md) |
