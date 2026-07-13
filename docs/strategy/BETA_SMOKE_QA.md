# Beta Smoke QA Guide v0

Guía práctica para verificar que un entorno LeadLens está beta-ready.
Correr completa antes de exponer el producto a un beta customer real.
Marcar PASS/FAIL por paso; cualquier FAIL en pasos de seguridad (8, 11, 13, 15) bloquea el beta.

Prerequisitos: Supabase configurado, `ADMIN_SECRET_TOKEN` seteado, dev server corriendo, un usuario de prueba con sesión.

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 1 | Crear search vía onboarding | POST el form público de onboarding (o `/api/onboarding/submit` con body válido). Respuesta incluye `search_id`. | ☐ |
| 2 | Verificar linkage onboarding→search | SQL: `SELECT id FROM onboarding_requests WHERE search_id = '<SEARCH_ID>';` → 1 fila. | ☐ |
| 3 | Run baseline | `curl -X POST .../api/admin/searches/<SEARCH_ID>/rerun -H "x-admin-token: $TOKEN"` → `is_baseline: true`. | ☐ |
| 4 | Segundo run | Mismo curl → `is_baseline: false`, mensaje de comparación. | ☐ |
| 5 | Verificar scope del snapshot | SQL: `SELECT job_id, status, search_id FROM snapshot_reports WHERE search_id = '<SEARCH_ID>' ORDER BY created_at;` → 2 filas completed, `search_id` correcto, nunca null. | ☐ |
| 6 | Monitor center | Login como owner → `/dashboard/searches` → columna Monitor muestra "Latest report →" con badge COMPARED. | ☐ |
| 7 | Abrir reporte customer | Click en Latest report → página carga con badge "Compared with your previous report". | ☐ |
| 8 | **Sin campos de contacto** | En el reporte y en `/dashboard/searches/[id]`: cero emails personales, nombres de personas, teléfonos, LinkedIn. Exportar ambos CSVs y revisar headers. | ☐ |
| 9 | Wording de What Changed | Run 1 (baseline): "Current Change Signals". Run 2: "What Changed Since Last Report". Nunca "since last report" en baseline. | ☐ |
| 10 | Feedback | En una account card, click "Good fit" → "✓ Feedback saved". SQL: `SELECT id FROM opportunity_feedback WHERE job_id = '<JOB_ID>' AND company = '<COMPANY>';` → 1 fila. | ☐ |
| 11 | **Feedback dedup** | Repetir el mismo POST de feedback (curl con mismo job_id+company+signal) → `already_saved: true`, sigue habiendo 1 fila. | ☐ |
| 12 | Admin QA status | `/admin/searches/<SEARCH_ID>` → banner de readiness (READY TO REVIEW o REVIEW RECOMMENDED) + chips por run. | ☐ |
| 13 | **Auth de reporte** | (a) Owner con sesión → 200. (b) `curl .../api/report?job_id=<JOB>` sin auth → 401. (c) Bearer token de OTRO usuario → 404. (d) `x-admin-token` → 200. | ☐ |
| 14 | /api/process one-off | POST `/api/process` sin `searchId` → completa; snapshot con `search_id` null; sin comparación previa. | ☐ |
| 15 | **Demo mode aislado** | Con `DEMO_MODE=true`: pipeline no lee account memory ni snapshots previos; `/api/report` abierto solo sobre datos demo. Sin writes a account_memory. | ☐ |

## SQL snippets útiles

```sql
-- Searches sin linkage de onboarding (no pueden correr como monitor):
SELECT ls.id, ls.name FROM lead_searches ls
LEFT JOIN onboarding_requests o ON o.search_id = ls.id
WHERE o.id IS NULL;

-- Runs de una serie con estado:
SELECT job_id, status, lead_count, hot_count, created_at
FROM snapshot_reports WHERE search_id = '<SEARCH_ID>' ORDER BY created_at;

-- Feedback duplicado (debe devolver 0 filas tras P5):
SELECT job_id, company, feedback_signal, COUNT(*)
FROM opportunity_feedback
GROUP BY 1,2,3 HAVING COUNT(*) > 1;

-- Snapshots unscoped (solo admin puede abrirlos):
SELECT job_id, status, created_at FROM snapshot_reports WHERE search_id IS NULL;
```

## Resultado

- **PASS total** → entorno beta-ready.
- **FAIL en 8/11/13/15** → bloqueo: no exponer a clientes hasta arreglar.
- **FAIL en otros** → evaluar severidad; documentar en DECISION_LOG.

## Self-serve additions (Smoke QA + Bugfix Sprint v0 — 2026-07-02)

Pasos adicionales para el flujo self-serve (complementan la tabla principal;
los pasos 3–4 de arriba pueden ejecutarse también como customer):

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 16 | Run self-serve (owner) | `curl -X POST .../api/monitor/<SEARCH_ID>/run -H "Authorization: Bearer <OWNER_JWT>"` → 200, `is_baseline` correcto | ☐ |
| 17 | Run self-serve (no-owner) | Mismo curl con JWT de otro usuario → **404** | ☐ |
| 18 | Entitlement gate | Usuario plan free + 0 créditos → **403** con copy de upgrade | ☐ |
| 19 | Setup incomplete | Search sin onboarding_request → **422** | ☐ |
| 20 | Stale processing no bloquea | Insertar snapshot `processing` con `created_at` > 15 min atrás (SQL) → run devuelve 200, no 409 | ☐ |
| 21 | `report.search_id` presente | Report de un run nuevo → `report_json->>'search_id'` = SEARCH_ID | ☐ |
| 22 | Feedback con search context | Fila de `opportunity_feedback` del run nuevo tiene `search_id` no-null | ☐ |
| 23 | Script automatizado | `npm run smoke:selfserve` con todos los env vars → 0 failed | ☐ |

## Estado de verificación (2026-07-02)

**Verificado por inspección de código + TypeScript (0 errores):** auth chains,
ownership antes de acceso a snapshots, dedup con cutoff de staleness, copy
customer-safe, ausencia de campos de contacto en superficies customer, guards
del run endpoint, dedup de feedback.

**Requiere QA en vivo (browser + Supabase real) — NO verificado:**
- Sintaxis PostgREST del JSON-path select (`report_json->change_summary`) con datos reales.
- Flujo completo de run self-serve end-to-end (incl. duración del pipeline).
- Descargas CSV/MD autenticadas desde el browser.
- Renderizado del report page con un `report_json` real (shapes legacy incluidos).
- Comportamiento del token refresh de Supabase durante runs largos.
- `maxDuration = 300` solo aplica en planes Vercel que lo permiten — verificar en deploy.

## Async run additions (Reliability Sprint v0 — 2026-07-02)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 24 | Run devuelve rápido | POST run (customer o admin) → **202** con `status: "processing"` en segundos, no minutos | ☐ |
| 25 | Snapshot processing existe | SQL inmediato: fila `processing` con `search_id` correcto | ☐ |
| 26 | Processor rechaza sin secret | `curl -X POST .../api/internal/monitor-runs/<JOB>/process` sin header → 401/403 (producción) | ☐ |
| 27 | Processor completa un job | Mismo curl con `x-internal-secret` válido → 200 `status: "completed"`; snapshot pasa a completed | ☐ |
| 28 | Fallo marca failed | Job cuyo pipeline falla → snapshot `failed`, nunca stuck | ☐ |
| 29 | UI muestra processing | Monitor detail: botón "Run in progress", polling actualiza solo | ☐ |
| 30 | Report disponible al completar | El link "View report" del run aparece y abre tras completion | ☐ |
| 31 | Retry de stale | Row processing > 15 min → badge STALLED en admin → "Retry run" → job reprocesado | ☐ |
| 32 | Retry de failed | Run failed → "Retry run" → job NUEVO creado y procesado | ☐ |
| 33 | Trigger perdido es recuperable | Matar el processor antes de completar → job queda processing → tras 15 min: stale + retriable | ☐ |

## Production architecture additions (Production Sprint v0 — 2026-07-02)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 34 | Drainer rechaza sin secret | `curl -X POST .../api/internal/monitor-runs/drain` sin headers → 401/403 (producción) | ☐ |
| 35 | Drainer dry_run | Mismo curl con `x-internal-secret` + `?dry_run=true` → 200 con summary `{scanned, retriggered, superseded, abandoned, skipped_fresh}` sin mutar nada | ☐ |
| 36 | Drainer bounded | `?limit=100` se clampa a 25 (revisar summary vs filas processing) | ☐ |
| 37 | Drainer ignora completed/unscoped | Insertar snapshot processing SIN search_id (SQL) → dry_run no lo lista en actions | ☐ |
| 38 | Drainer recupera stale | Snapshot processing > 15 min con search_id → drain real lo re-dispara; > 6 h → lo marca failed (abandoned) | ☐ |
| 39 | Ops center carga | `/admin/monitor-runs` → totales + runs recientes + botones Retry/drain | ☐ |
| 40 | Retry rechaza completed | `POST .../api/admin/monitor-runs/<JOB_COMPLETED>/retry` → 409 | ☐ |
| 41 | Retry 409 con fresh en vuelo | Retry de stale mientras existe run fresh en la misma serie → 409 | ☐ |
| 42 | Env health | `GET /api/admin/system-health` con admin token → `env_health.production_safe` + `missing_for_production` (booleans, nunca valores) | ☐ |
| 43 | Scheduler inactivo | Grep `SCHEDULING_ENABLED` = false; ninguna ruta crea runs sin acción humana (el cron del drainer solo recupera jobs existentes) | ☐ |
| 44 | Fail-closed sin secrets | Deploy de prueba SIN INTERNAL_RUN_SECRET/ADMIN_SECRET_TOKEN/CRON_SECRET → processor y drainer devuelven 403 en producción | ☐ |
| 45 | Cron config | `vercel.json` tiene el drain path; con `CRON_SECRET` seteado, Vercel manda `Authorization: Bearer` automáticamente | ☐ |

## Customer experience additions (Customer-Ready Sprint v0 — 2026-07-02)

Recorrido de cliente real, en orden, en browser:

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 46 | Website explica el producto | Landing en 10 segundos: qué es, para quién, promesa central, sin lenguaje de contactos. Link "Sign in" visible en nav | ☐ |
| 47 | Signup/login | Crear cuenta + login; subtítulos hablan de opportunity monitor, no lead generation | ☐ |
| 48 | Dashboard vacío | Usuario nuevo: empty states explican qué es un monitor y qué hacer (crear ICP → crear search) | ☐ |
| 49 | Setup states | Search sin business context muestra "Setup incomplete" (lista + detail + botón deshabilitado) con explicación en lenguaje de cliente | ☐ |
| 50 | Run → confirmación inmediata | Click "Run monitor" → mensaje de confirmación en segundos, botón pasa a "Run in progress" | ☐ |
| 51 | Processing visible | Badge "Processing", polling actualiza solo, sin refresh manual | ☐ |
| 52 | Report aparece | Al completar: link "View report" en el run + "Open latest report" en header | ☐ |
| 53 | Feedback UX | Chips claros, línea "Your feedback helps future reports improve", estados saved/already recorded/error | ☐ |
| 54 | Stalled comprensible | Run stalled: "Taking longer than expected — you can start a new run" (nunca jerga interna) | ☐ |
| 55 | Mobile | Landing, dashboard, monitor detail y report legibles en ~390px; sin overflow horizontal grave | ☐ |

(Pasos de auth de reporte, dedup de feedback, admin recovery y env health ya cubiertos en 8–45.)

## Vault Foundation + Beta Command additions (2026-07-02)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 56 | Beta readiness panel | `/admin/beta-readiness` carga; verdict banner + critical config live + checklists manuales persisten al recargar | ☐ |
| 57 | Vault empty state | `/admin/vault-foundation` carga con Supabase vacío/sin migración sin crashear | ☐ |
| 58 | Crear company manual | Companies → + Add manually → aparece en la lista | ☐ |
| 59 | Crear source manual | Sources → source_url y source_type obligatorios; sin URL → error claro | ☐ |
| 60 | Crear signal manual | Signals → signal_type obligatorio; queda pending_review | ☐ |
| 61 | Intake de candidato | /admin/vault-foundation/candidates/new → bundle crea source+company(+contact)(+signal); segunda vez con mismo domain → "matched by domain" | ☐ |
| 62 | Suppression | Agregar entrada email/domain con reason; aparece en la lista | ☐ |
| 63 | Sin ruta pública de Vault | `curl /api/admin/vault-foundation/companies` sin x-admin-token → 401/403 | ☐ |
| 64 | Apollo deshabilitado | Con APOLLO_API_KEY seteado pero sin licensed flag: run del flow Apollo falla con mensaje de licensing (no silencioso) | ☐ |
| 65 | Setup completion | Search creada desde dashboard → form "Complete your monitor setup" → guardar → botón Run se habilita | ☐ |
| 66 | smoke:vault | `npm run smoke:vault` → 11/11 PASS | ☐ |

## Lead Hunter additions (2026-07-09)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 67 | Migración 030 aplicada | `SELECT COUNT(*) FROM lead_hunter_briefs;` → 0 sin error | ☐ |
| 68 | Crear brief + run | /admin/lead-hunter/briefs → crear → Start run | ☐ |
| 69 | Source con formato | Run detail → agregar source con "Company — evidence" → Generate → 1 candidato pending_review | ☐ |
| 70 | Source LinkedIn bloqueada | Agregar URL linkedin.com → safety BLOCKED; Generate no crea candidato de ella | ☐ |
| 71 | Rights gate | Candidato con rights unverified → Approve/→Vault devuelven error 422 claro | ☐ |
| 72 | Promote to Vault | Candidato permitted → →Vault → aparece en /admin/vault-foundation/companies con source y signal | ☐ |
| 73 | Sin rutas públicas | `curl /api/admin/lead-hunter/briefs` sin token → 401/403 | ☐ |
| 74 | smoke:lead-hunter | `npm run smoke:lead-hunter` → 14/14 | ☐ |

## Vault → Report bridge additions (2026-07-11)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 75 | Preview con Vault vacío | /admin/vault-report-bridge → Preview → estado claro "not enough approved Vault opportunities yet" | ☐ |
| 76 | Preview con datos | Promover 1+ candidato al Vault → Preview → aparece con match score y razones | ☐ |
| 77 | Exclusión por rights | Company cuyo source tiene rights unverified → contada en exclusiones, no seleccionada | ☐ |
| 78 | Dry-run payload | "Dry-run report payload" → JSON LeadCandidate[] con source "vault", sin email/name/title | ☐ |
| 79 | Sin ruta pública | curl /api/admin/vault-report-bridge/preview sin token → 401/403 | ☐ |
| 80 | smoke:vault-bridge | npm run smoke:vault-bridge → todo verde | ☐ |

## Readiness automation additions (2026-07-11)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 81 | Env readiness | `npm run check:supabase` → 0 FAIL | ☐ |
| 82 | Schema probe | `npm run probe:supabase` → 0 MISSING (o dice exactamente qué migración aplicar) | ☐ |
| 83 | Seed E2E local | dev server + `npm run seed:vault-bridge-demo` → 8 pasos OK y URLs impresas | ☐ |
| 84 | Bridge payload contract | `npm run test:vault-bridge` → todo verde (source vault, confidence 0–1, sin contactos) | ☐ |

## Vault-powered generation additions (2026-07-11)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 85 | Generate sin email | Generate sin customer_email → 400 claro | ☐ |
| 86 | Generate feliz | Preview con selección → Generate → link /results/<jobId> abre reporte completo | ☐ |
| 87 | Usage post-éxito | Preview de nuevo mismo cliente → excluidos already_used | ☐ |
| 88 | Failure lifecycle | (simulado) run fallido → snapshot failed + reservas released + 0 usage | ☐ |
| 89 | smoke generation | npm run smoke:vault-report-generation → 16/16 | ☐ |

## Generation ops additions (2026-07-11)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 90 | Queue 202 | Generate → 202 inmediato con job_id y link processing | ☐ |
| 91 | Processor auto | El reporte pasa a completed (con créditos) o failed limpio (sin créditos) solo | ☐ |
| 92 | Failure release | Job failed → reservations_released > 0 en runs list | ☐ |
| 93 | Retry seguro | Retry de failed → 202 job nuevo; retry de completed → 409 | ☐ |
| 94 | Idempotencia | POST interno con job completed → skipped, sin doble usage | ☐ |
| 95 | AI probe | ALLOW_AI_HEALTH_PROBE=true npm run check:supabase → estado real de créditos | ☐ |
| 96 | smoke ops | npm run smoke:vault-generation-ops → 22/22 | ☐ |

## Customer delivery additions (2026-07-13)

| # | Paso | Cómo verificar | Pass |
|---|---|---|---|
| 97 | Linked delivery | Generate con search_id → aparece en dashboard + monitor history del cliente | ☐ |
| 98 | Link-only señalado | Generate sin search_id → 202 con warning y pill "link-only" en runs | ☐ |
| 99 | Notificación | Job linkeado completado → notificación "Your report is ready" en /dashboard/notifications | ☐ |
| 100 | Cross-user | Usuario B no ve monitores/reportes de A (overview filtra por user_id) | ☐ |
| 101 | Failed safe | Reporte failed → cliente ve copy genérico, sin error técnico | ☐ |
| 102 | smoke delivery | npm run smoke:customer-vault-delivery → 20/20 | ☐ |
