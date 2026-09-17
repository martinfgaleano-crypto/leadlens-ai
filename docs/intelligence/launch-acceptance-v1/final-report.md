# Intelligence Launch Acceptance V1

## 1. Final Verdict

**NOT LAUNCH READY.** Canonical truth safety improved and both observed presentation hard fails were removed, but productive opportunity recall remains too weak for an autonomous paid launch. The tested release envelope is suitable only for guided founder pilots with manual QA and explicit abstention.

## 2. Supported Launch Envelope

Guided Preview/Brief-style pilots for industrial automation and lean operations in the United States and Colombia/South America, with manual review before customer delivery. No claim of broad market coverage. No autonomous self-serve release.

## 3. Benchmark Design

Three frozen commercial contexts across USA and South America (six Track A runs), plus eight frozen positive controls in Track B. The first USA run was excluded because DNS interruption and clock skew contaminated runtime. No datasets, gates, scoring, providers, or budgets changed before baseline completion.

## 4. Baseline

Six valid Track A runs: 50 universe accounts, 9 researched, 7 portfolio accounts, 9 canonical Holds, 0 customer-safe opportunities. Track B captured 4/8. Runtime median 233,839 ms, max 352,687 ms. Score 56/100 with two presentation hard fails.

## 5. Post-Fix Result

Three exact Track A reruns completed before Anthropic exhaustion: 19 universe accounts, 5 researched, 3 customer-visible Holds, 0 customer-visible opportunities. One internal Validate was correctly not admitted. No action/evidence contradiction appeared. Track B improved to 5/8 by recovering Quad. A fourth run is infrastructure-only; two runs were not started.

## 6. Score Delta

56 → **65 provisional**. This is evidence-bounded, not a population estimate. Hard fails in the scored subset: 2 → 0. Full six-run comparison is unavailable because Anthropic exhausted.

## 7. Company Case Table

| Company | Region | Decision | Evaluator assessment | Value | Hard fail | Note |
|---|---|---|---|---|---|---|
| DHL Supply Chain | USA | Hold | defensible | marginal | no | no validated current event |
| Mapei | South America | Hold | decision defensible | low | baseline only | unvalidated US URL now suppressed |
| WEG | South America | Hold | defensible | marginal | no | no validated current event |
| Logisfashion | South America | Hold | defensible | low | no | static page not Timing |
| Tecnoglass | South America | Hold | presentation fixed | useful | baseline only | canonical Hold now owns action |
| Chex Finer Foods | USA | Hold | defensible | marginal | no | history/anniversary rejected |
| CoralTree Hospitality | USA | Hold | defensible | marginal | no | no procurement mechanism |
| Koba Colombia | South America | Hold | defensible | low | no | low fit/no event |
| Grupo Éxito | South America | Hold | defensible | useful | no | stale evidence |
| Village Super Market | USA | Validate (internal) | correctly not admitted | marginal | no | target/relevance uncertainty |

## 8. Truth & Grounding

Canonical Case now controls customer-facing next action. Candidate URLs without a deterministic event date no longer enter the evidence chain. Search hints remain discovery provenance, not Evidence. Independent-source quality remains bounded by sparse retrieval.

## 9. Dates / Freshness

Publication date is not promoted to event date. Undated candidate URLs are suppressed from dossier Evidence. No false What Changed was observed in the scored post-fix subset.

## 10. Commercial Judgment

Abstention is generally defensible. The weakness is not score inflation; it is insufficient discovery and research recall. Fit remains structurally stronger than Timing and event evidence.

## 11. False Positives

Canonical actionable false positives: 0 in baseline and post-fix samples. Baseline presentation contradictions: 2; both fixed and regression-tested. Post-fix scored subset: 0/3 customer-visible cases contradicted canonical truth.

## 12. False Negatives

Track B: 3/8 remain missed (John Deere, UFP, Mondi). Quad was recovered. Root causes are retrieval targeting/extraction allocation, not relaxed gates. Track A likely loses useful opportunities before Research because USA universes can collapse to one account.

## 13. Uncertainty / Counterevidence

Uncertainty is preserved through Hold/Validate and no-buying-intent language. Counterevidence is structurally present; the sample did not prove consistently rich independent counterevidence for customer-safe opportunities because none reached delivery.

## 14. Actionability

Canonical mapping is now deterministic: Prioritize→outreach, Validate→validate source, Monitor→monitor, Hold→exclude. The tested cases no longer tell a customer to contact a held account.

## 15. Portfolio Quality

Industrial USA: honest but too sparse. Industrial South America: broader universe, all Hold. Lean USA: one internal Validate rejected before delivery. No post-fix portfolio yet demonstrates paid customer value.

## 16. Customer Value

Current measured value: **MARGINAL** for autonomous discovery; **USEFUL** as a guided analyst-assist system that safely rejects weak claims. This is not enough for self-serve charging.

## 17. USA vs South America

Baseline scores: USA 53, South America 59. South America produced larger universes but weaker/staler public evidence; USA suffered severe universe collapse. Country-level conclusions remain small-sample.

## 18. Provider Contribution

Brave and Tavily supplied live search coverage. Serper produced 44/44 errors across measured baseline/post-fix runs and no observed value; it is now skipped pre-query when terminally unhealthy. Firecrawl remained an extraction fallback. Provider marginal yield attribution is still incomplete.

## 19. Cost

Baseline Anthropic: $0.879282 observed across 47 calls. Three valid post-fix runs: $0.538269 across 30 calls. Search-provider cost was unavailable and is not invented. Post-fix Anthropic cost was about $0.108 per researched account and $0.179 per portfolio account; these ratios are not tier economics because no useful delivered opportunity resulted.

## 20. Latency

Baseline median 233,839 ms, max 352,687 ms. Post-fix valid subset median 196,989 ms, max 302,087 ms. Improvement is directional only; sample sizes differ and provider exhaustion interrupted completion.

## 21. Tier Value

Preview: VALUE PARTIAL with guided QA. Brief: VALUE WEAK until more than abstention is demonstrated. Portfolio: VALUE WEAK. Premium: unsupported by this acceptance evidence.

## 22. Escalation Policy

Skip terminal providers before queries; preserve deterministic fallback; never convert degraded coverage into confidence; require a dated material event for Timing; canonical Case owns action; do not deliver a Validate that fails admission.

## 23. Exa Decision

**EXA_BENCHMARK_RECOMMENDED** for a future isolated, budgeted recall comparison only. Integration is not justified by this sample and was not attempted.

## 24. SAM.gov / Data.gov

**DEFER.** No evidence that these sources address the current cross-vertical retrieval bottleneck enough to justify integration.

## 25. Tests

Focused acceptance: Event-First 39/39, productive spine 31/31, delivery gate 16/16, intelligence-v3 54/54, release candidate 31/31, lead-hunter universe 30/30. The full release sequence passed through all Intelligence, report, provider, security, admin and control-plane suites after one stale Control Plane expectation was updated to the measured 5/8 artifact. No scoring constant changed.

## 26. Typecheck

PASS (`npx tsc --noEmit`).

## 27. Build

PASS (`next build`, 160 static pages generated; expected edge-runtime static-generation warning only).

## 28. Security

PASS for tested scope: processing authorization 7/7, HTTP surface security 12/12, admin auth 48/48, admin login routing 58/58, demo safety 6/6, production isolation guards unchanged. No auth, RLS, tenant, secret, Billing, Landing, or Pricing code changed.

## 29. Remaining P0

1 — productive discovery recall is insufficient to demonstrate a customer-safe commercial opportunity in Track A.

## 30. Remaining P1

3 — provider exhaustion resilience, provider-level marginal-yield telemetry, and per-context runtime ceiling consistency.

## 31. Launch Blockers

No customer-visible positive case in productive Track A; USA candidate universe collapse; incomplete post-fix matrix due Anthropic exhaustion; remaining 3/8 positive-control misses.

## 32. Non-blocking Risks

Small sample, incomplete provider cost attribution, Tavily baseline ledger anomaly, geography variance, and reliance on guided QA.

## 33. Recommended Release Envelope

Founder-guided pilots only, USA + Colombia/South America, industrial automation and lean operations, explicit limited-coverage disclosure, manual dossier review, no self-serve SLA and no guaranteed opportunity count.

## 34. Next Intelligence Action

**FIX_NAMED_P0_OR_P1: improve productive USA candidate-universe recall using the existing Brave/Tavily routes, then rerun the same frozen six-context matrix.**

## 35. Git

Branch `intelligence-launch-acceptance-v1`; starting commit `c682c9f`; baseline `5c676f5`; canonical truth fix `7fbb765`; terminal-provider routing fix `bf09101`. Push and ending commit are reported after final verification. No merge.
