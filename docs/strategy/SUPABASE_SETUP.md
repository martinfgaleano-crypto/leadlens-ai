# Supabase Setup — LeadLens

## Env vars (en `.env.local`, nunca commiteado; en Vercel para producción)

| Var | Obligatoria | Nota |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | Project Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | idem |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | **Solo server-side. Jamás con prefijo NEXT_PUBLIC.** |
| ADMIN_SECRET_TOKEN | ✅ | protege /api/admin/* y el admin UI |
| INTERNAL_RUN_SECRET | recomendada | procesador async (fallback: ADMIN_SECRET_TOKEN) |
| CRON_SECRET | si cron activo | drainer diario en Vercel |
| NEXT_PUBLIC_APP_URL | producción | URL desplegada |
| APOLLO_LICENSED_PROVIDER_ENABLED | dejar `false` | licensed-only; la presencia de APOLLO_API_KEY NO lo activa |

## Flujo de verificación (sin tocar secretos por chat)

```
npm run check:supabase    # env + seguridad de secretos (presencia, nunca valores)
npm run probe:supabase    # tablas reales vs. esperadas → qué migración falta
```

## Mínimo para probar la cadena actual (Hunter → Vault → Bridge)

1. Aplicar migraciones hasta la 030 (ver MIGRATION_READINESS_SUMMARY.md).
2. Setear las env vars de arriba en `.env.local`.
3. `npm run check:supabase` → sin FAIL.
4. `npm run probe:supabase` → sin tablas MISSING.
5. Con el dev server corriendo: `npm run seed:vault-bridge-demo` (solo localhost; targets remotos requieren FORCE=true; todo marcado [DEMO], sin contactos).
6. Abrir `/admin/vault-report-bridge` → Preview y Dry-run.
7. Validación automática del payload: `npm run test:vault-bridge`.

## Actualización 2026-07-11 — AI readiness

`check:supabase` ahora chequea ANTHROPIC_API_KEY. Presencia ≠ créditos:
`ALLOW_AI_HEALTH_PROBE=true npm run check:supabase` hace un probe de 1 token y
reporta el estado real de billing. Cuidado con NEXT_PUBLIC_APP_URL: debe ser la
URL exacta (el trigger interno la usa para invocar el processor).
