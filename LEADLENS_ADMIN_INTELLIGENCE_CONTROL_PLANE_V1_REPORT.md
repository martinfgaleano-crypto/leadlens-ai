# LeadLens Admin Intelligence Control Plane V1

## Executive verdict

Admin Intelligence now has an automatic, evidence-driven capability control plane. It registers 47 canonical capabilities once, evaluates nine maturity dimensions independently, gives live/acceptance evidence precedence over implementation and tests, retains sample sizes and confidence, and can move scores both up and down.

Current local-acceptance result: **59/100**, medium confidence, 22/47 capabilities with enough multidimensional evidence to score. This score is capped by the latest empirical truth: zero human-defensible Cases and a 0/8 bounded capture proxy. Eight capabilities are degraded. No production-readiness claim is created by the new UI.

## Audit: what was real

- `os-contracts-v1` already prevented scores on unmeasured values and separated implementation, evidence, outputs, validation and readiness.
- `snapshot-methodology-v1` already assembled provider-free deterministic snapshots from artifacts and optional database rows.
- The Command Center already had Admin auth, private/no-store delivery, capability assessments, evidence, gaps, actions, readiness, feedback and validation lifecycle.
- Growth Index used real database counts and kept decision performance null below its sample floor.
- Provider Health, source review, source access, Monitor metrics, Candidate Universe coverage and usage ledgers existed on separate surfaces.

## Audit: what could become stale

- The overview embedded Amor de Gea counts and blocker text directly in the React page.
- The legacy capability inventory covered roughly half the current productive Intelligence spine and used a manually assembled `CapSpec[]` list.
- Implementation/exercised status could dominate capability presentation even when later live evidence contradicted quality.
- Dynamic Universe’s latest 0/8 capture result was absent from the Admin maturity computation.
- Runtime p95 and provider-call economics were not first-class capability dimensions.
- Capability registration required updating multiple UI/engine locations.
- Historical trend persistence remains uninstrumented; the UI correctly says so.

## Canonical registry

`lib/intelligence/capability-control-plane.ts` registers 47 non-duplicated capabilities across:

- context;
- discovery;
- research;
- reasoning;
- monitor;
- operations;
- coverage;
- learning;
- readiness.

The registry contains metadata, dependencies, snapshot aliases and implementation evidence. It deliberately contains no score. The UI and API iterate the registry; they do not maintain a second feature list.

## State model

Canonical states:

- `not_started`;
- `implemented`;
- `domain_proven`;
- `production_wired`;
- `live_validated`;
- `soak_validated`;
- `degraded`;
- `blocked`.

Implementation never implies operational validation. Scheduler infrastructure remains implemented while cron is OFF. ML remains shadow/observation-only.

## Maturity dimensions

Every capability exposes:

1. implementation;
2. integration;
3. correctness;
4. real-world validation;
5. reliability;
6. quality;
7. observability;
8. economics;
9. autonomy.

A capability score requires at least three measured dimensions. Missing measurements stay `insufficient_evidence`, never zero and never fabricated.

## Evidence hierarchy

1. Real live/production observations.
2. Repeated controlled soak.
3. Live acceptance.
4. Deterministic integration tests.
5. Unit/domain tests.
6. Implementation presence.

The latest real evidence overrides lower evidence. Consequently, passing discovery tests cannot hide the 0/8 capture result.

## Bidirectional scoring

The deterministic acceptance harness proves:

- 0/8 capture degrades Dynamic Universe despite a 95/100 legacy test assessment;
- raising bounded capture raises its score automatically;
- p95 304.9 seconds lowers runtime reliability;
- lowering p95 to 180 seconds raises the same capability;
- provider failures lower observed routing reliability;
- no human-positive Case caps the overall score at 59;
- zero denominator never displays 100% precision.

## Current capability result

From `ml/data/acceptance/admin-intelligence-control-plane-v1.json`:

- Overall: 59/100.
- Confidence: medium.
- Scored capabilities: 22.
- Implemented: 27.
- Production wired: 9.
- Live validated: 0.
- Soak validated: 3.
- Degraded: 8.
- Blocked: 0.

Primary evidence-driven blockers:

- no human-defensible positive Case; 0/8 capture proxy;
- runtime p95/max 304,912 ms above the 300,000 ms ceiling.

## Runtime and provider telemetry

The control plane consumes the existing usage ledger without exposing secrets. It maps:

- calls today;
- errors today;
- observed calculated cost;
- recent provider failures;
- failure rate;
- cooldown activation.

The six-run acceptance artifact contributes provider calls, average calls/run, observed Anthropic cost and runtime. Unknown costs remain unknown.

## UI changes

- Command Center hero now displays authoritative control-plane maturity instead of the older snapshot average.
- New `Control Plane` tab lists all canonical capabilities.
- Filters by domain and state.
- Each capability exposes all nine dimensions, confidence, `n`, supporting metrics, blockers and evidence freshness.
- Legacy capability view remains available and clearly labeled.
- Hardcoded Amor de Gea metrics were removed; only a link to its canonical workspace remains.
- Existing Admin auth and private/no-store API behavior remain unchanged.

## Automatic update behavior

The Command Center updates when its existing evidence sources change:

- acceptance artifacts;
- soak artifacts;
- snapshot capability assessments;
- Signal Temporal artifacts;
- Account Memory counts;
- validation lifecycle/outcomes;
- opportunity feedback;
- provider usage ledger.

No UI score edit is required. New capabilities require one registry registration and an evaluator only when they introduce new evidence semantics.

## Known gaps

- Runtime/acceptance artifacts are local files; a cross-deployment historical telemetry store is not yet present.
- Full-text metrics are tested but not fully persisted by productive Research acceptance artifacts.
- Monitor’s repeated zero-false-novelty evidence is available in controlled artifacts/tests, but no canonical persisted production aggregate exists yet.
- Trends remain explicitly uninstrumented.
- Database-backed production sampling was not added through a migration in this sprint.

## Production posture

- Admin control plane: ready for internal operational use.
- Intelligence quality: not launch validated.
- Self-serve: still not ready.
- Cron: OFF.
- Ranking/selector: unchanged.
- Migration: none.

## Next move

Persist a compact capability telemetry event/snapshot after each productive Intelligence and Monitor run, using the same evaluation contract. This should replace local-artifact dependence for historical trends without changing ranking or quality gates.
