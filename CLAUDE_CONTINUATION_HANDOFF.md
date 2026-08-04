# CLAUDE CONTINUATION HANDOFF — LEADLENS

## Latest checkpoint - Amor de Gea Pilot 1 delivery mapping

The approved package is mapped by canonical IDs in `lib/intelligence/amor-de-gea-pilot1-delivery.ts`; the Admin route verifies exact SHA-256 content. The old dynamic six-account PDF is historical only and marked `OBSOLETO - NO ENVIAR`. Do not change V3R3, run Pilot 2, or reintroduce `/api/admin/intelligence/pilots/amor-de-gea/pdf` into primary delivery UI. Full evidence is in `LEADLENS_AMOR_DE_GEA_FINAL_REPORT_MAPPING_AND_DELIVERY_FIX.md`.

Documento autoritativo de continuidad. Leer completo antes de proponer o modificar código.

## 1. Project identity

- Producto: **LeadLens**.
- Categoría: **Account Opportunity Intelligence / B2B Opportunity & Market Intelligence**.
- Usuario objetivo: fundadores, equipos comerciales, estrategia, partnerships y desarrollo de negocio que necesitan priorizar cuentas B2B con evidencia.
- Promesa: encontrar cuentas que vale la pena evaluar y explicar por qué importan, qué cambió, qué evidencia existe, qué sigue incierto, si existe timing y qué acción está justificada.
- Valor principal: convertir investigación pública y contexto explícito del cliente en decisiones comerciales trazables, no en listas genéricas.
- Producción: `https://leadlensintel.com`.
- Repositorio: `/Users/martingaleano/leadlens-project`.
- Branch: `main`.
- Deployment: Vercel.
- Base de datos: Supabase/Postgres con RLS.
- Stack: Next.js 14 App Router, React, TypeScript, Supabase y jsPDF server-side.

LeadLens **no** es una base estática de leads, CRM, producto de datos de contacto ni herramienta de outreach masivo. Fit, accesibilidad o afinidad nunca equivalen a intención de compra.

## 2. Product principles and invariants

- Structural fit, client fit y timing son dimensiones separadas.
- Accessibility es distinta de buying intent.
- Sin evento actual verificable no se afirma urgencia.
- Hechos, señales, inferencias, recomendaciones y limitaciones permanecen separados.
- Counterevidence debe seguir visible.
- Nunca fabricar buying intent ni respuestas del cliente.
- Customer-safe requiere revisión explícita; aprobación interna no basta.
- Ranking permanece sin cambios salvo autorización expresa.
- Outputs internos permanecen internos.
- Admin y PDF no realizan provider calls durante render.
- Preservar aislamiento tenant y derivar tenant/actor en servidor.
- Versiones históricas y revisiones son inmutables/append-only.
- No guardar/exponer payloads crudos, secretos ni hidden reasoning.

## 3. Current architecture

- Next.js App Router: rutas públicas/customer y `/admin` separadas.
- Auth Admin: Supabase login, allowlist `admin_users`, cookie firmada httpOnly, revocación inmediata y producción fail-closed. Bypass únicamente localhost con flag explícito.
- RLS: acceso anónimo denegado a datos internos; escrituras sensibles server-only/service-role.
- Command Center: `app/admin/intelligence/page.tsx`, `lib/intelligence/admin-view-model.ts`, `app/api/admin/intelligence/command-center/route.ts`.
- Snapshot/capabilities: `lib/intelligence/snapshot-engine.ts`, `snapshot-loader.ts`, `feature-snapshot.ts`, `os-contracts.ts`.
- Registries: `output-registry.ts`, `pattern-registry.ts`.
- Validación: `validation-lifecycle.ts`, `validation-store.ts`.
- Evidencia/temporal: `evidence-temporal.ts`, `evidence-store.ts`, `research-quality.ts`.
- Señales/monitoring: `signal-temporal.ts`, `signal-benchmark.ts`, `lib/sources/signal-taxonomy.ts`, `signal-freshness.ts`.
- Entidades: `colombian-entity-resolution.ts`, `lib/discovery/corporate-identity.ts`, `entity-role.ts`.
- Cliente/cuenta: `account-opportunity-synthesis.ts`, `client-context-review.ts`.
- Piloto: `pilot-workspace.ts`, `pilot-intelligence.ts`.
- PDF: `lib/reports/internal-pilot-pdf.ts`; endpoint Node Admin-only; generador local comparte renderer.
- Persistencia: migraciones Supabase para Auth, lifecycle, evidencia, señales, entidades, tesis, contexto y piloto.

## 4. Blocks 0–16

| Block | Objetivo y resultado | Archivos clave | Migración | Commit | Validación / limitación |
|---|---|---|---|---|---|
| 0 | Auditoría dirigida y mapa Intelligence/data. | checkpoints/audit reports | — | `23f684d` | Base documental; sin contratos ejecutables. |
| 1 | Contratos canónicos y guardas de honestidad. | `os-contracts.ts` | — | `fc450de` | Contratos probados; faltaba snapshot. |
| 2 | Snapshot determinista, capabilities y maturity. | `snapshot-engine.ts`, `snapshot-loader.ts` | — | `f7c97bd` | Tests snapshot; sin registries. |
| 3 | Output Registry y Pattern Registry en observation/shadow. | `output-registry.ts`, `pattern-registry.ts` | — | `dc35ca1` | Sample gates; ranking off. |
| 4 | Lifecycle de validación, acciones, outcomes y aprendizaje. | `validation-lifecycle.ts`, `validation-store.ts` | 041 | `2489bbc` | Validación tests; necesita outcomes reales. |
| 5 | Intelligence Command Center Admin seguro. | Admin page/view model/API | — | `0ade65a` | Command Center tests/build; capacidades parciales. |
| 6 | Evidencia, claims, fechas, freshness y corroboración. | `evidence-temporal.ts`, `evidence-store.ts` | 042 | `926b456` | Evidence suite; profundidad desigual. |
| 7 | Research profiles, identity-first research y qualification. | `research-quality.ts`, research scripts | — | `0c04d59` | Research-quality tests; sin evento comercial directo. |
| 8 | Signal Intelligence, monitoring y What Changed. | `signal-temporal.ts`, signal taxonomy | 043 | `4ba5dbd` | Signal suite; fit no crea timing. |
| 9 | Benchmark de señales y diagnóstico provider/source. | `signal-benchmark.ts`, block9 scripts | — | `9feca53` | Benchmark tests; cobertura/costo variables. |
| 10 | Resolución colombiana de entidades y atribución. | `colombian-entity-resolution.ts` | 044 | `7bea3c442247256ae054d8936b1c431577cee22e` | 6 identidades confirmadas; identidad no prueba oportunidad. |
| 11 | Account opportunity synthesis, buyer/use-case/route/thesis. | `account-opportunity-synthesis.ts` | 045 | `ffbe76f428afd715ca8686c647cd0167a0e03332` | 6 tesis internas; contexto cliente incompleto. |
| 12 | Intake, context versions, recalculo y thesis-review readiness. | `client-context-review.ts` | 046 | `0e703c59c6c7441e82dd00c4d926c8eafca604a7` | 17 preguntas/10 blockers; ninguna respuesta. |
| 13 | Workspace operativo, persistencia/backfill idempotente. | `pilot-workspace.ts`, pilot routes/scripts | 047 | `7c2e3b2f30b9935970f7d03a4eec64bef7ecfaaa`, `a849ae5dd0aaf264816f808f23277e713e1b0494` | 1 piloto/6 tesis; sin reviews. |
| 14 | Rediseño premium Admin decision-first y responsive. | `pilot-experience.tsx`, `workspace.module.css` | — | `e2ca3101ab1765fdf8e6569d38f8db110165b1e6` | QA 1440/1280/1024/390; datos cliente pendientes. |
| 15 | Navegación canónica, ICP, recomendaciones y PDF interno inicial. | `pilot-intelligence.ts`, section routes, PDF route | — | `cbab5502118121913a3d8bc7445f452813321336` | 47/47; PDF inicial reemplazado en Block 16. |
| 16 | PDF premium de 16 páginas y alineación final con Admin. | `internal-pilot-pdf.ts`, PDF tests/reports | — (048 no requerida) | `aaf39ebfd2d932592d762725739493ba7cbcaa67`, `b4fe4e18ad6a05a12e3894702bb884e4b1cf1be6` | 42/42 + visual QA; baseline aceptado, no reconstruir. |

## 5. Amor de Gea pilot state

- Pilot ID: `amor-de-gea`.
- Ruta: `/admin/intelligence/pilots/amor-de-gea`.
- Cliente: Amor de Gea.
- Geografía: Colombia.
- Categoría informada: infusiones botánicas.
- Estado: validación con el cliente; interno.
- Cuentas/tesis: 6/6.
- Preguntas: 17.
- Respuestas aceptadas/contextos aceptados/tesis revisadas/customer-safe: 0/0/0/0.
- Timing: no existe evento comercial actual verificable que cree urgencia.
- PDF: interno, 16 páginas, habilitado.
- Reporte final: deshabilitado.

Orden:

1. BioPlaza
2. Distribuidora DAM
3. Natural + Mente
4. Tu Tienda Saludable
5. Hotel Spa La Colina
6. Somos Consiente

Validar primero: BioPlaza, DAM. Seguimiento estratégico: Natural + Mente, Tu Tienda Saludable. Monitorear selectivamente: Hotel Spa La Colina, Somos Consiente.

Esta secuencia es estrategia de validación, no prueba de intención de compra ni nuevo algoritmo de ranking productivo.

## 6. Current pilot intelligence

| Cuenta | Segmento / rol | Oportunidad y uso | Buyer/ruta | Pregunta / siguiente acción | Trigger / límite |
|---|---|---|---|---|---|
| BioPlaza | Retail; cuenta de entrada | Validación de categoría; inclusión acotada en surtido bienestar. | Category management/compras; muestra B2B y alta de proveedor. | ¿Formato, precio, margen y abastecimiento permiten prueba? Preparar ficha/economía/muestra. | Nueva categoría/surtido/proveedores. Evidencia estructural, no demanda. |
| Distribuidora DAM | Distribución; palanca de canal | Route-to-market y complemento de portafolio. | Dirección comercial/portafolio/abastecimiento; validar cobertura y economics. | ¿Sostiene margen, volumen y despacho? Modelar canal, MOQ, capacidad y territorio. | Expansión de portafolio/cobertura. Dominio no prueba interés. |
| Natural + Mente | Retail; seguimiento estratégico | Diferenciación dentro de surtido naturalmente afín. | Compras/curaduría/liderazgo comercial; aplicar aprendizaje BioPlaza. | ¿Qué atributo agrega valor frente al surtido? Definir diferenciador y comparar formato/precio. | Renovación catálogo/nuevas marcas. Afinidad no prueba demanda. |
| Tu Tienda Saludable | Retail; seguimiento estratégico | Entrada simple, recurrente y de bajo inventario. | Compras/abastecimiento/administración; propuesta corta y reposición clara. | ¿Puede entrar de forma rentable y fácil de reponer? Diseñar piloto bajo inventario. | Catálogo de bebidas/nueva tienda. Operación real no confirmada. |
| Hotel Spa La Colina | Hospitality; monitoreo | Amenidad/ritual/bebida de bienvenida. | A&B/spa/guest experience/operaciones; identificar dueño del programa. | ¿Mejora experiencia sin cargar operación? Preparar concepto de una página y monitorear. | Expansión spa/programa/amenidades. Sin programa/presupuesto verificado. |
| Somos Consiente | Wellness; monitoreo | Alianza de contenido/comunidad/ritual. | Fundador/alianzas/comunidad/operaciones; esperar programa concreto. | ¿Puede convertirse en relación B2B repetible? Definir triggers; no investigar profundo aún. | Programa/alianza/tienda/experiencia. Afinidad puede no monetizar. |

## 7. Client-context state

Hay 17 preguntas, 10 blockers críticos, todas sin responder. No existe respuesta real aceptada, respuesta sintética productiva ni context version aceptada.

Inputs prioritarios: formatos B2B, rango mayorista, MOQ, restricciones de margen, cobertura de entrega, capacidad de producción, fulfillment, registros/certificaciones, capacidad de distribución, modelo comercial preferido y ciclo de venta aceptable.

- Retail: formato, precio, MOQ, margen, rotación/reposición.
- Distribución: margen de canal, volumen, territorio, capacidad/continuidad.
- Hospitality: formato de servicio, fulfillment, reposición y certificaciones.
- Feasibility/report readiness/customer safety: capacidad, cobertura, cumplimiento, economics y revisión explícita.

## 8. Database and migrations

- 001–039: SaaS/auth/customer, ICP/searches/results, quality/enrichment, Vault, credits, onboarding, delivery, feedback, snapshots, Intelligence/ML, source/signal review y origins.
- 040 `admin_authorization`: `admin_users`, allowlist/revocación Admin. Aplicada.
- 041 `intelligence_validation_loop`: lifecycle/reviews/actions/outcomes/learning, idempotencia. Aplicada.
- 042 `evidence_temporal_intelligence`: evidencia/claims/fechas/freshness/cambios. Aplicada.
- 043 `signal_temporal_monitoring`: señales, runs, baselines/transitions. Aplicada.
- 044 `colombian_entity_resolution`: identidad, propiedades/anchors/atribución. Aplicada.
- 045 `account_opportunity_synthesis`: tesis cliente-cuenta y outputs relacionados. Aplicada.
- 046 `client_context_review`: intake, respuestas/versiones, thesis/safety review. Aplicada.
- 047 `amor_pilot_workspace`: piloto canónico, tesis y actividad. Aplicada.
- 048: no existe y no es requerida.

Tablas principales introducidas en 040–047: `admin_users`, `intelligence_validations`, `intelligence_validation_reviews`, `intelligence_commercial_actions`, `intelligence_commercial_outcomes`, `intelligence_learning_implications`, `intelligence_evidence`, `intelligence_claims`, `intelligence_claim_evidence`, `intelligence_client_contexts`, `intelligence_account_states`, `intelligence_dossiers`, `intelligence_monitoring_runs`, `intelligence_monitoring_triggers`, `intelligence_signals`, `intelligence_signal_changes`, `intelligence_entity_resolution_records`, `intelligence_account_opportunity_syntheses`, `intelligence_portfolio_syntheses`, `intelligence_client_context_versions`, `intelligence_client_intakes`, `intelligence_customer_safety_reviews`, `intelligence_pilots` e `intelligence_pilot_activity`.

RLS debe negar acceso anónimo. Escrituras son server-only. Upserts/backfills son idempotentes. Versiones/revisiones preservan historia. Tenant/client scope se deriva en servidor. No incluir secretos.

## 9. Current Supabase pilot counts

- Pilots: 1
- Accounts: 6
- Theses: 6
- Unanswered questions: 17
- Real answers: 0
- Accepted contexts: 0
- Reviewed theses: 0
- Customer-safe outputs: 0
- Orphan records: 0
- Cross-scope records: 0

## 10. Route map

- `/admin/login`, `/api/admin/session`, `/api/admin/auth-check`: Auth Admin.
- `/admin/intelligence`: Command Center.
- `/admin/intelligence/pilots/amor-de-gea`: Resumen por defecto.
- `/admin/intelligence/pilots/amor-de-gea/{icp|accounts|account|context|evidence|readiness}`: tabs URL-backed.
- `/admin/pilot`: redirect al piloto canónico.
- `/api/admin/intelligence/pilots/[pilotId]/intake`: draft/submit context.
- `/api/admin/intelligence/pilots/[pilotId]/operations`: context acceptance, thesis/safety review.
- `/api/admin/intelligence/pilots/[pilotId]/pdf`: PDF Admin-only; ID forjado 404.
- Customer: `/dashboard`, `/dashboard/icp`, `/dashboard/searches`, `/dashboard/searches/[id]`, `/results/[jobId]`, `/results/[jobId]/brief`.

El reporte final permanece bloqueado aunque el PDF interno esté disponible.

## 11. Important file map

- `app/admin/intelligence/page.tsx`: Command Center.
- `app/admin/intelligence/pilots/[pilotId]/page.tsx`: piloto/resumen.
- `app/admin/intelligence/pilots/[pilotId]/[section]/page.tsx`: tabs.
- `app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx`: UX source-of-truth.
- `pilot-intake.tsx`, `pilot-review-operations.tsx`: intake/review.
- `workspace.module.css`: sistema visual.
- `app/api/admin/intelligence/pilots/[pilotId]/{intake|operations|pdf}/route.ts`: APIs.
- `lib/intelligence/pilot-workspace.ts`: loader/ensamblaje.
- `pilot-intelligence.ts`: secciones, ICP y recomendaciones.
- `account-opportunity-synthesis.ts`: tesis/rutas/use cases.
- `client-context-review.ts`: questions/versions/recalculation/readiness.
- `output-registry.ts`, `pattern-registry.ts`: outputs/patterns.
- `snapshot-engine.ts`, `snapshot-loader.ts`: snapshot/capabilities.
- `colombian-entity-resolution.ts`: entity resolution.
- `evidence-temporal.ts`, `evidence-store.ts`, `research-quality.ts`: evidence.
- `signal-temporal.ts`, `signal-benchmark.ts`: signals.
- `lib/reports/internal-pilot-pdf.ts`: renderer activo.
- `scripts/generate-internal-pilot-pdf.ts`: PDF local.
- `scripts/sources/backfill-amor-pilot-workspace.ts`: backfill.
- `reconcile-amor-pilot-workspace.ts`: reconciliation.
- `verify-amor-pilot-migration.ts`: verification.
- Tests clave: `premium-internal-pdf.test.ts`, `pilot-navigation-pdf.test.ts`, `premium-pilot-experience.test.ts`, `pilot-workspace.test.ts`, `intelligence-validation-loop.test.ts`, `admin-intelligence-command-center.test.ts`, `admin-auth.test.ts`, `evidence-temporal-intelligence.test.ts`, `signal-temporal-monitoring.test.ts`.
- Reports/checkpoints: `LEADLENS_BLOCK_13_AMOR_DE_GEA_PILOT_WORKSPACE_REPORT.md`, `LEADLENS_BLOCK_14_RADICAL_PILOT_EXPERIENCE_REBUILD_REPORT.md`, `LEADLENS_BLOCK_15_PILOT_NAVIGATION_ICP_RECOMMENDATIONS_PDF_REPORT.md`, `LEADLENS_BLOCK_16_PREMIUM_INTERNAL_PDF_REBUILD_REPORT.md`, `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md`, `LEADLENS_CONTINUITY_AUDIT_CHECKPOINT.md`.

## 12. Internal PDF state

- Renderer metadata: `leadlens-pilot-brief-v3`.
- 16 páginas A4, texto seleccionable, metadata/links.
- Estructura Admin: Resumen, ICP, Cuentas recomendadas, Análisis por cuenta, Contexto, Evidencia y timing, Preparación.
- Banda impresa representa los siete tabs.
- LeadLens es sistema visual primario; Amor de Gea usa acento botánico restringido no presentado como identidad oficial.
- Admin-only, `private, no-store`, sin provider calls.
- Reporte final deshabilitado.

Baseline interno aceptado. **No reconstruir el PDF.** Cambios futuros deben responder a nuevo contenido o defecto concreto demostrado.

## 13. Test commands

```bash
npm run test:premium-internal-pdf
npm run test:pilot-navigation-pdf
npx -y tsx scripts/fixtures/premium-pilot-experience.test.ts
npx -y tsx scripts/fixtures/pilot-workspace.test.ts
npx -y tsx scripts/fixtures/client-context-review.test.ts
npm run test:admin-auth
npm run test:evidence-temporal-intelligence
npm run test:signal-temporal-monitoring
npm run test:intelligence-validation-loop
npm run test:admin-intelligence-command-center
npx tsc --noEmit
npm run build
```

## 14. Deployment workflow

1. Commit en `main`.
2. Abrir GitHub Desktop.
3. Push origin.
4. Esperar Vercel `Ready`.
5. Verificar producción.
6. Login Admin real.
7. Abrir `/admin/intelligence/pilots/amor-de-gea`.
8. Descargar PDF y confirmar 16 páginas/metadata/links.
9. Confirmar cero errores console/API.
10. Aplicar migraciones futuras manualmente solo con autorización.

Nunca incluir `.leadlens/source-intelligence.json` ni `.leadlens/usage.json`.

## 15. Current Git and deployment state

- Estado verificado antes del closeout: branch `main`, HEAD `b4fe4e18ad6a05a12e3894702bb884e4b1cf1be6`.
- `origin/main...HEAD`: `0 behind / 0 ahead`; el push de Block 16 ya ocurrió.
- Dirty intencional: solo `.leadlens/source-intelligence.json`, `.leadlens/usage.json`.
- Untracked: ninguno antes de editar este handoff.
- El commit final de closeout será el commit que contiene esta versión; resolver con `git rev-parse HEAD`.
- Push del commit de closeout: pendiente.
- Vercel Ready y validación Admin/PDF de producción: pendientes de verificación; no asumir.

## 16. Known limitations

- Sin respuestas reales, context version aceptada, tesis revisadas, customer-safe outputs ni reporte final.
- Sin timing comercial actual verificable.
- Muestra controlada de seis cuentas.
- Evidencia más fuerte para identidad que demanda.
- Buyer roles son hipótesis.
- Feasibility depende de contexto.
- Sin outcome data, intelligence-lift validado ni adaptive ranking.
- Un piloto no demuestra rendimiento generalizado.

## 17. Exact next phase for Claude

**AMOR DE GEA PILOT — CLIENT CONTEXT COMPLETION AND ACCOUNT INTELLIGENCE QUALITY IMPROVEMENT**

Primero: leer este archivo; verificar HEAD/deployment; abrir piloto; confirmar data/UI; proponer la fase concreta más pequeña; no modificar hasta verificar continuidad.

Después: ingresar respuestas reales, mejorar intake solo si es necesario, aceptar context version, recalcular tesis afectadas, profundizar evidencia, validar buyer paths, revisar seis tesis, reevaluar feasibility/readiness y preparar customer-safe únicamente con revisión. Reporte final solo tras gates.

## 18. Do not repeat

No reiniciar arquitectura; no reconstruir Auth, navegación, workspace o PDF; no recrear/reaplicar 040–047; no discovery amplio ni cuentas nuevas sin autorización; no cambiar ranking; no inferir intención; no inventar respuestas; no promover customer-safe automáticamente ni generar reporte final prematuramente.

## 19. Safe continuation instructions

```text
Read `CLAUDE_CONTINUATION_HANDOFF.md` completely and treat it as the authoritative continuation state.

Do not restart the architecture audit or rebuild completed systems.

Verify the current Git HEAD, production deployment and Amor de Gea pilot state first.

Then continue exactly with:

AMOR DE GEA PILOT — CLIENT CONTEXT COMPLETION AND ACCOUNT INTELLIGENCE QUALITY IMPROVEMENT

Before modifying code, propose the smallest concrete phase that advances:
- real client-context completion;
- account evidence depth;
- thesis review;
- feasibility;
- customer-safe readiness.

Preserve every invariant documented in the handoff.
```

## Phase 1 real-context review continuation — 2026-08-02

- Returned client questionnaire reviewed: 9-page iOS PDF with FreeText annotations; three images classified only as client marketing material.
- Admin Context now contains `PREVIEW — NO APLICADO`: 17 represented, 7 answered, 6 clarification recommended, 4 missing and 0 accepted.
- Preview includes operational/evidence classifications, six-account impact and Pilot Success Contract. No ranking, thesis, provider, customer-safe or final-report action occurred.
- Authoritative detail: `LEADLENS_PHASE_1_AMOR_DE_GEA_REAL_CONTEXT_REVIEW_REPORT.md`.
- Next gate: obtain four priority clarifications, founder review, then explicit context acceptance. Phase 2 has not started.

## Phase 1.5 founder-resolution continuation — 2026-08-02

- All six clarification categories and four missing questions now have explicit conservative treatment; final economics no longer globally block the pilot.
- Direct client product expectations are recorded separately: commercial intelligence, prioritization, pre-meeting preparation, market learning and strategy review, plus six evaluation questions.
- Founder-approved ladder, route hypothesis and three pilot objectives are labeled and never attributed to the client.
- Persisted candidate: `intake_fb4bc38a8e0af0343c9f8f1e`; 17 questions, 0 accepted context versions, no thesis/ranking/provider/customer-safe action.
- State: `READY FOR FOUNDER ACCEPTANCE WITH EXPLICIT LIMITATIONS`. Phase 2 starts only after explicit `accept_context`.

## 20. Client questionnaire experience (added)

Professional client-context questionnaires now exist (reusable across pilots):
- Editable **XLSX** (primary): `GET /api/admin/intelligence/pilots/[pilotId]/questionnaire/xlsx`
- Read/print **PDF**: `GET /api/admin/intelligence/pilots/[pilotId]/questionnaire/pdf`
- Technical **CSV** (fallback): `GET /api/admin/intelligence/pilots/[pilotId]/questionnaire`
Model: `lib/intelligence/client-questionnaire.ts` (17 client-facing questions, 9 esenciales, 3 phases, options/units/confidence, hidden import keys). Renderers: `lib/reports/client-questionnaire-xlsx.ts` (exceljs), `lib/reports/client-questionnaire-pdf.ts` (jsPDF). Admin: 3-button module in the Context tab. Admin-only, private/no-store, provider-free, answers blank, no internal names on client outputs. See `LEADLENS_CLIENT_QUESTIONNAIRE_EXPERIENCE_REPORT.md`.
**Next operational step:** send the XLSX/PDF to Amor de Gea; import the returned answers as `admin_entry` and review/accept before recalculating theses. Do not import/accept before review.

## Client questionnaire visual correction (v2)
PDF + XLSX polished: drawn checkboxes, thematic section order, fixed cover, vertical-form XLSX (blank cells, hidden keys, live Resumen/Esenciales), responder page. test:client-questionnaire 27. See report.

## Phase 0 — execution control + intake readiness (done)
Audited the intake pipeline (manual entry `/intake` → review/accept `/operations` → append-only context versions; tenant-safe; honesty-gated). Questionnaire keys stable (17 unique, 0 dupes), `_meta` parseable, 17/17 internal-field coverage. **Decision: A — manual entry sufficient for Amor de Gea** (minimal one-time exceljs ingestion utility = documented fallback B; not built). No code/migrations. See `LEADLENS_PHASE_0_INTAKE_READINESS_AUDIT.md` + `LEADLENS_NEXT_90_DAYS_EXECUTION_PLAN.md`. **Phase 1 blocked until the completed questionnaire is returned.**
# Phase 2 handoff — 2026-08-03

Canonical accepted context: `context_28bbc2b447323da3e387c964`, sourced only from `intake_fb4bc38a8e0af0343c9f8f1e`. The Commercial Readiness Profile is in the existing pilot Context experience. Preserve all provenance and 15 explicit limitations. Do not start Phase 3 without founder review.

## Phase 3 handoff

Search Blueprint V1 is `founder_review`; six recalibrations are `internal_review`. Baseline V1 objects remain canonical history. Do not execute the 15 query hypotheses or begin Phase 4 without explicit founder approval.

## Phase 4 handoff

Blueprint V1 is approved. Recovery run `amor_phase4_recovery_v1` persisted 15 completed Tavily queries atomically. The 15-account V3 portfolio is internal and pending human review. No Phase 5 action is authorized.
# Phase 4.5 continuity

The separate `V3R` layer audits all 15 V3 accounts without new provider calls or historical mutation. Use `AMOR_PHASE45_ACCOUNT_REVIEWS` and `AMOR_PHASE45_PACKET`; do not promote, contact or begin Phase 5 without a later explicit founder event.

## Phase 4.6 continuity

Use `AMOR_PHASE46_PORTFOLIO`, `AMOR_PHASE46_ACTION_BRIEFS` and `AMOR_PHASE46_CONFLICT_PACKAGE`. V3R2 has 12 internal accounts; exactly three repair calls were consumed. Do not rerun repairs or begin Phase 5.

## Phase 5A continuity

Use the separate `amor-de-gea-phase5a-customer-safe.ts` V4D layer. Conflict answers are deliberately null, final report generation is disabled and Phase 5B requires real client responses plus explicit founder approval.

## Phase 5A.1 continuity

Use `amor-de-gea-phase5a1-signoff.ts`. V4D.1 has 11 safe-after-check accounts and one BioPlaza source gap. The CSV importer is preview-only; never fabricate or persist responses automatically.

## Context-impact audit continuity

Handoff is paused. `amor-de-gea-context-impact-audit.ts` concludes partial—not strong—impact, creates unapproved Blueprint V2 and proposes V3R3 with BioPlaza/DAM outside the active portfolio. No providers were used.
## Blueprint V2 replay checkpoint

Replay `amor_blueprint_v2_replay_20260803_v1` compiles 30 context fields into 22 executable rules across 56 persisted domains. V3R3 proposes 10 active accounts; BioPlaza is insufficient evidence and DAM is monitor-only. Do not search or contact the client.

Bounded run `amor_blueprint_v2_bounded_search_20260803_v1` completed 8 Tavily calls (39 raw, 28 domains, 0 errors). Zonazul is investigation-only; no V3R4 was justified. Historical total is 42 calls. No second batch is authorized.

Account-first v1 now enforces source ecosystem → entity → identity → buyer role → business model → context gate before enrichment. Validation `amor_account_first_validation_v1` is FOUNDER REVIEW with a four-call ceiling and has not run.

Validation completed 4 Tavily calls: 20 sources, 2 accepted ecosystems, 2 stopped owner placeholders, 0 verified buyers and 0 enrichment waste. Verdict INCONCLUSIVE; next state RETURN TO SOURCE-MAP DESIGN. Historical calls: 46.
# Update — Pilot 1 finalization

Amor de Gea Pilot 1 is `FOUNDER REVIEW REQUIRED`. Use `lib/intelligence/amor-de-gea-pilot1-finalization.ts` as the operational closeout source. Do not add accounts, run providers, mark delivery, close Pilot 1 or activate Pilot 2 without the corresponding manual event.

## Urgent loading repair

The duplicate client session gate in `AdminLayout` was removed because middleware already enforces Admin authorization. The Amor de Gea overview now renders its operational closeout immediately, has a route error boundary and serves all four deliverables through an allowlisted Admin-only download handler.


## Pilot 1 customer deliverables — finalized (2026-08-03)
- Premium redesign of the 4 customer-safe files. Source of truth = intelligence modules → `scripts/artifacts/export-amor-pilot1-deliverable.ts` → `output/amor-pilot1-deliverable.data.json` → `scripts/artifacts/build-amor-pilot1-finalization.py` (deterministic; invariant PDF + normalized DOCX zip).
- Report 25 pp / 53,956 B, briefs 9 pp / 20,402 B, feedback 13 pp / 15,730 B, DOCX 39,698 B. Checksums in `lib/intelligence/amor-de-gea-pilot1-delivery.ts` updated (version `V3R3 / 2.0`).
- Reproduce: `pip install reportlab python-docx pypdf`; `npm run pilot:amor-deliverable-export`; `python scripts/artifacts/build-amor-pilot1-finalization.py`.
- Tests: `test:amor-pilot1-content`, `test:amor-pilot1-delivery`, `test:amor-pilot1-finalization` green; tsc + `next build` clean.
- Preserved: V3R3 portfolio, exclusions, evidence conclusions, customer-safe boundaries, account memory, Pilot 2 planned/not-authorized, provider_calls 0.
- Report: `LEADLENS_AMOR_DE_GEA_FINAL_DELIVERABLE_REVIEW_AND_REDESIGN.md`.
