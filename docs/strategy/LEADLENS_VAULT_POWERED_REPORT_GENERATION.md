# Vault-Powered Report Generation v0

**El cierre del circuito:** Lead Hunter → Vault → Bridge → **Reporte real** → Customer.
Complementa LEADLENS_VAULT_REPORT_BRIDGE.md.

## Flujo de generate

`POST /api/admin/vault-report-bridge/generate` (x-admin-token, maxDuration 300):

1. Valida `customer_email` (obligatorio — ownership y usage necesitan dueño).
2. `selectVaultOpportunities` (exclusion-first; already-used del mismo cliente excluido). 0 seleccionadas → **422** con rejected_counts.
3. Adapter → `LeadCandidate[]` `source: "vault"` (account-level, sin contactos).
4. **Reserva** las companies (TTL default 24h, configurable `reserve_ttl_hours`).
5. Crea snapshot `processing` (jobId `vault-<ts>-<rand>`) — /results/:jobId muestra estado desde ya.
6. Corre `runLeadLensPipeline` con `candidatesOverride` — **cero provider discovery**, cero Apollo; research/qualification/report agents normales sobre los candidatos del Vault.
7. `completeSnapshot` → **solo entonces** `recordVaultOpportunitiesUsed` (usage_type `report_delivery`; jobIds texto van en notes porque `vault_usage_history.job_id` es UUID).
8. Devuelve `report_url` (/results/:jobId), job_id, usage_recorded, reservations_created.

## Failure lifecycle (probado en vivo)

Cualquier fallo del pipeline/persistencia → snapshot `failed` + `releaseVaultReservationsForFailedRun`
(match por `reservation_reason = "report run <jobId>"`) + **cero usage registrado** → 500 con razón segura.
Verificado E2E: un run que falló por créditos de Anthropic agotados dejó ambas reservas `released`.

## Ownership / acceso del cliente

Patrón existente sin cambios: el reporte vive en `snapshot_reports` y se abre por
`/results/<jobId>` (jobId no adivinable = el mismo patrón de entrega actual). El admin
copia el link con el botón "Copy customer link". `search_id` opcional lo engancha a la
serie del monitor del cliente (el workspace lo levanta como cualquier snapshot).

## Cómo probarlo (admin)

1. `/admin/vault-report-bridge` → criterios → Preview.
2. Con selección > 0 aparece "Generate customer report from Vault (N)" + warning.
3. Confirmar → espera (minutos) → link del reporte + usage/reservas.
4. Preview de nuevo con el mismo customer_email → los usados aparecen excluidos (`already_used`).

## Limitaciones v0

- Requiere créditos de Anthropic API (el pipeline usa Claude para research/report).
- El contexto comercial del cliente se deriva de los criterios del admin (no de un
  onboarding real) salvo que se pase `search_id`; suficiente para entrega admin-driven.
- Signals promovidos antes del fix 2026-07-11 quedaron `pending_review` — aprobar en
  /admin/vault-foundation o re-promover.
