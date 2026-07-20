# Company-First Discovery (company-first-v1)

## Root cause of the quality problem (audit)

The previous discovery was **news-first**: it searched for event phrases
("empresa X abre nueva bodega") and then tried to derive the company from the
article's headline (`title.split("|")[0]` + entity resolution). This inverts the
correct order and is why the Colombian pilots surfaced junk:

| Symptom | Failure class | Why it happened (news-first) |
|---|---|---|
| **Revistaturbo, Eltransporte, Factorautomotor** | entity-resolution / **source failure** | These are Colombian trade media. News-first took the publication name as the "company" because the event lived on the publisher's own site. |
| **"Colombia" as a company** | **universe failure** | A public-initiative headline had no corporate subject; news-first still forced a company out of the title → a place. |
| **Publishers / public entities** | **universe + commercial-relevance failure** | The universe was "whatever news matched an event verb", which is dominated by media and government announcements. |
| **Generic articles / SEO** | **query failure** | Broad event queries with no company anchor return listicles and trend pieces. |
| **Companies without a real opportunity** | **commercial-relevance failure** | A relevant, recent, true news item was treated as an opportunity even with no causal link to the client's product. |

The honest filters downstream (gates v3, Opportunity Test predecessors) correctly
DISCARDed these — but the system never had a chance to find good companies,
because the **universe itself was bad from stage one**. Fixing entity resolution
alone cannot help: you cannot resolve a good company out of a page that is about
a publisher or a government program.

## New architecture (company-first-v1)

```
ICP  →  needs map (causal)  →  company universe (plausible real companies)
     →  per-company signal search  →  extract + validate date
     →  Opportunity Test (fail-closed)  →  corroboration  →  thesis  →  ranking
```

- **needs-map-v1** (`lib/discovery/needs-map.ts`): turns the client's product +
  ICP into `buyer_problem → operational_triggers → observable_signals →
  relevant_signal_families`. Only signal families with a real causal link to the
  product ever generate queries.
- **company-first-v1 universe** (`lib/discovery/company-universe.ts`): enumerates
  companies from permitted public sources (sector rankings, association member
  lists, business directories) and classifies each name with
  entity-resolution-v3. **Publishers, places, public entities and categories are
  rejected HERE, before any signal search** — they can never become an account.
- **per-company signal search** (`lib/discovery/company-first-discovery.ts`): for
  each plausible company, runs `"<company>" <event phrase>` queries scoped to the
  needs families, with an adaptive second round (official-domain / press-release
  phrasing) when the first round is noise.
- **opportunity-test-v1** (`lib/discovery/opportunity-test.ts`): fail-closed gate.
  An opportunity exists only with identity + fit + a real dated material event +
  a plausible commercial relationship + timing + evidence. Any hard blocker →
  reject; the LLM never rescues a hard-blocked signal (pure function).

## Budgets (effort ≠ delivered count)

| Tier | max companies | queries/company | max extractions |
|---|---|---|---|
| Preview | 18 | 2 | 24 |
| Brief | 30 | 3 | 60 |
| Intelligence | 45 | 3 | 90 |
| Premium | 60 | 4 | 120 |

The tier limit controls **delivery**, never the research effort. Nothing is
filled to reach the target — Preview can honestly emit 0, 1 or 2.

## Error taxonomy (measured on the 3-ICP benchmark)

| Error class | Where it must be caught | Fix in company-first-v1 | Residual risk |
|---|---|---|---|
| publisher-as-company | company universe | entity-resolution-v3 + media-name filter at enumeration | low — 0 leaks measured |
| place / public entity | company universe | GEO_BARE / GOV_PUBLIC classes reject before signal search | low |
| non-event reference page (Wikipedia, Play Store, Tracxn, Trustpilot) | Opportunity Test | `non_event_reference_page` hard blocker | low |
| name-only match (page mentions company, no event) | Opportunity Test | `no_material_event` — a needs-family verb must appear | medium (verb list per vertical) |
| foreign homonym (CO "Bavaria" vs German Bavaria) | Opportunity Test | `geography_mismatch_or_homonym` — content/domain must confirm region | medium (needs corroboration to fully resolve) |
| stale signal (>180d) | Opportunity Test | hard blocker; 90–180d → monitor | low |
| low commercial materiality | Opportunity Test + human review | verb + universe fit; final call is human QA | medium — genuine judgment call |

**Honest status:** the universe failure (the #1 root cause) is fixed — measured
0 publisher/place/public-entity leaks across 3 ICPs, with real Colombian
companies enumerated (Coltanques, Servientrega, Avianca, Terpel, Nutresa,
Contecar, DHL, Bavaria, Terpel…). The remaining work is **signal quality**:
name-only pages and foreign homonyms are now gated, but final materiality
still benefits from human QA. Company-first is a large, measurable improvement,
not a claim of full autonomy.

## Deep validation layer (v2)

After a signal passes the Opportunity Test, it goes through:

1. **Corporate identity** (`corporate-identity-v1`): resolves the company's real
   corporate domain via a bounded official-site search and scores
   `corporate_identity_confidence` (name↔domain match + .co bonus). The signal is
   attributed to the company only when the source host / content references that
   domain, or the content confirms the operating country AND identity confidence
   is ≥60. This is the **homonym guard** — German "Bavaria" and US "Essentia"
   pages no longer attach to the Colombian companies.
2. **Materiality** (`materiality-v1`): high (new plant/warehouse/fleet/contract/
   acquisition/investment/market entry), medium (minor alliance, hiring, pilot),
   low (award, interview, fair, social post, directory). Only high/medium
   advance; a low-materiality marker vetoes a medium one.
3. **Corroboration** (`quality-rubric-v1`): tiered from independent non-syndicated
   source domains + whether a primary/corporate source exists.
4. **Quality rubric (0–100) + adversarial review**: identity 15, fit 15,
   materiality 15, signal-association 15, evidence 15, causality 15, timing 5,
   actionability 5. Verdict: ≥85 & high-materiality → prioritaria; ≥75 →
   investigar; ≥60 → monitorear; else rechazar. Hard blockers, failed
   association, or low materiality **always** reject regardless of score. The
   adversarial flags are computed separately from thesis generation.

## Intelligence layer v3 (org type · event-vs-metric · thesis specificity)

- **organization-type-v1** (`organization-type.ts`): distinguishes commercial
  companies from public authorities/programs/systems. Does NOT auto-reject
  state-linked entities — Ecopetrol (state-owned commercial), EPM (mixed) and
  Opain (private concessionaire) are valid accounts; a ministry, mayor's office,
  a bare transit system (TransMilenio) or a state metro operator (Metro de
  Medellín) is not `eligible_for_icp`. Runs as **Stage 1** before any signal
  search — a runtime win AND the fix for public-service entities slipping
  through. Fields: `organization_type`, `commercial_entity`,
  `public_sector_relationship`, `eligible_for_icp`.
- **event-vs-metric-v1** (`event-vs-metric.ts`): a statistic ("movilizó 17M
  pasajeros", "creció 20%") is not a trigger — only `corporate_event`,
  `operational_change` or `strategic_decision` can seed an opportunity. A metric
  can add context but never triggers; it also caps materiality at low. Fixes the
  Avianca passenger-stat false positive.
- **thesis-specificity-v1** (`thesis-specificity.ts`): the substitution test — a
  thesis you could paste onto any company by swapping the name is too generic. A
  specific thesis references the concrete event + the client's product + a
  validation condition + a next action.

## Staged budget (runtime)

The 36-min benchmark was driven by a too-high budget. Now: Stage 1
(org-type/fit) rejects before any search; per-tier budgets are lean (Preview 12
companies / 14 extractions, Brief 20 / 28); a 5-minute wall-clock cap bounds
every run. Effort concentrates on eligible companies.

## Source policy (Colombia, initial)

Sources are classified for their ROLE, measured per run (not a static allow-list):
- **corporate / regulatory / institutional / economic-media / sector-media** →
  usable as evidence; corporate/regulatory count toward "primary".
- **publisher / aggregator / social / reference page / promotional** → never the
  account; social/reference pages are hard-blocked as non-events.
Domains that repeatedly yield homonyms or non-events lose priority via the
per-run taxonomy (measured in the benchmark output).

## Compliance

Company enumeration uses only Brave/Serper search + Tavily/Firecrawl extraction
over public pages. No Apollo, no PDL, no person databases, no PII, no
authenticated LinkedIn.
