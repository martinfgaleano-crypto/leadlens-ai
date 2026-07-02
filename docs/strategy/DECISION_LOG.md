# Decision Log

**Registro de decisiones estratégicas** — agregar una entrada por cada decisión significativa de producto, técnica o de negocio. No borrar entradas anteriores; si una decisión se revierte, agregar una nueva entrada que lo documente y explique por qué.

---

## Formato de entrada

```
### [YYYY-MM-DD] Título corto de la decisión
**Decisión:** Qué se decidió.
**Por qué:** Razón principal.
**Implicaciones:** Qué cambia o no cambia como consecuencia.
**Estado:** Vigente / Revertida / Superada por [referencia]
```

---

## Decisiones vigentes

---

### [2026] Pivote a Account-Level Opportunity Intelligence

**Decisión:** LeadLens pivota de ser una herramienta de lead database / contact scraping a ser una plataforma de Opportunity Intelligence a nivel de cuenta/empresa.

**Por qué:** El espacio de contact databases (Apollo, ZoomInfo, Clay) está saturado con players con ventaja de datos enorme. El diferenciador posible es inteligencia de oportunidad — explicar *por qué* una cuenta vale la pena, no solo *qué* cuenta existe.

**Implicaciones:** LeadLens no vende ni almacena emails personales, teléfonos, nombres individuales ni LinkedIn personales. El pipeline trabaja con datos a nivel de empresa, no de persona. Todo el scoring, feedback y Vault opera sobre cuentas, no sobre individuos.

**Estado:** Vigente.

---

### [2026] No Personal Data — Política core de producto

**Decisión:** LeadLens no vende ni almacena emails personales, teléfonos, nombres individuales ni LinkedIn personales.

**Por qué:** (1) Legal y compliance — reduce riesgo regulatorio significativamente. (2) Diferenciación — la propuesta es inteligencia de *empresa*, no de contacto. (3) Coherencia con el pivote a account intelligence.

**Implicaciones:** Esta restricción aplica a todo el stack — pipeline, Supabase, reportes, feedback, admin. Ningún agente debe buscar, almacenar ni retornar datos de personas individuales.

**Estado:** Vigente. No negociable.

---

### [2026] Propuesta central: "Find the B2B accounts worth contacting this week — and know exactly why"

**Decisión:** Esta frase es la propuesta de valor central de referencia para todas las decisiones de producto y comunicación.

**Por qué:** Captura las dos cosas que el ICP necesita: saber *cuáles* cuentas y saber *por qué* — sin generación de contactos personales y con evidencia explícita.

**Implicaciones:** Cualquier feature o cambio de producto que no sirva a este objetivo debe justificarse o descartarse. Cualquier copy que contradiga esta propuesta debe corregirse.

**Estado:** Vigente — sujeto a validación con prospectos reales.

---

### [2026] El Vault es el diferenciador defendible a largo plazo

**Decisión:** El diferenciador de LeadLens no es el modelo de IA en sí mismo, sino el **Vault** — la memoria propietaria por cliente que mejora con feedback acumulado.

**Por qué:** Los modelos de IA son commodities reemplazables. La memoria propietaria de cada cliente (qué empresas funcionaron, qué industrias generaron reuniones, qué señales son relevantes para su ICP específico) es difícil de replicar y aumenta con el tiempo.

**Implicaciones:** El Vault debe ser visible y explicable para el cliente, no solo operativo en backend. Sin visibilidad del Vault, el cliente no percibe el valor de permanecer suscrito.

**Estado:** Vigente. Vault MVP conservador implementado; Account Memory pendiente.

---

### [2026] No lanzar Monthly Monitor hasta tener Account Memory / Anti-Repetition y Evidence Quality visibles

**Decisión:** El Monthly Monitor no debe venderse a clientes nuevos hasta que Account Memory esté funcionando de forma visible y Evidence Quality esté implementado.

**Por qué:** Sin Account Memory, los reportes mensuales se repiten sin diferenciación clara → causa principal de churn temprano. Sin Evidence Quality visible, la promesa de mejora con el tiempo no es verificable por el cliente.

**Implicaciones:** El criterio de lanzamiento del Monitor es técnico, no solo comercial. Ver checklist completo en `PRODUCT_STRATEGY.md` sección H.

**Estado:** Vigente.

---

### [2026] Go-to-market inicial: outreach directo y orgánico, no ads fríos

**Decisión:** El canal de adquisición inicial es outreach directo (mensajes 1:1 a prospectos específicos) y crecimiento orgánico, no advertising pagado frío.

**Por qué:** Con los precios actuales de productos one-time, los ads fríos no son rentables — el CAC estimado por ads ($40–90) supera el margen de los productos de entrada. El outreach directo tiene CAC bajo (principalmente tiempo) y permite validar el mensaje de posicionamiento en conversaciones reales antes de escalar.

**Implicaciones:** No invertir en Meta Ads, Google Ads ni similares hasta tener (a) datos reales de conversión y (b) un plan del que el Monthly Monitor (LTV recurrente) sea el producto ganador.

**Estado:** Vigente hasta que haya datos reales de conversión que justifiquen otro canal.

---

### [2026] Regiones iniciales para Source Strategy: US/Canada, Colombia, México, UK

**Decisión:** Las 4 regiones prioritarias para el Source Access Layer son US/Canada, Colombia, México y UK.

**Por qué:** Combinan buena cobertura de fuentes públicas, costo razonable de acceso, y relevancia para el mercado inicial esperado de clientes.

**Implicaciones:** No invertir en mapear otras regiones (Europa completa, Brasil, Asia) antes de tener tracción comercial en estas 4. Ver `SOURCE_STRATEGY.md` para detalle.

**Estado:** Vigente.

---

### [2026] Output genérico es el riesgo #1

**Decisión:** El riesgo principal identificado es que el output de LeadLens se sienta genérico — reproducible con un chatbot en 20 minutos.

**Por qué:** Si el reporte no aporta inteligencia específica y verificable (evidencia con fuente y fecha, razón clara por qué esa cuenta es relevante para ese ICP), el cliente no tiene razón para pagar ni para renovar.

**Implicaciones:** Toda decisión de arquitectura de agentes, Evidence Quality, Source freshness y QA debe apuntar a eliminar este riesgo. Ver `QUALITY_STANDARD.md` para el estándar de vendibilidad.

**Estado:** Vigente. Riesgo no resuelto — Evidence Quality y detección de genericidad pendientes.

---

### [2026] Métrica clave de validación

**Decisión:** La métrica principal de validación de la tesis de negocio es: **porcentaje de compradores one-time que dan feedback útil y piden otro reporte o se suscriben al Monitor dentro de 30 días**.

**Por qué:** Esta métrica combina dos señales: (1) que el reporte fue lo suficientemente valioso para generar feedback, y (2) que el cliente quiere repetir la experiencia — lo que valida tanto calidad de output como retención.

**Implicaciones:** Instrumentar esta métrica desde el primer cliente real. No es posible calcularla sin (a) feedback persistente vinculado a job_id real y (b) seguimiento de si el cliente vuelve a comprar. La infraestructura de feedback job_id linkage implementada es el prerequisito técnico de esta métrica.

**Estado:** Vigente — no hay datos reales todavía.

---

### [2026] Próximo bloque estratégico prioritario: Account Memory / Anti-Repetition

**Decisión:** El siguiente bloque de desarrollo estratégico a priorizar es Account Memory / Anti-Repetition.

**Por qué:** Es el prerequisito bloqueante para: (1) lanzar el Monthly Monitor, (2) demostrar el valor del Vault al cliente, (3) reducir el riesgo de churn por reportes repetidos.

**Implicaciones:** Antes de implementar, diseñar la taxonomía completa de estados de cuenta (ver `RETENTION_ENGINE.md` sección E) en términos de negocio, no solo como especificación técnica.

**Estado:** Implementado — commit `377f9cd`. Ver `RETENTION_ENGINE.md` sección D para detalle.

---

### [2026-06-30] Evidence Quality actúa como guardrail sobre recommended_action, no como reemplazo de scoring

**Decisión:** Evidence Quality es una capa conservadora de metadata que puede bajar (nunca subir) la `recommended_action` según la fuerza de la evidencia disponible. Nunca modifica `fit_score`, `category` ni el orden de ranking.

**Por qué:** La alternativa de modificar el score numérico habría roto invariantes del pipeline (el ranking ya está computado cuando se aplica EQ). Además, evidencia débil no implica que la cuenta no sea un buen fit — solo implica que no está lista para outreach directo hoy.

**Implicaciones:**
- `source_count = 0` → `insufficient` (techo: `add_to_watchlist`)
- Sin `signal_date` en schema hoy → `fresh_signal_count` siempre 0 → nivel `high` inalcanzable hasta implementar Source Access Layer
- Orden de pipeline: Vault → Account Memory → Evidence Quality → report agent → `applyEvidenceQualityToReport`
- `do_not_show` (exclusión por Account Memory) ocurre antes de Evidence Quality — correcto, ya excluida antes de llegar a EQ
- Best-effort: si EQ falla, el pipeline continúa sin modificación

**Estado:** Implementado — `lib/quality/evidence-quality.ts`. Ver `QUALITY_STANDARD.md` sección D para detalle.

---

### [2026-06-30] Source Access & Freshness Layer v0: metadata interna, no nuevas fuentes

**Decisión:** Implementar Source Layer v0 como capa de normalización de metadata de fuentes existentes — sin nuevas APIs, sin scraping, sin nuevas integraciones. El objetivo es estructurar lo que ya tenemos (LeadCandidate.source, source_url, evidence_discipline) en tipos explícitos con taxonomy definida.

**Por qué:** Sin Source Layer, Evidence Quality computa source_count y region_confidence con heurísticas duplicadas y source_types se llenaba con texto crudo. Esta capa centraliza esa lógica, elimina duplicación, y prepara la estructura para v1 cuando se agregue signal_date real.

**Implicaciones:**
- `signal_date` sigue siendo null en v0 — no existe campo estructurado en schema todavía
- `fresh_signal_count` sigue siendo 0 en v0 — requiere signal_date para ser > 0
- `evidence_quality = "high"` sigue siendo inalcanzable en v0 (fresh_signal_count = 0)
- `region_confidence` ahora puede ser "high" para US/Canada/UK (antes max "medium")
- Source Layer corre antes de EQ en pipeline — EQ consume sus campos cuando `source_layer_applied = true`
- Nombres de archivos: `signal-taxonomy.ts` y `signal-freshness.ts` (no "source-registry" — ya existe para providers)

**Estado:** Implementado — `lib/sources/signal-taxonomy.ts`, `lib/sources/signal-freshness.ts`.

---

### [2026-06-30] Report Source Metadata Integration v0: source metadata en ranked_opportunities y exports

**Decisión:** Implementar `applySourceFreshnessToReport()` para que el Source Layer v0 escriba metadata de fuentes y freshness en `ranked_opportunities` y en los exports (CSV/Markdown). No cambia scores, ranking, ni EQ guardrails.

**Por qué:** Después de Source Layer v0 e EQ, `ranked_opportunities` tenía metadata de EQ (`evidence_quality`, `recommended_action` corregida) pero no tenía metadata de fuentes ni freshness. El cliente no podía ver en el reporte si la evidencia tenía fecha confirmada o no, ni qué tipo de fuente respaldaba cada oportunidad.

**Implicaciones:**
- `OpportunityRanking` ahora incluye 6 campos opcionales: `evidence_strength_label`, `source_freshness_label`, `is_context_only`, `signal_role`, `source_coverage_note`, `source_name`, `source_type`
- `applySourceFreshnessToReport()` corre antes de `applyEvidenceQualityToReport()` en pipeline — EQ spreads encima sin perder campos de Source Layer
- `evidence_strength_label` derivado de `lm.evidence_quality` (ya calculado por EQ en el lead): "Strong / Moderate / Limited / Insufficient evidence"
- `source_freshness_label` viene de `lm.freshness_label` — en v0 siempre es "Context-only source · No timing signal" o "No signal date available · Freshness unknown" (nunca "Fresh signal")
- CSV export: 3 nuevas columnas — "Evidence Strength", "Source Freshness", "Source Name"
- Markdown export: líneas adicionales por cuenta — evidence strength, signal freshness, coverage note, source name
- Ningún dato personal introducido — `source_name` es solo hostname de dominio
- Scores, ranking y EQ guardrails sin cambio

**Estado:** Implementado — `applySourceFreshnessToReport()` en `lib/sources/signal-freshness.ts`, pipeline en `lib/pipeline.ts`, exports en `lib/utils/export.ts`.

---

### [2026-07-01] Signal Date v0: soporte estructurado conservador de signal_date

**Decisión:** Implementar soporte conservador de `signal_date` en el Source Layer. `signal_date` se lee exclusivamente de campos estructurados existentes — nunca de texto libre, nunca inventada, nunca de `discovered_at`.

**Por qué:** Con `signal_date` siempre null, `fresh_signal_count` era siempre 0 y Evidence Quality `"high"` era inalcanzable en producción. Esta limitación era artificial — algunos providers y el research agent SÍ tienen fechas explícitas disponibles. Signal Date v0 las usa cuando existen, sin cambiar el comportamiento cuando no existen.

**Fuentes aceptadas (en orden de prioridad):**
1. `LeadCandidate.signal_date` — fecha explícita del provider (ej. Apollo funding date en futuro, mock/manual)
2. `EvidenceClaim.date` — fecha explícita en claims de tipo `verified_public_signal`, solo cuando el research agent la extrae de una fecha de calendario literal en raw_context/web_context

**Validación estricta (`validateSignalDate`):**
- Debe ser parseable como fecha real
- No puede ser fecha futura
- No puede ser mayor a 3 años (señal demasiado antigua para ser accionable)
- Inválido → null

**Implicaciones:**
- `signal_date` permanece null cuando no hay fecha estructurada — sin cambio de comportamiento
- `fresh_signal_count > 0` solo cuando `signal_date` válida Y `source_freshness === "fresh"`
- Evidence Quality `"high"` ahora es alcanzable con fecha válida + `source_count >= 2`
- Nunca se extrae fecha de expresiones como "recently", "last month", "a few weeks ago"
- Research agent recibe instrucciones explícitas: solo `date` cuando hay fecha de calendario literal en la fuente

**Estado:** Implementado — `validateSignalDate()`, `extractSignalDate()` en `lib/sources/signal-freshness.ts`; `EvidenceClaim.date` y `LeadCandidate.signal_date` en `types/index.ts`; prompt actualizado en `lib/agents/research-agent.ts`; datos de prueba en `lib/providers/mock-lead-provider.ts`.

---

### [2026-07-01] What Changed Since Last Report v0 — Phase 1A + 1B

**Decisión:** Implementar clasificación de cambios a nivel de cuenta en dos fases. Phase 1A: tag simple derivado de Account Memory. Phase 1B: tipo rico derivado de AM + EQ + Source Freshness + Signal Date + Vault + Feedback.

**Por qué:** El cliente necesita saber QUÉ cambió entre el reporte actual y el anterior para que el Monthly Monitor tenga valor. Sin esta capa, reportes repetidos parecen genéricos. La clasificación de cambios es el componente que convierte "mismo score" en "mismo score pero con nueva señal fresca" o "visto 3 veces sin novedad".

**Decisiones técnicas clave:**
- Phase 1A corre DESPUÉS de Account Memory hints, ANTES de Source Layer — solo necesita category y score previos.
- Phase 1B corre dentro de `applyChangeSinceLastReportToReport`, DESPUÉS de EQ y Source Layer — necesita EQ, freshness, signal_date, vault actuales.
- `account_memory_last_feedback_signal` propagado a `lead.learning` para que Phase 1B pueda detectar `excluded_by_feedback`.
- `change_tag` (Phase 1A) preservado para backwards compatibility; `change_type` (Phase 1B) es la taxonomía rica.
- Orden de prioridad: feedback negativo > new_account > revived > fresh_signal > stale > priority up/down > repeated_no_change > new_evidence > repeated_with_new_evidence > still_relevant > no_meaningful_change.

**Implicaciones:**
- `ChangeType`: 12 tipos en `types/index.ts`
- `change_summary.by_type` y `change_summary.client_visible_count` en `LeadLensReport`
- `client_visible`, `suppression_reason`, `change_label`, `change_reason` por oportunidad en `ranked_opportunities` y `lead.learning`
- `previous_*` campos definidos en tipos pero null en v0 — sin snapshot comparison todavía
- Feedback negativo (`not_useful`, `irrelevant`, `wrong_fit`, `exclude_similar`) prevalece sobre score
- Score bajo con evidencia insuficiente NO puede ser `priority_increased`
- Contexto-only nunca genera `fresh_signal_added`
- Sin `signal_date` → nunca `fresh_signal_added`

**Estado:** Implementado — `lib/memory/change-classifier.ts` (Phase 1A + 1B), `types/index.ts` (`ChangeType`, campos nuevos en `LearningMetadata`, `OpportunityRanking`, `change_summary`), `lib/memory/account-memory.ts` (`account_memory_last_feedback_signal`), `lib/pipeline.ts` (wiring). No UI built. No scoring changes. No personal data.

---

### [2026-07-01] What Changed Since Last Report v0 — Phase 2: Previous Snapshot Comparison (Infrastructure Ready, Safely Disabled)

**Decisión:** Construir la infraestructura completa de comparación de snapshot previo (`PreviousOpportunitySnapshot`, `buildPreviousOpportunityMap`, `classifyRichAccountChange` con `prev`, pipeline wiring), pero deshabilitar el lookup del snapshot de manera segura hasta que exista un scope identifier válido en el schema de `snapshot_reports`.

**Problema identificado (Scope Safety Audit — 2026-07-01):** `getPreviousCompletedSnapshot` en su implementación inicial hacía un query global (`status=completed AND job_id != currentJobId`) sin ningún filtro de cliente, búsqueda o ICP. Esto significaba que LeadLens podría comparar el reporte actual de un cliente contra el reporte de otro cliente. Inaceptable para SaaS.

**Auditoría de scope disponible:**
| Identificador | ¿Existe en `snapshot_reports`? | ¿Disponible en `PipelineInput`? | Apto para scope |
|---|---|---|---|
| `user_id` | Sí (columna) | No | No — nunca escrito por `createProcessingSnapshot` ni `completeSnapshot` |
| `search_id` | **No** (no es columna) | No | No |
| `icp_id` | **No** (no es columna) | No | No |
| `customer_id` / `workspace_id` | **No** | No | No |
| `job_id` prefix | No encoding de cliente | N/A | No |

**Decisión técnica:** Ningún scope seguro disponible → `getPreviousCompletedSnapshot` devuelve `null` incondicionalmente. El pipeline y el clasificador ya manejan `null` de forma segura (proxy Phase 1B se activa). No se hace query a la BD.

**Infraestructura lista pero en espera:**
- `PreviousOpportunitySnapshot` interface — definida, lista para usar
- `buildPreviousOpportunityMap(prevReport)` — implementada, cero errores TS
- `classifyRichAccountChange(lm, action, prev?)` — acepta prev opcional; deltas verdaderos cuando `prev !== null`
- `applyChangeSinceLastReportToReport(report, prevReport?)` — acepta snapshot previo; cero cambios de comportamiento cuando `prevReport = null`
- `pipeline.ts` — llama `getPreviousCompletedSnapshot(id)` (best-effort); recibe null; pasa null al clasificador → proxy Phase 1B activo

**Cómo habilitar (upgrade path):**
- **Opción A (recomendada):** Agregar columna `search_id UUID REFERENCES lead_searches(id)` a `snapshot_reports`. Escribirla desde `PipelineInput` (agregar `searchId?: string`). En `getPreviousCompletedSnapshot(currentJobId, searchId)`, hacer query: `.eq("search_id", searchId).neq("job_id", currentJobId)`. Un snapshot se puede comparar si y solo si pertenece a la misma serie de búsqueda del mismo cliente.
- **Opción B (parcial):** Empezar a escribir `user_id` en `completeSnapshot`. Requiere pasar `userId` por `PipelineInput`. Sola, esta opción mezcla búsquedas distintas del mismo usuario. Solo segura si también se agrega `search_id` o `icp_id`.

**Estado:** Infraestructura implementada, lookup deshabilitado de forma segura hasta migration 027.

---

### [2026-07-01] Safe Snapshot Scope v0 — search_id en snapshot_reports

**Decisión:** Agregar `search_id UUID REFERENCES lead_searches(id)` a `snapshot_reports` como el scope identifier seguro para "What Changed" Phase 2. Este es el identificador mínimo que garantiza que un snapshot previo pertenece al mismo search/monitor series del mismo cliente.

**Por qué `search_id` y no `user_id`:**
- `user_id` solo acota por cliente pero mezcla todas sus búsquedas distintas. Un cliente que hizo dos búsquedas para ICPs diferentes tendría snapshots de distintos ICPs comparándose entre sí — inútil e incorrecto.
- `search_id` (lead_searches.id) representa una búsqueda específica con su propio ICP, países, industrias y nombre — garantiza que comparamos el mismo monitor series.
- Adicionalmente, `user_id` nunca se escribe actualmente, mientras que `search_id` sí se puede propagar desde el caller que ya lo tiene.

**Implementación:**
- `supabase/migrations/027_snapshot_search_scope.sql`: columna nullable + índice compuesto `(search_id, created_at DESC)` con `WHERE search_id IS NOT NULL`.
- `SnapshotRecord` interface: campo `search_id: string | null`.
- `createProcessingSnapshot(jobId, plan, searchId?)`, `completeSnapshot(..., searchId?)`, `failSnapshot(..., searchId?)`: todos aceptan `searchId` opcional y lo escriben cuando está disponible.
- `getPreviousCompletedSnapshot(currentJobId, searchId?)`: devuelve null si `searchId` es falsy (nunca hace query global); cuando `searchId` está provisto, query `.eq("search_id", searchId).eq("status","completed").neq("job_id", currentJobId).order("created_at",{desc}).limit(1)`.
- `PipelineInput`: agrega `searchId?: string`.
- `pipeline.ts`: destructura `searchId` de input; solo llama `getPreviousCompletedSnapshot` cuando `!IS_DEMO && searchId`.
- `/api/process/route.ts`: acepta `searchId: z.string().uuid().optional()` en body; propaga a `runLeadLensPipeline`, `createProcessingSnapshot`, `completeSnapshot`, `failSnapshot`.

**Callers que NO pasan searchId (safe by default):**
- `/api/demo/route.ts`: demo mode — `IS_DEMO` guard bloquea el lookup igualmente.
- `/api/admin/jobs/[id]/run/route.ts`: legacy SaaS admin flow — sin searchId → `getPreviousCompletedSnapshot` devuelve null → Phase 1B proxy activo.

**Cómo activarlo en el Monthly Monitor:** El trigger que llama `/api/process` con `searchId = lead_search.id` activa automáticamente el scope. No se necesita código adicional.

**Estado:** Implementado. `supabase/migrations/027_snapshot_search_scope.sql`, `lib/storage/snapshot-store.ts`, `types/index.ts` (`PipelineInput`), `lib/pipeline.ts`, `app/api/process/route.ts`. TypeScript: 0 errores. No UI. No scoring. No datos personales.

---

### [2026-07-01] Monthly Monitor Manual Rerun v0 — POST /api/admin/searches/[id]/rerun

**Decisión:** Implementar el plumbing backend mínimo para ejecutar manualmente un run del AI pipeline asociado a un `lead_searches.id` existente, usando `search_id` como scope para la historia de snapshots y la comparación de "What Changed".

**Por qué este approach:**
- El endpoint `/api/admin/searches/[id]/generate` ya existente usa el flow de Apollo (generación de leads), no el AI pipeline (`runLeadLensPipeline`). Un nuevo endpoint separado evita contaminar ese flow.
- Admin-only (requiere `x-admin-token`) — no hay superficie de ataque pública.
- El scope via `search_id` (migration 027) garantiza que cada run queda scoped al mismo monitor series y puede participar en "What Changed" comparisons.

**Guards implementados:**
1. **Dedup guard:** Si ya existe un snapshot con `status=processing` para el mismo `search_id`, el endpoint retorna HTTP 409 en lugar de iniciar otro run.
2. **Onboarding data required:** Si no existe `onboarding_requests.search_id = searchId`, retorna HTTP 422 con mensaje claro — el pipeline no se puede ejecutar sin datos de entrada.
3. **Baseline detection:** Si no hay snapshots `completed` para el `search_id`, el run se marca como `is_baseline=true` en la respuesta.

**Reconstrucción de OnboardingData desde onboarding_requests:**
- `company_name` → `onboarding_requests.company_name`
- `offer_description`, `company_description`, `value_proposition` → `onboarding_requests.what_you_sell` (misma fuente, mejor disponible)
- `target_customer_description` → `onboarding_requests.ideal_customer` (nullable, fallback a texto genérico)
- `tone` → `"direct"` (default)
- `contact_email` → `onboarding_requests.email`

**Archivos creados/modificados:**
- `app/api/admin/searches/[id]/rerun/route.ts` — nuevo endpoint POST admin-only
- `lib/storage/snapshot-store.ts` — agrega `listSnapshotsForSearch(searchId, limit?)`
- `app/admin/searches/[id]/page.tsx` — Card "Monthly Monitor — AI report" en sidebar derecho (tipo RerunLog, handler handleRerun, inline result log)

**Estado:** Implementado. TypeScript: 0 errores. No cron/scheduler. No UI rediseño. No billing. No Apollo. No datos personales.

---

### [2026-07-01] Monthly Monitor Sprint — Run History Backend + Admin UI + Change Presentation

**Decisión:** Completar el ciclo mínimo de Monthly Monitor admin-controlado en un sprint controlado (P0–P5): índice de performance, historia de runs backend, vista admin de historia de runs, columna Source Coverage en CSV, y presentación de "What Changed" en exports.

**Implementación:**
- **P0** — `028_onboarding_search_id_idx.sql`: índice parcial sobre `onboarding_requests(search_id)` para el lookup del rerun endpoint.
- **P1** — `GET /api/admin/searches/[id]/runs`: historia de runs admin-only, scoped por `.eq("search_id")` (sin fallback global). Extrae `change_summary` vía JSON-path select (`report_json->change_summary`) — el `report_json` completo nunca sale de la BD para listados. Deriva `is_baseline` (primer run completed, oldest-first) y `run_index`. Respuesta: `{ search_id, total_runs, latest_status, latest_completed_at, has_processing_run, runs[] }`.
- **P2** — Card "Monthly Monitor — AI report" en admin search detail ahora muestra: resumen de serie (latest status, total runs, last completed), warning de run en processing, e historia compacta con badges BASELINE/COMPARED, conteos por run y visible changes. El botón de rerun se preserva; la historia se recarga tras cada rerun.
- **P3** — CSV export gana columna "Source Coverage" ("Limited region coverage" cuando `limited_region_coverage`). Único campo P3 ausente; evidence strength, freshness y recommended action ya estaban en ambos exports.
- **P4** — Presentación de What Changed en exports:
  - Markdown: sección con conteos de change types client-visible. Título "What Changed Since Last Report" **solo** cuando algún `previous_*` field está poblado (comparación real); si no, "Current Change Signals" con nota explícita de baseline. Línea "Change:" por cuenta solo cuando `client_visible === true`.
  - CSV: columna "Change" con `change_label` (copy customer-safe de `CHANGE_TYPE_LABELS`), vacía cuando no es client-visible.
  - `no_meaningful_change` / `repeated_no_change` se omiten de los conteos de la sección (ruido).

**Reglas de seguridad respetadas:** sin scheduler, sin comparación global de snapshots, sin cross-search history, sin cambios de score/ranking, sin datos personales en UI/exports nuevos, demo mode intacto, `/api/process` one-off intacto.

**Estado:** Implementado. TypeScript: 0 errores en cada bloque. Commits: P0 `3bca76b`, P1 `38d583a`, P2 `9a959c1`, P3 `209a3a8`, P4 `5f0deed`.

---

### [2026-07-01] SaaS Readiness Sprint v0 — Customer-Facing Account-Level Surfaces

**Decisión:** Convertir la inteligencia backend existente en superficies de producto customer/admin coherentes, sin scheduler, billing ni automatización customer-facing.

**Implementación (commits P0–P8):**
- **P0 (`00a1b0e`)** — Rewrite completo de `/results/[jobId]` como Account Opportunity Report. Eliminados todos los campos de contacto personales (nombres, emails, LinkedIn, títulos de persona); el contact data legacy en `report_json` nunca se renderiza. El mismo rewrite entrega las partes page-level de P1, P3 y P4 (un solo archivo coherente):
  - *P1 — Customer Report View:* cards por cuenta con recommended action (labels legibles, no enums), why-it-fits (account thesis + fit reasons), why-now (why_now + confirmed signals), evidence strength, signal freshness, source context, coverage note. Fallbacks seguros: "Not available", "Signal date not confirmed". Orden = ranking existente, nunca re-ordenado client-side.
  - *P3 — Customer What Changed:* sección con chips de conteos client-visible. "What Changed Since Last Report" solo cuando `previous_*` fields poblados; baseline muestra "Current Change Signals" con nota. Noise types sin label customer (omitidos). `change_label` por cuenta solo con `client_visible === true`.
  - *P4 — Feedback UX:* barra de feedback account-level por card → `POST /api/feedback/opportunity` existente (job_id + company + domain + score + category). Mapeo: Good fit→useful, Not relevant→irrelevant, Already contacted→contacted, Weak evidence→generic, Show more like this→add_to_vault, Do not show again→exclude_similar.
- **P2 (`be5333a`)** — `GET /api/monitor/[id]/runs`: run history customer-scoped con patrón Bearer-JWT existente (`/api/credits`). Ownership check contra `lead_searches.user_id` ANTES de cualquier query a snapshots; searches ajenas devuelven 404. Dashboard search detail gana sección Monthly Monitor (total runs, latest status, last completed, BASELINE/COMPARED, links a reports).
- **P5 (`0f0b88a`)** — `GET /api/admin/searches/[id]` devuelve `has_onboarding_request`; el admin ve warning explícito y botón de rerun deshabilitado cuando falta el linkage (el 422 ya no es sorpresa).
- **P6 (`a91a10c`)** — QA flags por run en el endpoint admin de runs, derivados de agregados existentes: "Run failed", "Low/insufficient evidence dominates" (`evidence_quality_counts`, débil >50%), "Mostly repeated / no meaningful change" (noise types >50% de lead_count). Chips NEEDS REVIEW en admin UI. **Sin flag de freshness dominance:** el reporte no tiene agregado de freshness; agregarlo requiere un cambio pipeline-side (futuro).
- **P7 (`65bd451`)** — Product Readiness QA Checklist v0 en QUALITY_STANDARD.md.

**Decisión pendiente (flagged, NO tocada):** la tabla de leads del dashboard customer (`app/dashboard/searches/[id]`) y su CSV export siguen mostrando contact_name/email/linkedin de `lead_results` — es el deliverable pagado del flow Apollo legacy. Removerlo es una decisión de producto del founder (afecta lo que clientes existentes compraron), no una limpieza técnica. Recomendado como bloque propio.

**Estado:** Implementado. TypeScript: 0 errores tras cada bloque.

---

### [2026-07-02] Beta-Ready Product Sprint v0 — Coherencia, Seguridad y Operabilidad

**Decisión:** Endurecer el shell de producto alrededor de la inteligencia del Monthly Monitor: posicionamiento account-level consistente, acceso a reportes con ownership, monitor center, feedback durable, QA operable.

**Implementación (commits P0–P10):**
- **P0 (`7c44207`)** — `BETA_READINESS_SURFACE_MAP.md`: clasificación de cada superficie. Hallazgo crítico: `GET /api/report` solo leía la tabla legacy `reports` — los links de monitor runs devolvían 404.
- **P1 (`baff8a2`)** — Dashboard customer account-level: la tabla y CSV de `/dashboard/searches/[id]` ya no seleccionan/muestran/exportan contact_name, email, linkedin_url, title, seniority ni email_quality. Copy "leads/contacts" → "accounts/opportunities" en dashboard home, searches list y detail. Data en DB intacta; tooling admin intacto.
- **P2 (`ab707b3`)** — Acceso a reportes protegido: `GET /api/report` resuelve `snapshot_reports` primero (arregla los links de monitor), y aplica: demo abierto / admin token total / customer Bearer JWT con ownership `search_id → lead_searches.user_id` / unscoped y legacy `reports` admin-only / no-owner → 404 sin confirmar existencia. Report page usa token de sesión y descargas blob autenticadas.
- **P3 (`aa3b6f3`)** — Monitor center: `GET /api/monitor/overview` (2 queries batched, user-scoped) + columna Monitor en searches list con link a latest report y badge BASELINE/COMPARED.
- **P4 (`eaf38d9`)** — Report v2: badge de contexto de run en header (comparación real vs baseline, probado por `previous_*`), strips de Evidence Quality (de `evidence_quality_counts`) y Signal Freshness (conteo de labels existentes; unknown visible como unknown).
- **P5 (`b2d9bb3`)** — Feedback hardening: dedup API (job_id+company+feedback_signal → `already_saved`), estado de error en UI, "already recorded" cuando aplica. **Pendiente futuro:** escribir `search_id` en feedback requiere que el reporte lleve search context (LeadLensReport no tiene search_id hoy).
- **P6 (`8790a65`)** — `lib/monitor/readiness.ts`: verdict único por serie (6 estados) derivado de estado existente, sin schema. Banner color-coded en admin.
- **P7 (`e4fe310`)** — Copy customer-safe de readiness en monitor center ("Needs internal review" cuando el último run falló sin reporte).
- **P8 (`1ef6339`)** — `REPORT_ACCESS_MODEL.md`: lookup, reglas por caller, estados, superficies de delivery, y lo que no existe por diseño (sin public sharing, sin email delivery, sin scheduler, sin acceso customer a legacy).
- **P9 (`45a1de5`)** — `BETA_SMOKE_QA.md`: 15 pasos con verificación curl/SQL y pasos de seguridad bloqueantes.

**Límites intactos:** sin scheduler, sin billing, sin CRM, sin email automation, sin contact database, sin cambios de scoring/ranking, demo mode aislado, `/api/process` one-off sin cambios de comportamiento (solo el GET de reportes cambió).

**Estado:** Implementado. TypeScript: 0 errores tras cada bloque.

---

### [2026-07-02] Fully Self-Serve SaaS Foundation Sprint v0

**Decisión:** Habilitar el journey self-serve completo: el customer crea, corre, lee, da feedback y vuelve a correr su monitor sin admin — con guards idénticos a los del path admin.

**Implementación (commits P0–P11):**
- **P0 (`b225cc4`)** — `SELF_SERVE_SAAS_ARCHITECTURE.md`: mapa implemented/partial/admin-only/self-serve/future.
- **P1 (`8a4414a`)** — `LeadLensReport.search_id` (contexto, nunca ranking); pipeline lo setea con `searchId`; `/api/report` loguea mismatches snapshot/report y los oculta a no-admins. Legacy y one-off intactos.
- **P2 (`befacc1`)** — Feedback con `search_id` (columna existía desde 023 — sin migración); results page lo propaga desde `report.search_id`. Dedup se mantiene en job_id+company+signal (job_id subsume search scope; filtrar por search_id duplicaría legacy rows).
- **P3 (`7391fe2`)** — **`POST /api/monitor/[id]/run`**: Bearer JWT → ownership (404) → entitlement (403) → onboarding linkage (422) → dedup (409) → pipeline con searchId → snapshots scoped → respuesta con is_baseline + copy customer-safe. CTA "Run monitor" en el detail (deshabilitado processing/setup incompleto). Admin rerun y `/api/process` intactos.
- **P4 (`544e099`)** — `lib/monitor/lifecycle.ts`: 7 estados customer-journey derivados, labels seguros, badge en el monitor section.
- **P5 (`46bdda0`)** — `lib/usage/entitlements.ts` (creado en P3): gate honesto = plan no-free O credit_balance > 0, sin deducción por run, sin Stripe, sin fake paid. `/api/credits` expone entitlements.
- **P6 (`4d23cfb`)** — Overview con `has_onboarding_link` batched; lista muestra "Setup incomplete"; el form de creación declara honestamente que los searches de dashboard no son monitores completos.
- **P7 (`de18689`)** — Command center en dashboard home: totales (monitors/ready/processing/attention/setup), CTA al reporte más reciente, copy honesto de cadencia manual.
- **P8 (`edc423c`)** — Decisión de gates: QA admin es advisory; `needs_review` no bloquea acceso customer (approval workflow = futuro con estado persistido).
- **P9 (`5f79b98`)** — `npm run smoke:selfserve`: probe read-only de auth/ownership (matriz de reporte anon/owner/non-owner/admin, leak check de LinkedIn personal, search_id en payload); pasos mutantes quedan manuales.
- **P10 (`b2d47de`)** — Docs de scheduler/billing readiness: camino futuro con guards idénticos, Lemon Squeezy como proveedor, entitlements.ts como único punto de decisión.

**Self-review adversarial:** (1) admin-detection en /api/report hereda el modo dev-sin-token de requireAdmin — consistente con el resto del admin API; (2) entitlement falla cerrado ante error de DB (bloquea run con copy de upgrade — trade-off aceptado); (3) fix aplicado: check no-op en smoke script; (4) runs customer-triggered comparten el riesgo de timeout serverless del path admin (pre-existente, documentado); (5) sin leaks encontrados en overview/runs/run (todo filtrado por user_id antes de tocar snapshots).

**Estado:** Implementado. TypeScript: 0 errores tras cada bloque.
