# Quality Standard

**Documento vivo** — actualizar cuando se implemente Evidence Quality, Insufficient Evidence, o se formalice el checklist de QA.
Usado por: Claude normal (revisión de reportes antes de entrega) y Claude Code (implementación de Evidence Quality y detección de genericidad).

---

## A. Propósito

Establecer qué hace que un Opportunity Snapshot o Market Intelligence Report sea "vendible", para que exista un estándar objetivo de calidad antes de entregar cualquier reporte a un cliente real, en vez de un juicio subjetivo caso por caso.

---

## B. Decisiones actuales

- LeadLens debe preferir decir "evidencia insuficiente" antes que generar recomendaciones débiles con falsa seguridad.
- Ningún reporte debe entregarse a un cliente sin pasar por un checklist de QA mínimo.
- La detección de "genericidad" (output que se siente genérico/reproducible) es un criterio de calidad explícito, no solo una sensación.

---

## C. Métricas clave *(SUPUESTO de diseño, no validado aún con clientes reales)*

| Métrica | Valor | Nota |
|---|---|---|
| Score mínimo interno antes de vender un reporte | A definir numéricamente | Cuando exista el sistema de scoring de evidencia; hoy es criterio cualitativo |
| Source count mínimo por oportunidad HOT | ≥2 fuentes independientes | SUPUESTO, sujeto a ajuste según disponibilidad real de fuentes por región |
| Freshness mínima para señal "activa" | <30–45 días (`signal_date` o `discovered_at`) | SUPUESTO |

---

## D. Qué está implementado

- Estructura de `snapshot_reports` con lifecycle (processing / completed / failed).
- Vault Memory UI que distingue entre validated pattern, caution pattern e insufficient feedback.
- Feedback job_id linkage que conecta oportunidades con el snapshot real.
- **Sistema de Evidence Quality** (`high | medium | low | insufficient`) por oportunidad — implementado en `lib/quality/evidence-quality.ts` como capa conservadora de guardrails sobre `recommended_action`. Nunca modifica score, categoría ni ranking. Aplicado después de Account Memory, antes del report final.
- **Guardrails sobre recommended_action** — bajada automática de acción recomendada según nivel de evidencia:
  - `high`: sin cambio
  - `medium`: `send_outreach_now` → `validate_source_first`
  - `low`: `send_outreach_now` / `validate_source_first` → `monitor_for_new_signal`
  - `insufficient`: toda acción activa → `add_to_watchlist` (excepto `exclude`)
- **Badge de Evidence Quality** en UI (`app/demo-pipeline/page.tsx`) con texto de guardrail cuando aplica. Copy en EN/ES/PT/JA.

---

## E. Qué falta

- **Freshness real de señales** — `signal_date` implementado de forma conservadora (Signal Date v0). Se lee de `LeadCandidate.signal_date` (fecha explícita del provider) y de `EvidenceClaim.date` (fecha explícita en claims de tipo `verified_public_signal`). Cuando existe una fecha válida y fresca, `fresh_signal_count > 0` y el nivel `high` de Evidence Quality se vuelve alcanzable. Cuando no hay fecha estructurada, `signal_date` permanece null y el comportamiento es idéntico al v0 anterior (conservador por diseño). Nunca se extrae fecha de texto libre ni se inventa.
- **Source Access Layer** — sin él, `region_confidence` nunca puede ser `"high"` (máximo `"medium"` para las 4 regiones prioritarias). Ver `SOURCE_STRATEGY.md`.
- **What Changed — Phase 2 (snapshot comparison):** infraestructura completa y scope seguro activo. Migration 027 agrega `search_id UUID` a `snapshot_reports`. `getPreviousCompletedSnapshot` requiere `searchId` — devuelve null sin él. Cuando Monthly Monitor trigger pasa `searchId`, el lookup es scoped a `search_id = searchId AND status = completed AND job_id != current` — sin cross-customer comparisons posibles. Phase 1B proxy activo como fallback cuando no hay snapshot previo.
- **Monthly Monitor Manual Rerun v0:** `POST /api/admin/searches/[id]/rerun` — trigger manual del pipeline para un `lead_searches.id`, con dedup guard, baseline detection, y `search_id` scope automático. Primera ejecución por search series = baseline. Ejecuciones posteriores activan comparación real.
- **Monitor Run History + Change Presentation:** `GET /api/admin/searches/[id]/runs` (admin-only, same-search scope, nunca global) + vista de historia en admin search detail (BASELINE/COMPARED badges). Exports presentan change classification con copy customer-safe: "What Changed Since Last Report" **solo** cuando `previous_*` fields están poblados (comparación real con snapshot previo); baseline/proxy runs se etiquetan "Current Change Signals" con nota explícita. `change_label` por cuenta y columna "Change" en CSV solo cuando `client_visible`. CSV además gana columna "Source Coverage". Freshness desconocida nunca se presenta como fresh; fuentes context-only nunca como timing signal (reglas de Source Layer v0, sin cambios). Sin scheduler — runs manuales admin-only.
- **Mecanismo de detección de genericidad** (ver definición abajo) — no implementado.
- **Checklist de QA** aplicado de forma sistemática antes de cada entrega — no formalizado aún como proceso.

---

## F. Riesgos

| Riesgo | Descripción |
|---|---|
| Sin estándar de calidad explícito | El riesgo de entregar reportes genéricos (la mayor amenaza del análisis de viabilidad) aumenta directamente. |
| Sin Insufficient Evidence implementado | El sistema puede generar confianza falsa en mercados o cuentas con poca cobertura de datos, dañando la credibilidad del producto. |

---

## G. Próximas acciones

1. Definir y especificar el sistema de Evidence Quality (Low/Medium/High) con criterios concretos de qué combinación de `source_count` + `freshness` + `reliability` produce cada nivel.
2. Diseñar el mecanismo de Insufficient Evidence con su texto exacto hacia el cliente (ej. "Recommendation: Monitor, not attack now — Limited recent public evidence").
3. Definir criterios concretos de "genericidad" (ver sección H) y cómo detectarla antes de que un reporte llegue al cliente.
4. Formalizar el checklist de QA como paso obligatorio del workflow, no opcional.

---

## H. Criterios de éxito

### Qué hace que un reporte sea vendible

Un reporte es vendible cuando cada oportunidad HOT o WARM incluye evidencia específica y verificable (no genérica), una fuente identificable, una fecha de la señal, y una explicación clara de por qué esa cuenta es relevante para el ICP del cliente — en vez de afirmaciones vagas tipo "empresa en crecimiento" sin sustento.

---

### Evidence Quality *(marco conceptual)*

| Nivel | Descripción |
|---|---|
| **High** | Múltiples fuentes independientes, señal reciente (dentro del umbral de freshness), alta confianza regional. |
| **Medium** | Una fuente confiable o señales con freshness moderada. |
| **Low** | Una sola fuente, señal antigua, o confianza regional baja — debe activar el mecanismo de Insufficient Evidence en vez de presentarse como recomendación fuerte. |

---

### Source count

Cada oportunidad debe registrar cuántas fuentes independientes sustentan la señal. Menos del mínimo definido (sección C) debe degradar automáticamente la confianza de la recomendación, no ocultarse.

---

### Freshness

Cada señal debe registrar su fecha de origen (`signal_date`) y fecha de descubrimiento (`discovered_at`). La antigüedad (`signal_age_days`) determina si la señal todavía es accionable o debe tratarse como contexto histórico.

---

### Decision Confidence

Cada oportunidad debe exponer al cliente un nivel de confianza en la decisión recomendada, derivado de Evidence Quality + Source Count + Freshness combinados — nunca un score numérico sin explicación de qué lo compone.

---

### Insufficient Evidence

Cuando la evidencia no alcanza el umbral mínimo, el sistema debe mostrar explícitamente algo equivalente a:

> Evidence Quality: Low · Source Count: [N] · Recommendation: Monitor, not attack now · Reason: Limited recent public evidence

En vez de forzar una recomendación de ataque inmediato.

---

### Detección de genericidad

Un reporte se considera potencialmente genérico si las explicaciones de "por qué contactar esta cuenta" podrían aplicarse intercambiablemente a cualquier otra empresa del mismo sector sin cambios sustanciales. Este es un criterio cualitativo de revisión humana/QA hasta que exista un mecanismo automatizado de detección.

---

### Score mínimo interno antes de vender un reporte

A definir formalmente junto con el sistema de Evidence Quality. Mientras no exista ese sistema, el criterio mínimo provisional es: **ningún reporte se entrega a un cliente real si más del 30% de sus oportunidades HOT carecen de al menos una fuente identificable y una fecha de señal** — *(criterio provisional, sujeto a revisión)*.

---

## Checklist de QA antes de entregar un reporte

- [ ] Cada oportunidad HOT/WARM tiene al menos una fuente identificable.
- [ ] Cada señal tiene fecha registrada (`signal_date` o `discovered_at`).
- [ ] No hay oportunidades con lenguaje genérico/intercambiable sin evidencia específica.
- [ ] Las oportunidades con evidencia insuficiente están marcadas como tal, no presentadas como recomendación fuerte.
- [ ] El reporte no expone datos personales (emails, teléfonos, nombres individuales, LinkedIn personal).
- [ ] El Results Page/UI se ve terminado, sin estados de carga rotos o JSON crudo visible.
