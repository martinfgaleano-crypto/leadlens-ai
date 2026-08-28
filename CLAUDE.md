# LeadLens — Claude Code Operating Guide

LeadLens is **Account Opportunity Intelligence**: *which accounts deserve attention now, why, and with what evidence?* Next.js 14 (App Router) + TypeScript + Supabase. This file is durable project truth — the repeatable procedures live in Skills (`.claude/skills/`), deterministic safety in the hook (`.claude/settings.json`).

## Commands
- **Typecheck:** `npx tsc --noEmit -p tsconfig.json`
- **One test:** `npx tsx --tsconfig tsconfig.json scripts/fixtures/<name>.test.ts` (fixtures are standalone; they print `N passed, 0 failed`)
- **Full deterministic gate (CI):** `npm run release:check` (tsc + ~45 suites + build)
- **Build:** `npm run build` — **stop any running dev server and `rm -rf .next` first** (build-while-dev corrupts `.next` → 500s)
- **Dev server:** use the `leadlens-project-dev` launch config (port 3000). Never run a dev server via Bash.
- **Live Supabase probes (read-only, safe):** `node scripts/accept-confirmed-context.mjs`, `npm run probe:supabase`, `node scripts/accept-account-memory.mts`

## The standard sprint loop
`audit relevant repo state → report current truth (git/found/gap/plan) → implement the smallest coherent change → targeted fixture tests → tsc → build → git verify → completion report`. Use `/leadlens-verify` mid-sprint and `/leadlens-sprint-close` to finish.

## Non-negotiable engineering rules
- **Audit before edit.** Read the real code first; don't assume a handoff is current.
- **Additive by default.** No speculative broad rewrites; smallest coherent change; prefer one reversible commit.
- **Verify before claiming done:** `tsc` clean + relevant fixtures green + `npm run build` clean + `git diff --check`. If tests fail, say so with output.
- **Git push ≠ deployed.** Never push automatically. Production behavior requires an actual deploy; a migration existing in the repo is not applied until the founder applies it.
- **Never edit an applied/historical migration.** Reconcile only via a new forward-only migration (see `/leadlens-migration-safe`). Never auto-apply to production.
- **Secrets never exposed.** `.env*` is gitignored; never print/commit real keys; env presence checks only (names, not values).
- **Revert runtime artifacts before committing:** `git checkout -- .leadlens/` (source-intelligence/usage churn is not part of a change).

## Intelligence truth boundaries (the core product invariants — never regress)
Owned by the Intelligence contracts, enforced by deterministic gates that are the **final authority** (an LLM may propose; code decides):
- Memory ≠ Evidence · User context ≠ verified Fact · User-confirmed ≠ Evidence-verified · Interpretation ≠ execution.
- Retrieval date ≠ event date · Publication date ≠ event date · Static fact ≠ What Changed.
- Two URLs ≠ independent support (independence needs ≥2 distinct **origin** ids) · Old evidence rediscovered ≠ new evidence · Newly-discovered historical info ≠ post-review external change.
- No observed event → no Timing claim · Absence/unknown ≠ counterevidence · Limited public evidence ≠ poor opportunity.
- Current Case > history: build the current Case first (`synthesizeCase`/`caseDecision` is the one Decision authority), then `diffAccountCase`. Historical snapshots are immutable.
- Decisions are `prioritize | validate | monitor | hold`. **No HOT/WARM/COLD, no opaque numeric lead/provider score.**
- Tenant isolation: owner/client/context scoped everywhere; never leak another tenant's data.
- **No Apollo. No new provider merely because credentials exist** — routing is task/health/cost-aware (`lib/monitor/provider-routing.ts`), quality floor is non-negotiable.
When you touch intelligence code (`lib/monitor/`, `lib/deliverable/`, `lib/discovery/`, `lib/interpretation/`), run `/leadlens-intel-guard`.

## Architecture map (where things live)
- Stage A interpretation: `lib/interpretation/` → `interpret-service.ts`, contracts, `app/api/interpret/route.ts`
- Confirmed context + discovery handoff: `lib/interpretation/confirmed-context-*.ts`
- Lead Hunter: `lib/lead-hunter/` (candidate-universe, run-store) on `snapshot_reports`
- Account Memory: `lib/deliverable/account-memory*.ts` (migration 052), `diffAccountCase`
- Monitor / recurring: `lib/monitor/` (eligibility, delta-research, case-resynthesis, canonical-case, event-extraction, claim-event-extractor, scheduler, provider-routing, research-economics)
- Deliverable/Case: `lib/deliverable/adapters.ts` (`decisionOf` → canonical `caseDecision`), renderers
- Providers: `lib/sources/access/` (brave/tavily/serper/exa/firecrawl, health, extractors)
- Migrations: `supabase/migrations/NNN_*.sql` (forward-only; founder applies)

## Persistent memory
Session facts/decisions live in `~/.claude/projects/-Users-martingaleano/memory/` (index `MEMORY.md`) — read the recalled memories; they carry the current unpushed-commit state and outstanding founder actions. Update them at sprint close.

## Do NOT (in a normal sprint)
Change pricing, landing (frozen), customer/product behavior, DB schema, or providers unless the task is explicitly that. This is an intelligence/infra codebase — keep product surfaces stable.
