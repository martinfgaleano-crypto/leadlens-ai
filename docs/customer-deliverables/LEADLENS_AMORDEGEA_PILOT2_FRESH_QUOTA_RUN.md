# Amor de Gea Pilot 2 — Fresh-Quota Research Run (ready-to-execute)

Everything downstream is built: the context→interpretation bridge, the structured route/dependency data,
the Admin workspace, the intake, the feedback/context persistence (migration 065, apply to activate), the
V2.4 tier composer + renderer, and the integrity tests. **The only remaining input is candidate supply**,
which is gated on **fresh provider quota** (same-day chained runs get starved: discovery is skipped and only
2 candidates surfaced → 1 qualified).

## Budget (cumulative, do not reset)
- Ceiling **$20** total for the Pilot 2 continuation. **Spent so far: $0.19.** Remaining headroom ≈ $19.8.
- Target ≤ $12; stop early once 18 genuinely qualify with route coverage, or when more spend can't improve the tier (§37).

## Run it on a FRESH quota window (first run of the day)
Node 24 required. Vault reuse OFF for the US (fresh discovery). ≤600-char context (the interpret cap):

```bash
cd /Users/martingaleano/leadlens-landing-v2 && PATH="/usr/local/bin:$PATH" \
LEADLENS_ACCEPTANCE_PLAN=pro \
LEADLENS_ACCEPTANCE_LOCALE=en \
LEADLENS_ACCEPTANCE_KEEP=1 \
LEADLENS_RENDER_OUT=/tmp/pilot2 \
LEADLENS_ACCEPTANCE_CONTEXT="Amor de Gea, a Colombian maker of premium botanical wellness beverages in glass bottles, wants to export from Colombia to the United States. We seek US B2B accounts that could carry or distribute the product: premium natural and specialty food and beverage retailers, wellness hotels and spas, premium gifting companies, and specialty importers of premium natural brands. Exclude mass-market discount retailers, pharmacy and medical channels, and pure online marketplaces with no buyer." \
npx -y tsx --tsconfig tsconfig.json scripts/accept-one-time-deliverable-v2_4.mts
```

Then compose all four tiers from the one foundation (reads the KEEP file):
```bash
cd /Users/martingaleano/leadlens-landing-v2 && PATH="/usr/local/bin:$PATH" \
LEADLENS_RENDER_OUT=/tmp/pilot2 npx -y tsx --tsconfig tsconfig.json scripts/pilot2-render-tiers.mts
```
Cleanup the disposable rows afterward with the `LEADLENS_ACCEPTANCE_CLEANUP_USERS=…` line the run prints.

## Route diversity (§33–34)
The universe must reflect the current route decisions, not one query family. Per-route discovery seeds live in
`lib/intelligence/pilot2-us-routes.ts` (`discovery_queries`), covering: specialty importer/distributor,
premium/natural & specialty retail, wellness hospitality, premium/corporate gifting, Latin-American specialty.
The pipeline builds the ICP from the context above (already interpreted as: specialty F&B retail, natural/
organic, hospitality/wellness, premium gifting, import/distribution).

## Qualification + honesty (§35, §44, §49)
- Deduplicate by canonical account_id (the fixed invariant: one canonical account → at most one delivered/charged).
- **Do not weaken qualification to reach a count.** If only 9 qualify, Portfolio stays PARTIAL. Exhaust
  reasonable research within budget first.
- Record real telemetry into the Admin (`AMOR_PILOT2.research`) + persist context/feedback via 065.

## Product classification (§28–29) — parallel, non-blocking
Ask the customer the single question in `PILOT2_CLASSIFICATION_QUESTION` (Admin → Export Deps tab) to resolve
food/supplement/cosmetic; keep the dependency branches CONDITIONAL until answered. Do not infer a legal class.
