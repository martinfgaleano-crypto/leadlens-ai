# LeadLens — handoff completo para continuación con Claude

## A. Identidad del proyecto

LeadLens es un sistema de inteligencia comercial B2B que transforma investigación pública, contexto explícito del cliente y revisión humana en oportunidades comerciales trazables. Su promesa no es entregar una lista genérica de empresas: explica por qué una cuenta importa, qué ruta comercial podría existir, qué evidencia la sostiene, qué falta confirmar y cuál es el siguiente movimiento seguro.

LeadLens no es un scraper de contactos, un buscador de empresas, un generador de intención de compra ni un sistema de outreach automático. Tampoco debe fabricar timing, respuestas del cliente o conclusiones customer-safe.

- Producción: `https://leadlensintel.com`
- Repositorio: `/Users/martingaleano/leadlens-project`
- Branch canónico: `main`
- Stack: Next.js 14 App Router, TypeScript, Supabase/Postgres/RLS, Vercel, generación PDF server-side con jsPDF.
- Arquitectura: rutas customer y Admin separadas; Intelligence OS tipado; artefactos deterministas; persistencia Supabase para estados que requieren durabilidad; providers fuera del render.

## B. Estado actual del producto

- Admin principal: `/admin`
- Intelligence Command Center: `/admin/intelligence`
- Piloto canónico: `/admin/intelligence/pilots/amor-de-gea`
- Alias legado: `/admin/pilot` redirige al piloto canónico.
- Customer: `/dashboard`, `/dashboard/icp`, `/dashboard/searches`, `/dashboard/searches/[id]`, `/results/[jobId]`, `/results/[jobId]/brief`.
- Auth Admin: sesión Supabase + allowlist `admin_users` + cookie firmada httpOnly; revocación inmediata; bypass solo localhost con flag explícito; producción fail-closed.
- Supabase: migraciones 001–047 presentes y aplicadas según el checkpoint operativo. No existe migración 048.
- Vercel: `main`/`origin/main` era el despliegue esperado antes del commit final de este handoff. El commit final requiere push y esperar estado Ready.
- Amor de Gea: 1 piloto, 6 cuentas, 6 tesis internas, 17 preguntas sin responder, 0 versiones de contexto aceptadas, 0 tesis revisadas, 0 outputs customer-safe.
- PDF interno: disponible por endpoint Admin-only; 16 páginas; renderer activo `lib/reports/internal-pilot-pdf.ts`; metadata `leadlens-pilot-brief-v3`; filename estable.
- Reporte final: deshabilitado.
- Ranking: sin impacto adaptativo.

## C–D. Intelligence OS y Blocks 0–16

| Block | Objetivo e implementación principal | Archivos/migración | Commit | Limitación pendiente |
|---|---|---|---|---|
| 0 | Auditoría dirigida, mapa de datos/inteligencia y límites del sistema. | Checkpoints y mapa de arquitectura; sin migración. | `23f684d` | No construía contratos ejecutables. |
| 1 | Contratos canónicos de inteligencia y guardas de honestidad. | `lib/intelligence/*contracts*`; sin migración. | `fc450de` | Sin snapshot determinista. |
| 2 | Snapshot determinista, capacidades y readiness sin falsos ceros. | Snapshot/assessment engine; sin migración. | `f7c97bd` | Sin outputs/pattern registry. |
| 3 | Output Registry y Pattern Registry en observación/shadow. | Registries y tests; sin migración. | `dc35ca1` | Patrones no validados; ranking off. |
| 4 | Ciclo de validación, acciones, outcomes y aprendizaje seguro. | Repositorio lifecycle; `041_intelligence_validation_loop.sql`. | `2489bbc` | Requiere volumen humano atribuible. |
| 5 | Admin Intelligence Command Center y view model seguro. | `app/admin/intelligence`, API/view model; sin migración. | `0ade65a` | Varias capacidades siguen parciales. |
| 6 | Evidencia, claims, fechas, frescura, corroboración y cambios. | `lib/intelligence/evidence*`; `042_evidence_temporal_intelligence.sql`. | `926b456` | Profundidad de evidencia varía por cuenta. |
| 7 | Calidad de investigación, recuperación de claims y account intelligence. | Research/evidence recovery y fixtures; sin migración nueva. | `0c04d59` | Sin evento comercial directo en la muestra. |
| 8 | Taxonomía de señales, monitoreo temporal y What Changed v2. | `lib/intelligence/signals*`, monitoring; `043_signal_temporal_monitoring.sql`. | `4ba5dbd` | Baselines limitados; no crea timing desde fit. |
| 9 | Benchmark de recuperación, cobertura de fuentes y operaciones de monitoreo. | Source coverage/monitor operations; sin migración nueva. | `9feca53` | Proveedores pueden limitar cobertura/costo. |
| 10 | Resolución de entidades colombianas, propiedad oficial y atribución. | Entity resolver/identity graph; `044_colombian_entity_resolution.sql`. | `7bea3c4` | Identidad confirmada no implica oportunidad. |
| 11 | Síntesis cliente-cuenta, rutas, casos de uso y tesis internas. | Opportunity synthesis/output adapters; `045_account_opportunity_synthesis.sql`. | `ffbe76f` | Depende de economía/contexto real del cliente. |
| 12 | Intake, versiones de contexto, recalculo de tesis y revisión/safety. | Client context/review; `046_client_context_review.sql`. | `0e703c5` | Las 17 preguntas siguen sin respuesta. |
| 13 | Workspace operativo canónico y backfill idempotente de Amor de Gea. | `lib/intelligence/pilot-workspace.ts`, rutas/operations; `047_amor_pilot_workspace.sql`. | `7c2e3b2` + activación `a849ae5` | Sin tesis revisadas ni customer-safe. |
| 14 | Experiencia Admin premium, decision-first y responsive. | `pilot-experience.tsx`, CSS y tests. | `e2ca310` | Los datos subyacentes aún requieren cliente. |
| 15 | Navegación canónica, ICP, recomendaciones y primer PDF interno. | `pilot-intelligence.ts`, rutas tabs, endpoint PDF. | `cbab550` | PDF inicial era demasiado técnico/plano. |
| 16 | PDF premium y corrección final alineada con Admin. | `lib/reports/internal-pilot-pdf.ts`, endpoint, tests y reportes; sin migración 048. | Base `aaf39eb`; commit final = el commit que contiene este archivo (`git rev-parse HEAD`). | Sigue siendo interno; falta contexto real y revisión humana. |

## E. Estado de Amor de Gea

Agrupación vigente:

- Validar primero: BioPlaza; Distribuidora DAM.
- Seguimiento estratégico: Natural + Mente; Tu Tienda Saludable.
- Monitorear selectivamente: Hotel Spa La Colina; Somos Consiente.

La evidencia confirma identidad, dominio y propiedad oficial para las seis cuentas. No existe evento verificable que cree urgencia ni evidencia de intención de compra. Los triggers son específicos por cuenta y sirven para monitoreo, no para fabricar timing.

Faltan economía mayorista, formatos B2B, MOQ, margen, capacidad, cobertura, certificaciones y modelo comercial. El Admin conserva 17 preguntas; el PDF muestra solo las cinco de mayor impacto. Las seis tesis están internas y sin revisión. Ninguna salida es customer-safe. El PDF interno está habilitado; el reporte final permanece bloqueado.

## F. Base de datos y migraciones

- 001–030: SaaS, auth/customer, ICP/búsquedas, resultados, calidad/enrichment, Vault, créditos, onboarding, delivery, feedback y snapshots.
- 031–039: Intelligence foundation, ML, source review, signals, institutional snapshots, origins y feedback outcomes.
- 040: autorización Admin (`admin_users`).
- 041: validation/learning lifecycle.
- 042: evidence/temporal intelligence.
- 043: signal temporal monitoring.
- 044: Colombian entity resolution.
- 045: account opportunity synthesis — aplicada.
- 046: client context/review — aplicada.
- 047: canonical Amor pilot workspace — aplicada.
- 048: no creada ni aplicada; no es necesaria.

Estado esperado: 1 piloto Amor de Gea, 6 tesis/cuentas, 17 preguntas, 0 respuestas aceptadas, 0 versiones activas de contexto, 0 tesis revisadas y 0 customer-safe outputs. El client/pilot ID canónico seguro es `amor-de-gea`; no documentar tenant UUIDs ni secretos. RLS debe negar acceso anónimo; escrituras sensibles son server-only/service-role y derivan tenant/actor en servidor.

## G. Mapa de archivos importante

- `lib/intelligence/pilot-workspace.ts`: ensamblaje canónico del piloto.
- `lib/intelligence/pilot-intelligence.ts`: tabs, ICP, universo histórico y orden de recomendaciones.
- `lib/intelligence/account-opportunity-synthesis.ts` y módulos relacionados: tesis/rutas/casos.
- `lib/intelligence/client-context*`: intake, versiones, feasibility y recalculo.
- `lib/intelligence/evidence*`: evidencia, claims, fechas, freshness/corroboración.
- `lib/intelligence/signal*` / `monitor*`: taxonomía, timing, triggers y What Changed.
- `lib/intelligence/*entity*`: identidad colombiana, anchors y propiedad oficial.
- `lib/intelligence/admin-intelligence-view-model.ts`: lectura segura del Command Center.
- `lib/intelligence/snapshot*`: snapshot/capability/readiness determinista.
- `app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx`: experiencia Admin source-of-truth.
- `app/admin/intelligence/pilots/[pilotId]/pilot-experience.module.css`: sistema visual Admin.
- `lib/reports/internal-pilot-pdf.ts`: renderer PDF activo, tema compartido vía `PILOT_SECTIONS`, co-branding configurable.
- `app/api/admin/intelligence/pilots/[pilotId]/pdf/route.ts`: endpoint protegido y filename/cache/log.
- `scripts/generate-internal-pilot-pdf.ts`: generador local del mismo renderer.
- `scripts/fixtures/premium-internal-pdf.test.ts`: contrato PDF/Admin.
- `scripts/fixtures/pilot-navigation-pdf.test.ts`: regresión Block 15.
- `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md`, `LEADLENS_CONTINUITY_AUDIT_CHECKPOINT.md`: continuidad.
- `LEADLENS_BLOCK_16_PREMIUM_INTERNAL_PDF_REBUILD_REPORT.md`: auditoría/render QA.

## H. Rutas y redirects

- `/admin/login`: acceso Admin.
- `/admin/intelligence`: Command Center.
- `/admin/intelligence/pilots/amor-de-gea`: Resumen.
- `/admin/intelligence/pilots/amor-de-gea/{icp|accounts|account|context|evidence|readiness}`: secciones URL-backed.
- `/api/admin/intelligence/pilots/amor-de-gea/pdf`: PDF interno.
- `/api/admin/intelligence/pilots/[pilotId]/intake`: intake.
- `/api/admin/intelligence/pilots/[pilotId]/operations`: operaciones/review.
- `/admin/pilot`: redirect al piloto canónico.
- IDs forjados del PDF: 404; usuarios no Admin: rechazo/redirect según superficie.

## I. Comandos de prueba

```bash
npm run test:premium-internal-pdf
npm run test:pilot-navigation-pdf
npx -y tsx scripts/fixtures/premium-pilot-experience.test.ts
npx -y tsx scripts/fixtures/pilot-workspace.test.ts
npm run test:admin-auth
npm run test:evidence-temporal-intelligence
npm run test:signal-temporal-monitoring
npx tsc --noEmit
npm run build
npm run pilot:internal-pdf -- output/pdf/leadlens-amor-de-gea-informe-interno.pdf
```

## J. Despliegue

1. Abrir GitHub Desktop y verificar que solo esté el commit final del sprint.
2. Push `main` a `origin`.
3. Esperar Vercel `Ready`; no asumir despliegue por commit local.
4. No aplicar migración: este sprint no crea 048.
5. Entrar en producción con sesión Admin real.
6. Abrir el piloto, recorrer las siete secciones y descargar el PDF.
7. Verificar 16 páginas, filename, metadata v3, links y ausencia de cache obsoleta.
8. Mantener sin commit `.leadlens/source-intelligence.json` y `.leadlens/usage.json`.

## K. Invariantes

- Nunca inventar intención de compra.
- Nunca derivar timing desde fit estructural.
- Separar evidencia, interpretación, recomendación y limitación.
- Customer-safe requiere estado explícito y gates.
- Ranking no cambia sin autorización.
- Piloto y PDF son Admin-only.
- No sintetizar respuestas del cliente.
- Cero provider calls durante render.
- Aislamiento tenant y actor derivados en servidor.
- Versiones y revisiones son inmutables/append-only.
- No exponer payloads crudos, secretos ni reasoning privado.

## L. Limitaciones conocidas

- No hay respuestas reales de Amor de Gea.
- No hay versión de contexto aceptada.
- Las seis tesis no han sido revisadas.
- No existen outputs customer-safe ni reporte final.
- No hay timing comercial actual verificable.
- El piloto es una muestra controlada de seis cuentas.
- La profundidad de account intelligence todavía debe aumentar.
- La evidencia más allá de identidad/dominio varía por cuenta.

## M. Próxima fase exacta — no iniciada

**AMOR DE GEA PILOT — CLIENT CONTEXT COMPLETION AND ACCOUNT INTELLIGENCE QUALITY IMPROVEMENT**

Debe ingresar respuestas reales, aceptar una versión de contexto, recalcular tesis, profundizar evidencia por cuenta, mejorar diferenciación, revisar las seis tesis y preparar outputs customer-safe. Generar reporte final únicamente cuando los gates de readiness pasen.

## N. No repetir

No reiniciar auditoría de arquitectura; no reconstruir Auth; no recrear migraciones; no rehacer navegación, Admin o PDF; no ejecutar discovery amplio; no cambiar ranking; no inventar respuestas.

## O. Estado Git al cierre

El commit final es el commit que contiene este handoff; resolverlo con `git rev-parse HEAD`. Branch `main`. Antes del commit final, `origin/main` apuntaba a `aaf39ebfd2d932592d762725739493ba7cbcaa67`. Push y despliegue quedan pendientes salvo que el handoff final indique lo contrario. El repositorio debe quedar limpio excepto:

- `.leadlens/source-intelligence.json`
- `.leadlens/usage.json`
