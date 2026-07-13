# Vault Generation Ops v0

**La generación desde el Vault es async y production-safe.** Complementa
LEADLENS_VAULT_POWERED_REPORT_GENERATION.md.

## Ciclo async (todo probado en vivo)

```
POST /api/admin/vault-report-bridge/generate  (x-admin-token)
  → valida + selecciona + adapta
  → RESERVA (24h TTL)
  → snapshot processing con metadata (_vault_generation) = job durable
  → trigger fire-and-forget → 202 { job_id, report_url, selected, reservations }
POST /api/internal/vault-report-bridge/process  (x-internal-secret, fail-closed en prod)
  → claim idempotente (completed = skip, nunca doble usage; claim fresco = skip)
  → runLeadLensPipeline con candidatesOverride
  → éxito: completeVaultGenerationJob → recordVaultOpportunitiesUsed
  → fallo: releaseVaultReservationsForFailedRun → failVaultGenerationJob (metadata preservada)
```

El customer nunca ve la metadata: al completar, `report_json` es el reporte con un
marker mínimo (`source_mode/generated_by/usage_recorded`); criterios/vault ids/candidatos
solo existen mientras el job está processing/failed (estados que /results no expone).

## Reservas / usage

- Preview y dry-run: cero side effects (smoke lo verifica en código).
- Reserva ANTES del pipeline; usage SOLO después de persistir el reporte.
- Fallo → reservas liberadas automáticamente (match por `reservation_reason = "report run <jobId>"`).
- Trigger perdido → el job queda processing y pasa a "stuck (stale)" tras el cutoff de 15 min → retry admin.

## Retry / stuck

`/admin/vault-report-bridge` → "Recent Vault generation runs": badges
processing/completed/failed/stuck, Open report, Copy link, **Retry** y **Release reservations**
(solo failed/stuck). Retry: libera reservas del job viejo y encola un job NUEVO desde los
criterios guardados — la selección fresca re-valida approval/rights/suppression/usage
(no resucita oportunidades bloqueadas después). Completed → 409 siempre.
Processing fresco → 409 (espera al cutoff).

Rutas: `GET .../runs`, `POST .../runs/[jobId]/retry`, `POST .../runs/[jobId]/release-reservations` — todas admin.

## AI readiness

`npm run check:supabase`: presencia de ANTHROPIC_API_KEY (WARN si falta). La presencia
NO verifica créditos — con `ALLOW_AI_HEALTH_PROBE=true` hace un probe de 1 token
(costo ínfimo) y marca FAIL con el mensaje real si los créditos se agotaron.
El 202 del generate incluye `anthropic_key_present` y la UI avisa.
**Créditos activos en console.anthropic.com → Plans & Billing son prerequisito.**

## Signals pendientes (pre-fix)

`npm run approve:demo-signals` aprueba SOLO signals de companies demo
("Demo Company…"/"[DEMO]"); los no-demo se listan y se saltan salvo FORCE=true
(revisar manualmente en /admin/vault-foundation). La promoción actual ya crea
signals approved, así que esto es solo limpieza histórica.

## Prueba manual

1. Créditos activos → `/admin/vault-report-bridge` → criterios + customer email → Preview.
2. "Queue Vault report generation (N)" → 202 inmediato con link.
3. Abrir el link: processing → reporte completo al terminar.
4. Runs list: estado, retry/release en failed/stuck.
5. Sin créditos: el job falla limpio, reservas liberadas, error visible, retry disponible.

## Limitaciones

- El processor corre en una invocación (maxDuration 300s) — plan pro (100 leads) necesitará
  particionado o el drainer; sample/starter caben bien.
- El claim de concurrencia es best-effort (ventana de carrera pequeña aceptada en v0).
- Sin cron drainer propio para jobs vault stuck — visibles y retryables manualmente.

## Actualización 2026-07-13 — Delivery al workspace

El generate acepta search_id (campo "Link to monitor" en la UI) → el reporte aparece
solo en el workspace del cliente; sin search_id es link-only y el admin lo ve señalado
(202 delivery_note + pill en runs list). Al completar un job linkeado se crea una
notificación in-app. Ver LEADLENS_CUSTOMER_VAULT_DELIVERY.md.
