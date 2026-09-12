# Premium Differentiation V1 — technical contract

Premium = **Account Opportunity Intelligence + bounded commercial decision context**. It adds real
decision utility over Portfolio, never generic market research. Same Intelligence truth quality across
all tiers; higher tiers add breadth/depth/context, never "better truth".

## Capability allocation (Premium over Portfolio)
Deterministic (computed from the already-evaluated portfolio, zero COGS, always present for premium):
Advanced Portfolio Synthesis, Decision Pathways (conditional), up-to-5 Decision-Critical Briefs,
richer Executive Portfolio. Contact Rationale is available Preview-upward where evidence supports it —
NOT Premium-exclusive.

Research-backed context (bounded, fail-closed, present only where defensible evidence exists):
Commercial Benchmark (central), Relevant Competitor/Alternative Context, Additional Opportunity
Discovery, Embedded Ecosystem Intelligence.

Hard caps: benchmark 5 · competitors 5 · discovery 8 surfaced / 3 deep · ecosystem 4 · briefs 5.
Never fill maxima merely because capacity exists.

## Execution lifecycle (production)
`lib/intelligence/productive-spine.ts` → after canonical Account Intelligence is FINALIZED (never
before — cannot delay/corrupt it), premium runs only (`isPremiumEligible`, server-authoritative):
`deriveResearchInput` (from confirmed context + evaluated portfolio) → `producePremiumContext`
(`lib/intelligence/premium/premium-production.ts`) → live researcher
(`premium-context-researcher.ts`, providers + LLM) → doctrine gate (`assemblePremiumContext`) →
`PremiumContextEnvelopeV1` persisted INSIDE `report_json._premium_context`.

Delivery read: `getBriefForViewer` → `premiumContextFromEnvelope` → `deliverableForViewer` sets
`DeliveryDocumentV1.premiumContext` → `TierComposer` composes the premium section for the **premium
tier only** → web (`OpportunityWorkspace` "Decision context" tab) + PDF (`renderPdfBuffer`). CSV stays
the flat operational contract (unchanged across tiers).

## Persistence (Phase 1)
Additive, versioned, backward-compatible: `PremiumContextEnvelopeV1` lives in the existing report JSON
payload — **no migration**. Old/non-premium reports simply have none → fail-closed absence at delivery.
`premiumContextFromEnvelope` returns null for any non-`present` status, missing/malformed record, or
version mismatch (forward/backward safe).

## Failure semantics (fail-closed)
`producePremiumContext` NEVER throws. A premium-context failure (provider/LLM unavailable, COGS
ceiling, exception) yields an honest envelope (`unavailable`/`failed` + `failClosedReasons`) — the paid
canonical report ALWAYS completes. Zero-result is a valid, honest outcome, never filler.

## Idempotency / billing safety (Phase 3)
Research runs ONLY inside `runIntelligenceExecution`, which returns early for completed runs → retries
never re-spend. Delivery/export/workspace/PDF/CSV read the immutable snapshot and trigger zero
research/credit. One-time grants remain 18; Premium research consumes no extra Account Intelligence
credit.

## Cost governor (Phase 5) + COGS method
The researcher enforces a hard COGS ceiling ($8/order design stop) and STOPS (throws → caught →
`failed`) rather than overspend; target < $4/order. `estimatedUsd` = Anthropic list-price via the usage
ledger delta + provider-reported search cost (Brave/Serper report null → `measured:false`). It is a
list-price estimate, not a provider invoice. Measured live: ~$0.05–0.10/order.

## Latency
Independent searches run with bounded concurrency (`searchConcurrency`, default 3; never bursts
providers). Total latency is LLM-synthesis-dominated and variable (~78s clean single call; ~113s with
a JSON-repair retry). The search phase is concurrent but is not the bottleneck.

## Anti-hallucination
A contextual note survives only if it cites ≥1 REAL retrieved evidence index; evidence is built solely
from retrieved source objects, never model-invented URLs/dates. Ungrounded proposals are dropped at the
researcher and again at the gate.

## Freshness doctrine
180d (or capability-specific windows) gates TIME-SENSITIVE claims only (a stale "current movement" is
dropped — it is no longer current). Durable structural facts are RETAINED and age-flagged, never
treated as expired. One-time Premium never implies ongoing monitoring; "What Changed" requires a stored
prior state and is not part of a first one-time run.

## Truth boundaries (frozen)
Premium research is contextual: it informs presentation, synthesis and validation. It NEVER overrides a
canonical Account Decision (`prioritize|validate|monitor|hold`). Decision Pathways are conditional —
they describe blocking conditions, decision-critical unknowns, next validations, strengthening/weakening
conditions and possible transitions; they NEVER predict a transition. FACT/SIGNAL/INFERENCE/DECISION/
RECOMMENDED-VALIDATION are never collapsed. Canonical Fit/Timing/Evidence/thresholds/Materiality/Account
Memory/Monitor/What-Changed are untouched.

## Observability
`producePremiumContext` emits one sanitized structured log per run (status, capability generation,
capability counts, provider/llm calls, estimatedUsd, measured, latency, fail-closed reasons). No
provider names, URLs, raw output, or secrets.

## Tests
`premium-context` (gate), `premium-context-researcher` (live-logic, zero spend),
`premium-production` (envelope/eligibility/derivation/fail-closed), `premium-differentiation`
(deterministic architecture), `premium-delivery` (Golden Differentiation + lower-tier isolation).
Live: `scripts/accept-premium-context-live.mts` (spend-gated `PREMIUM_LIVE_ACCEPT=1`).
