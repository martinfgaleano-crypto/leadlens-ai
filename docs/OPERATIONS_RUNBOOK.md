# LeadLens — Operations Runbook (2026-07-21)

## Estado de proveedores y consola
- **Consola:** `/admin/operations/providers` (link "Provider Health" en nav admin). API: `GET/POST /api/admin/operations/providers` (requireAdmin; probes cacheados 5 min; forzado máx 1/min; test individual con audit log).
- Datos SIEMPRE etiquetados: `confirmed_by_provider` / `observed_by_leadlens` / `estimated` / `unavailable`. Créditos jamás inventados.
- Ledger de uso: `.leadlens/usage.json` (observado; efímero en serverless).

### Estado medido 2026-07-21 (confirmed_by_provider)
| Proveedor | Estado | Detalle |
|---|---|---|
| Anthropic | **exhausted** | reset 2026-08-01 00:00 UTC |
| Brave | **exhausted** | 402 — plan sin crédito |
| Serper | **exhausted** | "Not enough credits" |
| Tavily | **exhausted** | 432 — límite del plan |
| Firecrawl | ok | **897 créditos** (endpoint real, sin costo) |
| Supabase | ok | auth health 200 |
| Lemon Squeezy | missing | intencional (pagos inactivos) |

## Modos degradados (honestos, fail-closed)
- **Anthropic caído:** needs-map y universo caen a **vertical packs** (`lib/discovery/vertical-packs.ts`): mapa causal + seed universe de empresas colombianas reales por vertical. Detección EN RUNTIME (`llm_ok` — la key puede existir y fallar). `stats.degraded_seed_pack` lo expone. Reportes E2E (7 agentes) NO corren sin Claude — no hay fake success.
- **Brave caído:** Serper+Tavily en paralelo (ya activo).
- **Tavily caído:** se pierde la mejor fuente de prensa CO — recall baja fuerte; Firecrawl cubre extracción.
- **Serper caído:** Brave+Tavily.
- **Supabase caído:** plataforma no opera (crítico sin fallback — alerta roja).

## Discovery pipeline (company-first-v1 + intelligence layer)
Flujo: needs-map → universe (stoplist `AMBIGUOUS_NAME`; seeds pack en degradado) → búsqueda 3 providers → prefilter junk/TLD extranjero → extracción ordenada por (evento-en-título, **source utility**) → Opportunity Test fail-closed → identidad (3 providers) → homonym guard (trace con conf) → entity-role → sentiment → materialidad → commercial/operational fit (hard blockers) → corroboración → rubric v2 → counterevidence (ajusta, nunca rescata) → adversarial review independiente (reject → no se emite) → emisión.
- Trace: `metrics.deep_trace` (cada señal que llega a validación profunda, con outcome exacto).
- Source intelligence: `.leadlens/source-intelligence.json` acumula DomainStats entre corridas (priors decaídos ÷2 al cargar).
- Benchmark: `npm run bench:company-first` → `ml/data/company-first/benchmark-*.json`.

## Tests (suites clave)
`test:intelligence-v2` (28) · `test:intelligence-v3` (37) · `test:deep-validation` (26) · `test:company-first` (22) · `test:date-es` (11) · `test:counterevidence` (27) · `test:provider-health` (10) → **161**.

## Failure modes conocidos
- Push a GitHub bloqueado en esta máquina (keychain): commits quedan locales; `git push` manual.
- `npm run build` con dev server corriendo corrompe webpack → nunca simultáneos.
- esbuild/tsx transient al correr scripts ad-hoc concurrentes: usar harnesses commiteados.
- Providers de búsqueda se agotan con ~2-3 benchmarks completos/día en planes actuales: presupuestar antes de correr (la consola muestra el estado antes de gastar).

## Replicabilidad (audit honesto 0-10, copiable en…)
- Idea/branding/UI: 2-3/10 — copiable en 1 semana.
- Pipeline determinístico (gates): 5/10 — copiable en ~1 mes por un equipo serio leyendo el producto; el CÓDIGO no es el moat.
- **Vertical packs + taxonomía de errores + source intelligence acumulada: 7/10** — requiere meses de corridas reales y errores pagados (Inter/Nu-bank, fechas ES, TLDs, homónimos CO).
- **Outcome data + calibración humana + Account Memory por cliente: 8/10** — depende de clientes reales y tiempo; ESTE es el moat central a cultivar.
- Conclusión: el moat no es el código sino el LOOP: corridas → errores → gates ajustados → packs → source utility → outcomes → mejor ranking con menor costo.

## Próximo piloto real (cuando recarguen créditos)
1. Ver consola de providers (todo verde).
2. `npm run bench:company-first` (3 ICPs) → revisar deep_trace + emitidas manualmente.
3. Pilot Console → Preview real → QA ≤10 min → Brief mismo ICP.
4. Segunda corrida del mismo ICP (consistencia).
5. Registrar outcomes en opportunity_feedback (investigated/contacted/…).
