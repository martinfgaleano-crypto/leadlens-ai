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
