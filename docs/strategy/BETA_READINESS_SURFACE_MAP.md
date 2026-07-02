# Beta Readiness Surface Map

**Documento vivo** — mapa de superficies de producto para decidir qué es seguro exponer a un beta customer. Actualizar cuando una superficie cambie de clasificación.

Clasificación por superficie:
- **Account-safe**: no muestra datos de contacto personales.
- **Legacy-contact**: muestra o exporta contact_name/email/linkedin del flow Apollo pre-pivot.
- **Auth**: qué protección tiene.

## Customer-facing

| Superficie | Ruta | Clasificación | Auth | Estado |
|---|---|---|---|---|
| Dashboard home | `/dashboard` | Account-safe (verificar copy) | Supabase session | OK |
| Monitor/search list | `/dashboard/searches` | Copy legacy ("Lead Searches") | Supabase session + RLS | Limpiar (P1/P3) |
| Search detail | `/dashboard/searches/[id]` | **Legacy-contact** (tabla lead_results + CSV export con contact_name/email/linkedin) | Supabase session + RLS | **Limpiar (P1)** |
| Monitor section (search detail) | `/dashboard/searches/[id]` | Account-safe | Bearer JWT + ownership (`/api/monitor/[id]/runs`) | OK |
| Report page | `/results/[jobId]` | Account-safe (rewrite SaaS Readiness Sprint) | **Sin auth en `/api/report`** | **Proteger (P2)** |
| Feedback | cards del report | Account-safe | Sin auth (por diseño demo-friendly) | Dedup (P5) |

## Admin-facing

| Superficie | Ruta | Clasificación | Auth | Estado |
|---|---|---|---|---|
| Admin search detail | `/admin/searches/[id]` | Contact data visible (tabla leads) — **admin-only, aceptable** | x-admin-token | OK (interno) |
| Admin run history | `GET /api/admin/searches/[id]/runs` | Account-safe (conteos) | x-admin-token | OK |
| Admin QA flags | run history UI | Account-safe | x-admin-token | Mejorar (P6/P7) |
| Admin report | `GET /api/admin/report/[jobId]` | Full report | x-admin-token | OK |
| Rerun | `POST /api/admin/searches/[id]/rerun` | Account-safe | x-admin-token | OK |

## Report / export endpoints

| Endpoint | Fuente de datos | Auth | Estado |
|---|---|---|---|
| `GET /api/report?job_id=` | tabla `reports` (legacy admin jobs) — **NO lee snapshot_reports** | **Ninguna** | **P2: snapshot-first + ownership** |
| `POST /api/report` (body→CSV/MD) | body del caller | Ninguna (el caller ya tiene los datos) | OK |
| CSV export dashboard | `lead_results` client-side | Session (RLS) | **Legacy-contact — limpiar (P1)** |
| CSV/MD export report page | `/api/report?format=` | Sin auth | P2 |

## Hallazgo crítico (pre-P2)

Los links "View report" del monitor center apuntan a `/results/[jobId]` → `GET /api/report` → tabla `reports`. Los monitor runs guardan en `snapshot_reports`, no en `reports` — esos links devuelven 404 hoy. P2 agrega lookup snapshot-first con ownership check, lo que arregla ambos problemas (acceso y seguridad) a la vez.

## Legacy `reports` (tabla)

Escrita solo por `/api/admin/jobs/[id]/run` (flow legacy). Linkage: `order_id` — sin linkage verificable a `auth.users`. Decisión: acceso **admin-only**; clientes no pueden abrir reports legacy sin scope. Sin public sharing.
