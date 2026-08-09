# LeadLens Discovery V2.5 — Colombia Retail LIVE

## 1. Audit and preservation

- Initial HEAD: `76f40479756ba4556c1daf1a958cedd66967ee1f`.
- Branch began synchronized with `origin/main`; only pre-existing runtime files under `.leadlens/` were dirty.
- Hospitality, Manufacturing, Retail controlled, Pilot 1 and Pilot 2 were not modified.
- Controlled benchmark remains `discovery-v2-colombia-retail-controlled-001`; this report concerns only `discovery-v2-colombia-retail-live-001`.
- Production Provider Health was current and operational for Brave, Tavily, Firecrawl and Exa before execution. SAM, SEC and Serper were not called.

## 2. Execution contract

- Country: Colombia.
- Cluster: Retail.
- Business models: retailer, specialty retailer, multi-brand retailer, ecommerce store and chain operator.
- Route/mechanism: `retail_listing` / `product_listing`.
- Commercial neutrality: no Amor de Gea criteria or scoring.
- Hard maximum: 25 provider calls. Actual: 12 (Brave 5, Tavily 5, Exa 2); within budget.
- Data basis: `live_provider`; 72 raw results, 55 unique observed results.
- Costs: provider responses did not expose an actual or estimated dollar cost; both remain unknown rather than guessed.
- Stop reason: planned base queries and bounded Exa escalation completed.

## 3. Why Exa was escalated

The first ten Brave/Tavily calls returned 60 rows. A manual audit exposed false acceptance of articles/directories and incorrect `.com.co` root-domain handling. The classifier was corrected and the preserved evidence was reprocessed with zero new calls. Corrected coverage remained weak enough to justify semantic escalation, so exactly two Exa calls were executed. Exa added 10 unique canonical retail-compatible domains not observed in the base cohort. This is measured incremental discovery, not proof of evidence sufficiency or commercial fit.

## 4. Live funnels

| Cohort | Raw | Unique | Canonical domains | Retail-compatible | Evidence sufficient |
|---|---:|---:|---:|---:|---:|
| Specialized / structured-first | 24 | 17 | 6 | 2 | 1 |
| Search-first | 24 | 18 | 7 | 10 | 3 |
| Hybrid | 12 | 9 | 9 | 3 | 2 |
| Exa escalation | 12 | 11 | 11 | 10 | 2 |

Overall: 33 canonical domains, 25 heuristic retail-compatible results, 8 with observed assortment evidence and structurally plausible product listing. The broad observed retailer precision is 45.5%; digital resolution is 60%; assortment-evidence yield among compatible results is 32%. No buying intent was inferred.

## 5. Classification and contamination

Unique observed composition: 18 retailers, 7 chains, 12 articles, 5 directories and 13 other. Marketplace contamination measured 0% in this bounded sample; this does not prove the market is free of marketplace contamination. Distributors, articles, directories and generic ecosystem pages are kept as rejected/borderline evidence, not silently deleted.

The strongest directly resolved retail examples in the founder-review packet include Dafiti Colombia, LaPercha, Casa Precis, El Duque Boutique, Somos Moda, GEF, Rustiko and Librería Lerner. Results such as mall tenant surfaces and regional-chain articles remain borderline or rejected; they are not presented as qualified customer accounts.

## 6. Chain, location and identity behavior

- Location Inflation Ratio: 1.15 after corrected canonical-domain resolution.
- Colombian public suffixes such as `.com.co` are now resolved at the registrable-domain level.
- Multiple URLs for one chain/domain do not become separate commercial accounts.
- A mall, directory or article mentioning stores is not automatically a retailer.
- Location and chain evidence remains separate from buying decision scope; procurement centralization is never inferred.

## 7. Assortment and commercial meaning

Assortment evidence is accepted only when the live result provides an official-domain catalog/category/brand/product signal. It supports `structurally_plausible` product listing, not current purchase intent. The artifact permanently records `buying_intent: not_inferred` and the aggregate inferred-intent count is zero.

## 8. Observed bias and diversity

Geography in the unique sample: 46 Colombia/unknown, Bogotá 4, Cali 2, Medellín 1, Barranquilla 1 and Bucaramanga 1. This shows weak regional observability, not national population distribution. The base specialized cohort was association/directory-heavy and low-yield. Search contributed more long-tail surfaces but substantial editorial contamination. Exa improved company-domain discovery materially but still requires downstream assortment validation.

## 9. Saturation and complementarity

Observed checkpoints were 10→0, 20→1, 30→4 and 50→12 useful unique accounts. No unobserved curve is fabricated. Specialized sources supplied authority/ecosystem context; Brave and Tavily supplied breadth; hybrid queries improved official-domain/evidence resolution; Exa supplied the strongest incremental company discovery (10 accounts). No provider is declared globally superior from this one sample.

## 10. Provider economics and latency

Average measured latency: Brave 618 ms, Tavily 205 ms, Exa 774 ms. Provider-reported cost was `null`, therefore cost per verified/evidence-sufficient account is unavailable. The provider ledger recorded every real call; no secrets are stored in the artifact.

## 11. Source learning

- Fenalco is authoritative but the tested public search surface was duplicate-heavy and low-density; recommended role: ecosystem/context and targeted validation, not sole primary discovery.
- Mall directories can expose tenant ecosystems but require strict account extraction; recommended role: coverage source.
- General search remains necessary for independent and regional retailers, with article/directory rejection.
- Hybrid official-domain queries improve digital and assortment validation.
- Exa is justified as a coverage-gap escalation, not default first-line routing.
- Highest remaining gaps: regional/SME retail coverage, marketplace seller classification with a real observed sample, assortment evidence, and chain-to-decision-scope resolution.

All recommendations remain human-approval-required and context-specific.

## 12. Persistence and Observatory

- Live artifact: `artifacts/discovery/discovery-v2-colombia-retail-live-001.json` and mirrored execution output.
- Append-compatible `SourcePerformanceSnapshot` records exist per source/cohort, with commercial outcome fields explicitly `awaiting_real_outcomes`.
- Admin Discovery Observatory now shows controlled and LIVE Retail separately, including calls, funnel headline, digital/assortment quality, Exa contribution and observed saturation.
- Colombia live benchmark depth moves from 2 to 3; coverage remains partial rather than complete.

## 13. Cross-vertical learning

Hospitality benefited from a dense authoritative association surface and comparatively direct property identity. Manufacturing required legal/brand/group resolution and manufacturer-versus-distributor evidence. Retail is more search-dependent, has stronger editorial/directory contamination, location/chain inflation and assortment-validation requirements. The shared architecture broadly generalizes, while entity-type classifiers and evidence gates remain vertical-specific overlays.

## 14. USA Manufacturing Benchmark 1 — prepared, not executed

- Proposed ID: `discovery-v2-usa-manufacturing-live-001`.
- Context: USA, manufacturing/industrial, manufacturer, procurement, supplier addition; commercially neutral.
- Candidate specialized sources: Manufacturing Extension Partnership centers, state manufacturing associations, Thomas-style industrial directories where public/allowed, exhibitor/member directories and official company sites.
- Contextual providers only: SAM for explicit federal procurement/vendor context; SEC only for applicable public-company evidence; neither belongs in generic USA base routing. Exa remains escalation-only.
- Entity concerns: legal entity/brand/group/facility, manufacturer/distributor/importer separation, state fragmentation and plant-versus-account scope.
- Proposed cap: 25 calls and 30–60 raw candidates, with source-first/search/hybrid comparison.
- Prerequisites: founder approval, explicit budget, provider gate, source accessibility validation and no people data.
- Status: `prepared_not_executed`; no provider call, benchmark artifact or account research was performed.

## 15. Validation, migration and next step

No database migration is needed. Focused Retail V2.5 tests passed 10/10; V2.4.1 recovery passed 34/34; V2.4 multi-country passed 48/48; provider integrations passed 25/25; TypeScript passed. Two clean production-build attempts remained indefinitely at Next.js `Creating an optimized production build` without an emitted compiler error and were stopped after controlled waits; build status is therefore `environment_process_blocked`, not passed. Recommended next sprint: diagnose the build worker separately, then improve evidence-grade retail account validation and regional/SME source overlays from the preserved 33-domain universe before executing Colombia Technology; USA Manufacturing remains prepared only.
