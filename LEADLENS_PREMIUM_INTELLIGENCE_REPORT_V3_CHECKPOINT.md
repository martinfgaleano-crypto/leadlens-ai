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

## Bloques PENDIENTES (3-10) — no iniciados
2. **Integrar Market-to-Account en el harness** (hoy es post-hoc): segmentos→queries por segmento→universo→verificación→ranking→shortlist→deep research; métricas y reason-codes por etapa en el artefacto. NO exigir señal reciente para entrar al universo.
3. **Expandir universo Amor de Gea** 15→40-60 verificadas, ≥5 segmentos, query families por segmento (retail/premium/hospitality/spa/food-service/distribución/corporate/gifting/amenities); honestidad sobre gaps.
4. **Ranking mejorado**: 6 dimensiones con inputs transparentes + reglas explícitas de recomendación + tests (high-fit/low-timing, low-fit/recent, etc.).
5. **Deep account research** (second-pass, 8-12 cuentas): identidad/estructura/buying-path/desarrollos/tesis/evidencia hecho-vs-inferencia; dossier gate.
6. **Customer Report V3** (separado de Admin diagnostics): renderizar el contrato en una vista customer (`/results` o nueva ruta) — NO usar el layout actual como baseline.
7. **Gráficos premium**: Market Opportunity Map, Segment Attractiveness Matrix, Market Funnel, Fit-vs-Timing, Opportunity Portfolio, Evidence/Freshness, Account Comparison Table. SVG, print-safe, 0/1/N.
8. **Commercial Strategy layer**: secuencia de segmentos/cuentas, oferta por segmento, plan 30 días, learning agenda.
9. QA + honesty gates + release:check.
10. Deliverables + screenshots + readiness.

## Próximo prompt exacto
"Continúa el sprint Premium V3 desde LEADLENS_PREMIUM_INTELLIGENCE_REPORT_V3_CHECKPOINT.md. Bloque 2: integra Market-to-Account dentro del harness (scripts/sources/run-amor-de-gea-pilot.ts + lib/discovery/company-first-discovery.ts) — segmentos→queries por segmento→universo→ranking→shortlist→deep research SOLO sobre shortlist, con métricas y reason-codes por etapa en el artefacto. Preserva channel_fit_not_buying_intent y los gates de ranking. Luego Bloque 3 (expandir universo a 40-60). No reabrir decisiones protegidas."
