# LeadLens — Company Interpretation Context Contracts V1 — Report

**Date:** 2026-08-25 · **Scope:** Stage A → Stage B execution boundary. Contracts-only, no LLM call, no provider, no discovery, no migration, no landing/pricing change.

This sprint found the Stage A contract layer **already built and passing** from prior phases; the one genuine gap was the **execution adapter** documented but never implemented. That adapter is now real.

---

## 1. Existing Context Architecture Audit

| Concern | Status before this sprint | Location |
| --- | --- | --- |
| `CompanyInterpretationV1` | ✅ exists | `lib/interpretation/company-interpretation.ts` |
| Provenance / truth states | ✅ exists (`ContextOrigin`, `VerificationStatus`) | same |
| Commercial objective model (supported/unsupported) | ✅ exists | same |
| Target account profile (+ `discovery_required`) | ✅ exists | same |
| Opportunity conditions / signal hypotheses / disqualifiers | ✅ exists | same |
| Clarification / contradiction model | ✅ exists | same |
| `stageAViolations` / `executionReadiness` validators | ✅ exists | `company-interpretation.ts` / `confirmed-commercial-context.ts` |
| `ConfirmedCommercialContextV1` + `confirmInterpretation` gate | ✅ exists | `lib/interpretation/confirmed-commercial-context.ts` |
| Guarded LLM service + repair + deterministic fallback | ✅ **already exists** (contradicts prompt §44) | `interpret-service.ts`, `deterministic-extractor.ts` |
| Golden + adversarial + malformed fixtures | ✅ exists | `lib/interpretation/fixtures/*` |
| Canonical downstream commercial context | ✅ exists | `lib/commercial/commercial-context.ts` (`CommercialContextInput` → `normalizeCommercialContext` → `CommercialContext`), consumed by `app/api/customer/onboarding/route.ts` |
| **Execution adapter (Stage A → canonical Stage B)** | ❌ **stubbed** (`EXECUTION_ADAPTER_BOUNDARY`) | — |

**Canonical Stage B entry:** `runCompanyFirstDiscovery(icp, criteria, …)` in `lib/discovery/company-first-discovery.ts`; its commercial-context source of truth is `CommercialContext`.

## 2. Reuse Decisions
- **No new ontology.** The adapter maps into the existing `CommercialContextInput`/`CommercialContext` and reuses `normalizeCommercialContext` (country aliasing + region derivation) verbatim — no parallel country/region logic.
- **No new objective/signal taxonomy.** Signal families stay canonical (`SignalFamily` from `needs-map`); objectives stay the existing supported/unsupported enums.
- **Guarded LLM service left intact** rather than removed — the prompt's "don't implement the LLM call yet" is stale vs. repository truth (see Contradictions).

## 3–13. Contracts (unchanged, already present)
Stage A contract, provenance/truth model (`user_stated`/`user_confirmed`/`inferred`, with `externally_verified` reachable only in Stage B), objective model, target-account model, opportunity conditions, signal hypotheses, disqualifiers, clarification/contradiction model, confirmation + versioning, and `ConfirmedCommercialContextV1` are all pre-existing and covered by `company-interpretation.test.ts` (33) + `interpret-*` suites. This sprint did not modify them.

## 13. Execution Adapter (NEW — the sprint deliverable)
`lib/interpretation/execution-context-adapter.ts`:
- `adaptConfirmedContext(ctx: ConfirmedCommercialContextV1): AdapterResult` — maps to canonical `CommercialContextInput`, normalizes to `CommercialContext`, and attaches: `watchSignalFamilies` (hypotheses → watch config), `hardExclusions`/`strongNegatives` (negative targeting configuration), stable `ref` (`contextId`/`version`/`effectiveFrom`/`supersedes`), and `provenanceSummary`.
- `adaptInterpretation(interp, opts)` — confirm-then-adapt convenience doorway; any confirmation failure short-circuits into an adapter refusal.
- **Defensive re-gate:** refuses `not_executable` when the mapped `commercial_goal` is empty, or the target is undefined and *not* legitimately `discovery_required`.

Field mapping (honest, never fabricated): `company_description` ← companyDescription; `offer` ← offer labels; `buyer` ← organizationTypes ∪ industries (empty is valid when discovery-required); `problem_solved` ← capabilities → structural/required conditions; `target_countries` ← geographies; `commercial_goal` ← objective.description; region ← single consistent `regionKey` else canonical derivation.

## 14. Stage A / Stage B Boundary
- **No raw prose downstream (§28):** the adapter reads only structured confirmed context; `ConfirmedCommercialContextV1` carries no raw input, and the output never echoes `rawInputRef` (tested).
- **No query generation (§29):** owned downstream; adapter emits only canonical watch families (tested — no `query` field).
- **No evidence leak (§8):** the mapped `CommercialContext` has exactly the seven config keys — no fit/timing/decision/evidence/observation vocabulary (tested).
- **Isolation (§57):** no provider/LLM/network/persistence imports (tested).

## 15. Account Memory Compatibility
`ConfirmedCommercialContextV1` already carries `contextId`/`version`/`effectiveFrom`/`supersedes`; the adapter preserves them in `ref`. This lets Account Memory later distinguish "the account changed" from "the customer's commercial context changed" (§26). **No Account Memory code changed.** Migration `052_account_review_snapshots.sql` is recorded as applied by the founder; repository state does **not** contain proof of live Supabase acceptance of Account Memory snapshots — that remains a separate operational acceptance item, not touched here.

## 16. Tests
New: `scripts/fixtures/execution-context-adapter.test.ts` — **22/22**. Covers golden (software/consulting/partnerships) mapping, disqualifier→config (cyber/banks/not-fintech), unsupported-objective refusal, blocking-gap refusals, unconfirmed refusal, degenerate-goal refusal, discovery-required executable, version retention, no-raw-prose, no-query, no-evidence, isolation, canonical reuse.
Regression (unchanged, green): company-interpretation 33, interpret-discovery 30, interpret-service 33, landing-interpretation-integration 18, commercial-continuity 17, demo-safety 6. `tsc` clean; `npm run build` passes.

## 17. Remaining Risks
1. `problem_solved`/`buyer` are best-effort string mappings; a future NeedsMap-level adapter (into `ICP`/`LeadSearchCriteria`) may want richer structure than the flat `CommercialContext` carries.
2. The guarded LLM service predates these contracts; a follow-up should confirm its output flows through `confirmInterpretation` + the new adapter (not around them) before self-serve execution.
3. Live Account Memory snapshot acceptance in Supabase is still unproven in-repo.
4. No persistence of `ConfirmedCommercialContextV1` yet — versioning is in-type only.
5. Adapter is not yet wired into `runCompanyFirstDiscovery`'s actual call site (deliberate — no execution this sprint).

## 18. Recommended Next Intelligence Sprint
1. **Wire** `adaptConfirmedContext` into the real onboarding→discovery call path (replace ad-hoc `normalizeCommercialContext` usage), behind the confirmation gate.
2. Persist `ConfirmedCommercialContextV1` (new migration) so context versions are durable for Account Memory cause-attribution.
3. Only then: harden the already-present guarded LLM Stage A (schema-constrained + one repair + rate limit + privacy-safe observability) for self-serve.
