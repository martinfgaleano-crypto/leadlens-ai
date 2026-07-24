# Checkpoint — Provider Coverage Recovery + Pilot Readiness (2026-07-24)

## Estado
- Rama `main`, tree limpio. Último commit: **`4f...` (ver `git log -1`)** sobre `d781660`.
- `npm run release:check` → **exit 0** (tsc + ~28 suites + build, todo verde).
- Decisiones de producto APROBADAS y protegidas (NO reabrir): ranking actionability-first (capa sobre fit→signal→evidence, empates conservan orden) + carril channel_access (solo físico/retail/hospitality/wellness; produce investigate/validate_first con flag `channel_fit_not_buying_intent`; nunca act_now solo).

## Providers (probe en vivo 2026-07-24)
- anthropic: OK · supabase: OK · firecrawl: OK (~600 cr)
- **brave: RECUPERADO (200)** · serper: agotado (400 "not enough credits") · tavily: agotado
- Consecuencia: solo 1 search saludable → `searchCoverageReadiness().sufficient = false` (requiere ≥2). Amor de Gea se AUTO-BLOQUEA antes de gastar LLM.

## Cambios de esta sesión (todos commiteados, verdes)
1. `lib/ops/provider-health.ts`: `classifyProviderError()` (taxonomía compartida: exhausted/invalid/rate_limited/unknown) + `searchCoverageReadiness()` (≥2 search saludables).
2. `lib/discovery/company-first-discovery.ts`: search `.catch` preserva `{ok,error}`; `metrics.provider_status` por-run distingue available / healthy_no_results / exhausted / etc.; `providers_missing` = solo los que ERRARON; `coverage_limitation` nombra agotados.
3. `scripts/sources/run-amor-de-gea-pilot.ts`: gate de cobertura ANTES de gastar LLM → `STOPPED_INSUFFICIENT_SEARCH_COVERAGE` (exit 3) salvo `AMOR_ALLOW_LIMITED_COVERAGE=true`. (Ya tenía el fix de budget-split 60/40 de la sesión anterior.)
4. `scripts/fixtures/provider-error-taxonomy.test.ts` (9 tests) + en `release:check`.

## Cómo ejecutar Amor de Gea válido (cuando ≥2 search se recuperen)
```
# 1. recargar serper (o tavily) hasta tener ≥2 search en verde
# 2. verificar: el harness ya no se auto-bloquea
PILOT_E2E_MAX_USD=3 AMOR_PILOT_PHASE=discovery npm run pilot:amor-de-gea
# → debería entrar en full_discovery (urls>0, ≥2 providers), no provider_limited
```
Forzar modo limitado (entrega do_not_deliver, solo para probar el flujo):
```
AMOR_ALLOW_LIMITED_COVERAGE=true PILOT_E2E_MAX_USD=3 npm run pilot:amor-de-gea
```

## Próximo paso exacto (siguiente sesión)
Objetivo: primera corrida Amor de Gea en `full_discovery`.
1. Probe barato de providers (curl, sin llamadas costosas): confirmar ≥2 search en verde. Si no, NO correr.
2. Con ≥2 verdes: `PILOT_E2E_MAX_USD=3 AMOR_PILOT_PHASE=discovery npm run pilot:amor-de-gea`.
3. Revisar manifest: `operating_mode` debe ser `full_discovery`; validar candidatos con el trace; channel_access sigue en investigate, no opportunity.
4. Si el manifest sale bien → fase `full` con budget acotado para generar el reporte piloto real.
NO re-auditar el repo. NO reabrir ranking/channel_access. Leer este checkpoint primero.
