# LeadLens — Documento de Continuidad (post-Fable 5, 2026-07-22)

Para continuar SIN re-auditar el repo. Complementa: `docs/OPERATIONS_RUNBOOK.md`, `docs/FIRST_PILOT_RUNBOOK.md`, `docs/DISCOVERY_COMPANY_FIRST.md`.

## 1. Qué es
Account Opportunity Intelligence B2B: encuentra cuentas que vale la pena investigar AHORA y explica qué cambió, cuándo, por qué importa, evidencia, counterevidence, qué validar y qué acción tomar. NO es base de contactos ni scraper. Sin Apollo/PDL/PII/LinkedIn autenticado.

## 2. Pipeline de inteligencia (lib/discovery/)
Orquestador: `company-first-discovery.ts` → `runCompanyFirstDiscovery(icp, criteria, tier, limit)`.
Secuencia: `needs-map.ts` (LLM→fallback `vertical-packs.ts` `packNeedsMap`) → `company-universe.ts` (LLM extract→fallback seeds del pack; stoplist `AMBIGUOUS_NAME`; dominios verificados del pack se propagan) → búsqueda Brave+Serper+Tavily en paralelo → `isJunkUrl` prefilter (social/TLD extranjero) → extracción ordenada por (evento-en-título, `sourceUtilityScore`) via `lib/sources/access/extractors.ts` `extractWithFallback` (Tavily→Firecrawl) → `date-resolver.ts` (`parseSpanishDate`: "27 de marzo de 2026", "hace 4 meses") → `opportunity-test.ts` (fail-closed) → identidad: short-circuit con `company.domain` del pack (conf ≤85) o `corporate-identity.ts` `resolveCorporateIdentity` (3 providers) + `signalMatchesIdentity` (homonym guard) → `entity-role.ts` `assessEntityRole` (word-boundary `tokenIndex`; atribución "CEDI/planta de X"→asset_owner) → `sentiment.ts` `classifyDirection` (distress block; regulatory/disruption según producto) → `materiality.ts` → `commercial-fit.ts` `assessCommercialFit` (hard blockers: outsourced/no-op/product-unrelated/disqualifier) → `corroborationTier` → `quality-rubric.ts` `scoreOpportunityV2` → `counterevidence.ts` `assessCounterevidence`+`applyCounterevidence` (ajusta, nunca rescata/rechaza sola) → `adversarial-review.ts` `adversarialReview` (reject→no emite) → emisión.
- Asociación empresa↔texto: `companyNameInText` (word-boundary; fix del FP "Inter"⊂"internacional").
- Trace: `metrics.deep_trace` (incluye homonym rejects con conf). Métricas completas en `DiscoveryMetrics`.
- Aprendizaje: `source-utility.ts` + `source-intelligence-store.ts` (`.leadlens/source-intelligence.json`, priors ÷2).
- Presupuestos: `TIER_BUDGET` (preview/brief/intelligence/premium) + cap 5 min.

## 3. Providers y ops (lib/ops/)
- `provider-health.ts`: `PROVIDER_DEFS` (7), `probeAll` (caché 5 min), `deriveAlerts`, `RUN_REQUIREMENTS` (qué necesita cada tipo de run), `recommendedAction`. Estados: ok/exhausted/invalid/rate_limited/missing/unknown/not_tested; datos etiquetados confirmed_by_provider/observed_by_leadlens/estimated/unavailable.
- `usage-ledger.ts`: contadores por proveedor (instrumentado en `lib/sources/access/providers.ts` y `lib/anthropic.ts`), `.leadlens/usage.json`.
- Consola: `/admin/operations/providers` (página `app/admin/operations/providers/page.tsx`, API `app/api/admin/operations/providers/route.ts`, requireAdmin, probe forzado 1/min, test individual auditado).
- **Estado 2026-07-22:** Anthropic `exhausted` — ES LÍMITE DE USO configurado (reset 2026-08-01; subirlo en console.anthropic.com, recargar saldo NO basta). Brave 402. Serper "Not enough credits". Tavily 432. Firecrawl OK (897 conf.). Supabase OK.

## 4. Packs verticales (moat + degradado)
`lib/discovery/vertical-packs.ts`: fleet_software / logistics_automation / operational_software. Cada uno: operations, problems, triggers, señales ES, familias, términos de operación, CE hints, hard blockers, patrón de tesis, seeds reales CO (17 con `domain` verificado por HTTP 2026-07-22 — nunca inventar dominios nuevos sin verificar). `matchVerticalPack` por industrias+oferta; `packNeedsMap` FUSIONA buying_signals del cliente con las del pack.

## 5. Validación sin providers
`scripts/sources/provider-limited-validation.ts`: pipeline profundo completo sobre newsrooms corporativos + URLs con provenance, vía Firecrawl. Etiqueta `provider_limited` + `fresh_extraction|reused_verified_evidence`. Último run n=5: 5/5 rechazos correctos, 0 FP. Output: `ml/data/company-first/provider-limited-*.json`.
Benchmark full: `npm run bench:company-first` (3 ICPs) → `ml/data/company-first/benchmark-*.json` (incluye deep_trace impreso).

## 6. Producto
- Tiers: Preview $7 (≤2) / Brief $25 (≤6) / Intelligence $59 (≤12, 4 dossiers) / Premium $129 (internal-only, "Early access · Guided pilot only"). Catálogo/entitlements server-side; codes preview_launch_v0…premium_launch_v0. NO conectar pagos (Lemon Squeezy inactivo por diseño).
- Landing: `app/demo-pipeline/page.tsx` (4 idiomas; hero "worth contacting"; CTAs "desde $7"). Pricing = sección `#pricing` (no existe /pricing).
- Pilot Console: `/admin/pilot`. Reportes: `/results/[jobId]` y `/results/[jobId]/brief`. Feedback/outcomes: POST `/api/feedback/opportunity` (`feedback_signal` incluye investigated/saved/contacted/replied/meeting/qualified/rejected/won/lost/thesis_confirmed/thesis_wrong → tabla `opportunity_feedback`).
- Tablas clave: lead_searches, snapshot_reports, opportunity_feedback, icps, account_memory, learned_preferences, vault_* (migraciones hasta 038 aplicadas; RLS activo; data-origin isolation fail-closed).

## 7. Tests y build
Suites: `test:intelligence-v2` (28) · `test:intelligence-v3` (40) · `test:deep-validation` (26) · `test:company-first` (22) · `test:date-es` (11) · `test:counterevidence` (27) · `test:provider-health` (10) · `test:entity-v3` (25) · `test:production-eligibility` (17) = **206**. `npx tsc --noEmit` y `npm run build` limpios (NUNCA build con dev server corriendo). Dev server: launch config "leadlens-project-dev" (la config "leadlens-dev" apunta a copia stale del Desktop).

## 8. Known bugs / limitaciones
- `git push` bloqueado en esta máquina (keychain) → commits locales; push manual.
- Serper/Tavily se agotan con ~2-3 benchmarks/día en planes actuales.
- Recall real sin medir con stack completo (nunca hubo todos los providers vivos + fixes a la vez). Emitidas limpias confirmadas: 0 (el único emitido histórico fue el FP "Inter", corregido y testeado).
- esbuild/tsx transient en scripts ad-hoc concurrentes → usar harnesses commiteados.
- Preview/Brief E2E: ejecutados en sprints previos con motor viejo; PENDIENTES con el motor actual (bloqueo: Anthropic).

## 8b. Modos operativos (sin bloqueo por falta de search providers)
`DiscoveryMetrics.operating_mode` (company-first-discovery.ts) — clasificado post-hoc: `full_discovery` (≥1 search provider dio URLs) · `targeted_discovery` (0 URLs de búsqueda → se investiga el sitio corporativo de seeds con dominio verificado; source_type company_website) · `provider_limited` (harness con URLs conocidas/evidencia previa) · `analysis_only` · `stopped`. Cada run registra providers_available/missing, coverage_limitation, fresh_search/extraction/reused counts, confidence_impact. El reporte antepone una nota honesta de cobertura en el empty-state (pipeline.ts, vía `getLastDiscoveryCoverage()` en public-signal-provider.ts → `report.coverage_context`). **Serper NO se recompra hasta validar ROI** (`lib/ops/search-provider-roi.ts` `assessSearchRoi`: do_not_buy hasta ≥3 corridas confirmadas de cada modo con ventaja ≥1/run; jamás proyecta). Consola muestra `RUN_REQUIREMENTS` y `recommendedAction`.

## 9. Decisiones vigentes
Ranking/scorer/selector INTACTOS; ML en shadow. Hard blockers nunca se relajan; QA humana no rescata. Nada de cuotas ni relleno. Degradación siempre visible (`degraded_seed_pack`, `provider_limited`). Créditos jamás inventados.

## 10. Próximos pasos exactos (en orden)
1. Martín: subir límite de uso de Anthropic + recargar Serper (≈$50) y Tavily; `git push`.
2. Con providers verdes: `npm run bench:company-first` → revisar deep_trace → confirmar ≥2 emitidas limpias (o diagnosticar con el trace).
3. Preview E2E → Brief E2E mismo ICP (runbook de piloto) → comparación $7 vs $25 → segunda corrida (consistencia).
4. Primer piloto real (docs/FIRST_PILOT_RUNBOOK.md) + outcomes en opportunity_feedback.
5. Persistir calibración humana acumulada (true/false positives por banda de score) — base del moat.

## 11. Hardening local 2026-07-21 (sin deploy)

- `/api/process/search/[id]`: ya no acepta UUID como autorización. Owner JWT,
  `INTERNAL_RUN_SECRET` o admin explícito; dashboard, cron, webhook y admin
  actualizados. Tests 7/7.
- Retirados con HTTP 410: `/api/upload`, `/api/onboarding`,
  `/api/onboarding/submit`, `/api/onboarding/upload-logo`; eran superficies
  legacy de contactos/PII sin callers vigentes.
- `/api/demo` falla cerrado salvo `DEMO_MODE=true`, limita input y marca la
  respuesta `demo`/`data_origin=demo`.
- Checkout tiene doble gate explícito y no crea jobs cuando está cerrado. Una
  secret antigua por sí sola no lo reactiva. No se eligió ni activó provider.
- `npm run release:check`: 238/238 assertions y build 130/130 páginas verdes.
- Demo/eventos ahora tienen payload caps y rate limit por instancia; eventos de
  pago/refund y `amount_paid` no se aceptan desde navegador. Antes de self-serve
  se requiere rate limiting distribuido.
- `npm run pilot:e2e:preflight` carga `.env.local`, no llama providers y falla
  antes de gasto. Estado observado: credenciales base presentes, pero
  `ALLOW_MOCK_LEADS_WITH_REAL_AI=true` e `INTERNAL_RUN_SECRET` ausente; por eso
  el E2E real quedó correctamente detenido.
- HTTP integration local: `test:http-security` 12/12; rutas retiradas,
  checkout/demo cerrados y auth legacy verificadas sin DB/provider.
- Preflight v2 registra commit/dirty state, presupuesto explícito (cap USD 5),
  pagos cerrados y health `not_checked`; jamás equipara key presente con health.
- Harness `npm run pilot:e2e:run`: requiere preflight verde + confirmación exacta,
  hace probes mínimos, exige Anthropic/Supabase + search/extraction verdes y solo
  entonces corre benchmark. Guarda health, usage, benchmark, deep trace,
  adjudication.csv y comparación Preview/Brief. Validado que hoy se detiene antes
  de probes con `provider_calls_made=false`.
- Rúbrica humana v1 y runbook de piloto v2: critical → HOLD/FAIL; SLA inicial 2
  días hábiles, máximo 1 piloto, soporte/incident/refund/seguimiento definidos.
- `npm run release:check` vigente: 263/263 assertions; build 130/130.
