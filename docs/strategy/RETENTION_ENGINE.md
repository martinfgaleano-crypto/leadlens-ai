# Retention Engine

**Documento vivo** — actualizar cuando se implemente Account Memory, cuando haya datos reales de churn, o cuando cambie el modelo de suscripción.
Usado por: Claude normal (diseño del loop de retención) y Claude Code (implementación de Account Memory, Anti-Repetition, Vault).

---

## A. Propósito

Documentar la lógica de negocio que justifica por qué un cliente debería renovar el Monthly Monitor, para que el diseño técnico (Account Memory, Anti-Repetition, Vault) tenga una razón de negocio explícita detrás, no solo una especificación técnica aislada.

---

## B. Decisiones actuales

- La recurrencia depende de cinco mecanismos: **Account Memory**, **Anti-Repetition**, **Evidence Quality**, **Source Freshness**, y **"What changed since last report"**.
- El **Vault** (memoria de feedback acumulada por cliente) es la pieza de defensibilidad más importante del negocio.
- **No se debe vender el Monthly Monitor a clientes nuevos hasta que Account Memory esté funcionando de forma visible**, no solo en backend.

---

## C. Métricas clave *(SUPUESTO, sin datos reales aún)*

| Métrica | Umbral | Nota |
|---|---|---|
| Churn mensual tolerable en etapa inicial | 8–12% | Por encima de 15–20% mensual el modelo de suscripción no es sostenible |
| Conversión "compra one-time" → "se suscribe al Monitor" | 15–25% deseado | SUPUESTO |
| Retención promedio objetivo | 8–12 meses por cliente suscrito | SUPUESTO |

---

## D. Qué está implementado

- Feedback MVP persistente asociado a `job_id` real.
- Vault MVP conservador (`applyVaultHints()`) que agrega metadata explicable sin cambiar scoring agresivamente.
- Vault Memory UI dentro de Opportunity Cards (validated pattern / caution pattern / insufficient feedback).
- Feedback linkage: `opportunity_feedback.job_id` apunta al snapshot real del run.
- **Account Memory / Anti-Repetition** (commit `377f9cd`): tabla `account_memory`, clasificación de 8 estados, integración en pipeline (best-effort), badge en LeadCard en 4 idiomas. Demo jobs no escriben. Supabase failure no bloquea pipeline.
- **What Changed Since Last Report v0 — Phase 1A + 1B** (`lib/memory/change-classifier.ts`): clasificación de cambios a nivel de cuenta en dos capas:
  - *Phase 1A* (`ChangeTag`): `new | promoted | demoted | score_up | score_down | unchanged` — derivado de Account Memory únicamente (pre-Source Layer).
  - *Phase 1B* (`ChangeType`): 12 tipos comercialmente significativos (`new_account`, `new_evidence`, `fresh_signal_added`, `signal_became_stale`, `priority_increased`, `priority_decreased`, `repeated_with_new_evidence`, `repeated_no_change`, `excluded_by_feedback`, `revived_account`, `still_relevant`, `no_meaningful_change`) — derivado de AM + EQ + Source Freshness + Signal Date + Vault + Feedback.
  - *Phase 2* (`previous_*` fields): infraestructura completa construida y scope seguro implementado. `snapshot_reports` ahora tiene columna `search_id UUID REFERENCES lead_searches(id)` (migration 027). `getPreviousCompletedSnapshot(currentJobId, searchId?)` requiere `searchId` explícito — sin él devuelve null, nunca hace query global. Cuando `searchId` es provisto (Monthly Monitor trigger), busca `.eq("search_id", searchId).eq("status","completed").neq("job_id", currentJobId)` — garantiza mismo-search scope. `PipelineInput` tiene `searchId?`; `/api/process` lo acepta en body. Cuando no hay snapshot previo disponible o `searchId` no se provee, Phase 1B proxy activo como fallback.
  - Ambas capas son metadata-only: nunca cambian fit_score, category ni ranking.
  - `change_summary` en `LeadLensReport` incluye conteos por tipo y `client_visible_count`.
  - `client_visible` y `suppression_reason` disponibles por oportunidad.
  - `account_memory_last_feedback_signal` propagado a `lead.learning` para detección de feedback negativo.

---

## E. Qué falta

**Exclusión por feedback (`do_not_show`):** el flag existe y el pipeline lo respeta, pero el mecanismo para activarlo desde `exclude_similar` feedback aún no está conectado.

**Medición real** de churn y conversión (no hay datos de clientes reales aún).

**scope activo desde migration 027:** `snapshot_reports.search_id` existe y se escribe cuando el caller proporciona `searchId`. El Monthly Monitor trigger debe pasar `searchId` (lead_searches.id) en el body de `/api/process` para que el scope funcione. Runs sin `searchId` (demo, admin legacy) devuelven null seguro — Phase 1B proxy activo. `user_id` sigue sin escribirse; si se desea scope por usuario adicional en futuro, requiere pasar `userId` por `PipelineInput`.

**Monthly Monitor Manual Rerun v0:** `POST /api/admin/searches/[id]/rerun` permite ejecutar manualmente el AI pipeline para un `lead_searches.id` existente. Guards: dedup (409 si hay processing), onboarding data (422 si no hay `onboarding_requests.search_id`), baseline detection (`is_baseline=true` en respuesta cuando no hay snapshots completados previos). `listSnapshotsForSearch(searchId)` disponible en `snapshot-store.ts` para consultar historia de runs por series.

**Monitor Run History (implementado):** `GET /api/admin/searches/[id]/runs` devuelve la historia de runs de una serie (same-search only, nunca global), con `is_baseline`/`run_index` derivados de runs completados y `change_summary` (conteos, sin datos de cuentas) extraído por JSON-path. El admin search detail muestra la serie: latest status, total runs, last completed, warning de processing, y lista de runs con badges BASELINE/COMPARED. **Sin scheduler y sin automatización customer-facing todavía** — todos los runs son manuales y admin-only por diseño en esta etapa. Regla de copy en exports: "What Changed Since Last Report" solo cuando existe comparación real con snapshot previo; baseline/proxy se etiqueta "Current Change Signals".

**Self-Serve Foundation Sprint v0 (2026-07-02):** el loop de retención ya es operable por el propio cliente: Run monitor → Report ready → Feedback (ahora con `search_id` context) → Vault/Account Memory → siguiente run = comparación real. Entitlement gate honesto (plan/créditos reales) prepara el terreno para billing sin fake paid status. Cadencia sigue manual con copy honesto — el scheduler futuro reutilizará el mismo path con los mismos guards.

**Beta-Ready Product Sprint v0 (2026-07-02):** el dashboard customer es 100% account-level (tabla y CSV sin campos de contacto); acceso a reportes con ownership check (`REPORT_ACCESS_MODEL.md`); monitor center con overview batched y links a latest report; feedback con dedup (repetir el mismo feedback no crea filas duplicadas — protege la calidad del Vault); readiness status por serie (`lib/monitor/readiness.ts`) visible en admin y con copy customer-safe. Smoke QA de 15 pasos en `BETA_SMOKE_QA.md`. Sigue sin scheduler, sin billing, sin sharing público.

**Superficies customer-facing (SaaS Readiness Sprint v0):** `/results/[jobId]` es ahora un Account Opportunity Report account-level (sin contactos personales) con What Changed, evidence/freshness labels y barra de feedback por cuenta — el loop de retención (feedback → Vault → mejor próximo reporte) es visible y usable desde el reporte mismo. `GET /api/monitor/[id]/runs` (Bearer JWT + ownership check) alimenta la sección Monthly Monitor del dashboard del cliente: el cliente ve que LeadLens es un monitor recurrente con baseline y comparaciones, no un reporte one-off. Guardrail de onboarding: el admin ve cuándo una search no puede correr como monitor por falta de `onboarding_requests.search_id`. QA gate: chips NEEDS REVIEW por run antes de exponer a cliente.

---

## F. Riesgos

| Riesgo | Descripción |
|---|---|
| Vender Monitor sin Account Memory | Genera reportes mes a mes muy similares → causa más probable de churn temprano. |
| Clientes que no usan feedback | Si el cliente no da feedback, el Vault no aprende y la promesa de "mejora con el tiempo" no se cumple — rompe la tesis central de recurrencia. |
| Mayoría de clientes compra solo una vez | Puede indicar que el modelo correcto es reportes por evento/trimestrales en vez de suscripción mensual fija — sería un pivote de modelo, no un fracaso de producto. |

---

## G. Próximas acciones

1. Diseñar la taxonomía completa de estados de Account Memory (lista en sección E) en términos de negocio antes de pasar a especificación técnica.
2. Diseñar la vista de "what changed since last report" como elemento central del Results Page, no como feature secundaria.
3. Instrumentar desde el primer cliente real: tasa de uso del feedback, tasa de marcado "useful"/"meeting_booked", y si el cliente regresa sin que se le pida.
4. Establecer un proceso explícito de revisión de churn mensual una vez haya al menos 10 suscriptores activos.

---

## H. Criterios de éxito

La tesis de retención se considera validada cuando, en un grupo de al menos 10 suscriptores reales del Monitor durante 3 meses consecutivos, el churn mensual se mantiene por debajo de 12% y al menos 50% de los clientes interactúan con el feedback en cada ciclo.

---

## Por qué un cliente renovaría

El mercado cambia constantemente (nuevas empresas, nuevas señales, cuentas que suben o bajan de prioridad), y el feedback del cliente mejora la calidad de los reportes futuros. La renovación solo tiene sentido si el cliente puede **ver** ese cambio y esa mejora — de lo contrario, está pagando por la misma información repetida.

---

## Señales tempranas de churn a monitorear

- El cliente deja de dar feedback en oportunidades (señal de desconexión del producto).
- El cliente no abre o no revisa el reporte del mes (si esta métrica se puede instrumentar).
- Las oportunidades del nuevo reporte se sienten repetidas o sin evidencia nueva (señal directa de que Anti-Repetition no está funcionando).
- El cliente pide cancelar o pausa la suscripción explícitamente — registrar siempre el motivo declarado.
