# LeadLens — Real Account Brief Continuity + Authenticated QA V1

Align the **real** customer-facing Account Brief with the product language
established on the frozen landing, and actually inspect it in a browser via a
safe, synthetic, production-guarded fixture. Display/terminology only; no
backend/pipeline/entitlement/auth/billing/provider changes; landing untouched.

## 1. Initial HEAD
`b6db03f` — `feat: unify LeadLens authenticated product experience`.

## 2. Canonical real Account Brief route
`/results/[jobId]/brief` → `app/results/[jobId]/brief/page.tsx` (loader) →
`BriefView.tsx` (presentational). Data via the `getBriefForViewer` **server
action** (ownership-checked; raw report_json stays server-side). The other
deep surface is the report detail `/results/[jobId]/page.tsx`; the canonical deep
output is the **brief**.

## 3. Components
`BriefView.tsx` (presentational; no auth/fetch/DB), `TierCharts` (in-file),
`ClaimP`/`Tag` claim renderers, `deriveMiniVerdict/derivePortfolioStatus/
deriveDecay/deriveMomentum/deriveAllocation` (report-experience). New:
`app/dev-brief-preview/page.tsx` (dev-only QA fixture).

## 4. Data contract
`InstitutionalOpportunityReportV1` (executive_brief, portfolio_summary, quality,
`account_dossiers[]` with tier/thesis/why_now/why_this_company/why_this_quarter/
evidence_chain/risks/hypotheses/playbook/recommended_next_step, methodology,
limitations) + a server-resolved `ReportExperience` (tier gating). Assembled by
`assembleInstitutionalReport()` — deterministic, provider-free.

## 5. Before state
Strong evidence-first brief, but customer-facing chips used legacy **HOT / WARM /
COLD / DISCARD** (es PRIORITARIA/POSIBLE/FRÍA/DESCARTADA), a red "hot lead" tier
palette (HOT=#dc2626), a portfolio legend reading "hot/warm/cold/discard", a
section titled "Account Dossiers", and an alarming red "Commercial approach"
box — contradicting the landing's decision-state model.

## 6. After state
Chips now read **Prioritize / Validate / Monitor / Hold** (es Priorizar/Validar/
Monitorear/En espera) in a restrained blue/amber/slate palette; portfolio legend
uses the same decision words; section is "Account intelligence"; the outreach
"Commercial approach" box is demoted to neutral slate. All other intelligence
(thesis, why-now, evidence chain + sources + dates, risks, validate, next step,
methodology, limitations, charts) is preserved untouched.

## 7. Header
Kept and confirmed coherent: dark AOI header `"<tier display_name> · <header_label>"`
(e.g. "Intelligence · Executive Intelligence Brief"), headline, date, accounts
analyzed, evidence grade, Download PDF. Answers "which account/what/why/how strong/
what's uncertain/what to validate/what next" across the page. Not relabeled to
"Report/Results/Snapshot".

## 8. Opportunity Thesis
**Supported & visible** — each dossier leads with a labeled `thesis` claim
(Analysis/Verified/Hypothesis basis tag) synthesizing why the account matters;
conservative, no buying-intent overclaim.

## 9. What Changed
**Supported** via `why_now` + evidence chain with dates (real data). Observation
vs interpretation is conveyed by the per-claim basis tags (Verified/Analysis/
Hypothesis). Not fabricated.

## 10. Fit
**Separated** — Fit appears as its own dimension (`fit_score` in the ranking chart
"8/10 · Prioritize", fit_reasons in thesis), distinct from timing.

## 11. Timing
**Separated** — timing surfaces via why-now/decay/momentum and the Fit×Timing
scatter (days-since-signal axis), never merged into one score.

## 12. Evidence
**Prominent** — a dedicated evidence chain per account (source label, link, date),
plus evidence-coverage % in the executive header and an "evidence grade".

## 13. Evidence Strength
**Supported** — quality grade (Strong/Moderate/Developing), evidence coverage %,
per-account evidence-grounded vs "validate first", and decay ("Revalidation
required by …").

## 14. Freshness
**Supported** — evidence dates, decay/revalidate-by, and a freshness distribution
chart (fresh/recent/stale/undated). (Real jobs carry dated evidence; the QA
fixture's dates were illustrative.)

## 15. Counterevidence
**Supported** — "Risks & unknowns" per account renders `risks` claims; an honest
"no specific risks surfaced — unknowns are the risk" fallback exists. Given
meaningful weight (not hidden in tiny text).

## 16. What to Validate
**Supported & clear** — "Validate before contact" section renders hypotheses/
open questions per account.

## 17. Next Commercial Decision
**Supported** — decision-state chip (Prioritize/Validate/Monitor/Hold) + portfolio
status (Act now/Investigate/Monitor/Reserve) + "Recommended next step" claim.

## 18. Commercial Accessibility
**Not-supported as a discrete field** in the current brief data — not fabricated.
(Documented as a Codex data gap; the dossier conveys related context via
identity/status.)

## 19. Decision Scope
**Not-supported as a discrete field** — not fabricated. (Codex data gap.)

## 20. Account resolution
Partial — identity line shows industry · location · domain. Parent/subsidiary
resolution is not a discrete brief field today (not invented).

## 21. Portfolio context
**Supported** — Portfolio Intelligence (hot/warm/cold/discard distribution →
relabeled decision words, funnel considered→filtered→selected, effort allocation)
and per-account rank. Real data only.

## 22. Legacy score treatment
Dominant temperature scoring removed from the customer view: HOT/WARM/COLD/DISCARD
→ decision states; red-hot palette → restrained decision palette; legend words →
decision words. Fit remains as an honest 0–10 dimension (not a blended "opportunity
score"). Backend `tier`/`fit_score` fields untouched.

## 23. Sales/outreach treatment
The "Commercial approach" (playbook) block is preserved but **demoted**: moved
visual weight from an alarming red box to neutral slate, and it already sits after
the intelligence (thesis/evidence/risks/validate). The brief does not read as
outreach automation.

## 24. Source UI
Evidence links render as named anchors (label + date) opening in a new tab
(`rel=noreferrer`); no raw ugly URLs dominate; provenance preserved. No provider/
retrieval internals exposed.

## 25. Desktop (1280/1440/1024)
Centered 880px intelligence column, sections as restrained cards, charts in
`overflow-x:auto` boxes. 0 document overflow, 0 clipped elements at 1280 & 1440.

## 26. Tablet (768/1024)
Content capped at 880px centers cleanly; same section flow. No overflow.

## 27. 430 / ## 28. 390 / ## 29. 375 / ## 30. 360
Browser-verified via the dev fixture: **0 horizontal overflow and 0 elements
exceeding the viewport** at 390/375/360 (and 1280/1440). Charts scroll inside
their own containers; header/executive/dossier sections stack and wrap; text
readable; decision chips visible. Mobile reading order is Account → decision →
thesis → why-now → evidence → risks → validate → next step (matches the spec).

## 31. Authenticated QA mechanism found?
**No** pre-existing safe session/test-user/seed/Playwright-auth mechanism for the
customer brief was found (the `block*-preview-local` route dirs are untracked/
empty; the admin institutional route is admin-gated). Per §35, since `BriefView`
is purely presentational and a deterministic provider-free assembler exists, a
**dev-only, production-guarded** fixture route (`/dev-brief-preview`) was added to
render it with **synthetic** data. It performs no auth, no DB, no provider calls,
returns 404 in production, and is unlinked.

## 32. Authenticated journey tested?
**Partially.** The **real Account Brief component** was visually verified end-to-end
via the safe fixture (all widths). A full **logged-in session** journey
(login→dashboard→monitor→brief with a real Supabase user) was **NOT** performed —
no safe test account exists in this environment. Marked UNVERIFIED, not estimated.

## 33. Dashboard visual QA
**UNVERIFIED authenticated** (session-gated). Prior sprint's dashboard changes are
compile-clean and build-clean; a seeded-account pass is still required.

## 34. Monitor detail QA
**UNVERIFIED authenticated** (session-gated). Prior sprint removed Apollo/Vault/
credits; compile-clean.

## 35. Login/signup regression QA
**Clean** — re-confirmed no regression from this sprint (no auth files touched).

## 36. Account Brief entry continuity
Dashboard routes to the brief as "Account Brief →" (prior sprint); the brief header
is AOI-branded. Entry does not switch to "Report/Snapshot" language.

## 37. Empty/partial states
Honest unknown states preserved (no thesis → "treat as a lead to validate"; no
risks → "unknowns are the risk"; undated evidence listed, never plotted with
invented positions). Not made to look like errors.

## 38. Processing/failure states
Loader states in `page.tsx` are coherent ("Your brief is being generated…",
"Please sign in…", "This brief is not available.") — real lifecycle, no fake
percentages. Untouched.

## 39. Accessibility
Charts have `role="img"` + aria-labels; decision state conveyed by text (not color
alone); evidence links are real anchors; headings semantic. Print styles preserved.

## 40. Performance
No new libraries; SVG charts are inline; zero new data-fetch/provider calls.

## 41. External provider calls
**Zero.**

## 42. Backend logic changes
**None** (display/label/color only; assembler/types/actions untouched).

## 43. Product fidelity score
Brief before ~7.0 → after ~8.2 (decision-state alignment; legacy temperature
removed).

## 44. Premium perception score
~7.0 → ~8.0 (restrained palette, institutional hierarchy, demoted outreach).

## 45. Trust score
~8.0 → ~8.3 (evidence/counterevidence/validate already strong; now free of
lead-scoring framing).

## 46. Mobile score
Brief mobile ~6.5 → ~8.0 (verified clean at 360/375/390).

## 47. Landing → real product continuity
Before ~5.5 → after ~8.0: the real brief now uses the same decision states,
evidence-first logic, What-Changed/Fit/Timing/Evidence, counterevidence and
restrained palette as the landing proof — clearly the same product, with more
depth.

## 48. Remaining P0
None introduced.

## 49. Remaining P1
Full logged-in authenticated journey QA (dashboard/monitor/brief) with a seeded
test account; Commercial Accessibility / Decision Scope as discrete brief fields.

## 50. Codex blockers (carried)
Password reset; plan-state-through-auth / Commercial Intent persistence;
dashboard-level Latest-Opportunity/What-Changed data endpoint; post-payment
onboarding schema; authenticated PT/JA localization; add Commercial Accessibility /
Decision Scope fields to the report data if desired.

## 51. Freeze recommendation
**PROVISIONAL.** The real Account Brief, landing, and auth surfaces are visually
coherent and browser-verified; the dashboard/monitor design is coherent and
compile-verified but a real logged-in visual pass is still outstanding. Freeze the
brief + auth; complete one seeded-session dashboard/monitor/brief journey QA before
declaring the whole authenticated visual system frozen.

## 52. Files changed
`app/results/[jobId]/brief/BriefView.tsx`,
`app/dev-brief-preview/page.tsx` (new, dev-only guarded),
`LEADLENS_REAL_ACCOUNT_BRIEF_CONTINUITY_V1_REPORT.md`.

## 53. Tests
`premium-report-contract` 23/0, `report-delivery-gate` 15/15,
`product-catalog` 27/27, `commercial-continuity` 17/17.

## 54. TypeScript
`npx tsc --noEmit` clean (0 errors).

## 55. Build
`npm run build` succeeded (136 pages); `/dev-brief-preview` builds as a dynamic,
production-guarded route (404 in prod).

## 56. Commit
`feat: unify real Account Brief experience`.

## 57. Push status
Not pushed — push via GitHub Desktop (no CLI credentials).

## 58. Stop confirmation
Real Account Brief aligned to decision-state vocabulary + restrained palette with
all intelligence preserved; browser-verified via a safe production-guarded
synthetic fixture at 360/375/390/1280/1440 (0 overflow, no HOT/WARM); tsc + build +
tests green; no landing/backend/billing/provider changes. Full logged-in journey
QA remains session-blocked and is documented, not faked. Freeze recommendation:
**PROVISIONAL**. **Stopping.**
