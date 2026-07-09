# LeadLens Data Sourcing Compliance

**Documento vigente** — reglas duras de sourcing de datos. Toda fuente nueva pasa por aquí antes de tocar código.

## Regla central

LeadLens NO es una base de datos de contactos y NO revende datos de terceros.
LeadLens es: AI-assisted B2B research + signal-based account intelligence +
human-reviewed outreach drafts.

## Apollo (y providers con licencia)

- **Una suscripción estándar de Apollo NO permite revender sus datos en
  deliverables de clientes.** Apollo es un provider LICENSED-ONLY.
- Apollo solo puede alimentar deliverables de clientes si existe un acuerdo de
  reseller/data licensing explícito.
- Sin licencia, Apollo puede usarse únicamente para prospección comercial
  INTERNA de LeadLens — nunca en entregables.
- **Enforcement en código** (no solo política): `APOLLO_LICENSED_PROVIDER_ENABLED=false`
  por default; la presencia de `APOLLO_API_KEY` NO activa Apollo.
  `lib/apollo/client.ts` lanza error de licensing y `lib/providers/provider-registry.ts`
  reporta `customer_facing_allowed: false` salvo flag explícito.
- Lo mismo aplica a ZoomInfo o cualquier provider equivalente: licensed-only.

## Prohibiciones absolutas

- Scraping o automatización de LinkedIn (perfiles, mensajes, conexiones).
- Bypass de paywalls.
- Reventa de bases de datos de terceros en crudo.
- Fuentes cuyo valor sea identificar personas (vs. empresas).
- Ignorar solicitudes de supresión/borrado — se registran en
  `vault_suppression_list` y se chequean antes de cualquier uso (`isSuppressed`).

## Categorías de fuente

**Permitidas:**
- Cuentas/listas provistas por el propio cliente
- Sitios web corporativos
- Directorios públicos con uso permitido
- Job posts públicos (agregados a nivel de empresa)
- Páginas públicas de eventos/conferencias
- Noticias públicas: funding, expansiones, lanzamientos
- Registros de empresas/cámaras donde su uso sea permitido
- Providers pagos SOLO si la licencia permite uso customer-facing

**Restringidas:**
- Apollo sin licencia · ZoomInfo sin licencia
- LinkedIn scraping/automatización
- Fuentes con paywall
- Bases de datos privadas
- Datos personales/sociales innecesarios para outreach B2B

## Requisitos por registro (Vault)

Todo lead/contact/signal en la Vault debe tener:
- `source_url` + `source_type` (provenance obligatoria — el intake lo exige)
- `source_confidence` / `confidence_score`
- `usage_rights_status` (`unverified | permitted | licensed | restricted`)
- freshness trackeada (`retrieved_at`/`published_at`/`freshness_status`)
- `review_status` — nada llega a un cliente sin revisión humana
- respeto de supresión (email/domain/company)

Ver: `supabase/migrations/029_vault_foundation.sql`, `lib/vault/vault-types.ts`,
`SOURCE_ENGINE_ARCHITECTURE.md` (adapter pattern futuro).

## Lead Hunter (actualización 2026-07-09)

Lead Hunter implementa esta política en código (`lib/lead-hunter/lead-hunter-policy.ts`):
categorías restringidas → blocked (jamás promovibles al Vault); rights unverified →
approve/promote bloqueados con 422 hasta resolución; URLs de LinkedIn/Apollo/ZoomInfo
se clasifican automáticamente como restringidas. v0 es manual-sources: cero fetching,
cero scraping. Ver LEADLENS_LEAD_HUNTER_ARCHITECTURE.md.
