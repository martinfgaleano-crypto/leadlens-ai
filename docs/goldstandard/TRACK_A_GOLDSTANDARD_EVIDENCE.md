# Track-A Gold-Standard — Evidence Package

**Verdict: B — PARTIAL. Specific Intelligence gap identified.** The live pipeline ran,
produced accurate account research and honest, internally-coherent canonical decisions,
but did NOT demonstrate Gold-Standard commercial-decision DEPTH on the five Intelligence
P0 capabilities for this fixture. This is a real finding, not a tooling artifact.

## The run (real pipeline)
- Customer: Track-A fixture — "Meridian Transition Partners", a boutique US post-merger-integration (PMI) operations consultancy (ASSUMED-FOR-FIXTURE; no real private facts). Target accounts = US mid-market industrials with a recent acquisition/roll-up/carve-out (the dated trigger = "why now").
- Discovery-SEARCH was **unavailable** in this environment: `BRAVE_API_KEY` absent; serper/tavily returned no yield for the niche M&A-trigger queries. The customer-job run returned 0 candidates across 4 passes (`output/goldstandard/track-a/track-a-diagnostics.json`). **Blocker is provider availability, not Intelligence.**
- To still exercise the real research + decision pipeline, 8 real public US industrials were **seeded** (candidate names/domains only) and run through `runLeadLensPipeline` + `canonicalCaseForLead`. Research, evidence, decisions are the real pipeline — not mocked, not hand-authored.
- Cost: **$0.48**. Research: 8/8. Eligible after the offer-aware gate fix: 8/8. Selected: 5.

## Decision distribution (real)
8 researched → **0 prioritize · 0 validate · 1 monitor · 7 hold**; artifact (top 5) → 0 prioritize · 0 validate · 1 monitor · 4 hold. No decision or distribution was forced.

## What the artifact got RIGHT (demonstrated)
- **Decision discipline (fit ≠ current opportunity):** every account scored Strong fit yet landed Hold/Monitor because no *current* commercial trigger was established. The system refused to convert serial-acquirer reputation into a PRIORITIZE. This is the core §11 distinction working.
- **Honest terminal state:** exec summary reads "0 prioritize · 0 validate · 1 monitor · 4 hold. No account currently justifies active commercial effort…" — a research conclusion, tier-local, no stale counts.
- **Decision-narrative coherence:** 0 contradictions — no "pursue now"/"outreach now"/"act now" anywhere; 0 forced prioritize.
- **Path to Prioritize** renders per account with legitimate conditions (verify a current commercial mechanism; verify commercial access; a dated current demand signal).
- **Customer-language:** 0 forbidden tokens (no scores, no WARM/HOT/COLD, no reason codes, no internal enums).
- **Accurate research:** company summaries are correct and sourced (verified against the merged report).

## The GAP (not demonstrated at Gold-Standard quality)
The research is **profile-driven, not decision-driven**. For every account: `why_now = none`, commercial mechanism / buyer function = "not established", commercial access = Unknown, next step = none. These serial acquirers (e.g. Chart/Howden, Enpro, CECO) have public M&A events the research did not hunt, extract, or tie to a PMI-demand thesis. So:

| P0 capability | Status | Evidence |
|---|---|---|
| Current Opportunity Qualification | PARTIAL | Correctly separates fit from opportunity (all Hold despite Strong fit), but passively finds "no why_now" instead of actively hunting the dated M&A trigger. |
| Commercial Mechanism | FAIL (not demonstrated) | "buyer function not established" on all 5. |
| Commercial Access | FAIL (not demonstrated) | Commercial access "Unknown" on all 5. |
| Decision-Critical Evidence | PARTIAL | Accurate profiles, but not targeted at decision-flipping questions (§54). |
| Actionability | FAIL (not demonstrated) | next step = none; Path-to-Prioritize present but generic, not account-specific. |

## Quality rubric (§14 — no flattering average)
Customer Specificity: PARTIAL · Current-Opportunity Qualification: PARTIAL · Commercial Mechanism: FAIL · Commercial Access: FAIL · Decision-Critical Evidence: PARTIAL · Counterevidence: PARTIAL · Uncertainty: PASS · Decision Coherence: PASS · Actionability/Next Action: FAIL · Claim-Source Integrity: PASS (claims limited to accurate sourced profiles + honest unknowns).

## Claim-source audit (§11)
Material customer-visible claims are the company profiles (SUPPORTED — accurate, sourced) and the canonical decisions (SUPPORTED by the evidence coverage). No UNSUPPORTED over-claims: the pipeline left mechanism/access/why-now as honest unknowns rather than asserting them. Totals: Supported = all rendered claims; Unsupported = 0 (the risk here is *omission*, not over-claim).

## Decision-narrative audit (§12)
0 known material contradictions. No Monitor/Hold carries a "pursue now" or active-outreach instruction; 0 PRIORITIZE without the bar.

## Root cause of the gap
The seeded research used the generic `runLeadLensPipeline` profiling path. It does accurate company research and honest decisioning, but it does not yet run **decision-driven research** (§23/§53/§54): it does not generate the bounded decision-critical questions ("did they just close an acquisition? which function owns integration? is there a PE sponsor?") and research against them. Closing this is the next P0 and is deliberately NOT attempted here (§10 — do not chase a prettier distribution; do not redesign research in this bounded pass).

## What LeadLens added beyond commodity discovery/enrichment (§72)
Beyond a company list, LeadLens added: a **canonical decision** per account grounded in the fit-vs-opportunity distinction, an **honest abstention** (all-hold with a valuable-abstention terminal state) that a raw list cannot produce, and a **Path to Prioritize** naming the evidence that would change each decision. It did NOT yet add the commercial mechanism / access / why-now depth that would make the decision act-on-able — which is exactly where Claude+Vibe-style discovery would be a comparable (or better) substitute today.

## Founder QA checklist (10–20 min, §15)
1. Open `output/goldstandard/track-a/LeadLens_TrackA_GoldStandard_Premium.pdf`.
2. Confirm exec summary counts match the benchmark table (tier-local).
3. Spot-check 2 company summaries against the cited sources (accuracy).
4. Confirm no account labeled Hold/Monitor recommends immediate outreach.
5. Confirm Path-to-Prioritize conditions are evidence-legitimate, not disguised recommendations.
6. Confirm no scores / WARM-HOT-COLD / internal codes.
7. Judge: would this change where you spend BD effort? (Expected answer today: it correctly says "not these, not yet, here's what to confirm" — useful as a *filter*, not yet as a *target list*.)

## Artifacts
- `output/goldstandard/track-a/LeadLens_TrackA_GoldStandard_Premium.pdf` (5 accounts)
- `output/goldstandard/track-a/track-a-merged-report.json` (canonical foundation)
- `output/goldstandard/track-a/track-a-seed-diagnostics.json` + `track-a-diagnostics.json` (discovery-failure evidence)
- Scripts: `scripts/track-a-goldstandard-run.mts` (live discovery path), `scripts/track-a-seed-research.mts` (seeded real-research path, with research caching for free correction re-runs).
