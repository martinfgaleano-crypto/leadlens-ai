# LeadLens — Discovery Engine V2.1: Live Controlled Validation

First **real** controlled source access for Colombia hospitality. It establishes operational accessibility, verification cost, research-depth, and a **live** SourcePerformanceSnapshot kept strictly separate from the fixture. **No fabricated live results.** Pilot 1/2 and Account Memory untouched.

> **Headline honesty:** One structured cohort ran live over a **small controlled sample (n=4)** via public web access; the search cohort **could not run** (no provider credentials loaded in the execution environment + known exhaustion) and is recorded as `not_executed`. This is enough to establish accessibility and that the pipeline runs live — **not** enough to rank strategies. Strategy ranking, search cleanliness and hybrid economics = **INSUFFICIENT LIVE EVIDENCE** this sprint.

## 1–3. Initial HEAD / Git / Production
HEAD `4ae63a3`, branch `main`, origin in sync, tree clean except `.leadlens/*`. `/login` 200; `/admin/intelligence/discovery` present; migration 048 present; recurring-cycle 50/0 (Account Memory 15 intact); Pilot 2 `PLANNED — NOT AUTHORIZED`.

## 4. Prior fixture benchmark summary
`discovery-v2-colombia-hospitality-001` (kept as the deterministic regression fixture): structured-first 6 genuinely-new qualified, search 67% non-business — **pipeline validation only**, 0 provider calls.

## 5–7. Objective / context / access-policy
Obtain the first real controlled SourcePerformanceSnapshots for CO · hospitality/boutique/spa/wellness · hotel_operator · hospitality_guest_experience · guest_amenity. Access policy honored: small controlled sample only, public pages, **no auth bypass, no CAPTCHA evasion, no mass scraping, no people data** (§47–§48).

## 8–10. Sources attempted / accessibility / executed
- **Cotelco** (`cotelco.org/afiliados/`): **direct_access** but **javascript_heavy + pagination_complex** (page/2/ returned the same entries → JS pagination, not URL-addressable). **Structured entries with name, city, and official website directly.** → **executed** (controlled sample).
- **RNT** (`rnt.confecamaras.co`): `manually_accessible_only` / form-driven JS registry — **not executed** (deferred to avoid uncontrolled access). High authority, high operational cost.
- **Search provider** (Serper/Tavily/Brave): `provider_accessible` in theory but **operationally_unsuitable here** — credentials declared in `.env.local` but **not loaded in this process** + known exhaustion → **not executed** (§45 recorded limitation).

## 11–14. Cohorts / data basis / sampling / provider budget
- Cohort A (structured, Cotelco): **executed live** (`data_basis: live_source`, `live_execution: true`).
- Cohort B (search): **not_executed** — no credentials.
- Cohort C (hybrid): **not_executed** — depends on B (and Cotelco already provides domains).
- Sampling: first page of the affiliate directory (JS pagination blocks deterministic deeper sampling) → **n=4** company-level records. Budget honored; browser-only access.

## 15–17. Provider calls / actual cost / estimated cost
Provider calls = **0** (public browser access). `actual_provider_cost = null`; `estimated_provider_cost` only (unknown_cost = true) — estimates are never represented as real charges (§44).

## 18–20. Structured extraction / provenance / Account Memory
Real entities (company-level only; emails/phones deliberately dropped, §48): **Hotel Estelar El Cable** (Manizales, hotelesestelar.com), **One sixteen Hotel** (Bogotá, onesixteenhotel.com), **1549 Hostal** (Barichara, 1549hostal.com), **AcquaSanta Lofts Hotel** (Cali, acquasantahotel.com). Account-Memory novelty checked: none in Amor de Gea memory → **genuinely_new** 4/4.

## 21–26. Research depth / entity & domain resolution / verification economics / model & context / evidence
- **Research depth (L0–L5):** all 4 survived L0→L4; **0 provider calls at L1** because the source **provides domains directly**; L5 not run (no deep opportunity research). No late rejection.
- **Entity resolution:** identity resolved (name + city + directly-provided domain). One is a hospitality_group (Estelar).
- **Domain resolution:** **directly_provided_verified 4/4 (100%)** — search-resolved 0.
- **Verification economics:** cost_per_verified ≈ 0.1 est. units; verification_calls_per_account = 0. **The structured directory collapses domain-resolution cost.**
- **Business model / context / evidence:** all hotel_operator/hospitality_group; context **plausible** (guest-amenity plausible for hotels); evidence **sufficient** (Cotelco affiliation is authoritative + identity + verified domain + route plausibility).

## 27–29. Opportunity / live funnel / novelty
Opportunity = **plausible_mechanism** (NOT strong — spa not individually verified, honest). Live funnel (structured, n=4): raw 4 → resolved 4 → real_business 4 → model 4 → context 4 → evidence 4 → opportunity 4 → genuinely_new 4; verified domains 4/4; duplicates 0. Search/hybrid funnels: **INSUFFICIENT LIVE EVIDENCE**.

## 30–34. Incremental / marginal / overlap / complementarity / rejections
Single executed source ⇒ incremental/overlap across cohorts not comparable this sprint (search absent). Complementarity finding: Cotelco = **primary_discovery + directly provides domains** (unlike the fixture's RNT identity/coverage-only role). Rejection analysis: **0 rejections in-sample** (all valid affiliates).

## 35. Early-rejection savings
None triggered in-sample (all valid). Gates remain in place; savings measurable once a noisier cohort (search) runs.

## 37–39. Manual review & quality
Founder-review sample = the 4 accepted entities with source, domain, decision and why; classification looks correct (real active hotels, verified domains). No good hotels wrongly rejected; no directory/aggregator wrongly accepted; group (Estelar) flagged as hospitality_group. Original decisions preserved.

## 33/40. Snapshots & source confidence
Live `LiveSourceSnapshot` (`data_basis: live_source`) persisted **separately** from fixture snapshots (never overwrites). **co_cotelco: hypothesized → benchmarked** (one valid run, **n=4, noted small**). **No promotion to `historically_effective`** (requires multiple independent runs).

## 41. Learning recommendations (approval-gated, live)
(1) Cotelco = primary discovery that **provides domains** (low verification cost); (2) build a **JS-pagination parser** for Cotelco; (3) **unblock the search cohort** — load authorized provider credentials + confirm quota. All `human_approval_required`, `auto_applied:false`, with `data_basis` + `sample_size`.

## 42. Source research queue
High: Cotelco JS-pagination parser; authorize+quota-check a search provider. Medium: evaluate RNT form-search (headless) for identity coverage.

## 43. Observatory changes
`/admin/intelligence/discovery` now has a **clearly separated LIVE section** (EN VIVO badge): data-basis banner, **operational accessibility** table, cohort + **verification economics**, **research-depth L0–L5**, **fixture-vs-live** ("where the assumption failed"), approval-gated recommendations — visually divided from the fixture section, never blended (§40).

## 44–46. Tests / TypeScript / Build
`test:discovery-engine-v2-1-live` **25/0** (live≠fixture metadata, real sample no-people-data, cohort honesty, accessibility states, research-depth transitions, verification economics with estimated-not-actual cost, direct-domain finding, novelty, confidence discipline (benchmarked max, no historically_effective), approval-gated learning, INSUFFICIENT-LIVE-EVIDENCE honesty). Regression: discovery-v2 40/0, source-intelligence 38/0, recurring-cycle 50/0, amor-pilot1 delivery ok. `tsc` clean; `npm run build` succeeded.

## 47. Files changed
New: `lib/discovery/source-intelligence/live.ts`, `scripts/fixtures/discovery-engine-v2-1-live.test.ts`, `output/discovery-v2-colombia-hospitality-live-001.json`, this report. Modified: `index.ts` (export), `app/admin/intelligence/discovery/page.tsx` (live section), `scripts/artifacts/run-discovery-v2-benchmark.ts` (live artifact), `package.json` (+1 script), 4 checkpoints. **Fixture artifact `…-001.json` unchanged** (regression preserved, §53). Pilot 1/2, Account Memory, providers untouched.

## 48–49. Commit / push
Commit `feat: run live controlled discovery validation for colombia hospitality`. Push via GitHub Desktop (no CLI push credentials); admin route deploys on push.

## 50. Founder decisions required
(1) Approve Cotelco as a primary CO-hospitality discovery source (provides domains)? (2) Approve building the Cotelco JS-pagination parser? (3) **Provide/authorize a search-provider key + quota** so cohort B/C can run? (4) Approve RNT headless evaluation? None auto-applied.

## 51. Manufacturing readiness
**NOT YET.** Gate (§55) unmet: only one cohort ran, at n=4; a full structured cohort (parser) + a search cohort are needed first. Fix the search-credential blocker before generalizing.

## 52. Exact next sprint
**Discovery Engine V2.2 — complete the hospitality live cohort:** build the Cotelco JS-pagination parser to reach 30–50 real entities, run the search cohort under a real provider key + hard budget, and produce comparable live funnels (structured vs search vs hybrid) with real verification economics — then reconsider the manufacturing benchmark.

## 53. Stop confirmation
Live access attempted and honestly recorded; one structured cohort executed live (n=4) with real entities + directly-provided domains; search/hybrid `not_executed` with reasons; operational accessibility, verification cost, research depth, and a live snapshot (separate from fixture) all built; Observatory separates live vs fixture; sources not promoted beyond `benchmarked`; recommendations approval-gated; 0 provider calls, no people data, no outreach; Pilot 1/2 and Account Memory unchanged; fixture regression preserved. **Did not** run the manufacturing benchmark. Stopping.
