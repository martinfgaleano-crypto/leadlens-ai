# Deployment Readiness Checklist v0

Correr completa antes de exponer el deploy a un beta customer. Cualquier ítem de la sección Seguridad en FAIL bloquea el go-live.

## 1. Environment variables (Vercel → Settings → Environment Variables)

| Var | Requerida | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Todo acceso a datos |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Auth cliente (login/session) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Rutas server (ownership checks, snapshots) |
| `ADMIN_SECRET_TOKEN` | ✅ | Admin API + fallback de processor/drainer |
| `INTERNAL_RUN_SECRET` | ✅ | Processor y drainer (dedicado) |
| `CRON_SECRET` | ✅ | Vercel Cron → drainer (header Bearer automático) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Trigger fire-and-forget del processor (self-fetch) |
| `APOLLO_API_KEY` | flow Apollo | Lead discovery legacy |
| `ANTHROPIC_API_KEY` (o la key del pipeline) | ✅ | Agentes AI |
| `DEMO_MODE` | ❌ en prod | Debe estar ausente o != "true" en producción |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | si se usan orders | Webhook de pagos |

Verificación rápida post-deploy: `GET /api/admin/system-health` con admin token →
`env_health.production_safe === true` y `missing_for_production` vacío.

## 2. Base de datos

- [ ] Migraciones 001–028 aplicadas en Supabase (SQL editor, en orden).
- [ ] RLS activo en: `lead_searches`, `icps`, `opportunity_feedback`, `customer_credits`, `snapshot_reports` (esta última sin policies — backend-only por diseño).
- [ ] `snapshot_reports.search_id` existe (migration 027) y `onboarding_requests.search_id` tiene índice (028).

## 3. Vercel

- [ ] `vercel.json` desplegado con los 2 crons (process-ready + drain).
- [ ] `CRON_SECRET` seteado ANTES del primer cron run.
- [ ] Plan Vercel: en hobby, `maxDuration=300` se clampa (~10–60s) → runs largos dependerán del drainer/retry; en Pro, subir el cron del drainer a `*/15 * * * *`.

## 4. Smoke QA obligatoria (ver BETA_SMOKE_QA.md)

- [ ] `npm run smoke:selfserve` con todos los env vars → 0 failed.
- [ ] Pasos de seguridad 8, 11, 13, 15, 26, 34, 44 en PASS.
- [ ] Pasos async 24–33 (run end-to-end real con Supabase productivo).
- [ ] Browser QA: dashboard → run → processing → report → feedback → segunda run → What Changed.

## 5. Checks de producto

- [ ] Cero campos de contacto personal en report page, dashboard, CSVs (paso 8 del smoke).
- [ ] Report auth: owner 200 / no-owner 404 / anon 401 / admin 200.
- [ ] Processor y drainer devuelven 401/403 sin secret.
- [ ] `/admin/monitor-runs` carga y el drainer dry_run responde.
- [ ] Feedback dedup activo (paso 11).

## 6. Rollback plan

- Deploy anterior: Vercel → Deployments → Promote previous (instantáneo).
- Los cambios de este ciclo no incluyen migraciones destructivas; 027/028 son aditivas — rollback de código no requiere rollback de DB.
- Si el drainer se comporta mal: quitar la entrada de `vercel.json` y redeploy (los jobs quedan recuperables manualmente); o rotar `CRON_SECRET`/`INTERNAL_RUN_SECRET` para cortarlo de inmediato.

## 7. Qué monitorear post-deploy (logs de Vercel)

- `[internal/process] failed` — fallas de pipeline (¿API key? ¿timeout?).
- `[drainer] done ... abandoned>0` — jobs muriendo sistemáticamente.
- `[run-jobs] processor trigger failed` — triggers perdidos (esperable ocasional; el drainer los cubre).
- `[retry] retry_rejected` frecuente — admin luchando contra races.
- 401/403 inesperados en `/api/report` — problemas de sesión/token de clientes reales.

## Vault Foundation (actualización 2026-07-02)

- Migración **029_vault_foundation.sql** se aplica DESPUÉS de 001–028, en orden.
- Env nuevo: `APOLLO_LICENSED_PROVIDER_ENABLED=false` (default). Nunca true sin
  acuerdo de licensing — ver LEADLENS_DATA_SOURCING_COMPLIANCE.md.
- `npm run smoke:vault` debe pasar 11/11 antes de deploy.
- `/admin/beta-readiness` debe mostrar READY antes de dar acceso a un beta customer.

## Lead Hunter (actualización 2026-07-09)

- Migración **030_lead_hunter.sql** después de 029.
- `npm run smoke:lead-hunter` debe pasar 14/14.
- Seed opcional local: `BASE_URL=http://localhost:3000 ADMIN_TOKEN=... npm run seed:lead-hunter` (rechaza deploys sin FORCE=true).

## Vault → Report bridge (actualización 2026-07-11)

- Sin migración nueva — el bridge lee tablas de 029 (vault_*).
- `npm run smoke:vault-bridge` debe pasar completo.
- Verificar que /api/admin/vault-report-bridge/* devuelve 401/403 sin token.

## Readiness automation (actualización 2026-07-11)

Antes de cada deploy: `npm run check:supabase` (0 FAIL) y `npm run probe:supabase`
(0 MISSING). Ver SUPABASE_SETUP.md y MIGRATION_READINESS_SUMMARY.md.

## Vault-powered generation (actualización 2026-07-11)

- `npm run smoke:vault-report-generation` 16/16.
- Créditos de Anthropic API activos (el generate corre el pipeline real).
- Sin migración nueva.

## Generation ops (actualización 2026-07-11)

- smoke:vault-generation-ops 22/22 y smoke:vault-report-generation 16/16.
- INTERNAL_RUN_SECRET recomendado en Vercel (fallback ADMIN_SECRET_TOKEN).
- NEXT_PUBLIC_APP_URL EXACTA (sin caracteres colgando) — un typo aquí rompe el
  trigger fire-and-forget del processor (bug real encontrado en local).
- Créditos Anthropic activos antes de generar.

## Customer delivery (actualización 2026-07-13)

- smoke:customer-vault-delivery 20/20.
- Al generar para un cliente real: SIEMPRE pasar search_id para visibilidad en workspace.

## Beta E2E (actualización 2026-07-13)

- test:beta-e2e-readiness 16/16 antes de cada entrega.
- AI probe sin FAIL (créditos activos) — requisito NO negociable para generar.

## Intelligence Foundation (actualización 2026-07-14)

- Migración **031_intelligence_foundation.sql** después de 030 (aditiva; sin ella el
  feedback opera en modo legacy con warning, nada se rompe).
- `npm run smoke:intelligence` y `npm run test:intelligence` verdes.
- Verificar en /admin/intelligence el banner de observation mode — ninguna preferencia
  con ranking On existe en esta versión.
