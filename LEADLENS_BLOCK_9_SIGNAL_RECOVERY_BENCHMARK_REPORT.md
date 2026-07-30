# LeadLens Intelligence OS — Block 9

## Signal recovery benchmark, source calibration and monitoring operations

Status: in progress
Methodology target: `signal-recovery-benchmark-v1`

## 9A. Block 8 failure matrix

Audit date: 2026-07-30. This matrix was completed before changing any signal gate or creating benchmark labels.

### Source-ledger limitation and recovery method

The Block 8 artifact preserved each query, provider, result count and accepted dated-entity candidate count, but did not preserve the eight raw search results. This is itself an operational defect: individual rejection decisions were not replayable from the artifact.

The original distribution was:

- Hotel Spa La Colina expansion query: 2 results;
- BioPlaza expansion query: 5 results;
- Distribuidora DAM expansion query: 1 result.

The three exact queries were replayed against the same Brave adapter on 2026-07-30. The replay returned the same 2/5/1 distribution. The ledger below is therefore a same-day deterministic query replay, not a claim that provider ranking/payload is immutable. Provider cost was not reported.

### Individual result classification

| Result | Provider / query | Entity state | Event state | Date state | Decision | Correct? | Primary reason | Possible recovery |
|---|---|---|---|---|---|---|---|---|
| `enlazandoalmas.com/listing/hotel-spa-la-colina-pereira` | Brave / exact name + expansión | correct entity | static listing; no expansion event | provider date present but not an event date | reject | yes | correct entity, no event; provider snippet insufficient | inspect body only if a dated expansion phrase is present; otherwise retain static fact |
| `flickr.com/photos/hotel-spa-la-colina` | Brave / exact name + expansión | correct/controlled account identity | photo profile; no atomic event | provider date present but semantically unrelated | reject | yes | correct entity, no event; commercially irrelevant | no recovery; reject gallery/profile pages as events |
| `tiktok.com/discover/cafe-kirby-santiago` | Brave / exact “BioPlaza” + expansión | wrong entity and wrong geography (Dominican Republic place name) | unrelated venue description | dated provider result | reject | yes | wrong entity; geographic mismatch | add verified domain/Colombia anchor and ambiguity exclusions |
| `bioplaza.com.ng/tiehome` | Brave / exact “BioPlaza” + expansión | wrong entity (Nigeria publishing site) | static company description | dated provider result | reject | yes | wrong entity; domain/country mismatch | anchor `bioplaza.com.co`, Colombia and healthy-products terms |
| `npiprofile.com/npi/1720168560` | Brave / exact “BioPlaza” + expansión | wrong entity (building address in Puerto Rico) | directory record; no event | dated provider result | reject | yes | wrong entity; unrelated geography/subentity | verified-domain and Colombia exclusions |
| `restaurantguru.com/Bioplaza-Bogota` | Brave / exact “BioPlaza” + expansión | probable correct account/location | static restaurant/directory page | provider date is page observation/update, not proven event date | reject | yes | no qualifying event; provider snippet insufficient | full-page extraction only for explicit opening language; never infer opening from listing date |
| `bioplaza.com.co/producto/harina-de-platano-500g` | Brave / exact “BioPlaza” + expansión | correct official entity | static product page; category mismatch | provider date present but not launch date | reject | yes | no event; static fact; commercially irrelevant to expansion query | query exact event terms and year; product page cannot establish launch |
| `distribuidoradam.com/.../Lista-de-Precios...2025.pdf` | Brave / exact name + expansión | correct official entity | static price list/footprint statement; no expansion event | exact document date, before Block 8 baseline | reject | yes | event before baseline; no atomic event; category mismatch | use as structural evidence only; search dated agreement/opening terms after cutoff |

### Gate distribution

- Correct entity but no qualifying event: 4.
- Wrong entity/geography: 3.
- Correct entity, static pre-baseline evidence: 1.
- Missing date: 0 in provider metadata, but 4 provider dates were not semantically valid event dates.
- Extraction failure: 0; extraction was correctly not attempted because no result established an event candidate.
- Duplicate/syndicated: 0.
- Valid event rejected: 0 identified.
- Correct rejections: 8/8.

### 9A conclusion

Block 8’s zero-signal result was principally a retrieval/query-recall problem, not an over-strict acceptance-gate problem. The event gate and identity/geography protections rejected all eight results correctly. The most promising recovery actions are:

1. verified-domain, country and ambiguity anchors for ambiguous names;
2. category-specific local-language event phrases rather than the broad word “expansión”;
3. exact year/date variants;
4. body/date recovery only after an event phrase passes;
5. persistent sanitized raw-result and gate-decision ledgers.

No identity, event, date, freshness, corroboration or counterevidence gate should be globally weakened based on this matrix.

## 9B. Real benchmark dataset

The curated dataset is `benchmarks/signal-recovery-v1.json`.

Composition:

- 8 known-positive cases;
- 5 known-negative source/window cases;
- 6 adversarial cases;
- 19 total records;
- 10 expected signals because two adversarial cases intentionally remain valid single-source signals while testing planned/completed and controlled-source independence.

Positive categories cover store/facility opening, product launch, partnership, leadership change and acquisition. IKEA Cali is the Colombian/Latin American case. Sources are official IKEA, FedEx, Apple, Spotify, Amazon, Microsoft and Airbnb pages/PDFs with explicit dates and event statements.

Negative cases use the real Block 8 static Hotel Spa La Colina, BioPlaza and Distribuidora DAM pages. Their labels mean “no qualifying event in this cited source and window,” not “the account had no event anywhere.”

Adversarial cases cover BioPlaza name collisions in the Dominican Republic, Nigeria and Puerto Rico; Microsoft planned-versus-completed acquisition states; Spotify official/controlled-channel duplication; and an evergreen Amazon hiring page.

Every record contains a stable ID, verified domain, country, category, event status/date, source URL/owner/type, expected entity/signal/date/corroboration state, query family, provenance, review cutoff and methodology version. Validation rejects positive labels without a dated, meaningful real event and does not convert an unlabeled case into a negative.

## 9C. Replayable benchmark and metrics

`lib/intelligence/signal-benchmark.ts` and `scripts/sources/run-signal-recovery-benchmark.ts` implement deterministic fixture replay. Default execution makes zero provider calls. Live mode requires the exact `I_UNDERSTAND_PROVIDER_CALLS` flag and a separate runner.

Fixture artifact: `ml/data/signal-benchmark/bench_d91e0bb65511be1d.json`.

Preliminary curated-fixture results:

- sample: 19;
- true positives: 10/10 expected signals;
- false positives: 0/9 expected non-signals;
- true negatives: 9;
- false negatives: 0;
- precision: 10/10 = 100%;
- recall: 10/10 = 100%;
- specificity: 9/9 = 100%;
- signal yield: 10/19 = 52.6%;
- identity precision among accepted signals: 10/10 = 100%;
- date-valid coverage: 10/10 = 100%;
- event-category accuracy: 19/19 = 100%;
- event-status accuracy: 10/10 = 100%.

These figures are explicitly preliminary and measure deterministic logic on curated sources. They are not production web-retrieval performance, client outcomes or evidence of broad category coverage.

### Query-family fixture results

| Query family | Cases | Valid identity | Date valid | Event valid | Accepted | False positives |
|---|---:|---:|---:|---:|---:|---:|
| exact name + partner | 3 | 3/3 | 3/3 | 3/3 | 3/3 | insufficient negative sample |
| exact name + signal | 10 | 8/10 | 7/10 | 3/10 | 3/10 | 0/7 |
| exact name + local signal | 1 | 1/1 | 1/1 | 1/1 | 1/1 | insufficient negative sample |
| exact name + signal + year | 2 | 2/2 | 2/2 | 2/2 | 2/2 | insufficient negative sample |
| site:official + signal | 3 | 3/3 | 1/3 | 1/3 | 1/3 | 0/2 |

Exact-name-only signal search is useful for discovery but weak for event validity. Partner and year variants performed best in this small labeled fixture, while official-site search protected identity but still needed date/body recovery.

## 9D. Live provider, extraction and date calibration

Live artifact: `ml/data/signal-benchmark/live-benchmark-2026-07-30T13-16-44-506Z.json`.

Scope: six positives and two adversarial cases across three configured providers, 24/24 queries, maximum five results, sanitized result ledger, no full provider payloads.

| Provider | Successful queries | Raw results | Known URL recovered | Dated results | Event-valid results | Cases with accepted result | Median latency |
|---|---:|---:|---:|---:|---:|---:|---:|
| Brave | 8/8 | 35 | 2 | 31 | 15 | 5/6 positives; 0/2 adversarial | 609 ms |
| Tavily Search | 8/8 | 40 | 1 | 0 | 13 | 0/6 under current date gate; 0/2 adversarial | 1,339 ms |
| Serper | 0/8 | 0 | 0 | 0 | 0 | 0 | 119 ms failure median |

Serper returned HTTP 400 on every query and is not a viable route until the adapter/request contract is corrected. Brave is the preferred dated recent-event search provider. Tavily Search has useful event discovery but supplied zero dates; it should route qualifying entity/event candidates into Tavily Extract rather than directly into current timing. Provider agreement never counts as source corroboration.

Provider-reported cost was unavailable for all calls, so cost remains `not_measured`, not USD 0.

### Date/extraction calibration

Initial extraction run:

- Tavily Extract success: 8/8;
- exact date recovery: 0/8;
- missing: 5;
- three incorrect month-first URL fallbacks.

Root cause: extracted Markdown preserved visible English datelines, but the resolver only recognized Spanish dates and searched too small a header window.

Targeted correction:

- added conservative English month-first/day-first parsing;
- expanded only the header/dateline scan to 5,000 characters;
- retained retrieval-date prohibition;
- retained explicit conflict state;
- retained URL dates as weak evidence.

Post-correction artifact: `ml/data/signal-benchmark/date-calibration-2026-07-30T13-18-21-468Z.json`.

- extraction success: 8/8;
- exact date recovery: 7/8 = 87.5%;
- missing: 1/8 (IKEA);
- conflicting: 0;
- Firecrawl fallback: 0;
- Tavily Extract: 8.

IKEA remains missing in extracted content and therefore requires provider metadata or an alternate source. It was not force-dated.

Date precedence is: structured metadata → article schema → Open Graph → visible dateline → provider date → URL segment. Conflicting high-confidence dates remain conflicting and are not silently overwritten. Retrieval time never becomes publication time.

### Category routing policy

Preliminary policy:

| Task/category | Primary | Fallback | Extraction | Stop rule |
|---|---|---|---|---|
| opening/expansion | Brave, exact name + local event + year | Tavily Search with verified-domain/country anchor | Tavily Extract; Firecrawl only on failure | stop after dated entity/event candidate plus bounded countersearch |
| partnership/agreement | Brave, exact name + partner/agreement | partner-confirmation query through Tavily | Tavily Extract | retain single-source observed if no independent owner found |
| product launch | official-domain query + Brave exact product/year | Tavily event discovery | extract official page for dateline/body | no signal from static catalog page |
| leadership | Brave exact name + appointment/year | official newsroom through Tavily | Tavily Extract | announced and effective dates remain distinct |
| negative event | Brave exact name + local negative terms | Tavily/local press | extract only entity-safe event candidate | never infer closure from inactivity alone |

This is preliminary because categories such as funding, hiring expansion, closure and geographic exit have insufficient live benchmark coverage.

### Recovery strategies

- Missing date: extract body, inspect dateline/metadata, then independent source; remain missing if unresolved.
- Ambiguous entity: verified domain + country + location + business terms; reject unresolved collisions.
- Vague event: exact event phrase/body/partner search; downgrade to static fact if atomic event remains absent.
- No independent corroboration: partner, registry, institutional or local press query; preserve single-source state rather than reject automatically.
- Provider failure: disable provider for the run and use one bounded fallback; no infinite retry.

## 9E. Monitoring operations

Block 9 adds:

- stable idempotent operation IDs;
- queued/processing/completed/limited/failed account states;
- bounded retry cap of two;
- resume selection for queued and retry-eligible failures;
- failed-account-only retry;
- source cutoff and methodology;
- operator notes;
- decision- and signal-policy-based monitoring cadence;
- explicit `recommendation_only` scheduling impact.

Recommended current policy:

- `act_now`: approximately weekly while timing remains active;
- `investigate_now`: approximately every 14 days;
- `prioritize`: approximately 34–45 days after evidence/source adjustments;
- `monitor`: approximately 45–90 days;
- `low_priority` and `exclude`: inactive by default.

Cadence also applies trigger horizon, signal decay, importance, source availability, evidence gaps, change frequency, client relevance and measured/unmeasured cost. No scheduler or recurring automation was created.

## 9F. Same-six-account calibrated rerun

Artifact: `ml/data/signal-monitoring-operations/amor-de-gea-block9-2026-07-30T13-21-30-694Z.json`.

Limits and execution:

- same six accounts;
- 12 active triggers;
- 18/24 searches;
- 0/12 extractions because no result passed entity + event while missing a date;
- 0 retries;
- 56 sanitized raw results;
- 2 correct-entity results;
- 54 dated provider results;
- 40 keyword/event-pattern results;
- 0 candidate passed identity + event + date + baseline freshness;
- 0 accepted evidence;
- 56 rejected evidence;
- 0 valid signals;
- 0 material changes;
- 0 qualification transitions;
- six `no_current_timing_evidence`;
- four `prioritize` and two `monitor` decisions retained;
- cost `not_measured`.

Gate-failure distribution:

- Identity: 54;
- Freshness: 41;
- Event: 16;
- Materiality: 16;
- Date: 2;
- Timing: 56.

The large raw yield did not improve accepted yield. The new diagnostics show why: broad Boolean queries increased noisy result retrieval, while the same-day baseline excluded old events and entity matching protected the accounts. This is a useful calibration result, not a reason to weaken gates.

### Block 8 versus Block 9

| Measure | Block 8 | Block 9 |
|---|---:|---:|
| Searches | 12 | 18 |
| Raw results | 8 | 56 |
| Correct-entity results | not fully persisted; replay showed 5 | 2 |
| Date-valid provider results | 8 provider dates, many not event dates | 54 |
| Event-pattern results | 0 accepted candidates | 40 preliminary patterns |
| Accepted evidence | 0 | 0 |
| Valid signals | 0 | 0 |
| Material changes | 0 | 0 |
| Qualification transitions | 0 | 0 |
| Gate trace | aggregate only | ten gates per raw result |
| Persistence | local artifact only | run, 12 triggers and changes in migration 043 |

Block 9 improved observability, date recovery, benchmark recall measurement and operational persistence. It did not improve same-six current-signal recall because no dated entity-safe post-baseline event was recovered.

## 9G. Persistence, Snapshot and Command Center

Migration 043 was verified as applied before the operating run. No migration 044 is required:

- benchmark definitions and fixture/live artifacts remain deliberately separated under `benchmarks/` and `ml/data/signal-benchmark/`;
- operational run, triggers, signals and What Changed entries reuse 043;
- benchmark records never enter production intelligence tables;
- no signal rows were inserted because no valid signal existed.

Persisted state after the run:

- monitoring runs: 1;
- monitoring triggers: 12;
- signals: 0;
- corrected account-specific changes: 6;
- one earlier colliding change row remains immutable as an audited pre-fix record.

A post-run audit found that no-signal change IDs omitted the account, causing six changes to collide. The ID now includes `account_id`; all six were reprocessed offline with zero provider calls. Nothing was deleted or overwritten.

Snapshot integration is provider-free and adds the benchmark methodology version only. It does not change Outcome Performance, Intelligence Lift, structural ranking, adaptive learning or report readiness.

The existing Command Center, without redesign, now shows:

- Overview: benchmark status/sample/precision/recall/identity/date coverage, FP/FN and monitoring-operation result;
- Evidence: preliminary benchmark confusion matrix and event accuracy;
- Gaps & Actions: gate-failure distribution, missing category coverage and next provider/date actions.

All metrics are labeled benchmark, preliminary and not production outcomes. No provider call occurs during render.

## 9H. Capability impact and limitations

Measured more credibly:

- curated signal detection precision/recall;
- event/date normalization;
- entity-safe rejection;
- provider/query/date calibration;
- resumable monitoring operations.

Not improved automatically:

- Outcome Performance;
- Intelligence Lift;
- client-specific commercial performance;
- adaptive learning;
- premium report readiness;
- production ranking.

Remaining limitations:

- 19 cases are too few for production reliability claims.
- Live provider comparison covered six positives and two adversarial cases, not all 54 categories.
- Negative live precision sample is only two adversarial queries per provider.
- The same-six baseline window was only hours old; current-event recall cannot be inferred from zero post-baseline events.
- Entity matching on external Colombian sources remains the primary operating-run bottleneck.
- Broad Boolean syntax increased irrelevant retrieval and needs provider-specific escaping/query decomposition.
- Serper remains unavailable due HTTP 400.
- Provider cost is not measured.
- IKEA’s extracted page still lacks a recoverable date.
- No real signal existed to exercise persisted signal/corroboration rows.

### Final QA

- Block 9 Signal Recovery Benchmark: 38/38.
- Block 8 Signal Temporal Monitoring: 51/51.
- Block 7 Research Quality: 62/62.
- Block 6 Evidence & Temporal: 55/55.
- Date resolver: 14/14.
- Admin Command Center: 36/36.
- Intelligence Snapshot: 27/27.
- Output/Pattern Registries: 28/28.
- Validation lifecycle: 50/50.
- Admin Auth: 48/48.
- Admin login routing: 57/57.
- Ranking/intelligence v2: 31/31.
- Ranking/intelligence v3: 52/52.
- TypeScript: passed.
- Next.js production build: passed; 134 static pages generated and Admin Intelligence compiled.

## Exact next block recommendation

Block 10 should be a narrow **entity-aware query decomposition and external-source identity recovery** block:

1. fix Serper request compatibility or formally retire it;
2. replace broad Boolean strings with provider-specific one-event queries;
3. benchmark external-source entity resolution for Colombian companies using domain, location, aliases and industry;
4. add reviewed funding/hiring/negative-event cases;
5. run a later-cutoff monitoring comparison after a meaningful time interval.

Keep execution manual, signals internal, ranking/report impact off, and do not start a scheduler or final Amor de Gea report.

## Stop confirmation

Block 9 stops after tests, production build, checkpoints and a stable commit. Block 10, automated monitoring, adaptive ranking, pattern promotion, customer alerts, final reports and broad market expansion are not started.
