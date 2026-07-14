# LeadLens Intelligence Foundation v0

**Captura estructurada + memoria inmutable + aprendizaje en modo observación.**
Implementa el primer sprint de LEADLENS CUMULATIVE INTELLIGENCE ARCHITECTURE.

## 1. Storage vs memory vs rules vs personalization vs learning

- **Storage**: filas en tablas (vault_*, opportunity_feedback). Existía.
- **Memory**: recuperar lo guardado en contexto (account memory, usage exclusions). Existía.
- **Rules**: efectos deterministas definidos por humanos (gates, do_not_show). Existían.
- **Personalization**: parámetros por tenant (ICP explícito). Existía parcial.
- **Learning**: parámetros derivados de datos con muestra/confianza/decay. **Este sprint lo
  hace observable — no operativo.** Ninguna preferencia toca el ranking.

## 2. Qué guarda este sprint

- `opportunity_feedback` gana: `reason_codes[]`, `feature_snapshot` (jsonb),
  `versions` (jsonb), `normalized_sentiment` (-1|0|1|NULL), `feedback_schema_version`.
- `learned_preferences`: agregados por tenant/scope/feature con strength, Wilson,
  decay, counters, audit trail. `can_affect_ranking=false` siempre en v0.
- Los reportes nuevos congelan por oportunidad un `feature_snapshot` y un bloque
  `_versions` (selector/scoring/decision_engine/model/etc. — solo identificadores).

## 3. Taxonomía de feedback (v2)

Gesto 1 (obligatorio): **Useful / Partially useful / Not useful** → `normalized_sentiment`
1/0/−1. Gesto 2 (opcional, <5s): chips de motivo — positivos (strong_fit, good_timing,
useful_evidence, relevant_industry_region), negativos (wrong_fit, too_small, too_large,
weak_or_old_signal, not_now, already_known, already_contacted, insufficient_evidence,
incorrect_information) y siempre `bad_explanation` (mala explicación ≠ mala oportunidad).

**Compatibilidad legacy (política documentada):** `irrelevant`→−1, `wrong_fit`→−1,
`generic`→−1. Eventos operacionales/comerciales (`contacted`, `replied`,
`meeting_booked`, `add_to_vault`, `exclude_similar`) → sentiment NULL: se conservan
pero **jamás** alimentan preferencias de fit. `exclude_similar` mantiene su efecto
existente en Account Memory (regla, no aprendizaje).

## 4. Snapshot inmutable

`buildOpportunityFeatureSnapshot` congela al generar el reporte: signal type/fecha/edad,
freshness bucket, industry/region/country, size bucket, source types, evidence_grounded,
confidence, fit, category, combo_key (pares ordenados, solo con ≥2 tipos válidos),
coverage_limited. **Sin PII** (account-level; nunca contactos). Campo ausente = null —
nunca se inventa. El POST de feedback copia el snapshot **desde el reporte persistido**
(server-side); reportes históricos sin snapshot → null, jamás reconstrucción desde datos
vivos disfrazada de historia.

## 5. Versionado

`report_json._versions`: report_schema, feature_schema, intelligence_foundation,
selector, scoring, decision_engine, pipeline, prompts ("unversioned" — honesto hasta
que se versionen), model_provider/model_id (constante real de lib/anthropic; "unknown"
si no se puede determinar). Identificadores, nunca contenido de prompts ni secretos.
Reportes viejos no se recalculan.

## 6. Semántica de reason codes en el learner

- **Excluidos totalmente** (la cuenta estaba bien o el problema no es de fit):
  `already_known`, `already_contacted`, `bad_explanation`, `incorrect_information`.
- `not_now`, `weak_or_old_signal` → solo `freshness_bucket.*`.
- `too_small`, `too_large` → solo `size_bucket.*`.
- Negativo simple → features de fit (signal_type, industry, region, size, source, combo,
  freshness). `wrong_fit` documentado como fit general.
- `insufficient_evidence` → métricas de evidencia (v0: cuenta como negativo de fit
  del feature de source — conservador); `incorrect_information` → revisión de fuentes,
  nunca preferencia.

## 7. Learner (observation mode)

Batch determinista, fuera del request path, admin-triggered. **Rebuild-from-source**:
cada corrida reconstruye los agregados desde los eventos → idempotente por construcción
(re-ejecutar no duplica contadores, no infla el audit trail; version++ solo con cambio
material). Matemática: `n = pos+neg` (partial = neutral: registrado pero fuera de la
proporción — no infla confianza); `strength=(pos+1)/(n+2)`; `confidence` = Wilson 95%
lower bound; `effective = confidence · 0.5^(días/half_life=90d)`. Validación:
`n≥5` **y** `distinct_reports≥2` **y** `effective≥0.60` → `inferred_validated`
(siempre observation-only). Frozen/revoked/explicit jamás se sobreescriben.

Con muestras pequeñas Wilson es humilde por diseño: 2/2 positivos da ~0.34 — no existe
"learned preference" que la muestra no pueda sostener (fixture-tested, 30/30).

## 8. Scope customer vs monitor

Cada evento con `search_id` alimenta **ambos** scopes; sin monitor asociable de forma
segura, solo customer (nunca se inventa la asociación). Las filas monitor permiten que
el mismo cliente tenga preferencias opuestas entre monitores.

## 9. Freeze / revoke / labels honestos

Admin `/admin/intelligence`: banner "Observation mode — learned preferences are not
affecting rankings", métricas de observabilidad (eventos, % con reasons/snapshot/versions,
distribución de sentimiento, top reasons, % already_known, % bad_explanation), y la
lista de patrones con labels *Early signal → Emerging pattern → Validated pattern —
observation only → Frozen → Revoked*. Freeze conserva estado e impide updates; Revoke
excluye sin borrar historia; ambos auditan actor/timestamp/versión y fuerzan
`can_affect_ranking=false`. Las preferencias `explicit` no se tocan desde aquí.

## 10. Aislamiento de tenant

`tenant_user_id` NOT NULL, consultas server-side service-role (RLS on, sin policies —
patrón 024/029), cero rutas customer-facing, cero agregación global, el free-text
(`feedback_notes`) nunca entra al learner ni a métricas compartidas.

## 11. Qué NO afecta rankings (invariante verificado por smoke)

Selector, scoring, Decision Engine, tiers, orden, gates, dedupe, suppression y Account
Memory no importan `learned_preferences` ni el learner (check estático), y
`can_affect_ranking` no se establece en true en ningún archivo del sprint. La prueba de
no-regresión compara los campos funcionales del ranking (companies/scores/reasons/
rejected counts) contra el baseline pre-sprint — no "byte-identical" (los reportes
ganan campos aditivos), sino igualdad exacta de lo funcional.

## 12. Camino a shadow scoring y ranking adaptation (futuro)

Shadow (siguiente sprint): calcular el Preference Adjustment con las validated,
registrarlo en el snapshot sin reordenar, y comparar contra feedback real. Activación
(sprint posterior): solo tras lift demostrado, con caps ±5/±10, kill switch
(`INTELLIGENCE_RANKING_ENABLED`), y explicación humana por ajuste. Cold start: cero
ajuste + label "Explicit criteria only".

## 13. Limitaciones conocidas

Muestras pequeñas dominan al inicio (correcto: el sistema lo dice en vez de fingir);
los snapshots solo existen en reportes nuevos (los históricos → feedback sin snapshot,
excluido del learner); signal_type solo llega tipado desde el bridge Vault (candidatos
de otros providers → feature ausente, honesto); el completion rate del feedback es la
variable existencial de todo lo posterior.
