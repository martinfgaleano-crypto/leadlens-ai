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

## Compliance

Company enumeration uses only Brave/Serper search + Tavily/Firecrawl extraction
over public pages. No Apollo, no PDL, no person databases, no PII, no
authenticated LinkedIn.
