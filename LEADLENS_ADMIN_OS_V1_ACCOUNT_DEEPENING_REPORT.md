# LeadLens Admin OS V1 Closeout + Account Deepening V1

## Status

PARTIAL. Admin OS V1 is production-wired. Account Deepening performs real, bounded company-specific retrieval and reaches the productive pipeline, but positive-event recall and customer-safe Case production are not yet validated.

## Admin closeout

- Migration 055: applied in live Supabase.
- Persistence: two material rows, RLS enabled, service-role only.
- Baseline: exactly one `control_plane_baseline_v1` row at readiness 39.
- Current material state: one `operational_snapshot` at readiness 49.
- Idempotency: evaluation-clock-only refresh produces the same fingerprint and no duplicate row.
- History: ordered reload works; 39 → 49 is an explicit material delta caused by correctly scoping worker auth, not by editing a score.
- Canonical current state: Intelligence Maturity 59/100 (confidence 0.566, n=24); Launch Readiness 49/100, `internal_pilot` (high confidence, n=1697).
- Old 21%: no active canonical formula or localStorage readiness remains. `delivery_score` survives only as explicitly labeled legacy delivery infrastructure.
- `INTERNAL_RUN_SECRET`: required for asynchronous customer processor; guided internal pilots remain available without it.

## Account deepening audit — resulting state

| # | Question | State | Evidence |
|---|---|---|---|
| 1 | Discovery triggers account Research | OPERATIONAL | Productive spine reloads durable universe, then pipeline Research. |
| 2 | New queries after Discovery | OPERATIONAL | `deepenAccountResearch` executes a fresh plan per shortlisted account. |
| 3 | Account-specific queries | OPERATIONAL | Canonical name/domain/geography in every accepted query. |
| 4 | Conditioned on commercial context | OPERATIONAL | Offer, target industries and buying signals compile the plan. |
| 5 | Beyond Discovery snippets | OPERATIONAL | New provider retrieval and bounded full-text extraction. |
| 6 | Seeks What Changed | OPERATIONAL | `current_activity` uses customer signal terms and temporal query mode. |
| 7 | Seeks primary sources | OPERATIONAL | Verified-domain `site:` routes; official source tier retained. |
| 8 | Seeks case-weakening evidence | OPERATIONAL | Mandatory bounded counterevidence stage. |
| 9 | Targeted corroboration | PARTIAL | Multi-domain evidence is measured; claim-derived follow-up exists in `research-quality-v1` but is not yet an extra productive query after a specific claim. |
| 10 | Origin-aware corroboration | PARTIAL | Canonical Monitor is origin-aware; initial deepening currently measures domains, not full origin lineage. |
| 11 | Identity revalidated | OPERATIONAL | `assessEvidenceCandidate` rejects wrong/ambiguous entities. |
| 12 | Static vs temporal | OPERATIONAL | Event-vs-metric/materiality/date gates; static pages cannot become Timing. |
| 13 | Evidence reaches canonical Case | OPERATIONAL | Enriched candidate enters qualification and `canonicalCaseForLead`; telemetry persists in `researchAudit`. |
| 14 | Fit/Timing/Evidence consume enriched research | OPERATIONAL | Same existing pipeline stages consume modified candidate/enrichment. |
| 15 | Compare uses enriched Cases | OPERATIONAL | Existing report/ranking path is unchanged downstream. |
| 16 | Adaptive depth | OPERATIONAL | Full text only for promising events; structured escalation only after deterministic failure. |
| 17 | Weak candidates stop early | OPERATIONAL | No-event accounts stop after mandatory counterevidence, before client/dossier depth. |
| 18 | Account-level cost observable | PARTIAL | Calls, failures, extraction and latency are durable; provider cost stays null where not reported. |

## Empirical result

- Prior bounded control: 0/8.
- Final strict diagnostic: 1/8, 62 provider calls, 14 full-text extractions, 185,475 ms, observed provider cost unavailable.
- Confirmed strict capture: Nestlé USA / Arvin distribution center, official page, event date 2026-06-10.
- Not captured strictly: Conagra, Quad, voestalpine, Hitachi Energy, Deere, UFP, Mondi. Several correct primary pages were retrieved, but the event/date pair did not clear the same-source temporal gate. They remain false negatives, not rescued positives.
- Productive autonomous E2E artifact: `customer-e2e-1787866586088.json`; 15/15 checks, universe 15, researched 3, delivered 0, human-positive 0.
- E2E cost: Anthropic 14 calls, 36,740 input tokens, 15,051 output tokens, observed calculated cost USD 0.335985. Brave 30 successful calls; Tavily 30 successful; 16 Serper failures exposed and subsequently removed from Account Deepening routing.
- E2E latency: 501,814 ms total; 483,904 ms background.

## Truth regression

- Wrong entity: fail-closed evidence assessment retained.
- False What Changed: event date comes only from event text/anchored explicit relative language, never retrieval time.
- Unsupported Timing: no dated material event means no canonical positive Case.
- Duplicate-origin corroboration: Monitor remains origin-aware; initial deepening does not claim independent corroboration from provider duplication.
- Raw LLM Evidence: structured output only proposes; deterministic gates decide.
- Forced Prioritize: zero accounts delivered in the autonomous run; ranking/selector/scorer unchanged.

## Verdicts

`ADMIN OPERATING SYSTEM V1 PRODUCTION-WIRED`

`ACCOUNT DEEPENING V1 OPERATIONAL BUT RECALL NOT YET VALIDATED`

Self-serve impact: PARTIAL. The productive path and observability improved, but canonical readiness remains 49/internal pilot because positive customer-safe Cases remain n=0, strict recall is 1/8, runtime exceeds ceiling and worker auth is absent.
