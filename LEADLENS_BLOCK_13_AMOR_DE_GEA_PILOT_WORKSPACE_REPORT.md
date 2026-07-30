# LeadLens Block 13 — Amor de Gea Pilot Workspace

> Block 14 subsequently rebuilt the visible workspace around commercial decisions while preserving every Block 13 persistence, authorization, history and safety contract. See `LEADLENS_BLOCK_14_RADICAL_PILOT_EXPERIENCE_REBUILD_REPORT.md`.

## Post-migration activation

Migration 047 was manually applied and verified through service-role access on both tables and every expected column. Anonymous access exposed no rows. PostgREST does not expose sufficient `pg_catalog` metadata to independently enumerate every index, grant and RLS policy, so those details are classified as partially verified empirically rather than overstated.

The corrected backfill dry-run planned one canonical pilot, six existing theses and one activity event while embedding one client identity, six account references, 17 unanswered questions, six feasibility assessments, 20 readiness sections and six monitoring triggers. It found zero duplicates, orphans, invalid references, conflicting IDs, synthetic answers or writes.

The authorized first write inserted eight rows: one pilot, six theses and one activity event. The immediate second write inserted zero rows with no duplicate error or destructive update. Direct final Supabase verification confirmed:

- 1 canonical pilot;
- 6 account references and 6 theses with exact expected IDs;
- 17 unanswered context questions;
- 6 feasibility assessments;
- 20 readiness records;
- 6 monitoring triggers;
- 0 real answers or accepted context versions;
- 0 reviewed theses;
- 0 customer-safe outputs;
- 0 orphan or cross-scope records;
- internal-only, ranking off, report impact off and final report disabled.

The Command Center now contains a bounded Amor de Gea summary and canonical workspace link. The production canonical URL exists and correctly redirected an unauthenticated browser to `/admin/login?reason=unauthorized` with no console errors. Full authenticated content/refresh/back-navigation verification remains pending because no active Admin browser session was available and the focused activation commit has not yet been pushed. No force push or automatic deployment was performed.

## Result

Block 13 replaces the empty Amor de Gea Admin state with a canonical, populated internal workspace at `/admin/intelligence/pilots/amor-de-gea`. It exposes the six verified accounts, six internal theses, 17 unanswered context questions, feasibility, safety, readiness, activity and an operating checklist. The final report remains disabled, ranking remains off and no production answer was fabricated.

## Empty-page root cause and route repair

The old `/admin/pilot` console loads `/api/admin/pilot`. That API queries only `batch_jobs` whose onboarding payload contains `pilot`. Blocks 10–12 did not create such a managed-pilot job: their real Amor de Gea work is associated with client ID `amor-de-gea` and stored in versioned Intelligence artifacts. The API therefore returned an honest empty list, which the UI rendered as “Sin pilotos todavía.” This was not an Auth, tenant or account-identity failure.

The Admin pilot page now links to the canonical Intelligence route. Legacy slugs `amor_de_gea`, `pilot-amor-de-gea` and `amor-de-gea-pilot` map to `amor-de-gea`; unknown IDs return not found.

## Canonical identity

- Pilot/client/slug: `amor-de-gea`
- Name: Amor de Gea
- Status: `context_required`
- Production state: internal
- Active context version: none
- Accounts: six existing Block 10–12 accounts
- Methodology: `amor-pilot-workspace-v1`
- Ranking impact: off
- Customer-safe outputs: 0
- Current signals/current timing: 0/0

Migration 047 adds only a canonical pilot record and append-only activity table with RLS and service-role access. It is now applied.

## Data reconciliation

Read-only reconciliation against Supabase performed zero writes:

| Data family | Expected | Supabase | Versioned artifact | Canonical selection | Action |
|---|---:|---:|---:|---|---|
| Opportunity theses | 6 | 0 | 6 | Block 11 artifact | Keep artifact-backed until bounded backfill |
| Context questions | 17 | not separately persisted | 17 | Block 12 artifact | Preserve unanswered |
| Context intakes | 0 | 0 | 0 | Supabase 046 | Write only real drafts/submissions |
| Accepted context versions | 0 | 0 | 0 | Supabase 046 | Create only after human acceptance |
| Safety reviews | 0 | 0 | 0 | Supabase 046 | Create only after human review |
| Canonical pilot | 1 | 1 | 1 | Supabase + bundled view model | Verified |

The production bundle statically includes the tracked Block 10, 11 and 12 JSON artifacts. It has no `.leadlens` runtime dependency and performs no provider or LLM call during render. The dry-run backfill reported one pilot, six accounts, six theses, 17 questions, six safety assessments and 20 sections with `writes: 0` and `synthetic_answers: 0`. Write mode then completed with eight inserts and the second run performed zero writes.

## Workspace architecture and state

One partial-data-tolerant view model aggregates:

- Overview: status, completeness, decisions, coverage, blockers and next action.
- Client Context: all 17 real questions with draft/submission controls, provenance and evidence URL.
- Accounts and comparison: identity, domain, decision, segment, fit, accessibility, feasibility, timing, safety and limiting factor.
- Opportunity Theses: Why This Account, Why Now/Why Not Now, use case, buying path, counterevidence and limitations.
- Review Operations: partial context acceptance and append-only internal thesis review.
- Evidence/Research/Signals: honest zero-current-signal state and provider-free render.
- Feasibility: every unresolved dimension points to the client field needed to resolve it.
- Customer safety: six explicit assessments remain context incomplete; no automatic customer-safe transition.
- Report Readiness: all 20 sections preserve their independent Block 12 state.
- Activity and checklist: auditable system events and the 12-step operating sequence.

## Safe write workflow

The Admin-only intake API accepts drafts or submissions, validates all question IDs and answer states, derives actor/client scope server-side, uses a body-hash idempotency key and writes to migration 046. Submission returns `context_activated: false`.

The operations API supports:

1. partial acceptance of selected answers from an existing submitted intake;
2. insertion of an immutable context version with previous-version linkage and the exact affected-thesis set;
3. provider-free deterministic recalculation metadata;
4. append-only thesis review versions that preserve the original in the new payload;
5. explicit safety-review records.

All operations require active Admin authorization, reject forged question/thesis IDs and preserve `internal_only`, `ranking_impact: off` and `customer_safe: false`. No destructive update is used.

## Verification

- Targeted workspace suite: 48/48 passed.
- Admin Auth: 48/48 passed.
- Admin login routing: 57/57 passed.
- Validation loop: 50/50 passed.
- Evidence temporal: 55/55 passed.
- Signal temporal: 51/51 passed.
- Command Center: 36/36 passed.
- Research quality: 62/62 passed.
- Signal benchmark: 38/38 passed.
- Registries: 28/28 passed.
- Snapshot: 27/27 passed.
- Market-to-Account pipeline: 22/22 passed.
- Colombian entity resolution: 25/25 passed.
- TypeScript: passed.
- Production build: passed; both workspace page and two protected APIs are present.

Browser validation confirmed that both the production-equivalent build and current production route redirect unauthenticated access to Admin login instead of exposing the workspace. Production emitted no browser-console error during this check. A complete authenticated visual run could not be safely simulated because no active Admin session was available and the Admin layout requires a signed httpOnly session cookie. No Auth weakening or fake production intake was introduced. Final authenticated screenshots must therefore be captured after the activation deployment with a real authorized Admin session.

## Migration and security status

- Migrations 041–046: reported applied; 045/046 tables were readable.
- Migration 047: applied and operationally verified.
- No service-role secret is sent to the browser.
- No customer route was added.
- No provider payload, personal contact data or hidden reasoning is stored/exposed.
- Runtime files `.leadlens/source-intelligence.json` and `.leadlens/usage.json` remain excluded.

## Remaining blockers and exact next action

Real state remains: 17 unanswered questions, 10 critical blockers, six unreviewed theses, six context/feasibility-blocked accounts, zero current timing, zero current signals and zero customer-safe outputs.

Exact next action: push the focused Block 13/activation commits, wait for Vercel Ready, then open the canonical route with a real Admin session and verify the persisted zero-answer state. After validation, collect the first real critical Amor de Gea answers as drafts. Do not generate the final report until accepted context, thesis review, feasibility and safety gates pass.

Next recommended block: a controlled Amor de Gea pilot operation block using real client answers, not a new generic Intelligence abstraction. Block 14 was not started.
