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
