# LeadLens — Amor de Gea Temporal Research Run V1 (detailed ledger)

**Run ID:** `amor_temporal_corroboration_v1`
**Executed:** 2026-08-21 20:10–20:11 UTC (34 s)
**Snapshot (immutable, new — Pilot-1 history untouched):** `ml/data/evidence-temporal/amor_temporal_corroboration_v1.json`
**Harness (existing provider stack only, no parallel scraper):** `scripts/sources/run-amor-temporal-corroboration-v1.ts`

## Provider health (live probe, `lib/ops/provider-health.ts` → `probeAll`)

| Provider | State | Role this run | Used |
|---|---|---|---|
| Anthropic | ✅ ok (1313 ms) | Bounded synthesis (later stage) | Not needed — 0 events survived acceptance |
| Exa | ✅ ok (834 ms) | Semantic escalation (Prioritize) | Yes (3 calls) |
| Tavily | ✅ ok (315 ms) | CO press + primary, supports dates | Yes (13 calls) |
| Brave | ✅ ok (821 ms) | Signal/identity backup | Yes (7 calls) |
| Firecrawl | ✅ ok (381 ms, 1025 credits) | Extraction fallback | Not needed |
| Serper | ❌ exhausted ("sin créditos") | search #2 of 3 | Skipped (degraded, non-blocking) |
| SEC EDGAR / SAM.gov | ok / 404 | US-only structured | N/A (Colombian accounts) |

**The 08-09 Anthropic "credencial rechazada" note is stale — the credential is healthy now.** No provider blocked the run; Serper exhaustion only removed one of three search providers (§78).

## Call ledger (23 calls, $0.021 exposed cost)

- **By provider:** Tavily 13, Brave 7, Exa 3.
- **By purpose:** support 13, unknown_resolution 8 (Validate accounts), adversarial 3 (Prioritize accounts).
- **Order:** Prioritize → Validate → Monitor (§9/§51). All 10 accounts received a targeted temporal check.
- **Errors:** 0. **Candidate results reviewed:** 138. **Unique URLs:** 123.

## Disciplined evidence adjudication

| Disposition | Count | Reason |
|---|---|---|
| **Accepted as verified dated material event** | **0** | — |
| Independent third-party *mention* (undated, static) | 1 | Habibi Plantitas on `english.dggf.nl` (Dutch Good Growth Fund) — an evergreen portfolio profile, **no event date** → not a dated event |
| Rejected — retrieval-date-as-event **+ wrong entity** | 18 | All 18 Exa results carried a uniform `2026-06-XXT00:00:00.000Z` crawl/index stamp (not an event date, §14/§70) **and** were semantically-similar *other* companies (Fithub, Natutivo, Pangea, VitalSetas, Biohotel…), not the account (§61 "irrelevant/not client-relevant") |
| Rejected — own-domain static page with template date | 10 | Company homepage/offering pages (spa page, kits page) = static facts, not events (§38/§61) |
| Rejected — own-domain static page, no date | 26 | Identity/offering pages, no event |
| Rejected — undated third-party snippet | 82 | Not promotable to material evidence (§18) |
| Rejected — wrong-entity adversarial noise | (within above) | Masaya **Nicaragua** hotel closures (≠ Masaya Collection Colombia); "Naturalmente"/other-brand closures (≠ Natural + Mente); macro Colombian health-system articles (≠ Ser Saludable) |

**Syndication clusters detected:** 0 (no single announcement repeated across hosts — because there were no announcements).
**Retrieval dates rejected as event dates:** 18. **Static facts rejected as changes:** 36. **Snippets rejected as proof:** 82.

## Per-account result

| # | Account | Decision | Support | Adversarial | Verified event | Indep. support | Counter-evidence |
|---|---|---|---|---|---|---|---|
| 1 | Ser Saludable | Prioritize | own site + wrong-entity crawl hits | macro health-system noise (≠ company) | **none** | none | none found |
| 2 | Masaya Collection | Prioritize | own site + other hotels | Masaya *Nicaragua* closures (wrong country) | **none** | none | none found |
| 3 | Natural + Mente | Prioritize | wrong-entity crawl hits | "Naturalmente"/other-brand closure (wrong entity) | **none** | none | none found |
| 4 | Éteka | Validate | own site (spa/ritual pages) + Johansens listing | — | **none** (static) | Condé Nast Johansens listing (directory, not an event) | — |
| 5 | Celestino H.B. & Spa | Validate | own site + hotel aggregators | — | **none** (static) | none | — |
| 6 | Sinergy On | Validate | own kits page | — | **none** (static) | none | — |
| 7 | Vitálica | Validate | own store homepage | — | **none** (static) | none | — |
| 8 | Charleston Santa Teresa | Monitor | brand pages | — | **none** | none | — |
| 9 | Habibi Plantitas | Monitor | own site + **DGGF (independent)** | — | **none** (DGGF undated) | 1 independent mention, undated | — |
| 10 | Funat | Monitor | own site + funatusa (US, 2024-12) | — | **none** decision-relevant | funatusa own-domain (US entry, ~20 mo old, not CO-relevant) | — |

## Honest conclusion of the run

The research executed correctly and the pipeline behaved with integrity: it **found real candidates, adjudicated them against the frozen contracts, and rejected everything that failed** (retrieval-date artifacts, wrong-entity semantic matches, static homepages, wrong-country/wrong-brand adversarial noise, undated snippets). **Zero verified dated material events survived acceptance for any of the 10 accounts. Zero independent event corroboration. Zero material counterevidence.** One genuinely independent third-party source exists (DGGF on Habibi Plantitas) but is an undated static profile, so it cannot establish Timing or What Changed.

This is a **valid, honest research result** (§8/§63/§76), not a pipeline failure. Its meaning is structural: the Amor account universe is **micro/small private Colombian wellness & hospitality businesses** whose public web footprint is static identity/offering pages, not trade-press-covered dated events. Temporal intelligence has little to bite on **for this segment** — which is itself the most important finding for where LeadLens's temporal layer creates value.
