# LeadLens Vault → Report Pipeline Bridge v0

**Documento vivo.** El Vault deja de ser solo almacenamiento: es la primera fuente
compliant e interna de oportunidades para reportes. Complementa
`LEADLENS_LEAD_HUNTER_ARCHITECTURE.md` y `LEADLENS_SAAS_VAULT_ARCHITECTURE.md`.

## Propósito

Cadena estratégica: **Lead Hunter → Vault → Review → Report Pipeline → Customer Workspace.**
El bridge selecciona companies/signals **aprobados** del Vault para un ICP y los
convierte en `LeadCandidate[]` compatible con el pipeline de reportes existente.
Apollo no participa en superficies customer-facing.

## Selección (exclusion-first)

`selectVaultOpportunities(criteria)` en `lib/vault/vault-opportunity-selector.ts`.

Excluye por defecto, cada exclusión con razón nombrada y contada:
- `not_approved` — signal sin review approved (require_approved=true por defecto)
- `suppressed` — company suprimida o domain/company en suppression list
- `usage_rights_restricted` / `usage_rights_unresolved` — solo pasan permitted/licensed/customer_provided (require_permitted_usage_rights=true)
- `already_used` — mismo customer/order/monitor en vault_usage_history (exclude_used=true)
- `reserved_for_other` — reserva activa no expirada para otro cliente (include_reserved=false)
- `excluded_domain`, `too_stale`, `below_min_confidence`

## Scoring (determinista, explicable, 0–100)

ICP fit por overlap de keywords (0–25) + geografía (0–15) + industria exacta/adyacente
(0–15) + freshness date-driven (0–20) + confianza Vault (0–10) + evidencia con
provenance (0–10) + tipo de señal fuerte (0–5). Cada punto tiene una razón legible
(`match_reasons`). Nada inventado: sin fecha → freshness unknown → 0 puntos.

## Adapter (account-level, jamás contactos)

`convertVaultOpportunityToLeadCandidate` en `lib/vault/vault-to-lead-candidate.ts`:
company/domain/website/industry/location/signal_date/source_url/confidence (0–100→0–1),
`source: "vault"` (nuevo miembro de LeadSource), evidencia + why-now + vault ids en
`raw_context` para trazabilidad. **name/title/email/linkedin quedan undefined siempre.**

## Usage history / reservations

Helpers en `lib/storage/vault-store.ts`: `reserveVaultOpportunitiesForRun` (TTL 24h),
`recordVaultOpportunitiesUsed` (solo tras reporte real), `releaseVaultReservationsForFailedRun`,
`listVaultUsageForCustomer`. **Preview y dry-run nunca los llaman** — el smoke lo verifica.

## Flujo admin de prueba

`/admin/vault-report-bridge` (x-admin-token): formulario de criterios →
"Preview Vault opportunities" (selección + scores + razones + exclusiones) →
"Dry-run report payload" (el `LeadCandidate[]` exacto que recibiría el pipeline).
Estados claros: sparse warning, "not enough approved Vault opportunities yet",
Supabase/migración ausente.

## Limitaciones actuales / camino a automatización

- **No hay `/generate`**: el bridge produce payload dry-run, no reportes de cliente.
  Conectar la generación final = próximo sprint (alimentar el monitor pipeline con
  `source: "vault"` y llamar reserve → generate → recordUsed/releaseOnFail).
- Selección lee hasta LIST_LIMIT (100) signals/companies — suficiente para beta.
- ICP matching es keyword-overlap; un matcher semántico llega cuando haya volumen.
