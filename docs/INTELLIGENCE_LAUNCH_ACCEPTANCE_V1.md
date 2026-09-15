# LeadLens — Intelligence Launch Acceptance V1

## Executive verdict

**READY FOR REAL CUSTOMERS: NOT CERTIFIABLE FROM THIS ENVIRONMENT — the live 12-company
benchmark could not be run here (no provider/LLM/Supabase keys), and this document does NOT
fabricate one.** What *is* proven in code passes: the deterministic Intelligence quality gates
that encode the launch rubric are all green. The single remaining launch step is **one live
benchmark run in a keyed environment** (command + thresholds below). Until that run exists,
Intelligence V1 is **LAUNCH-PENDING**, not launch-accepted.

Why no live run: this worktree has only `.env.example`; the shell exposes no
`BRAVE/TAVILY/SERPER/FIRECRAWL/EXA` provider keys, no `OPENAI/ANTHROPIC` API key, and no
`SUPABASE` service key. The real pipeline (`lib/monitor`, `lib/deliverable`, `lib/discovery`)
makes live provider + LLM + DB calls; with no keys it fails on the first call. Per the sprint's
absolute rule ("try to disprove readiness; do not fake live external success") and LeadLens's
product-truth ethos, no case outputs, scores, or decisions are invented here.

## Acceptance rubric (frozen)

Per analyzed company, 16 dimensions × 0–4 (0 fail · 1 weak · 2 acceptable · 3 strong · 4
excellent), summed /64 → normalized 0–100:

A company resolution · B relevant change · C freshness · D evidence quality · E dated evidence ·
F grounding · G fact/signal/inference separation · H why-now quality · I commercial relevance ·
J uncertainty · K counterevidence · L next validation · M decision quality · N non-repetition ·
O actionability · P honesty.

**HARD FAIL** if: wrong entity · unsupported material claim · fabricated evidence · stale claim
sold as current · false buyer-intent · unusable output · product-truth violation.

**Global launch gate:** avg ≥ 82 · 0 hard fails · no geography avg < 78 · grounding avg ≥ 3.2/4
· commercial-relevance avg ≥ 3.0/4 · honesty avg ≥ 3.5/4 · decision-agreement ≥ 80% · dated
material-evidence ≥ 80% · grounded-material-claim ≥ 90%.

## Frozen benchmark set (INPUTS — outputs PENDING the live run)

12 cases, 6 USA + 6 South America, deliberate mid-market mix (no megacaps), 4 easy / 4 medium /
4 hard, objectives distributed. **No decision, score, evidence, or finding is asserted below** —
these are only the frozen inputs to feed the pipeline.

| # | Region | Country | Segment | Objective | Difficulty |
|---|---|---|---|---|---|
| 01 | USA | GA | Multi-site healthcare group | New clients | Easy |
| 02 | USA | TX | Regional logistics / distribution | Target accounts | Easy |
| 03 | USA | OH | Specialty manufacturing | New partners | Medium |
| 04 | USA | CO | B2B field services | New clients | Medium |
| 05 | USA | MA | B2B tech / infrastructure | New market | Hard |
| 06 | USA | FL | Founder-led lean B2B / consultancy | New partners | Hard |
| 07 | SA | Colombia | Regional logistics | New market | Medium |
| 08 | SA | Brazil | Multi-site healthcare | Target accounts | Easy |
| 09 | SA | Chile | Specialty manufacturing / distribution | New clients | Medium |
| 10 | SA | Argentina | Professional services / agency | New partners | Hard |
| 11 | SA | Peru | Field services / infrastructure | New market | Hard |
| 12 | SA | Colombia | Founder-led B2B tech | Target accounts | Easy |

Once run, the machine-readable artifact belongs at
`artifacts/intelligence-launch-acceptance-v1.json` (one record per case: input, objective,
resolved entity, provider calls, raw evidence w/ tiers + dates, interpreted output, decision,
uncertainty, counterevidence, next validation, freshness, errors, per-dimension scores, hard-fail
flag) alongside an independent-verification column (SUPPORTED / PARTIAL / UNSUPPORTED /
CONTRADICTED per material claim, graded from sources OTHER than LeadLens's own output).

## Code-proven quality gates (this session, green)

The deterministic fixtures that encode the rubric's invariants all pass — these are the
architectural guarantees that hold regardless of any single live case:

| Rubric dimension | Enforced by (green) |
|---|---|
| Evidence quality (D) | `evidence-quality` 25/25 |
| Freshness / dated / temporal (C, E) | `evidence-temporal-intelligence` 55/55 · `research-temporal-hardening` 25/25 · `signal-temporal-monitoring` 51/51 (retrieval-date ≠ event-date, publication-date ≠ event-date, static-fact ≠ what-changed) |
| Grounding + fact/signal/inference (F, G) | `evidence-complete-opportunity-case` 36/36 · `case-handoff` 9/9 (independent support needs ≥2 distinct **origin** ids — provider diversity ≠ origin independence, `lib/monitor/{canonical-case,provider-routing}.ts`) |
| Counterevidence (K) | `counterevidence` 30/30 |
| Materiality / why-now (B, H) | `research-materiality` 7/7 · `materiality-partnership-recall` 7/7 (`isMaterialEventClaim` gates Case + Vault) |
| Commercial relevance + synthesis (I, O) | `account-opportunity-synthesis` 40/40 · `positive-commercial-case-validation` 19/19 |
| Decision quality + honesty/abstention (M, P) | `deep-validation` 26/26 · `lib/intelligence/portfolio-admission.ts` (admits prioritize/validate/monitor/eligible-hold; honest abstention drives commercialOutcome) — decisions are `prioritize/validate/monitor/hold`, **no HOT/WARM/COLD, no opaque score** |

Total ≈ 330 assertions green. These prove the *system will not* present ungrounded claims,
conflate dates, count one origin twice, fake buying intent, or emit a score — i.e. the failure
modes the rubric hard-fails on are structurally blocked.

## Prior LIVE evidence (historical — NOT re-run this session)

From earlier keyed runs (recorded in project memory / repo, cite as prior-live, not fresh):
self-serve V3 repeat-review **18/18 live** vs real Supabase (US mfg/logistics: distinct
runs/reviews, canonical-key overlap, Monitor/Hold survived, cross-tenant 404, **$0.68 / 2 runs**,
~200–230s/run @concurrency 2); retrieval revalidated **Brave + Tavily US 3/4 target-valid**
(Serper unfunded, not required). This supports plausibility but is **not** the 12-case launch
benchmark and is region-narrow (US mfg/logistics) — South America at launch scale is **unproven
live**.

## To produce the launch verdict (keyed environment / founder)

1. Set env: `BRAVE_API_KEY`, `TAVILY_API_KEY` (Serper optional), `FIRECRAWL_API_KEY`,
   `ANTHROPIC_API_KEY` (or the configured LLM), `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_RUN_SECRET`. (Optionally
   `INTELLIGENCE_RESEARCH_CONCURRENCY=2`.)
2. Run the real customer E2E path over the 12 frozen inputs (harness:
   `scripts/accept-customer-intelligence-e2e.mts`), persisting each case to
   `artifacts/intelligence-launch-acceptance-v1.json`.
3. Independently verify each material claim from sources other than LeadLens; grade all 16
   dimensions; compute the aggregates and the global gate above.
4. Expected spend ≈ prior $0.34/company ⇒ ~$4 for 12; latency ~200s/case.

Do **not** integrate Exa or SAM.gov for this: the current-provider failure mode that would
justify them is exactly what the live benchmark must first *measure*. No integration is warranted
on enthusiasm; recommend only if the run shows a repeated, provider-attributable gap.

## Final gates (this session)

DETERMINISTIC QUALITY GATES: **PASS** (330 green) · LIVE 12-CASE BENCHMARK: **NOT RUN** (no keys)
· GROUNDING/TEMPORAL/COUNTEREVIDENCE/DECISION/HONESTY INVARIANTS: **PASS (code)** · SOUTH AMERICA
AT LAUNCH SCALE: **UNPROVEN LIVE** · EXA / SAM.GOV: **DO NOT INTEGRATE** (no measured gap).

INTELLIGENCE V1: **LAUNCH-PENDING** (code-invariants accepted; live benchmark required).
READY FOR CUSTOMER TRAFFIC: **NOT YET CERTIFIED** — pending the one live benchmark run above.
