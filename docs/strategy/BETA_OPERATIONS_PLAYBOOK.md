# Beta Operations Playbook v0

Guía práctica para operar clientes beta sin tocar la base de datos en los casos comunes. Herramientas: dashboard admin (`/admin`), Monitor Ops (`/admin/monitor-runs`), system health, y el smoke script.

## 1. Onboarding de un beta customer

1. El cliente completa el onboarding público → se crean profile + ICP + `lead_search` + `onboarding_request` (setup completo automáticamente).
2. Verificar en `/admin/searches/<id>`: sin warning rojo de "no onboarding linkage" y readiness banner ≠ SETUP INCOMPLETE.
3. Verificar plan/créditos en el perfil (el gate de entitlement exige plan no-free o créditos > 0).
4. Si el cliente creó la search desde el dashboard (sin onboarding): verá "Setup incomplete" — hoy el fix es crear la search vía onboarding; no hay linking posterior.

## 2. Baseline y comparación

1. Baseline: botón "Run AI Report" en admin o "Run monitor" del cliente → 202 processing.
2. Esperar completion (run history se refresca sola). Badge BASELINE.
3. Verificar el reporte ANTES de avisarle al cliente (sección 4).
4. Segunda run (≥ unos días después para señales nuevas) → badge COMPARED; el reporte dice "What Changed Since Last Report".

## 3. Runs fallidos / stalled

| Síntoma | Qué hacer |
|---|---|
| Run row FAILED | Botón **Retry** (crea job nuevo). Si falla repetido → revisar logs `[internal/process] failed` (¿API key? ¿datos?) |
| Run row STALLED | Botón **Retry** (reprocesa el mismo job) o esperar el cron diario del drainer |
| Muchos stalled a la vez | `/admin/monitor-runs` → **Run drainer now** (o Dry run primero para ver qué haría) |
| "processing" eterno en UI del cliente | Tras 15 min se vuelve "Taking longer than expected" y el cliente puede relanzar; el drainer/retry lo resuelve del lado admin |
| Retry devuelve 409 | Hay un run fresh en vuelo — esperar; no forzar |

## 4. QA antes de mostrar un reporte

Checklist corto (el completo está en QUALITY_STANDARD.md):
1. Readiness banner: **READY TO REVIEW** (verde). REVIEW RECOMMENDED = leer el reporte con lupa antes de compartir.
2. Chips de warning: "Low/insufficient evidence dominates" o "Mostly repeated / no meaningful change" → NO compartir sin revisar cuenta por cuenta.
3. Abrir el reporte: ¿evidencia específica (no genérica)? ¿freshness honesta (unknown se muestra como unknown)? ¿cero nombres/emails de personas?
4. Baseline dice "Current Change Signals"; solo la comparación real dice "Since Last Report".

**No mostrar un reporte cuando:** dominan evidencia insuficiente o repetición, las explicaciones son intercambiables entre empresas, o cualquier dato personal aparece (bloqueo total — reportar como bug).

## 5. Evidencia débil — cómo responder

- El sistema ya degrada acciones (guardrails de Evidence Quality) — verificar que las cuentas débiles digan "Monitor/Watchlist", no "Contact this week".
- Si el run entero es débil: mercado/ICP con poca cobertura pública → ajustar ICP con el cliente o esperar el source engine. No prometer lo que las fuentes no dan.

## 6. Feedback

- Pedir al cliente 3–5 feedbacks por reporte (Good fit / Not relevant / Do not show again son los más valiosos para el Vault).
- Verificar en `/admin/feedback` que llegan. "Do not show again" debe reflejarse en el siguiente run (anti-repetition).

## 7. Datos personales — regla de operación

Nunca reenviar al cliente el tooling admin (la tabla de leads admin sí tiene contactos del flow Apollo legacy — es interno). Todo lo customer-facing es account-level; si algo personal aparece en una superficie de cliente, es un bug bloqueante.

## 7b. Recorrido de experiencia pre-beta

Antes de dar acceso a un cliente, hacer una vez el recorrido completo de cliente
(pasos 46–55 de BETA_SMOKE_QA.md): landing → signup → dashboard vacío → setup →
run → processing → report → feedback → segunda run. Si algún paso confunde a
alguien del equipo, confundirá al cliente.

## 8. Lo que sigue siendo manual

- Disparar runs (sin scheduling mensual — copy honesto en el dashboard).
- QA pre-entrega (secciones 4–5).
- Upgrades de plan/créditos (Supabase admin o Lemon orders).
- Linking de onboarding para searches creadas por dashboard.
- Recovery más rápido que el cron diario (botones de Monitor Ops).

## 9. Vault Foundation (intake manual)

- Toda cuenta/señal descubierta de fuente pública permitida entra por
  `/admin/vault-foundation/candidates/new` — source URL + type obligatorios.
- Nada sale de pending_review hacia un cliente sin revisión humana.
- Antes de usar cualquier contacto: verificar `usage_rights_status` y supresión.
- Apollo: SOLO prospección interna de LeadLens salvo licensing
  (ver LEADLENS_DATA_SOURCING_COMPLIANCE.md). El flag
  `APOLLO_LICENSED_PROVIDER_ENABLED` nunca se activa sin acuerdo firmado.
- Chequeo previo a beta: `/admin/beta-readiness` en READY.

## 10. Lead Hunter (descubrimiento para el Vault)

1. `/admin/lead-hunter/briefs` → crear brief (mercado, región, señales).
2. "Start run" → agregar sources (URL permitida + contexto `Company — evidence`).
3. "Generate candidates" → revisar en la cola: aprobar/rechazar/reservar.
4. Aprobados con rights resueltos → "→ Vault".
5. Regla: nada con safety BLOCKED o rights unverified llega al Vault — el sistema lo impide, no lo intentes rodear.

## 11. Vault → Report bridge (preview de oportunidades)

1. /admin/vault-report-bridge → definir ICP (mercado, región, industria, freshness).
2. "Preview Vault opportunities" → revisar scores, razones y exclusiones contadas.
3. "Dry-run report payload" → inspeccionar el LeadCandidate[] exacto.
4. Preview/dry-run NO registran usage ni crean reservas — seguro de usar siempre.
5. Si sale "not enough approved Vault opportunities yet": correr Lead Hunter, aprobar y promover más candidatos.

## 12. Generar reporte de cliente desde el Vault

1. /admin/vault-report-bridge → criterios + customer email → Preview.
2. "Generate customer report from Vault (N)" → confirmar el warning.
3. Copiar el link /results/<jobId> y entregarlo al cliente.
4. Regla: usage se registra solo si el reporte se creó; si falla, las reservas se liberan solas.
5. Requiere créditos de Anthropic API activos.
