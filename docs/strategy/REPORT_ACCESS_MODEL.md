# Report Access & Delivery Model v0

**Documento vivo** — actualizar si cambia el modelo de auth, se agrega sharing, o se agrega delivery por email.

## Cómo se abre un reporte

Un reporte se abre en `/results/[jobId]`, que consulta `GET /api/report?job_id=`.
Lookup del backend: primero `snapshot_reports` (monitor runs), después la tabla
legacy `reports` (flow admin jobs pre-monitor).

## Reglas de acceso (GET /api/report)

| Caller | Puede ver |
|---|---|
| `DEMO_MODE=true` | Todo (solo hay datos demo; no existen clientes reales en ese entorno) |
| Admin (`x-admin-token` válido) | Cualquier reporte: monitor snapshots + legacy |
| Customer (Bearer supabase JWT) | Solo snapshots con `search_id` cuyo `lead_searches.user_id` = su uid |
| Sin auth | 401 |
| No-owner / desconocido | **404** — nunca se confirma que el reporte de otro usuario existe |

- **Snapshots sin `search_id` (unscoped/legacy)**: admin-only. No hay ownership verificable; nunca se adivina scope desde `job_id`.
- **Tabla `reports` legacy**: linked a `order_id`, sin linkage verificable a `auth.users` → admin-only.
- **`POST /api/report`** (body → CSV/MD): sin auth por diseño — el caller ya posee los datos que envía.

## Estados de respuesta

| Estado del run | Respuesta |
|---|---|
| completed | `{ status: "completed", report }` o CSV/MD según `format` |
| processing | `{ status: "processing" }` — la página sigue polling |
| failed | `{ status: "failed" }` — la página muestra estado de fallo con reference ID |
| `report_json` placeholder/corrupto | 404 |

## Delivery dentro del producto

- **Monitor center** (`/dashboard/searches`): columna Monitor con link "Latest report →" (badge BASELINE/COMPARED), estado "Run in progress", o "Needs internal review" cuando el último run falló.
- **Monitor detail** (`/dashboard/searches/[id]`): sección Monthly Monitor con run history y "View report" por run completado + "Open latest report".
- **Admin** (`/admin/searches/[id]`): run history con QA chips y readiness banner; el reporte completo se consulta vía `GET /api/admin/report/[jobId]` (admin token).
- **Descargas CSV/Markdown**: botones en el report page que hacen fetch autenticado (Bearer token) y descargan blob — los links directos sin auth ya no funcionan para datos reales.

## Lo que NO existe todavía (por diseño)

- **Sin public share links.** Un URL de reporte no es un secreto compartible; requiere sesión del owner o admin.
- **Sin delivery por email.**
- **Sin scheduler** — los runs son manuales y admin-only.
- **Sin acceso customer a reportes legacy** (tabla `reports`) — si un cliente legacy necesita su reporte, el admin lo exporta y entrega manualmente.
