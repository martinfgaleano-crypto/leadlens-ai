---
name: leadlens-verify
description: Run the LeadLens verification gate for the current change — typecheck, the relevant fixture tests, and (when code the build can exercise changed) a production build. Use mid-sprint after implementing, before claiming anything is done. Invoke when the user says "verify", "run the gate", or asks whether a change passes.
---

# leadlens-verify

Deterministically prove the current change is sound. Do the minimum that actually exercises what changed — don't run the whole 45-suite gate for a one-module change.

## Procedure
1. **Typecheck:** `npx tsc --noEmit -p tsconfig.json` → expect exit 0, no output. (This catches errors in `scripts/fixtures/*` that `npm run build` does not.)
2. **Targeted fixture tests:** for every module you touched, run its and its dependents' fixtures:
   `npx tsx --tsconfig tsconfig.json scripts/fixtures/<name>.test.ts` — each prints `N passed, 0 failed`. Include the obvious regression neighbours (e.g. touching `lib/monitor/*` → run monitor-intelligence, research-temporal-hardening, monitor-activation; touching `lib/deliverable/*` → deliverable-renderer, portable-deliverable).
3. **Build (only if the change is build-observable):** stop any dev server, `rm -rf .next && npm run build` → exit 0. Skip if the change is only in `scripts/`, tests, or a non-app runtime.
4. **Worktree hygiene:** `git checkout -- .leadlens/` (revert runtime artifacts), then `git diff --check` (no whitespace/conflict markers).

## Output (report this)
`tsc: exit N · <suite>: X passed/0 failed (per suite) · build: exit N (or skipped, reason) · diff --check: clean`. If anything fails, show the failing output — never claim green on red. For a full pre-release sweep use `npm run release:check` instead.
