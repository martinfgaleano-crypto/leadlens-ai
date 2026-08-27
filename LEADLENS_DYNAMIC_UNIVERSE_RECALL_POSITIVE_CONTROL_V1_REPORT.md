# LeadLens Dynamic Universe Recall + Positive-Control Evidence V1

## 1. Git

- Baseline HEAD verified before work: `c0e36ffc3dcec85ea7106bee835c58ecff7f17ea` on `main`.
- `origin/main` was `64a74fff` at audit start.
- This sprint intentionally does not push.
- Local operational ledgers and unrelated pre-existing audit files were excluded from the sprint commit.

## 2. Soak Failure Diagnosis

The Production Soak V1 completed 10/10 runs but researched only 22 accounts and delivered no Case. Its overall human-rated structural precision was 12/22 (54.5%); Phase D improved to 7/9 (77.8%). Sparse US universes (1–3 accounts) occurred in broad accounting, fleet, industrial-distribution, and enterprise-operations contexts. The dominant discovery failures were target-family dilution, identity ambiguity, wrong geography, generic event-adjacent enumeration, wrong vertical-pack selection, and useful list pages whose organizations were never extracted.

Of the 10/22 wasted research accounts, the baseline audit classified 6 as wrong target family/operating model, 3 as identity failures, and 1 as wrong geography. These are discovery-stage failures, not Research shortcomings.

## 3. Selected Verticals

Exactly two supported US families were used:

1. Industrial/manufacturing automation software for owned plants.
2. Warehouse automation/WMS/inventory orchestration for owned warehouses and distribution operations.

Each had three target contexts. No company name was supplied to the productive runner.

## 4. Current Discovery Architecture

The productive route remains confirmed context → `planDiscovery` → LeadSearchCriteria/ICP → `runCompanyFirstDiscovery` → dynamic company universe → durable Candidate Account Universe → bounded Research → canonical Case. Pack candidates remain fallback assistance, not authoritative eligibility.

The audit found that route semantics existed in the plan but were collapsed by the default runner into generic discovery. `organizationTypes` were also lost between plan and criteria/ICP. Both defects reduced structural recall and permitted semantic drift.

## 5. Target-Family Preservation

`criteriaFromPlan` and `icpFromPlan` now preserve both organization types and industries. Enumeration queries repeat the confirmed target family, geography, and material operational qualifier. A manufacturer-only context no longer silently broadens to any company with a warehouse. Explicit exclusions and deterministic qualification remain authoritative.

## 6. Dynamic Enumeration

The engine now performs organization enumeration before event discovery using five bounded queries across `industry_category`, `geo_category`, and `source_ecosystem`. It records route, query, provider, raw names, grounded names, accepted companies, and identity-expansion calls.

Two direct real-provider audits demonstrate autonomous enumeration without account seeds:

- Industrial food manufacturing: 16 raw names → 5 verified companies after geography/category rejection and bounded official-domain resolution.
- Industrial distribution: 24 raw names → 13 accepted companies after geography, duplicate, and multi-company-page rejection.

In these two bounded samples, accepted names came from the industry route; source-ecosystem and geo-category routes contributed zero accepted names. Dynamic enumeration improved, but route diversity is not yet validated.

## 7. Vertical Pack Role

Pack matching is assistive. A warehouse/WMS offer can no longer select the wellness-channel pack merely because the target text contains beverage terms. No pack may override explicit objective or target-family mismatch. In the final US runs, the selected contexts were handled as dynamic discovery; no manually seeded winner was injected.

## 8. Source Ecosystem

The source-ecosystem route is now independently observable and its pages retain provenance. In the bounded audits it yielded no accepted company, so it is not credited with recall improvement. A source that discovers a company is never promoted to customer Evidence merely because it was useful for enumeration.

## 9. Entity Extraction

Bounded structured extraction may propose names from multi-company list pages only when every distinctive company token is present in the retrieved title/snippet. Deterministic identity and eligibility remain authoritative. Invented or ungrounded LLM names are rejected. Publisher names are rejected as accounts.

Official-domain expansion is limited to six unresolved autonomously discovered candidates and one healthy provider, within the global universe budget. Generic industry tokens such as “packaging”, “paper”, “food”, and “distribution” cannot assign another company’s domain.

## 10. Coverage Gaps

- Source-ecosystem and geo-category routes produced no accepted accounts in direct audits.
- Several industrial distributors were correctly enumerated but remained domainless, preventing Research readiness.
- Consumer-goods warehouse automation returned an empty productive universe.
- Event Research failed to recover obvious current primary-source events even when the account universe contained plausible manufacturers.
- Coverage is reported as bounded observation, never as the full market.

## 11. Candidate Quality Gate

Across the six final runs, 34 universe entries produced 10 researched accounts. Human labels:

- Strict structural `yes`: 7/10 (70%).
- Structurally reasonable including `borderline`: 9/10 (90%).
- Wrong target: 1/10 (10%).
- Defensible research outcomes: 0/10.

Thus the controlled pre-Research threshold passes only when the two explicitly borderline cases are included. Strict structural precision remains below 75%. Identity, source, Timing, materiality, and Case delivery gates were not relaxed.

## 12. Positive-Control Design

Six productive, real-provider runs were executed: three industrial-automation contexts (food/beverage, packaging, industrial equipment) and three warehouse-automation contexts (industrial distribution, food/beverage, consumer goods). Each used a commercial context, not account names. Research remained ≤3 accounts/run, below the ≤5 bound.

## 13. Run Results

| Vertical/context | Universe | Researched | Delivered | Human positive | Calls | Anthropic cost | Runtime |
|---|---:|---:|---:|---:|---:|---:|---:|
| Industrial / food-beverage | 8 | 3 | 0 | 0 | 24 | $0.167376 | 246.1s |
| Industrial / packaging | 8 | 3 | 0 | 0 | 41 | $0.177192 | 304.9s |
| Industrial / equipment | 9 | 2 | 0 | 0 | 39 | $0.132138 | 212.7s |
| Warehouse / industrial distribution | 5 | 0 | 0 | 0 | 24 | $0.000000 | 84.4s |
| Warehouse / food-beverage | 4 | 2 | 0 | 0 | 20 | $0.126870 | 187.7s |
| Warehouse / consumer goods | 0 | 0 | 0 | 0 | 10 | $0.058575 | 38.4s |

All six final outcomes were honest zero-result runs. There was no customer-facing false positive.

## 14. Human Labels

| Account | Identity | Target | Structural value | Research outcome | Human decision |
|---|---|---|---|---|---|
| Tropical Bottling | correct | strong | yes | not defensible | Hold |
| A.I. Foods | correct | plausible | yes | not defensible; wrong-company evidence | Reject |
| AAA Foods | weak | weak | no | not defensible | Reject |
| American Packaging | correct | strong | yes | not defensible; Sonoco evidence | Reject |
| International Paper | correct | strong | yes | borderline | Hold |
| Pratt Industries | correct | strong | yes | not defensible after fix | Hold |
| Koch Enterprises | correct | plausible | borderline | not defensible | Hold |
| Veeco Instruments | correct | strong | yes | borderline | Monitor |
| Hormel | correct | strong | yes | not defensible | Hold |
| United Citrus | correct | plausible | borderline | not defensible | Hold |

The full rationales and system fields are persisted in `ml/data/acceptance/dynamic-universe-recall-v1.json`.

## 15. Positive Cases

None. `n=0` human-confirmed positive Cases. Outcome precision is therefore not claimed.

## 16. Missed Opportunity Audit

A bounded independent primary-source audit identified at least eight plausible recent events in the selected markets: Nestlé USA’s Arvin distribution center; Conagra’s Fayetteville expansion; Quad’s Salt Lake packaging facility; voestalpine’s Indiana facility; Hitachi Energy’s South Boston expansion; Deere’s new factory/distribution center; UFP’s South Carolina packaging facility; and Mondi’s Pittsburgh automated packaging plant.

Pratt was autonomously enumerated, but the first apparent positive used a BuiltIn profile explicitly generated from LLM responses and not reviewed by Pratt. That was a false Evidence source. The new reference-information veto suppressed it in the final rerun. Public Pratt corporate expansion pages exist, but the productive run did not retrieve and ground them.

The dominant missed-opportunity class is therefore no longer “cannot name plausible companies”; it is “cannot reliably connect enumerated accounts to current primary, dated, material event pages.”

## 17. Capture Proxy

Bounded positive-control capture: 0/8 (0%). This is an evaluation reference set, not global recall. It demonstrates that event/source routing remains insufficient despite better account enumeration.

## 18. Provider Calls

Across six runs: 158 calls, 26.3/run average. Breakdown: Anthropic 42, Brave 72, Tavily 43, Serper 1. Search-provider calls were 116, or 19.3/run. This remains close to the soak economics and below the controlled ≤35 total-call target on average, although two individual runs reached 39 and 41 due to sufficiency escalation. Persisted provider cooldown prevents repeated Serper attempts; the single observed Serper call occurred before the cooldown state was established.

## 19. LLM Economics

Observed Anthropic cost was $0.662151 total, $0.110359/run average. No unobserved provider cost is invented. The six-run total duration was 1,074.2 seconds.

## 20. Full-Text Metrics

Existing monitor full-text extraction has structured metrics and deterministic tests. The completed productive acceptance artifacts did not persist full-text candidates, fetch attempts/successes, structured extractions, or accepted events. Those values are reported as unavailable, not zero. The acceptance harness now persists the durable universe `CoverageSummary`, route yield, gaps, and candidate provenance for future runs. Full-text telemetry still needs to be surfaced from Research into the durable run artifact.

## 21. Latency

Average runtime was 179.0s; observed max/p95 in this six-run bounded sample was 304.9s, essentially unchanged from the 311.8s soak p95. Stage A plus sequential discovery/Research dominated. No broad parallel fan-out was introduced because provider budgets and shared usage accounting require a separate concurrency safety proof.

## 22. Truth Regression

- Wrong entity delivered Evidence: 0 delivered; two wrong-account evidence associations were held/rejected during Research QA.
- False What Changed: 0 delivered.
- Unsupported Timing: 0 delivered. AI-generated reference profiles now classify as `reference_information` and cannot trigger Timing.
- Forced Prioritize: 0.
- Discovery provenance promoted to Evidence: 0.

## 23. Tests

The new focused harness covers target-family preservation, organization enumeration, grounding, publisher rejection, dedupe, route yield, provider degradation, provenance separation, provider budget, pack mismatch, domain-collision regressions, and AI-reference Timing. TypeScript and the relevant Lead Hunter/company-universe regressions pass. Final full regression and build results are recorded at handoff.

## 24. Production Verdict

**DYNAMIC UNIVERSE RECALL V1 IMPROVED BUT NOT YET VALIDATED**

Status: **PARTIAL**.

The universe is materially broader and more structurally relevant without a customer-facing truth regression, but no human-defensible positive Case was produced. Recall is therefore not solved.

## 25. Maturity

- Core intelligence: 78%. Company enumeration and truth gates are strong; productive event capture is unvalidated.
- Operational: 73%. Durable runs and bounded budgets work; full-text telemetry and p95 remain gaps.
- Limited self-serve readiness: 58%. Honest zero results work, but positive opportunity capture is not demonstrated.
- Paid launch readiness: 42%. `n=0` defendable Cases prevents a paid-launch claim.
- Autonomy: 64%. Account enumeration is autonomous; current-event evidence still needs bounded primary-source routing.

## 26. Remaining Gap

The smallest evidenced gap is a bounded official-domain/newsroom event route after identity confirmation: search the already enumerated company’s corporate newsroom/investor site for dated, material change terms, then escalate only promising pages to full text. It must retain global call budgets and source-quality gates. This is narrower than another universe heuristic and directly addresses the 0/8 capture proxy.

## 27. Next Move

Implement and evaluate **TARGETED PRIMARY-SOURCE EVENT RETRIEVAL V1** against the same eight bounded references. Require at least one human-defensible Case, retain ≥75% structurally reasonable Research-ready accounts and ≤10% wrong-target rate, and persist full-text funnel telemetry. Do not expand provider fan-out or weaken canonical qualification.
