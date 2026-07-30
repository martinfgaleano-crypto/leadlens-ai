# LeadLens Intelligence OS — Block 7

## Phase 7A — Block 6 failure taxonomy

Audit date: 2026-07-29
Baseline artifact:
`ml/data/evidence-temporal/amor-de-gea-2026-07-30T00-03-11-708Z.json`

The audit used the six actual accounts and 28 canonical evidence records from
Block 6. No provider call was made during this audit.

### Quantitative baseline

| Baseline metric | Block 6 |
|---|---:|
| Accounts researched | 6 |
| Queries executed | 12 |
| Evidence retained in artifact | 28 |
| Confirmed/high-entity evidence | 18 |
| Wrong-entity evidence | 10 (35.7%) |
| Evidence with publication date | 4 (14.3%) |
| Evidence without publication date | 24 (85.7%) |
| Evidence with unknown source type | 27 (96.4%) |
| Official-domain evidence | 7 |
| Commercial-signal evidence candidates | 12 |
| Commercial-signal candidates with wrong entity | 8 (66.7%) |
| Claims assessed | 8 |
| Independently corroborated claims | 0 |
| Explicit counterevidence checks | 0 |
| Qualified accounts | 0 |
| Provider cost | not measured |

### Failure classes

| Failure class | Actual finding | Root cause |
|---|---|---|
| Wrong entity | 10/28 records; all five Distribuidora DAM results and five additional social/search collisions | Queries used the account name without enough domain, location or identity discriminators |
| Ambiguous company identity | Distribuidora DAM was highly ambiguous; Tu Tienda Saludable and Somos Consiente had lexical near-matches | No deterministic research profile or ambiguity terms existed before search |
| Generic search results | Broad “expansion/partnership” wording returned football, fashion and unrelated corporate documents | Signal queries ran before a strong identity stage |
| Missing publication date | 24/28 records | Search snippets were persisted without targeted extraction/date recovery |
| Duplicated/syndicated source | Canonical URL dedupe existed, but source ownership/syndication was rarely classifiable | 27/28 records had no meaningful source class; no extraction metadata |
| Low-quality source | Directories, aggregators and social results were retained beside official evidence without a formal tier | Source quality was a numeric heuristic, not a tiered acceptance gate |
| Weak commercial relevance | Generic company descriptions and profile pages dominated; they confirmed existence but not a decision-changing fact | Claim recovery was query-labelled rather than fact-extracted |
| Unsupported claim extraction | “Commercial signal” was assigned from the query family even when the result only contained generic identity text | Evidence type was inherited from search intent instead of atomic content |
| No independent corroboration | 0/8 claims | No targeted query was generated from an existing single-source claim |
| No current signal | 0 defensible current opportunities | Only four dates were recovered and no dated event survived entity/relevance gates |
| No counterevidence | 0/6 accounts received an explicit bounded check | Counterevidence was modeled but not scheduled by the controlled runner |
| Provider failure | No provider-wide failure in the pass | All three search providers were available; provider diversity did not improve source independence |
| Extraction failure | Extraction was not attempted | The Block 6 runner used search results only |
| Insufficient query coverage | Two queries per account covered structural and broad signals only | No staged identity, footprint, counterevidence or corroboration plan |
| Query too broad | The generic signal query was the main source of wrong-entity results | No deterministic query-quality rejection |
| Account too obscure | Natural + Mente produced only one official result | Minimal independent web footprint; research should stop with an explicit unresolved gap |
| Language/regional coverage | Colombia was specified, but city/region and business category were not consistently used | Geography existed at provider level but not as an account-specific discriminator |

### Account-level baseline

| Account | Evidence | Wrong entity | Dated | Official domain | Primary bottleneck |
|---|---:|---:|---:|---:|---|
| Natural + Mente | 1 | 0 | 0 | 1 | obscure account / no independent source |
| Tu Tienda Saludable | 5 | 3 | 0 | 1 | ambiguous lexical matches |
| Hotel Spa La Colina | 7 | 0 | 2 | 1 | low-quality directories/social; no current event |
| BioPlaza | 5 | 0 | 2 | 2 | structural evidence only; dates not current |
| Distribuidora DAM | 5 | 5 | 0 | 0 | identity failure / overly broad query |
| Somos Consiente | 5 | 2 | 0 | 2 | similar-name social collisions |

### Phase 7A decision

Block 7 must not relax claim or actionability thresholds. It must improve the
research sequence before claim creation:

1. verified-data-only account profile;
2. identity-first queries and gate;
3. explicit source tier and accepted/rejected evidence ledger;
4. extraction only for relevant accepted URLs;
5. atomic claim recovery from content, never from query intent;
6. targeted corroboration and counterevidence;
7. transparent qualification gates and monitoring triggers.

## Delivery log

## Research-profile methodology

`buildResearchProfile` uses only the verified shortlist fields supplied to it.
Unknown aliases, parents, subsidiaries, locations, products and alternate
domains remain empty or null. Generic or short name tokens become ambiguity
risks; they never become aliases. Every profile records identity confidence,
structural score, verified fields and explicit pre-research gaps.

## Query planning, quality and sequencing

The deterministic planner creates at most five queries per account across
identity, footprint, current activity, counterevidence and client relevance.
Every query has a target evidence gap and eight quality dimensions. Generic,
duplicated or purposeless queries are rejected with reason codes.

Execution is adaptive:

1. identity must pass;
2. current activity may then run;
3. counterevidence runs for dossier-stage accounts;
4. a corroboration query is generated only for a meaningful single-source
   current claim and only while budget remains.

The commercial-footprint query remains planned but may be deferred because
identity/current sources can close that gap and the runner reserves query budget
for counterevidence/corroboration. Failed identity prevents later signal claims.

## Provider routing and stopping

- Serper: preferred identity/counterevidence discovery.
- Brave: current-activity and fallback discovery.
- Tavily: corroboration when it adds a distinct source.
- Tavily Extract: relevant accepted Tier A/B URLs only.
- Firecrawl: existing extractor fallback only; never general search.

The final pass enforced six accounts, five planned queries per account,
24 executed queries, two retries, eight extraction URLs and five results per
query. A failed provider is quarantined and subsequent stages use a healthy
provider instead of repeatedly burning retries.

The first attempted pass made six Serper identity calls; all returned HTTP 400.
It stopped before later stages, correctly yielding no evidence, but incorrectly
classified structurally strong accounts as prioritize/monitor. That intermediate
artifact is retained for audit. The gate was fixed so those states require
confirmed identity. The final controlled pass used one Serper failure plus one
bounded fallback and then routed through Brave.

## Source-quality and entity gates

| Tier | Accepted role |
|---|---|
| A | Registry, regulatory/institutional record or filing |
| B | Official company source, established business/trade source |
| C | Association, marketplace, verified partner or official social identity |
| D | Generic directory, aggregator, unverified/scraped source; discovery only |

Wrong/ambiguous entities cannot support claims. Probable evidence remains
visible but cannot generate high-confidence claims. Tier D is retained in the
rejection ledger and never enters claim recovery.

Source independence is ownership-aware. The company website and its controlled
Instagram/Facebook/LinkedIn channels count as one source owner. Provider
diversity never creates source independence. This correction removed three
apparent structural corroborations during offline readjudication.

## Claim, corroboration, counterevidence and date recovery

Claims are atomic facts separated from commercial interpretation; recommendation
is always null at claim level. Generic descriptions do not generate claims.
High-value event patterns cover openings, expansion, partnerships, negative
events and operating footprint. No claim states purchase intent.

Single-source current claims can generate a targeted query containing the same
account/event and excluding the already-known domain. No qualifying current
claim existed in the final pass, so zero corroboration queries were executed.

Counterevidence was checked for all six dossier accounts. No material negative
event was found within the bounded queries. The stored conclusion is
`not_found_within_bounded_search`, never “no counterevidence exists.”

Date recovery reused the existing extractor/date resolver: provider date,
JSON-LD, Open Graph, HTML time, visible date and URL pattern are evaluated while
retrieval time remains separate. Eight bounded extractions were executed.

## Opportunity qualification

Qualification does not replace structural ranking. Eight transparent gates are
recorded independently:

1. identity;
2. structural relevance;
3. commercial accessibility;
4. evidence;
5. timing;
6. counterevidence;
7. client fit;
8. actionability.

Each gate retains state, confidence, evidence references, blockers and next
verification. `act_now` requires all critical gates; structural fit cannot
compensate for missing timing/evidence. `prioritize` and `monitor` require
confirmed identity. `investigate_now` additionally requires a research question
likely to change the decision.

Monitor/prioritize dossiers contain explicit new-location and
distribution/category-partnership triggers, required evidence, baseline,
90-day review horizon and confidence. No recurring automation was created.

## Controlled Block 7 pass

Final artifact:
`ml/data/research-quality/amor-de-gea-block7-2026-07-30T00-33-22-535Z.json`

| Metric | Block 6 | Block 7 final |
|---|---:|---:|
| Accounts researched | 6 | 6 |
| Queries executed | 12 | 19 |
| Evidence retained/accepted | 28 | 17 |
| Evidence explicitly rejected | 0 | 27 |
| Wrong-entity evidence accepted | 10 initially retained | 0 |
| Wrong-entity rejections | not recorded | 8 |
| Dated evidence | 4 | 4 |
| Dated coverage | 14.3% of retained | 23.5% of accepted |
| Claims | 8 | 6 |
| Commercially relevant current claims | not reliably separated | 0 |
| Corroboration attempts | 0 | 0 |
| Independently corroborated claims | 0 | 0 |
| Counterevidence coverage | 0/6 | 6/6 |
| Qualification coverage | 0/6 | 6/6 |
| Actionable accounts | 0 | 0 |
| Prioritize | 0 | 4 |
| Monitor | 0 | 2 |
| Exclude | 0 | 0 |
| Accepted evidence/query | not comparable (wrong entities retained) | 0.89 |
| Provider cost | not measured | not measured |
| Supabase-persisted dossiers | 0 | 6 |

Block 7 generated fewer claims because it rejected generic descriptions and
grouped account-controlled channels. Higher claim volume was not treated as
better. Dated item count stayed flat, but dated coverage improved because
irrelevant evidence was rejected.

### Account decisions

| Account | Decision | Reason |
|---|---|---|
| Natural + Mente | prioritize | Confirmed account and strong client/structural fit; no current timing |
| Tu Tienda Saludable | prioritize | Confirmed footprint/client fit; no independently supported current event |
| Hotel Spa La Colina | monitor | Relevant confirmed account; no current dated commercial window |
| BioPlaza | prioritize | Confirmed structural/client fit; available dates are not a current signal |
| Distribuidora DAM | prioritize | Official identity and 2025 catalogue recovered; no current commercial window |
| Somos Consiente | monitor | Confirmed footprint; no current timing or independent event evidence |

All six states remain internal and unreviewed. No immediate outreach or buying
intent is justified.

## Persistence

Migration 042 was sufficient; no migration 043 was created. Profiles, query
plans, executed-query metadata, evidence decisions, atomic claims,
corroboration attempts, counterevidence result, qualification gates, monitoring
triggers and cost state are persisted inside the versioned internal dossier
JSON. Accepted canonical evidence, claims and account states use the normalized
042 tables.

The source-owner correction created new evidence/claim IDs and a superseding
account-state/dossier observation rather than mutating the earlier evidence.
All six corrected dossiers were persisted successfully. Rejected provider
payloads are not copied wholesale; only bounded auditable decision metadata is
retained.

## Snapshot and Command Center impact

The provider-free loader now consumes the latest Block 7 artifact and projects
real deep-research, accepted evidence, dated evidence, corroboration,
counterevidence and qualification coverage. No provider or LLM call occurs
during page rendering.

Without redesigning navigation:

- Overview shows research volume, accepted/rejected evidence, actionable count
  and the primary bottleneck.
- Outputs shows internal account qualifications, gates and next actions.
- Evidence shows accepted/rejected counts, wrong-entity rejections, dated
  coverage, source tiers, corroboration attempts, counterevidence coverage and
  honest cost state.
- Existing capabilities, gaps and readiness recalculate through the unchanged
  snapshot methodology.

Readiness remains conservative: no current commercial claims, no independently
corroborated claim, no reviewed customer-safe qualification, no outcomes and no
Intelligence Lift baseline. Ranking and customer reports are unchanged.

## Verification

- Research Quality: **62 passed, 0 failed**.
- Block 6 Evidence/Temporal: **55 passed, 0 failed**.
- Admin Command Center: **36 passed, 0 failed**.
- Validation Loop: **50 passed, 0 failed**.
- Registries: **28 passed, 0 failed**.
- TypeScript: passed.
- Admin Auth: **48 passed, 0 failed**.
- Structural Market-to-Account ranking: **17 passed, 0 failed**.
- Production build: passed; `/admin/intelligence` is 11.1 kB / 105 kB first
  load and the protected Command Center API remains dynamic.

## Remaining limitations

- No defensible current commercial claim was recovered.
- No independent corroboration attempt was needed because no high-value
  single-source current claim survived; structural claims remain uncorroborated
  after source-owner correction.
- Four accepted evidence items have dates; absolute dated evidence did not grow.
- Serper returned HTTP 400 and was quarantined; Brave carried the final pass.
- Provider billing estimates remain unavailable, so cost is `not_measured`.
- Qualification states are internal and unreviewed; none is customer-safe.
- Query rejection rules are covered by deterministic tests, while the generated
  real plans themselves produced zero rejected queries.

## Exact next block

Block 8 should focus on **targeted current-signal recovery and human review
operations**: improve date-bearing business-media/partner discovery, resolve the
Serper request failure, and add an Admin review action for account
qualifications. It must not modify ranking, auto-publish dossiers, promote
patterns, or run broad market expansion.

## Stop confirmation

Block 7 stops after final QA, checkpoint update and stable commit. Block 8 is not
started.
