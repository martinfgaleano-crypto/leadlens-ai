# Repository ML + Source Audit (Fase 0, 2026-07-15)

## Estado del repo
- HEAD `ff75cd2` (Intelligence Foundation COMPLETE). Working tree: sprint Expansion v0
  en curso (source layer, growth index, shadow preference, LLM judges, migración 032,
  ml/ vendoreado, scripts ml/, 3 páginas admin) — se commitea por fases en este sprint.
- Migración 031: **NO aplicada** (probe: learned_preferences MISSING). 032: no aplicada.
  Todo lo dependiente degrada honesto (verificado en vivo sprint anterior).

## Paquete ML
- `leadlens-intelligence-lab-v2.zip`: **NO existe en el entorno** (solo v0:
  sha256 e8d3af2e8fd5…, ya auditado, vendoreado en ml/, pandas-3 patch aplicado,
  tests 4/4, demo E2E ok). La carpeta extraída en Downloads es v0 idéntico.
- Capacidades v2 anunciadas cubiertas parcialmente por extensiones propias:
  quality gates (≈import gateway/quarantine), run_real/run_infer, growth index,
  shadow ranking, registry (migración 032 + manifests). Resto (drift, experiment
  tracking, serving, cost intelligence) queda fuera del vertical slice — documentado.

## Matriz de integración (v0 → repo)
| Componente | Real | Decisión |
|---|---|---|
| contracts/feature schema | lib/intelligence/feature-snapshot | Adaptar (adapter lib/ml/snapshot-adapter.ts) |
| dataset factory/splits/training/inference/shadow/fixtures | ml/src/leadlens_ml | Reutilizar (vendoreado + run_real/run_infer) |
| SQL preliminar | supabase/migrations/032 | Reemplazado (esquema propio, RLS patrón 024/029) |
| tenant/monitor | user_id / search_id (hashed en export) | Adaptar |
| labels | opportunity_feedback + ml_labels | Adaptar |

## Credenciales de providers (presencia, nunca valores)
- TAVILY_API_KEY: presente pero **vacía**. BRAVE_SEARCH_API_KEY, SERPER_API_KEY,
  FIRECRAWL_API_KEY: **ausentes** de .env.local/.env. Adapters implementados
  env-gated → health `unavailable` con el nombre exacto de la variable. Añadir
  claves = activación inmediata sin código.
- Apollo: excluido por decisión estratégica (no provider, no fallback, no benchmark).

## Baseline
- tsc limpio pre-sprint; ranking fixture capturado (scratchpad/ranking-baseline.json,
  igualdad funcional verificada en el sprint Foundation).
- Reporte real con snapshots: job vault-1784064884643-v8sr6g encolado con créditos
  activos (verificación pendiente en Fase de dataset).
