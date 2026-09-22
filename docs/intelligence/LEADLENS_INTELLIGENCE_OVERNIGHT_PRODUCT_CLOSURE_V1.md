# LeadLens — Intelligence Overnight Product Closure V1

Scope: convert accumulated Intelligence work into commercial readiness across five workstreams
(integration, runtime, Preview, US Brief envelope, higher tiers). **No product code changed this session**
— it is verification + bounded live acceptance. States: IMPLEMENTED · DETERMINISTICALLY_VERIFIED ·
LIVE_OBSERVED · FULL_ORDER_ACCEPTED · PRODUCTION_DEPLOYED · PAID_CUSTOMER_VERIFIED.

## Repository truth
Branch `intelligence-launch-acceptance-v1` · HEAD `9d0d470` → `<this doc>` · origin/main `c682c9f` (31
ahead / 0 behind) · tree clean · backups `intel-backup-bd455e9-20260921`, `intel-backup-f6ade2e-20260921`.
Push: NO · Merge: NO.

## Workstream A — Integration (READY FOR PR)
67 files vs main: 23 docs, 17 scripts, 13 lib (Intelligence), 11 ml (acceptance artifacts), 2 app (the two
runner-injection wirings), 1 `vercel.json` (recover cron). **Sensitive-area scan: only `vercel.json`** — NO
billing / migrations / schema / pricing / landing (`app/page`) / `.env` / entitlement changes. Secret scan:
only env-var NAMES in docs, no literal secrets. Feature flag `VAULT_REUSE_MODE` default OFF preserved.
**Status: READY FOR PR** (cannot push — guard hook + standing policy; founder opens PR from the branch).

## Workstream B — Production runtime / recovery
- RECOVERY CODE: **PASS** (intelligence-run-recovery 19/19).
- RECOVERY LIVE ACCEPTANCE: **PASS** (accept-run-recovery 10/10 this cycle: stranded → RESUMED+COMPLETED,
  gen fenced 1→2, exactly-once, customer-loadable, second wake no-op).
- CRON CONFIGURATION: **PASS** (`vercel.json` `/api/internal/intelligence-runs/recover` `*/15`; route accepts
  Bearer CRON_SECRET + GET).
- PRODUCTION DEPLOYMENT: **NOT VERIFIED** (branch unpushed).
- PRODUCTION CRON EXECUTION: **NOT VERIFIED** — needs `CRON_SECRET` + `INTERNAL_RUN_SECRET` in Vercel prod
  (both absent locally = production-only) + a deploy.
- PAID-CREDIT SAFETY: **PASS** (one-time-fulfillment 32, monitor-recurring-usage 12; recovery exactly-once;
  charge-at-materialization excludes failures; no billing code changed). Note: the acceptance harness uses
  unmetered disposable users, so the *entitlement cap* itself is exercised by the metering suites, not the e2e.

## Workstream C — Preview commercial acceptance (LIVE_OBSERVED)
Colombia Preview (plan `sample`, warehouse-automation context): real pipeline → **3 valid Colombian companies**
(Coca-Cola FEMSA, WEG, Logisfashion), 16/16 harness checks, ~$0.2 Anthropic, ~290 s. **Caveat**: the unmetered
disposable user delivers `researchLimit` (3), not the paid 2-cap — in production a 2-credit Preview entitlement
caps materialization to 2 via account-metering (tested separately). So Preview **quality/relevance is PASS**;
the exact 2-company cap is entitlement-enforced, **not exercised** by this unmetered harness. USA Preview not
separately run (trivially satisfiable — the reused lane reliably yields ≥2 US manufacturers).

## Workstream D — US Brief release envelope (LIVE_OBSERVED)
- Strict industrial-automation ICP (historical): **5/6 valid, 0 off-target**.
- NEW frozen context this session — US WMS/warehouse-automation seller → manufacturers + distributors + 3PLs
  with owned DCs/plants (a legitimate broader ICP, target families [manufacturer, distributor, logistics,
  retailer]): qualified **12** (wrong-target 1), 10 researched → **5 delivered, ALL on-target, 0 off-target**:
  **Burris Logistics (HOT 8.2)**, Capstone Logistics (WARM), BellRing (food mfr, COLD), Across International
  (COLD), Logos Logistics (COLD). 16/16 checks, $0.527 Anthropic, **runtime 962 s**.
- **Finding**: even with ample qualified supply (12), US delivers **5 valid**, because ~half of researched
  accounts DISCARD in Deep Research (e.g. Aras/software). The US ceiling of **5 valid on-target** is now
  DISCARD-rate-limited, not qualification-supply-limited. The operating-role fix holds (0 off-target across
  contexts). Per the one-new-context rule, Workstream D stops at this evidence.

## Workstream E — Portfolio / Premium readiness (audit)
WIRED + DETERMINISTICALLY_VERIFIED, **NOT FULL_ORDER_ACCEPTED**: plan mapping `standard`=12 / `pro`=18; premium
context `isPremiumEligible → producePremiumContext → report._premium_context` (fail-closed); tier-differentiation
38, premium-production 18, premium-context-researcher 20 green. **Not run live** (§43/§50): a 12/18-company order
would (a) under-deliver given the ~5 US valid-supply ceiling, and (b) run 20-40+ min (a Brief already hit 962 s)
→ heavily recovery-dependent and unverified in prod. Blockers: valid-supply ceiling + long-order runtime.

## Runtime concern (surfaced)
Brief research runs are lengthening (US WMS **962 s**), far past the process route `maxDuration=300 s`.
Production completion depends entirely on the recover cron (configured, not deployed). This is the single most
important operational gate before any 12/18-company tier is offered.

## Commercial quality (independent review)
Identity/geography correct; target relevance on-target across contexts (0 off-target after the operating-role
fix); a real HOT opportunity surfaced (Burris Logistics 8.2); decisions canonical; internal WARM/COLD is
scoring, not the customer decision layer. Customer value: the deliverables distinguish stronger/weaker accounts
and are on-target; the gap to full commercial value is COUNT (5 vs 6) and higher-tier scope, not relevance.

## Tests / gates
release:check EXIT 0 (prior; no code changed this session) · vault-reuse-qualification 44, integration 15,
config 16, identity 22, wiring 7, lead-hunter-universe 30, run-recovery 19, one-time-fulfillment 32,
monitor-recurring 12, tier-differentiation 38, premium-production 18, premium-context-researcher 20 · Track B 7/8.

## Accepted vs unaccepted
- **Accepted (LIVE_OBSERVED):** Colombia Brief 6/6 (prior); US Brief 5/6 valid 0 off-target (two ICPs);
  Preview quality; recovery cycle 10/10.
- **Not accepted:** US Brief clean 6/6; Preview exact 2-cap in an unmetered harness; Portfolio/Premium
  full orders; production cron execution.

## Remaining blockers (top 3)
1. **US valid-supply ceiling ≈5** (DISCARD-rate-limited) — a clean 6/6 US Brief and 12/18 tiers are supply-
   constrained; needs either broader on-target supply or accepting the honest count.
2. **Long-order runtime (≈600-960 s)** completing only via the recover cron, which is **not yet deployed**
   (founder env: `CRON_SECRET` + `INTERNAL_RUN_SECRET` in Vercel prod + a deploy).
3. **Higher tiers unaccepted**: Portfolio/Premium wired + unit-verified but no full-order live acceptance.

## Next founder action (ONE)
Deploy the Intelligence branch to a preview/prod environment with `CRON_SECRET` + `INTERNAL_RUN_SECRET` set, so
the recover cron can be verified executing — this unblocks long-order (Brief/Portfolio/Premium) production
completion, the highest-leverage remaining gate. (Branch is READY FOR PR; open the PR from
`intelligence-launch-acceptance-v1`.) Do not globally enable `VAULT_REUSE_MODE`.
