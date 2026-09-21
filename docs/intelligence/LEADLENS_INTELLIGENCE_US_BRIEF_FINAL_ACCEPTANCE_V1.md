# LeadLens — US Brief Final Qualification Acceptance V1

Verdict: **US Brief = PARTIAL (5 valid / 6, ZERO off-target). The authorized operating-role correction
succeeded** — it eliminated the DHL-type wrong-target admission (precision fixed) — **but a clean 6/6 was not
reached: the strict US industrial-automation ICP + current supply yields ~5 genuinely relevant manufacturers.**
Per the mandatory stop rule (fewer than 6 valid, one correction used), implementation stops here; the count
gap is an HQ decision. Builds on `LEADLENS_INTELLIGENCE_US_BRIEF_RUNTIME_CLOSURE_V1.md`.

## Repository
Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2`. Start HEAD `f6ade2e` → end
`6d8d66e` (+ this doc). Backups: `intel-backup-bd455e9-20260921`, `intel-backup-f6ade2e-20260921`. origin/main
`c682c9f` (0 behind). Push: NO · Merge: NO · tree clean. 29 prior commits preserved; V2/Brief-V1/runtime intact.

## Qualification root cause (DHL)
DHL Supply Chain (a 3PL) qualified as a manufacturer because `families(content)` matched the "manufacturing"
keyword in its content — which appears because DHL **serves** manufacturers, not because it **is** one
("customers served" / "facilities operated for third parties" confused with the company's own role). The
downstream decision engine scored it COLD but did not correct the upstream target-qualification error.

## Correction (ONE, generalizable, context-dependent)
`qualifyFromEvidence` now applies an operating-role guard: when the content shows a clear **self service-
provider role in a family the customer is NOT targeting** (`conflictingServiceRole`: logistics/software/
distributor/consulting) **and** there is **no self-operational evidence** for the matched target family
(`hasSelfOperationEvidence`: "manufacturer of / we manufacture / our production plant"), the match is treated
as "serves the target, is not the target" → `REJECTED_WRONG_TARGET_TYPE`. No company-name blacklist; no global
manufacturer-only rule; context-dependent (a logistics-targeting ICP still qualifies logistics); genuine
manufacturers that also distribute still qualify. Files: `lib/lead-hunter/vault-reuse-qualification.ts` (+ test).
Adaptive-qualification budget & deterministic ordering from the prior sprint preserved (caps NOT raised).

## Regression (vault-reuse-qualification 44/44)
CASE A genuine manufacturer → QUALIFIED · B 3PL serving manufacturers (DHL pattern) → REJECTED · C software
serving manufacturers → REJECTED · D manufacturer that also distributes → QUALIFIED · E ambiguous logistics-
provider, no self-mfg evidence → not auto-qualified · F logistics company under a logistics-targeting ICP →
QUALIFIED (not globally excluded). Colombia non-regression: the guard is context-dependent and CO fresh is
sufficient (gate closed → qualification never runs), so CO is structurally unaffected; CASE F + green fixtures
confirm no valid-type exclusion. Costly CO Brief not re-run (no material shared-risk, per §16).

## Productive US Brief (frozen industrial-automation context, plan `starter`, ELIGIBLE_FALLBACK) — LIVE_OBSERVED
First attempt hit a transient infra outage mid-run (Anthropic `Connection error` + Supabase DNS
`ENOTFOUND` → save/reload failed, 8/15 checks) — an OPERATIONAL failure, not a code/commercial result; the
qualification fix still fired (wrong-target 9, DHL rejected). Connectivity verified recovered, re-run once:
- Universe 41 (1 fresh + 40 reused). Qualification: attempted 18, **qualified 6**, wrong-target **8** (DHL +
  logistics/software rejected pre-research), non-company 3, unresolved 1, ops-blocked 0.
- 7 research-ready → 7 researched → Oracle & Aras (software) → DISCARD (correctly) → **5 delivered, all genuine
  manufacturers, ZERO off-target**:

| Company | origin | decision(internal) | manufacturing | valid |
|---|---|---|---|---|
| American Packaging Corporation | reused | WARM 7.5 | packaging manufacturer | ✅ |
| Diageo | reused | WARM 7.8 | beverage manufacturer | ✅ |
| Coherent Corp. | reused | WARM 6.8 | photonics/laser manufacturer | ✅ |
| Compact Industries, Inc. | reused | WARM 6.5 | contract manufacturer | ✅ |
| Across International | reused | COLD 4.5 | lab/industrial equipment maker | ✅ |

16/16 harness checks. COGS **$0.567** Anthropic (24 calls), Tavily 37, 0 errors. Runtime 488 s.

## Before / after
Valid delivered: 5 → **5** (unchanged) · Off-target admitted: **1 (DHL) → 0** · Delivered count: 6 → 5 · False
admissions: DHL eliminated · False rejections: none observed (genuine manufacturers preserved; CASES A/D pass).
The correction improved **precision** (removed the irrelevant company) but did not raise the valid COUNT to 6.

## Why not 6 valid
Clean-manufacturer supply for this exact strict ICP is ~5: fresh discovery ≈ 1, and qualified-reused clean
manufacturers ≈ 4-5 after software candidates (Oracle/Aras) DISCARD downstream. The prior "6 delivered"
included the off-target DHL as the 6th; removing it correctly leaves 5. A 6th CLEAN manufacturer is not
reliably available from the current Vault + fresh discovery for this narrow definition. This is the exact
limiting stage: **relevant-manufacturer SUPPLY**, not a qualification bug or runtime issue.

## Runtime
Recovery mechanism: LIVE-TESTED (accept-run-recovery 10/10 prior sprint) · Cron: CONFIGURED (`vercel.json`
`*/15`) · Production deployment: NOT DEPLOYED (branch unpushed) · Production recovery: NOT VERIFIED (needs
deploy + `CRON_SECRET`/`INTERNAL_RUN_SECRET`). Unchanged this sprint.

## Vault feature flag
Production default `VAULT_REUSE_MODE=OFF`. US Brief depends on `ELIGIBLE_FALLBACK` (thin fresh). Prod OFF would
not reproduce it. Rollout is HQ's decision; not activated.

## Tests / gates
release:check **EXIT 0** · git diff --check clean · vault-reuse-qualification 44, integration 15, config 16,
identity 22, wiring 7, lead-hunter-universe 30 · Track B 7/8 preserved.

## Remaining limitations (top 3)
1. **Relevant-manufacturer supply ≈ 5** for this strict US ICP → a clean 6/6 is not reliably deliverable
   without broadening the ICP or growing manufacturer supply (both out of scope / HQ).
2. **Software candidates (Oracle/Aras) still qualify** then DISCARD downstream — harmless to delivery but
   wastes a research slot; a future software-role tightening could free supply (not attempted — one-correction
   rule).
3. **Production runtime is deploy-pending**: recovery proven + scheduled in config, but not verified on a live
   deployment.

## Next action (ONE — HQ decision)
Choose the US Brief envelope: (a) **accept a broader but still-defensible US ICP** (e.g. "manufacturers OR
industrial producers", or manufacturing + adjacent industrial operators) so clean supply reaches 6 — a
commercial-definition decision, not an engineering relaxation; or (b) **ship the US Brief at its honest supply
(5 high-quality, on-target manufacturers)** for this narrow ICP and prepare the branch PR. Do not pad with
off-target companies; do not raise caps; do not expand the Vault.
