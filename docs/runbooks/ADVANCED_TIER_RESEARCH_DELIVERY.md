# Advanced-tier research and delivery runbook

Canonical authority: `docs/architecture/CANONICAL_INTELLIGENCE_DELIVERY_SYSTEM_V1.md`. This runbook is execution-only.

1. Confirm the persisted customer context and objective fingerprint. Reuse scoped Market/Account Memory only when geography, objective and category context match.
2. Build or refresh the Market Research Universe with `scripts/sources/run-pilot2-market-research-universe.ts`. Search results are discovery only.
3. Run `scripts/sources/deepen-pilot2-commercial-access.ts`, then `scripts/sources/run-pilot2-commercial-depth.ts`. Both use the provider-resilient extraction chain. Review `commercial-access-attempts.json` and `commercial-depth-research.json` before accepting verified mechanisms.
4. Persist with `scripts/sources/persist-pilot2-market-memory.ts`. A missing migration 066 is a blocking persistence state, not a successful run.
5. Research escalation order: actionability if advanced tiers have no evidence-qualified Prioritize; capacity if the selected universe is below entitlement; commercial depth if top accounts are not researched; corroboration when a decision-critical claim lacks independent support. Stop on evidence obtained, exhausted query families, provider/budget exhaustion, collapsed novelty, invalid route, or customer dependency.
6. Regenerate Pilot 2 with `scripts/pilot2-actionability-finalize.mts`. It preserves canonical decisions and assembles all four tiers from one report.
7. Validate focused contracts:

   ```bash
   npx tsx --tsconfig tsconfig.json scripts/fixtures/provider-resilient-extraction.test.ts
   npx tsx --tsconfig tsconfig.json scripts/fixtures/commercial-depth-research.test.ts
   npx tsx --tsconfig tsconfig.json scripts/fixtures/market-memory-store.test.ts
   npm run test:market-research-universe
   npm run test:canonical-intelligence-delivery
   npm run test:pilot2-natural-grocers-red-team
   ```

8. Run `npm run release:check` on the exact final HEAD. If code changes afterward, rerun it.
9. Inspect `pdfinfo` for all four outputs, render every page with Poppler using the bundled fontconfig file, and visually inspect every page. Never mark Premium ready at less than 18 legitimate accounts.

Pilot 2 outputs live under `output/pilot2/2026-09-30-actionability-final/`. The customer-facing source is the generated canonical report, not intermediate search or research artifacts.
