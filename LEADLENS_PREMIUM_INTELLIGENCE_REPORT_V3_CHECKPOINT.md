# Premium Intelligence Report V3 — Checkpoint

## Commits
- inicial de sprint: 98d2453 · Bloque 1: ver `git log -1`. Tree limpio, tsc limpio.

## Bloque 1 — DONE (Premium Intelligence Contract)
- `lib/reports/premium-intelligence-contract.ts`: contrato tipado reutilizable
  (ReportMetadata, ExecutiveDecisionBrief, MarketLandscapeIntel, BuyerSegmentIntel,
  CompanyUniverseAccount, StructuralAccountAssessment con 6 dimensiones SEPARADAS,
  AccountRecommendation act_now/investigate_now/prioritize/monitor/low_priority/exclude,
  DeepAccountDossier, PortfolioStrategy, EvidenceQualitySummary, Methodology,
  PremiumIntelligenceReport + delivery). `assemblePremiumReport(input)` adapta el
  artefacto actual (landscape+ranked+candidates+manifest+shortlist) al contrato;
  traduce técnico→comercial; `toRecommendation` garantiza que channel-only NUNCA
  sea act_now. Sin hardcoding de cliente en los tipos. `test:premium-report-contract`
  (23) + en release:check. Sin trabajo visual (por diseño del bloque).

## Providers (recordar antes de correr): brave OK, tavily OK, serper agotado, firecrawl OK, anthropic OK.

## Bloque 2 — DONE (Market-to-Account integrado al harness)
- `lib/discovery/market-to-account-pipeline.ts`: `runStagedPipeline(input, executors)` — secuencia explícita segments→queries_by_segment→discover+verify→classify+rank→shortlist(diversa)→deep research SOLO shortlist→métricas+reason codes. Ejecutores inyectables (live en harness, stub en tests) → determinista/replayable. StagedRunArtifact expone: segments, queries_by_segment, discovered/verified/classified, structural_ranking, shortlist, deep_research_status, signal_coverage, evidence_coverage, cost_by_stage, duration_by_stage, reason_codes (included/excluded/shortlisted/not_shortlisted/deep_research_complete/incomplete/no_current_timing/insufficient_evidence).
- market-to-account.ts: +deriveBuyerSegments (etapa 1), +buildSegmentQueries (etapa 2, UNIVERSE queries por segmento, no eventos).
- run-amor-de-gea-pilot.ts: cablea el pipeline sobre el universo YA descubierto (sin nueva corrida live) → escribe staged-pipeline.json + market_to_account_stages en el manifest. Deep research NO se corre aquí (Bloque 5) → deep_research_incomplete honesto.
- Verificado por replay determinista sobre el artefacto real: 7 segmentos, 15 verificadas, shortlist diversa (Tu Tienda Saludable/BioPlaza/Fitt Global/GHL/Movich), deep 5 incomplete.
- Tests: test:market-to-account-pipeline (22) + en release:check. channel-only nunca act_now; scores separados; replay determinista.

## Bloque 3 — DONE (con verdict honesto: insufficient_verified_universe)
- `lib/discovery/segment-universe.ts` (NUEVO): ejecutor live discover+verify por segmento consumido por el harness detrás de `AMOR_EXPAND_UNIVERSE=true`. Flujo: segment queries (Brave+Tavily, region co) → extractCompanyName → canonicalDomain → dedupe (domain, luego normalized name) → classifyBuyerSegment → statusFor → status verified/probable/unresolved/excluded. Budget: costCeilingUsd con aborted_on_budget; artefacto parcial preservado.
- **Endurecimiento de verificación (clave):** `verified` = marca corta ↔ dominio (looksLikeCompanyName + host propio). Se AGREGARON: `NON_COMPANY_HOST` (diccionarios/traductores/medios/prensa/OTA-globales/cadenas-hoteleras-globales/PEO → excluded, `identity_conflict`) y `looksLikeCompanyName` (rechaza titulares/artículos/listas/preguntas/traducciones/títulos truncados → como mucho `probable`, nunca `verified`). Sin esto, títulos de página («¿Dónde nos encuentras?», «Tres restaurantes… para comer en Bogotá», «grupo in English») entraban como verified.
- **Corrida live controlada (1 real + 1 de corrección tras el endurecimiento):** dir `ml/data/pilot-amor-de-gea/2026-07-27T01-35-36-464Z/`. Providers: Brave+Tavily verdes (search-only, sin LLM en expansión). Costo expansión **$0.042**, aborted=false. Funnel: **252 raw → 164 deduped → 21 verified / 29 probable / 0 unresolved / 114 excluded**. Universo mergeado 15→**64**.
- **Distribución por segmento (kept 50):** retail 15, wellness 12, amenities 8, distribution 4, hospitality 4, food_service 4, corporate 3 → **7 segmentos**. Verified defendibles: Fithub, Mercado Vital, Zonazul, Merkabah, Fit Market, Vitafitness, Natural Stores, Molinatural, Natural+Mente, Distribuidora DAM, Profunsa, Be Vital, COTELCO, Hotel Spa La Colina, sein wellness room, Human Wellness Center, La Tienda del Café, Café 18, Somos Consiente, Amenicol, Helios Group.
- **Verdict honesto: `insufficient_verified_universe` / `requires_validation_before_deep_research`.** 21 verified < target 40-60. NO se infló el conteo (se prefirió 21 defendibles a 82 con ruido). Los 29 probable son empresas reales con título tipo-titular → cola de validación, NO customer-ready.
- **Gap de cobertura + causa raíz:** la extracción por TÍTULOS de resultado es intrínsecamente ruidosa (los títulos son etiquetas de página/artículos, no identidades). El siguiente salto de calidad requiere **extracción de nombres vía LLM** (reusar `extractCompanyNames`/entity-resolution-v3 de `company-first-discovery.ts`) + una query de resolución de dominio oficial por candidato, en vez de parsear títulos con regex. Eso es lo que llevaría verified de ~21 a 40-60 con identidades defendibles.
- Tests: `test:segment-universe` **21 passed** (extract, dedupe domain/name, directorio/social/marketplace rechazados, marca-real→verified, host-medios/dictionary/global-chain→excluido, título-artículo≠verified, budget-abort, replay determinista). tsc limpio.
- **PENDIENTE de este bloque (no ejecutado por corte de budget):** verificación en navegador de `/admin/pilot` + `/admin/pilot/artifact` mostrando el nuevo artefacto (no el de 15), y screenshots (Parte 13). El artefacto YA se escribe con `segment_universe` en el manifest; el Admin artifact route lo lee. Reanudar aquí antes de Bloque 4.

## Bloques PENDIENTES (4-10) — no iniciados
3b. **Salto de calidad del universo (si se quiere 40-60):** rutear segment queries por extracción LLM de nombres + resolución de dominio oficial por candidato (ver causa raíz arriba). Opcional antes de Bloque 4.
4. **Ranking mejorado**: 6 dimensiones con inputs transparentes + reglas explícitas de recomendación + tests (high-fit/low-timing, low-fit/recent, etc.).
4. **Ranking mejorado**: 6 dimensiones con inputs transparentes + reglas explícitas de recomendación + tests (high-fit/low-timing, low-fit/recent, etc.).
5. **Deep account research** (second-pass, 8-12 cuentas): identidad/estructura/buying-path/desarrollos/tesis/evidencia hecho-vs-inferencia; dossier gate.
6. **Customer Report V3** (separado de Admin diagnostics): renderizar el contrato en una vista customer (`/results` o nueva ruta) — NO usar el layout actual como baseline.
7. **Gráficos premium**: Market Opportunity Map, Segment Attractiveness Matrix, Market Funnel, Fit-vs-Timing, Opportunity Portfolio, Evidence/Freshness, Account Comparison Table. SVG, print-safe, 0/1/N.
8. **Commercial Strategy layer**: secuencia de segmentos/cuentas, oferta por segmento, plan 30 días, learning agenda.
9. QA + honesty gates + release:check.
10. Deliverables + screenshots + readiness.

## Próximo prompt exacto
"Continúa el sprint Premium V3 desde LEADLENS_PREMIUM_INTELLIGENCE_REPORT_V3_CHECKPOINT.md. Bloque 2: integra Market-to-Account dentro del harness (scripts/sources/run-amor-de-gea-pilot.ts + lib/discovery/company-first-discovery.ts) — segmentos→queries por segmento→universo→ranking→shortlist→deep research SOLO sobre shortlist, con métricas y reason-codes por etapa en el artefacto. Preserva channel_fit_not_buying_intent y los gates de ranking. Luego Bloque 3 (expandir universo a 40-60). No reabrir decisiones protegidas."
