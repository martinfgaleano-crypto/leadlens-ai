# LeadLens Lead Hunter Architecture v0

**Documento vivo** — el sistema de descubrimiento de oportunidades. Complementa `LEADLENS_DATA_SOURCING_COMPLIANCE.md` y `SOURCE_ENGINE_ARCHITECTURE.md`.

## Qué es (y qué no es)

Lead Hunter descubre **empresas con señales de oportunidad** desde fuentes públicas/permitidas y las convierte en candidatos con evidencia para el Vault. **No es un Apollo clone**: no busca contactos, no extrae emails, no scrapea LinkedIn, no envía outreach, no produce deliverables de cliente directamente.

## Ciclo (review-first)

```
Brief (admin define qué cazar)
  → Sources (URLs permitidas + contexto pegado — v0 manual, sin fetch)
    → Engine (policy gate → candidates con evidencia/confidence/freshness)
      → Review queue (approve / reject / reserve — humano siempre)
        → Vault (promote: source → company dedup → signal; NUNCA contactos)
          → [futuro] Vault → report pipeline bridge
```

## v0: manual_sources

- El admin pega source URL + contexto (`Company — evidence` en la primera línea).
- El engine NO hace fetch de ninguna URL — provenance-only, cero scraping.
- Si no puede extraer un nombre de empresa con confianza, **no inventa uno**.
- Caps: max_candidates por brief (≤ 50 hard cap), 25 sources por invocación.

## Futuro: provider_search

`LeadHunterDiscoveryProvider` es el contrato de adapter (`lib/lead-hunter/providers/`).
El placeholder lanza error intencionalmente. Para activar descubrimiento automático:
1. Env: `TAVILY_API_KEY` (u otro provider revisado).
2. Revisión de compliance de los términos del provider para este uso.
3. El adapter DEBE clasificar cada resultado por el policy engine y respetar los caps.
Nunca LinkedIn, nunca paywall, nunca enrichment de contactos.

## Policy engine (código, no solo política)

- Categorías permitidas: company_website, public_job_post, public_news, public_directory_permitted, event_conference_page, marketplace_listing, public_registry, customer_provided, other_permitted_public_source.
- Restringidas (= `safety_status: blocked`, jamás promovibles): apollo_without_license, zoominfo_without_license, linkedin_scraping, paywalled_source, private_database, personal_social_profile, unknown_rights.
- Rights `unverified/unknown` → `needs_review`: puede quedar pending, pero **approve y promote fallan (422)** hasta que el admin resuelva los derechos o rechace.
- Freshness derivada de fecha estructurada (regla Signal Date v0 — nunca inventada; fecha futura = unknown).
- Confidence 0–100 determinista y explicable (evidencia + fecha + tipo de señal + riesgo de categoría).

## Promoción al Vault

`promoteLeadHunterCandidateToVault`: source (provenance intacta) → company (dedupe por domain) → signal (solo si existe) → vault_* ids guardados en el candidato. **Nunca crea vault_contacts** — Lead Hunter descubre empresas y señales, no personas.

## Sin exposición customer-facing

Todo es `/admin/lead-hunter/*` + `/api/admin/lead-hunter/*` con x-admin-token. Cero rutas públicas. El bridge Vault→reportes es un sprint futuro.
