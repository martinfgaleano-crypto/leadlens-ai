# LeadLens ML Architecture v0 (consolidated)

Consolida: architecture + integration map + runbook + labeling policy + shadow
scoring + source layer (decisión documentada: un doc denso > diez delgados).

## Arquitectura

Python aislado (`ml/`, venv propio, sklearn) = training/inferencia. Next.js =
control plane (extracción, registro, shadow, admin). Artifacts locales en
`ml/artifacts|runs` (gitignored, checksum sha256); nunca públicos, nunca cargados
desde fuentes no confiables. Nada del ML corre en request/response del cliente.

## Disposición del paquete (v0; v2 no provisto en el entorno)

- Integrados: contracts, dataset factory, weak labelers, splits (group+temporal,
  leakage assert), training (LogReg + HistGradientBoosting, EXCLUDE de baseline),
  inference+OOD, shadow compare, fixtures (DEMO_ONLY).
- Adaptados: run_real (gates), run_infer (batch), pandas-3 dtype patch, SQL →
  migración 032 propia.
- Demo-only: fixtures/, artifacts demo (banner TECHNICAL VALIDATION).
- Rechazados: SQL preliminar (sin RLS/tenant), simulated-gold de run_demo para
  datos reales.

## Feature schema reconciliation (autoritativo)

real snapshot → lab: company_key→sha256 hash · search_id→monitor_key hash ·
evidence_quality string→float (high .9/medium .6/low .3/insufficient .1) ·
freshness_bucket→{fresh,recent,stale}_signal_count · job_id→candidate_group
(lineage, excluido de features). Prohibidos como features: tenant/user ids,
nombres, emails, free text, fit_score/category del baseline (→ baseline_meta,
en EXCLUDE). Missing honestos: contradiction/claim counts=0 documentado,
soft_fit_score=null (baseline-derived), candidate pools = gap (captura futura
aditiva). Nunca se fabrica un feature ausente.

## Labels (provenance obligatoria)

customer_feedback (máxima autoridad; sentiment ±1; partial excluido del target
v0) > human_gold (review queue, reasons obligatorios) > llm_silver (3 judges
independientes, JSON validado, sin ver labels/baseline/otros judges;
provider_unavailable honesto) > weak (labelers del lab, abstención, consenso).
El baseline determinista JAMÁS es ground truth.

## Gates de entrenamiento (probados en vivo)

<40 ejemplos o <10/clase o fixtures presentes o campos prohibidos →
blocked_* explícito. Corrida real 2026-07-15: 2 ejemplos reales extraídos del
primer reporte post-Foundation → blocked_insufficient_data (correcto).

## Shadow

`npm run ml:shadow -- <jobId> [--model demo|real]`: infiere, calcula shadow rank
vs baseline, would_enter/leave_topK, OOD; guarda en ml_predictions (o local si
032 pendiente). Modelo demo siempre etiquetado TECHNICAL VALIDATION. Preference
shadow aparte (lib/intelligence/shadow-preference: solo inferred_validated,
caps ±5/±10, observation-only). Ranking customer: intocado (smoke lo verifica:
selector/scorer/decision no importan módulos ML).

## Source Access Layer

Contrato provider-agnostic + adapters Tavily/Brave/Serper/Firecrawl (env:
TAVILY_API_KEY, BRAVE_SEARCH_API_KEY [fallback BRAVE_API_KEY], SERPER_API_KEY,
FIRECRAWL_API_KEY) + fixture offline. Credencial ausente → health unavailable
con la variable exacta. Apollo/LinkedIn automation: excluidos. Benchmark
same-query: unique/marginal URLs, dated/official ratio, latency; grounded yield
= "not yet measured" hasta pasar por extracción+review (nunca estimado).
Provenance por resultado: provider/query/url/canonical/rank/fechas.

## Runbook

1. Aplicar 031 y 032 (SQL listos) → probe 24/24.
2. Generar reportes reales (créditos activos) → `npm run ml:dataset`.
3. Review queue (/admin/intelligence/review) → gold labels.
4. ≥40 ejemplos con soporte → `npm run ml:train <jsonl> ml/runs/real`.
5. `npm run ml:shadow -- <jobId> --model real` → comparar en growth page.
6. `npm run ml:test` (pytest 4/4) + `npm run smoke:intelligence-expansion`.
Model card: ml/docs/LEADLENS_ML_MODEL_CARD_TEMPLATE.md (del paquete).
