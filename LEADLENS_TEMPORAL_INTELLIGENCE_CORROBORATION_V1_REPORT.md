# LeadLens — Temporal Intelligence & Independent Corroboration V1 Report

**Milestone in:** `7eacb14` · **Run:** live temporal + adversarial corroboration across the 10 Amor de Gea accounts · **Date:** 2026-08-21

> **Bottom line:** The temporal-intelligence + corroboration *architecture* was already built and enforced at `7eacb14`. This sprint executed the missing half — **real, disciplined research** — and the honest result is that **no verified dated material event, no independent event corroboration, and no material counterevidence** exists in the accessible public web for any of the 10 Amor accounts. That is a valid, integrity-preserving outcome, and it carries a decisive product signal about *where* temporal intelligence pays off.

## 1. What was executed

- **Provider health first (§1–4).** Live `probeAll` probe: Anthropic **ok** (the 08-09 rejection is stale), Exa **ok**, Tavily **ok**, Brave **ok**, Firecrawl **ok (1025 credits)**, **Serper exhausted** (non-blocking), SEC EDGAR/SAM.gov US-only. No provider blocked the run (§78).
- **Disciplined live run** via the existing provider stack (no new providers, no Apollo, no parallel scraper): 23 calls (Tavily 13 / Brave 7 / Exa 3), **$0.021** exposed cost, 34 s, 0 errors, 138 candidates reviewed. Priority order Prioritize → Validate → Monitor; all 10 accounts checked; Prioritize accounts got an explicit adversarial pass.
- **Adjudication against frozen contracts:** every candidate tested for real event date (not retrieval/publication), entity identity, Case relevance, independence, syndication.
- **Snapshot** written to a **new immutable file** (`ml/data/evidence-temporal/amor_temporal_corroboration_v1.json`); **Pilot-1 history untouched**.

Detailed ledger: `LEADLENS_AMOR_TEMPORAL_RESEARCH_RUN_V1.md`.

## 2. What the research found (honest)

| Outcome | Count |
|---|---|
| Verified dated material events accepted | **0 / 10 accounts** |
| Accounts with a single-source event only | 0 |
| Accounts with independently-supported event | 0 |
| Accounts with material counterevidence | 0 |
| Independent third-party *mention* (undated, static) | 1 — Habibi Plantitas / DGGF (Dutch Good Growth Fund) |
| Retrieval dates rejected as event dates | 18 (all Exa `…T00:00:00.000Z` crawl stamps) |
| Static facts rejected as "changes" | 36 (own-domain identity/offering pages) |
| Snippets rejected as proof | 82 |
| Wrong-entity rejections | Masaya **Nicaragua** ≠ Masaya Collection; "Naturalmente" ≠ Natural + Mente; macro health articles ≠ Ser Saludable |
| Syndication clusters | 0 (nothing to syndicate — no announcements) |

**Why coverage did not rise:** the accounts are micro/small **private** Colombian wellness & hospitality businesses. Their public footprint is static homepages and directory listings, not dated, corroborated, trade-press-covered events. The pipeline correctly declined to manufacture recency or corroboration from that material.

## 3. Coverage before → after (all 10 accounts)

| Field | Before | After | Change |
|---|---|---|---|
| True What Changed | 0/10 (by omission) | 0/10 (**empirically verified** absent) | qualitatively stronger — now evidence-backed, not untested |
| Timing | 0/10 | 0/10 | unchanged |
| Why It Matters Now | 0/10 | 0/10 | unchanged |
| Independent Support | 0/10 | 0/10 | unchanged |
| Counterevidence | 0/10 | 0/10 | unchanged |

The one meaningful shift is epistemic: 0/10 moved from *"not yet researched"* to *"researched with a disciplined, logged, adversarial run and confirmed absent in accessible sources."* That is a defensible statement LeadLens can now stand behind.

## 4. Decisions, Fit — unchanged, correctly

- **Decision distribution:** Prioritize 3 / Validate 4 / Monitor 3 / Hold 0 — **before and after**. No transition, because no new evidence warranted one (§49 allows change *only* on evidence).
- **Fit:** all 10 remain Moderate. **Not artificially differentiated** (§36/§40) — no evidence emerged to justify Strong or Limited.
- **Deliverable NOT regenerated with fabricated events.** Inputs are unchanged, so regeneration would be byte-identical; producing "activity" would violate §80. The existing portable deliverable (`output/amor-pilot1-deliverable.data.json` → canonical `/results/[jobId]/brief`) stands, with its honest Timing/What-Changed absences intact.

## 5. Architecture verification (unchanged, still enforced)

The frozen contracts held throughout and are test-locked at `7eacb14`:
`evidence-temporal-intelligence` **55/55**, `counterevidence` **30/30**, `evidence-complete-opportunity-case` **36/36**. tsc clean (incl. the new research harness). No product/UI/Client-Canvas/landing/workspace code changed.

## 6. The real product finding

LeadLens's temporal-intelligence layer is **sound and honest** — it rejects retrieval-date artifacts, wrong-entity semantic matches, static facts, and wrong-country noise rather than dressing them up as events. But it is **evidence-bound**, and the Amor pilot segment (micro-SMB private CO wellness/hospitality) is **structurally evidence-poor** for temporal signals. Temporal + corroborated intelligence will demonstrate its value on **larger, more publicly-active accounts** (companies that issue announcements, appear in trade press, file with regulators, post roles). The Amor universe is a stress test the product **passed on integrity** and **could not lift on coverage** — because the coverage isn't there to lift.

## 7. Portfolio Intelligence readiness — **hard recommendation: NOT YET**

Cross-account synthesis needs comparable, trustworthy, temporally-anchored evidence across accounts (§58–59). Right now: 0 verified events, 0 corroboration, 0 temporal anchors, no decision diversity movement. **Synthesizing patterns from this base would fabricate signal.** Do **not** start Portfolio Intelligence on the Amor pilot data.

**Recommended next sprint:** run this same disciplined temporal+corroboration harness against a **publicly-active account set** (mid-market / enterprise / regulated companies) to prove the layer produces real `What Changed / Timing / Why-Now / Independent Support / Counterevidence` where the evidence actually exists — *then* gate Portfolio Intelligence on that corroborated, multi-account base. Keep Serper topped up or rely on Tavily+Exa+Brave; Firecrawl (1025 credits) is ready for primary-source extraction when live events appear.

## 8. Integrity statement

No recency manufactured. No corroboration manufactured. No retrieval date promoted to an event date. No snippet promoted to proof. No wrong-entity match accepted. No coverage number inflated. Pilot-1 history never mutated. The run succeeded on the only metric that matters: **it told the truth about what LeadLens actually knows.**
