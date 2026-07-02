# Self-Serve SaaS Architecture v0

**Documento vivo** — mapa del flujo self-serve. Actualizar cuando una pieza cambie de clasificación.

Clasificación: `implemented` · `partial` · `admin-only` · `self-serve` · `future`

| Pieza | Dónde | Clasificación | Notas |
|---|---|---|---|
| Signup/Login | Supabase auth + `/login` | implemented, self-serve | Onboarding público también crea usuarios |
| Onboarding público | `/api/onboarding/submit` | implemented, self-serve | Crea profile + ICP + lead_search + onboarding_request con `search_id` — el único path que deja un monitor completo |
| Creación de search desde dashboard | `/dashboard/searches` (form) | partial, self-serve | **Crea lead_search SIN onboarding_request** → sirve para Apollo flow pero NO puede correr como monitor AI (falta business context). Warning en UI; linking posterior = future |
| ICP builder | `/dashboard/icp` | implemented, self-serve | |
| Monitor series | `lead_searches.id` + `snapshot_reports.search_id` | implemented | Scope seguro desde migration 027 |
| Monitor run (admin) | `POST /api/admin/searches/[id]/rerun` | implemented, admin-only | Dedup + baseline + 422 sin onboarding |
| Monitor run (customer) | `POST /api/monitor/[id]/run` | **este sprint**, self-serve | Ownership + onboarding + dedup + entitlement |
| Report access | `GET /api/report` | implemented, self-serve | Ownership via snapshot.search_id; legacy admin-only; ver REPORT_ACCESS_MODEL.md |
| `search_id` en report payload | `LeadLensReport.search_id` | **este sprint** | Contexto para feedback/debugging/billing futuro |
| Feedback | `POST /api/feedback/opportunity` | implemented, self-serve | Dedup por job+company+signal; search context este sprint |
| Account Memory / Vault | pipeline (best-effort) | implemented | No demo; feedback `exclude_similar` → do_not_show |
| Readiness status | `lib/monitor/readiness.ts` | implemented | Admin banner + customer-safe copy |
| Lifecycle states | `lib/monitor/lifecycle.ts` | **este sprint** | Estado único por serie para customer/admin |
| Entitlements / usage | `lib/usage/entitlements.ts` | **este sprint**, partial | Gate honesto: plan no-free O credit_balance > 0. Sin deducción por run (future billing) |
| Credits | `plans`, `customer_credits`, `credit_transactions` | implemented | Consumidos por Apollo lead flow; monitor runs no consumen aún |
| Admin QA | runs endpoint qa_flags + banners | implemented, admin-only | |
| Billing (Stripe/Lemon) | — | future | Lemon Squeezy webhook existe para orders; sin suscripciones/entitlement automático |
| Scheduler mensual | — | future | Sin cron. Cadencia manual; copy honesto en UI |
| Public report sharing | — | future (decidido: no todavía) | |

## Flujo self-serve objetivo (post-sprint)

```
Signup/Onboarding → lead_search + onboarding_request (setup completo)
   → [customer] Run monitor (entitlement + dedup + ownership)
      → snapshot processing → completed (search_id scoped)
         → Report ready (ownership-checked) → Feedback (search context)
            → Account Memory / Vault → siguiente run = comparación real
```

Pasos que siguen siendo manuales/asistidos: cadencia mensual (sin scheduler), QA interno pre-entrega (checklist + banners), linking de onboarding a searches creadas por dashboard, billing/upgrades.
