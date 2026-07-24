# LeadLens — Matriz de autorización de APIs

**Fecha:** 2026-07-21  
**Propósito:** inventario de seguridad para la Compuerta A. La clasificación debe verificarse de nuevo cuando se agrega o cambia una ruta.

## Modelos de acceso

| Clase | Mecanismo esperado | Regla |
|---|---|---|
| Public demo/read | Sin sesión, input limitado | Nunca accede a datos reales ni activa gasto no acotado |
| Customer | Bearer Supabase JWT | Verifica usuario en servidor |
| Owner-only | JWT + `user_id`/relación en DB | Recurso ajeno responde 404 |
| Admin | `x-admin-token` + `requireAdmin` | Falla cerrado en producción |
| Internal/cron | secreto dedicado/Bearer | Falla cerrado; no depende de un ID difícil de adivinar |
| Webhook | firma raw-body | Idempotencia y validación de evento |

## Inventario verificado

| Superficie | Clase | Estado 2026-07-21 | Notas |
|---|---|---|---|
| `/api/admin/*` | Admin | PASS estático | Todas las rutas encontradas invocan `requireAdmin`; `process-ready` además acepta cron según su contrato |
| `/api/internal/monitor-runs/*` | Internal/admin | PASS estático | Usa internal/cron secret y fallback admin explícito |
| `/api/internal/vault-report-bridge/process` | Internal | PASS estático | Requiere `INTERNAL_RUN_SECRET`; mantener test negativo |
| `/api/report` GET | Owner/admin/demo | PASS por diseño | JWT + ownership de `search_id`; legacy/unscoped admin-only; demo abierto solo bajo flag |
| `/api/report` POST | Public transform | REVIEW | Convierte un reporte ya poseído; limitar payload/rate antes de self-serve |
| `/api/feedback/opportunity` | Owner | PASS estático | JWT/ownership; mantener tests de dedup |
| `/api/credits`, notifications, monitor | Customer/owner | PASS estático | JWT presente; completar pruebas horizontales |
| `/api/lemon-webhook` | Webhook | REVIEW | Firma presente; reconciliación cuando persistencia falla sigue pendiente |
| `/api/webhook` | Webhook Stripe legacy | REVIEW/BLOCKED | Firma presente; retirar o desactivar cuando se elija proveedor único |
| `/api/jobs`, `/api/jobs/[jobId]` | Admin legacy | FIXED | Antes listaba PII y permitía mutar jobs sin auth; ahora `requireAdmin` |
| `/api/results/[jobId]` | Admin legacy | FIXED | Antes exponía snapshot completo por job ID; ahora `requireAdmin`; clientes usan `/api/report` |
| `/api/process` | Admin legacy | FIXED | Antes cualquier caller podía activar pipeline/providers; ahora `requireAdmin`; demos usan `/api/demo` |
| `/api/process/search/[id]` | Owner/internal/admin | FIXED | JWT + ownership, `INTERNAL_RUN_SECRET` o admin explícito; UUID solo nunca autoriza; 7/7 tests |
| `/api/demo` | Public demo | PARTIAL/FIXED | Falla cerrado salvo `DEMO_MODE=true`, input estricto y respuesta marcada demo; rate limiting sigue pendiente |
| `/api/checkout` | Public | CLOSED/FIXED | Gate doble explícito; no crea job/PII cuando está cerrado; proveedor desconocido falla cerrado |
| `/api/onboarding` | Retired | FIXED | Flujo Stripe/contactos sin caller vigente; responde 410 |
| `/api/onboarding/submit` | Retired | FIXED | Flujo service-role inseguro retirado; responde 410 |
| `/api/onboarding/upload-logo` | Retired | FIXED | Upload público sin identidad retirado; responde 410 |
| `/api/upload` | Retired | FIXED | Upload de contactos/PII incompatible retirado; responde 410 |
| `/api/events` | Public telemetry | PARTIAL/FIXED | Schema, 8 KB, 60/min por instancia; rechaza pagos/refunds/amount desde browser. Falta rate limit distribuido |
| `/api/provider-status` | Dev-only status | PASS estático | Responde 404 en producción; solo booleanos en desarrollo |

## Próximas correcciones en orden

1. Sustituir rate limiting por instancia por uno distribuido antes de self-serve; extender a auth/feedback.
2. Añadir test de integración HTTP para las superficies 410 y checkout cerrado.
3. Auditar `/api/events` y `/api/provider-status` por abuso/fuga de información.
4. Completar pruebas horizontales owner/no-owner sobre Supabase real de prueba.
5. Diseñar un intake de piloto nuevo; no reabrir las rutas legacy.

## Evidencia HTTP local

`npm run test:http-security` (12/12): retiradas=410, checkout cerrado=503,
demo fuera de modo=404, jobs/results/process legacy sin admin=401 y procesador
de búsqueda anónimo/malformado=401/400 antes de DB. Owner/no-owner se cubre en
el helper (7/7); queda pendiente integración horizontal contra Supabase de prueba.
