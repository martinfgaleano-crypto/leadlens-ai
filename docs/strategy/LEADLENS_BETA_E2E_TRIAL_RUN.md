# LeadLens Beta E2E Trial Run — Runbook

**Propósito:** validar la cadena completa como si entregáramos al primer cliente beta
real, y producir un veredicto de launch readiness. Ejecutado 2026-07-13.

## Pre-flight (todo automatizable menos 2 ítems)

```
npm run test:beta-e2e-readiness        # 16 checks deterministas, sin AI pago
npm run probe:supabase                 # 17/17 tablas
ALLOW_AI_HEALTH_PROBE=true npm run check:supabase   # estado REAL de créditos
```

**Ítems manuales obligatorios:**
1. **Créditos de Anthropic activos** (console.anthropic.com → Plans & Billing). El probe lo verifica.
2. **NEXT_PUBLIC_APP_URL en Vercel** = exactamente `https://leadlens-ai-xi.vercel.app` — sin `=` ni espacios colgando (un typo así rompió los triggers en local).

## Flujo de la entrega beta (validado)

1. **Cliente:** signup/login normal → `lead_searches` con su user_id. Para pruebas:
   el trial creó `demo-beta-e2e@example.com` con monitor `[DEMO BETA E2E]` vía auth real.
2. **search_id:** /admin/searches → copiar el id del monitor del cliente.
3. **Seed Vault** (si hace falta): `npm run seed:vault-bridge-demo`.
4. **Preview:** /admin/vault-report-bridge → ICP + customer email + search_id →
   selección con match reasons, rights permitted, provenance; exclusiones contadas.
5. **Queue:** "Queue Vault report generation (N)" → 202 → pill **workspace** en runs list.
6. **Workspace:** el cliente ve el reporte en dashboard (latest card), lista de
   monitores y monitor detail; notificación "Your report is ready" al completar.
7. **Feedback:** en el reporte completado → se guarda con job_id + search_id + user_id.
8. **Fallos:** cliente ve copy genérico; admin ve el error real + Retry/Release.

## Resultado del trial (2026-07-13)

| Paso | Resultado |
|---|---|
| Customer auth real + monitor | ✅ creado vía signup path (JWT por password) |
| Workspace delivery (overview/runs por user_id) | ✅ reporte visible solo para su dueño |
| Aislamiento cross-user | ✅ 401 sin JWT; scoping por user_id |
| Reporte completed customer-safe | ✅ sin vault ids/reservas/criterios |
| Bridge preview escenario beta | ✅ 4 cuentas, razones útiles, rights permitted |
| Feedback E2E | ✅ job+search+user linkeados (fix aplicado) |
| Dedupe de cuentas en selección | ✅ (fix aplicado — antes una company podía repetirse) |
| Generación AI real | ⛔ BLOQUEADA: créditos Anthropic agotados (verificado por probe) |

## Pass/fail para la primera entrega real

PASS si: probe 17/17 · AI probe sin FAIL · preview > 0 con rights permitted ·
202 con pill workspace · reporte aparece en el workspace del cliente · feedback guarda.
FAIL/no entregar si: cualquier FAIL del readiness script, créditos agotados, o pill link-only inesperado.

## Veredicto

**CODE-READY / OPS-BLOCKED.** Todo el circuito está validado de punta a punta excepto
la generación AI, bloqueada exclusivamente por billing. Al recargar créditos: correr
pasos 4–7 con un monitor real y entregar.
