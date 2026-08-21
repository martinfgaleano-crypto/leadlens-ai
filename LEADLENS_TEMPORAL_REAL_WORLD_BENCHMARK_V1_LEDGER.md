# LeadLens — Temporal Real-World Benchmark V1 (research ledger)

**Run ID:** `temporal_benchmark_v1` · **Executed:** 2026-08-21 · **Client lens:** Asteron Systems
**Immutable snapshots (separate from Amor — §75/§97):**
- Discovery ledger: `ml/data/benchmark/temporal_benchmark_v1.json`
- Evaluation snapshot: `ml/data/benchmark/temporal_benchmark_v1.evaluation.json`
- Benchmark view model: `output/benchmark/asteron-benchmark-deliverable.vm.json`
- Benchmark artifact: `output/benchmark/asteron-benchmark.html`

**Harness (existing provider stack only):** `scripts/sources/run-temporal-benchmark-v1.ts`
**Adjudicator:** `scripts/sources/adjudicate-temporal-benchmark-v1.ts`
**Artifact builder (existing renderer):** `scripts/artifacts/build-asteron-benchmark-deliverable.ts`

## Provider calls
- **Discovery pass 1** (diagnostic): 36 calls (Tavily 24 / Exa 12) → 0 dated. Exposed the Exa freshness guard + Tavily `topic:general` date gap.
- **Discovery pass 2** (accepted): 36 calls (Brave 24 news / Tavily 12 general) → 202 unique URLs, **139 dated**.
- **Diagnostics:** ~4 probe calls (Brave/Exa/Tavily-news health) + 1 WebFetch (FreightWaves primary verification).
- **Exposed cost:** $0 (Brave & Tavily expose none; Exa cost-bearing calls were guarded/failed).

## Reproducibility bundle (§72/§73)
Persisted: selected universe (with per-account selection reason), client context, criteria, full call ledger (query/provider/results/dates/hosts), accepted + rejected evidence with gate reasons, evaluation snapshot, and view model. Re-running the harness later measures new/same/stale evidence and decision transitions per account.

## Gate-level rejection ledger (§37)
| Gate | Rejected | Representative reason |
|---|---|---|
| Identity | 71 | result not about the target entity (semantic near-match / wrong company) |
| Temporal | 48 | no real event date, or Exa midnight crawl stamp (`T00:00:00.000Z`) |
| Materiality | 54 | identity-valid + dated but no operational-event language (analyst notes, stock quotes, profiles) |
| Duplicate | 10 | same canonical URL across queries |
| Client-relevance | 0 | (material operational events already encode Asteron relevance) |

## Wrong-entity catches (identity gate working)
- **Coordinadora Mercantil (CO):** a same-named Spanish logistics firm (Algeciras / "Port Nou" / "desconvoca la huelga", `elestrechodigital.com`) was excluded — the Colombian entity yielded no valid dated event.

## Accepted evidence highlights (real, dated, sourced)
- **Saia:** new terminals Duluth MN + Columbia MO, June 2026 (3rd consecutive month) — FreightWaves, TT News, GlobeNewswire (PR), QuiverQuant, Trucking Dive. **Verified via primary FreightWaves fetch.**
- **Watsco:** Jackson Supply acquisition — announced Apr 28, completed Jun 2 — watsco.com (PR), distributionstrategy.com, grafa.com.
- **Encompass Health:** Kansas hospital expansion completed Jul 29; Deaconess expansion Apr 13; Greenville midpoint Mar 24; Franklin expansion begun Sep 2025 — encompasshealth.com, wevv.com, healthcaredesignmagazine.com.
- **Alianza Team (CO):** $36M U.S. functional-fats facility opened Apr 9 — foodnavigator.com; expansion consolidation May 19 — elnorte.com.co. *(Strongest Colombian case.)*
- **GXO:** Sant'Antonino logistics hub opened Mar 31; Electro Dépôt automation contract expanded Apr 19 — **but** 220-job Southaven closure, Memphis ~200 cuts, West Jefferson layoffs (bizjournals, actionnews5, hoodline). *(Best counterevidence example.)*

## Counterevidence (adversarial pass, dated)
Captured for 7/12 accounts, incl. Saia tonnage decline (Oct 2025), GXO layoffs/closures (multiple 2026), US Foods layoffs page, Watsco "stabilizing markets." Kept separate from direct evidence; unknowns not treated as counterevidence.

## No-evidence accounts (honest)
Quala, Crystal, Grupo BIOS, Coordinadora (all CO) — identity-valid hits present but no material dated operational event surfaced in-window. Cause: mix of genuine absence and Spanish-language news recall limits (see report §18, P2).

## Integrity statement
Accounts selected before searching, by structural criteria only. No event invented; every accepted item carries a real date + real publisher origin. Retrieval/crawl dates, static pages, and wrong-entity matches rejected. All 12 accounts remain visible. Amor pilot data and the public landing untouched. Architecture unchanged.
