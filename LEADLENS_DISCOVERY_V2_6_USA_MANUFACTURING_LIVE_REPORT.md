# LeadLens Discovery V2.6 — USA Manufacturing LIVE

## 1–9. State, context and execution

- Initial HEAD and `origin/main`: `3f7ca7bb7381936beb0135192ac83ae8a81675b2`.
- Production was current: V2.5 Retail LIVE was visible in `/admin/intelligence/discovery` and its artifact hash remained unchanged.
- Provider Health before execution: Brave, Tavily, Exa, Firecrawl, SEC and Anthropic operational; Serper exhausted/non-blocking; SAM HTTP 404/non-blocking.
- Benchmark: `discovery-v2-usa-manufacturing-live-001` — United States → manufacturing → manufacturer → procurement → supplier addition; commercially neutral.
- Hard budget: 28 total. First run: 14 calls executed but results not persisted (Brave 5, Tavily 5, Exa 4). Recovery: 9 persisted calls (Brave 2, Tavily 2, Exa 1, Firecrawl 4). Total counted: 23/28.
- SAM and SEC calls: 0. No hidden Provider Health probes.
- Executed source layers: specialized association/directory discovery, regional/general search, Exa semantic escalation and targeted Firecrawl evidence queries.
- Data basis: live provider responses. No people/contact data and no buying-intent inference.

## 10–24. Funnel, entities, geography and plausibility

- Persisted raw candidates: 52; unique observed results: 34; canonical domains/accounts: 26.
- Manufacturer-compatible accounts: 14; manufacturer precision among canonical evaluated accounts: 53.8%.
- Rejected contamination included associations, directories, publications and distributor/supplier-only results. Multi-model manufacturer/distributor status is preserved where supported.
- Subindustry composition is overlapping: packaging/plastics 15, medical/health 11, machinery/equipment 9, metalworking 5, electronics/electrical 4, food/beverage 2, chemicals/cosmetics 2, textiles/apparel 1 and other 4. Counts are sample labels, not market shares.
- Nine states were observed in text: OH 3; WA and TX 2 each; MI, IN, CA, CT, IL and FL 1 each. Unknown-state accounts remain unresolved. Largest observed state concentration: Ohio, but geography is sparse and digitally biased.
- Official-domain and digital-resolution yield: 76.5% of unique observed results.
- Corporate resolution used registrable domains conservatively; repeated pages/facilities collapsed. Legal entity, parent/group and independent facility purchasing authority were not inferred without evidence.
- CommercialDecisionScope defaults to corporate for resolved official domains and unknown otherwise.
- Structural procurement plausibility: 14 manufacturer-compatible accounts. Buying intent inferred: 0.
- Evidence yield is 100% among automated manufacturer-compatible rows because a supporting provider snippet/domain signal exists; this is usable benchmark evidence, not a claim that all 14 have deep first-party procurement verification.

## 25–39. Saturation, bias, Exa, SEC/SAM and economics

- Saturation checkpoints: 10→0, 20→1, 30→4, 40→14 and 50→14 manufacturer-compatible canonical accounts. Returns diminished after 40 processed rows.
- Specialized-first: 16 raw, 12 unique, 6 canonical, 0 manufacturer-compatible after strict association/directory rejection.
- Search-first: 16 raw, 14 unique, 12 canonical, 6 manufacturer-compatible.
- Exa: 1 recovery call, 8 raw, 8 canonical manufacturers, 8 incremental qualified and overlap 0 with the persisted base stack.
- Firecrawl: 4 targeted calls; they added validation pages but no novel canonical account because domain duplicates were correctly collapsed.
- Exa official-domain yield: 100%; observed evidence yield: 100%. Observed Exa cost: $0.007; cost per incremental qualified account: $0.000875. Lost-run cost remains unknown and is not excluded from reliability/economic interpretation.
- Exa classification: `high_incremental_value` for this USA Manufacturing cell only. It remains escalation, not an always-on provider.
- SEC: 0 calls; no reliable CIK/public-company trigger was required for benchmark completion. Dow appeared in search, but the benchmark did not spend a filing call merely because a public company was present.
- SAM: 0 calls; endpoint remained operationally 404 and the neutral supplier-addition route did not require federal-contractor evidence.
- Observed sample biases: digitally visible companies, packaging/plastics and medical manufacturing, selected regional queries and semantic-search visibility. Public-company, government-contractor, exporter and size shares were not measured rather than guessed.
- Novelty is benchmark-safe: root-domain duplicates and Firecrawl repeats do not inflate qualified yield. Account Memory commercial history was not inferred from this neutral benchmark.

## 40–47. Review, memory, comparison and Observatory

- Founder-review packet persisted: 10 accepted, 1 borderline and 10 rejected/unresolved, with original automated decisions preserved.
- Source Memory: append-compatible live snapshots exist for every executed source layer; outcome fields remain `awaiting_real_outcomes`; confidence ceiling is `benchmarked`.
- USA Market Memory now records fragmented state identity, poor account yield from the tested public specialized surfaces, useful general search, 8 incremental Exa manufacturers, SAM limitation and SEC non-use.
- Source Type Learning: semantic company search now has evidence from Colombia Retail and USA Manufacturing, but remains context-specific. Association performance diverged materially by market/vertical.
- Colombia Manufacturing vs USA Manufacturing: CO precision 73.3% vs USA 53.8%; CO digital resolution 23.3% vs USA 76.5%. Colombia benefited from authoritative exporter/association samples but had exporter/formal-member bias; USA had fragmented identity, more editorial/directory contamination and stronger semantic-search contribution.
- Generalization status: `architecture_generalizes_with_vertical_adapters`. Shared country→industry→model→route→source→provider→entity→evidence architecture worked; country-specific identity and classifier/source overlays remain necessary.
- Observatory: existing `/admin/intelligence/discovery` now contains a USA Manufacturing LIVE section with recovery economics, funnels, states, Exa contribution, contextual SEC/SAM status and Colombia comparison.
- Colombia Retail queue was updated without calls for regional/SME sources, official assortment evidence and editorial/directory rejection.

## 48–56. Validation, reliability and closeout

- Persistence incident: the original 14 calls are recorded as `executed_but_results_not_persisted`; their results were never fabricated.
- Recovery mechanism: atomic checkpoint after every call, normalized results, query/source/provider/timestamp, call number, partial funnel, provenance and ledger-backed call. Resume, duplicate protection, lost-call budget accounting and interruption-safe artifact were tested locally.
- Persisted recovery records: 9 calls and 52 raw results. Partial state: `artifacts/discovery/discovery-v2-usa-manufacturing-live-001.partial.json`.
- Remaining budget: 5 calls unused. Benchmark conclusion is defensible without consuming them.
- Validation closed green: 48 V2.4 multi-country checks, 34 V2.4.1 recovery checks, 16 V2.6 benchmark checks, 12 incremental-persistence checks, and 25 provider-integration checks passed; TypeScript and the Next.js production build also passed.
- Files changed: V2.6 live/recovery modules, runners, fixtures, artifacts, Market/Source Memory, Observatory, queues and this report.
- Founder decisions: retain Exa as escalation for USA Manufacturing; approve strict rejection of association/publication surfaces; decide whether the next USA cell should be Technology after evidence-grade manufacturer validation improves.
- Exact recommended next sprint: deploy V2.6, verify Observatory, then run a no-new-discovery evidence audit over the 14 accepted USA manufacturers before authorizing another vertical.
- Stop: no Pilot 2, outreach, people enrichment, USA second vertical, UK/AU/CA expansion or extra provider calls.
