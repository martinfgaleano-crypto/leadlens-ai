# Customer-facing Vault Delivery v1

**El cliente vive en el workspace, no en un link suelto.** Complementa
LEADLENS_VAULT_GENERATION_OPS.md.

## Contrato de linking

- Generate con **search_id** → el snapshot queda en la serie del monitor del cliente
  → aparece automáticamente en: dashboard (latest report card), lista de monitores
  (badge + Open report) e historial del monitor detail — todo vía /api/monitor/overview
  y /api/monitor/[id]/runs, que filtran por el user autenticado (Bearer JWT, user_id).
- Generate **sin search_id** → reporte **link-only**: el cliente lo abre por el
  /results/<jobId> copiado, no aparece en las listas del workspace (snapshot_reports
  no indexa por email; la visibilidad del workspace es por lead_searches.user_id).
- El admin ve la diferencia en todos lados: el 202 devuelve `workspace_visible` +
  delivery note, y la runs list muestra el pill "workspace" / "link-only".

## Estados customer-safe

- Processing: /results muestra "being generated" con polling; el detail del monitor
  también pollea. Cero metadata interna.
- Failed: copy genérico ("failed before producing a report; our team has visibility") —
  el results API no devuelve report_json en failed, así que ni el error técnico ni la
  metadata del Vault pueden filtrarse. El error real vive solo en la runs list admin.
- Completed: reporte completo con Visual Insights + feedback por oportunidad
  (opportunity_feedback ya enlaza job_id + search_id + user).

## Notificación in-app

Al completar un job **linkeado**, el processor crea una notificación best-effort
("Your report is ready" con el link) para el dueño del monitor (lead_searches.user_id →
notifications). Nunca bloquea la entrega; sin email (no se tocó Resend/SMTP).

## Qué ve el cliente / qué no

Ve: estado del reporte, fecha, cuentas, evidencia con fuentes, insights, feedback.
NO ve: vault ids, reservas, criterios del admin, errores de Anthropic, nada de
Lead Hunter. El marker `_vault_generation` del reporte completado solo lleva
source_mode/generated_by/completed_at/usage_recorded/su propio email.

## Flujo admin recomendado

1. /admin/searches → copiar el search_id del monitor del cliente.
2. /admin/vault-report-bridge → criterios + customer email + **search_id** → Preview → Queue.
3. Verificar pill "workspace" en la runs list.
4. El cliente lo ve solo en su dashboard/monitor (+ notificación al completar).

## Limitaciones actuales

- Sin search_id no hay visibilidad en workspace (documentado y señalado al admin).
- Notificación solo in-app; email queda para un sprint con el sistema de correo ya endurecido.
- El label del reporte en el workspace es el genérico de la serie (no distingue
  "vault-generated" de un run de monitor — decisión deliberada: para el cliente es
  simplemente su opportunity report).

## Actualización 2026-07-13 — Trial E2E

Delivery validado con un cliente auth real ([DEMO BETA E2E]): workspace scoping,
aislamiento, feedback con user_id (fix), y dedupe de cuentas en selección (fix).
Ver LEADLENS_BETA_E2E_TRIAL_RUN.md.
