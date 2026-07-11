# Migration Readiness Summary

**Generado 2026-07-11.** Estado de migraciones locales vs. lo que el producto espera.
Verificación en vivo: `npm run probe:supabase` (dice exactamente qué tabla falta y qué migración la crea).

## Migraciones en el repo (orden obligatorio: numérico, 001 → 030)

001–028 son la base histórica (SaaS foundation, auth, ICP/searches, resultados,
créditos, onboarding, delivery, feedback, snapshot reports 024/027, índice 028).
Las dos críticas para la cadena nueva:

| Migración | Crea | Depende de ella |
|---|---|---|
| **029_vault_foundation.sql** | vault_companies, vault_contacts, vault_sources, vault_signals, vault_usage_history, vault_reservations, vault_suppression_list | Vault Foundation UI, Lead Hunter promotion, **Vault Report Bridge completo** |
| **030_lead_hunter.sql** | lead_hunter_briefs, lead_hunter_runs, lead_hunter_candidates, lead_hunter_source_inputs | Lead Hunter admin flow, seed:vault-bridge-demo |

Nota de nombres: 008_vault_foundation (legacy, crea `vault_leads`) y 011_lead_hunter
(legacy, crea el source engine `lead_sources`/`source_runs`/`lead_source_matches`)
NO colisionan con 029/030 — tablas distintas, ambas familias conviven.

## Qué área del producto depende de qué

- **Results/monitor runs** → snapshot_reports (024 + 027) y onboarding_requests (016/018/028).
- **Vault Foundation admin + Bridge selection/exclusiones** → todas las tablas de 029.
- **Lead Hunter completo** → 030 (y 029 para promover).
- **Vault Bridge preview/dry-run** → solo lee 029; sin datos muestra el estado "not enough approved Vault opportunities yet" sin romper nada.

## Cómo aplicar manualmente (si falta)

1. Supabase Dashboard → SQL Editor.
2. Pegar y ejecutar **en orden numérico** cada archivo faltante de `supabase/migrations/`
   (todas usan `IF NOT EXISTS` — re-ejecutar una ya aplicada es inofensivo).
3. Para la cadena nueva basta: `029_vault_foundation.sql` y luego `030_lead_hunter.sql`.
4. Confirmar: `npm run probe:supabase` → todo ✅.
