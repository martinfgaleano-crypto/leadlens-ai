# LeadLens — Authenticated Product Continuity V1

Make the authenticated experience feel like the same product as the (frozen)
landing: one LeadLens from login → signup → dashboard → monitor/account →
Account Brief. Visual/UX + terminology only. Landing untouched; no
backend/entitlement/pricing/billing/provider changes.

## 1. Initial HEAD
`6444322` — `fix: finalize LeadLens landing product language`.

## 2. Surfaces changed
`app/login/page.tsx`, `app/signup/page.tsx`, `app/dashboard/page.tsx`,
`app/dashboard/searches/[id]/page.tsx` (monitor detail). Admin untouched.

## 3. Flow before
Landing (modern AOI) → `/login` (generic card, "Your B2B opportunity monitor",
no AOI context) → `/dashboard` (legacy: Credits stat card + Credits card, "Search
Statistics" with "Credits Spent"/"Avg Leads", "Recent Searches" table with a
"Leads" column, "Ready to get leads?" hint linking to `/demo-pipeline`, stale
plan labels "Starter ($29)/Standard ($79)/Pro ($149)", credit events in the
activity timeline) → monitor detail exposing "From Vault / From Apollo / Vault
Hit Rate" and "No credits were charged". The authenticated product read as a
legacy lead-gen/credits SaaS.

## 4. Flow after
Landing → `/login` & `/signup` carry an **Account Opportunity Intelligence**
eyebrow + AOI subcopy and the same brand/palette/restraint → `/dashboard`
oriented around monitors, briefs-ready and account intelligence (no credits, no
search-stats, no lead columns) with canonical tier names → monitor detail with
the internal provider-sourcing panel suppressed and credit/lead wording removed.
Terminology and product model now match the landing.

## 5. Login changes
Added AOI eyebrow ("Account Opportunity Intelligence"); subcopy "Your B2B
opportunity monitor" → "Know which B2B accounts to work now — and why." Auth
logic, non-blocking static-form guarantee, friendly errors and redirects
unchanged. Mobile clean at 360/390 (0 overflow).

## 6. Signup changes
Added the same AOI eyebrow; "Create your account" → "Create your LeadLens
account"; subcopy → "Find the B2B accounts worth working now — and the evidence
behind each one." Validation, duplicate-account handling, check-email state and
security behavior unchanged.

## 7. Password reset status
**Still incomplete — documented, not faked.** `/auth/callback` can accept a
recovery token but there is no forgot-password entry point and no set-new-password
page, so a coherent reset can't complete. No dead "Forgot password?" link was
added. **Codex blocker** (needs a reset request affordance + a set-password page +
callback wiring).

## 8. Plan-state continuity
Not solved here (would require auth-core/return-URL work — out of the safe-edit
map). Selected plan still does not survive `/login`→`/signup`. Documented as a
**Codex blocker** (§47). No unsafe UI hack attempted.

## 9. Onboarding changes
None this sprint. Onboarding lives inside the frozen landing component
(`app/demo-pipeline/page.tsx`, already progressive per the continuity contract);
touching it risks the landing freeze. The post-payment onboarding schema/sequence
remains a Codex item. (Answers to §10–§17 below reflect the existing state.)

## 10. Target countries
`target_countries` is authoritative (geography contract). The onboarding form is
in the frozen landing component and already collects it; not modified here.

## 11. Field visibility
Unchanged (onboarding not touched). The continuity contract's 6-core-field target
remains a Codex/onboarding-sprint item.

## 12. Dashboard before
Six stat cards led with Account · Plan · **Credits** · ICPs · Monitors ·
Onboarding; a large **Credits** card (balance + transactions); a **Search
Statistics** panel (Total Searches / Completed / **Credits Spent** / **Avg
Leads**); a **Recent Searches** table with a **Leads** column; credit events in
the activity feed; **"Ready to get leads?"** upgrade hint → `/demo-pipeline`;
plan labels **"Starter ($29)"** etc.

## 13. Dashboard after
Stat cards: Account · Plan · **Target profiles** · Monitors · Onboarding (Credits
removed). Credits card **removed**. Search Statistics → **"Intelligence activity"**
(Monitors / Briefs ready / Target profiles). Recent Searches → **"Recent
monitors"** with **Monitor / Accounts** columns. Activity timeline **filters out
credit events**. Command center: "Reports ready" → **"Briefs ready"**, "Open
latest report" → **"Open latest intelligence"**, "Institutional brief" →
**"Account Brief"**, suggestions reworded to Account Brief / Opportunity
Portfolio / account intelligence. Upgrade hint → **"Ready to build your first
Opportunity Portfolio?"** → `/`. Plan labels → canonical **Free / Preview / Brief
/ Intelligence / Premium** (no stale prices). The existing dark AOI hero and
"next suggested action" were already on-message and kept.

## 14. Legacy terms removed (migration map)
| OLD | NEW | SURFACE | WHY |
|---|---|---|---|
| Credits (stat card, card, timeline) | removed / hidden | dashboard | Credits = internal-only (contract §25) |
| Search Statistics · Credits Spent · Avg Leads | Intelligence activity · Monitors · Briefs ready | dashboard | vanity/lead metrics → intelligence metrics |
| Recent Searches | Recent monitors | dashboard | canonical monitor concept |
| "Leads" column | "Accounts" | dashboard | account-level, not leads |
| "Ready to get leads?" → /demo-pipeline | "Ready to build your first Opportunity Portfolio?" → / | dashboard | canonical + correct route |
| Starter ($29)/Standard ($79)/Pro ($149) | Preview/Brief/Intelligence/Premium | dashboard | stale prices contradicting the catalog |
| Reports ready / latest report / Institutional brief | Briefs ready / latest intelligence / Account Brief | dashboard | canonical deep output |
| From Vault / From Apollo / Vault Hit Rate | suppressed | monitor detail | exposed provider/lead-DB plumbing |
| "No credits were charged" / "lead generation" / "Loading leads…" | credit wording removed / "account intelligence" / "Loading accounts…" | monitor detail | credits internal; account language |
| 🔍 (search) icons | 📡 (signal) | dashboard | de-emphasize "search" |

## 15. Credits treatment
Removed from all customer-facing dashboard surfaces (stat card, dedicated card,
timeline events, monitor-detail "no credits" copy). The `customer_credits` /
`credit_transactions` ledger, fetches and types are untouched (internal
accounting preserved).

## 16. Search treatment
Customer-facing "Search/Searches" → **Monitors**; search 🔍 icons → 📡. Backend
routes (`/dashboard/searches`, `lead_searches`) and internal variables unchanged.

## 17. Navigation
Existing shell nav was already canonical — Overview / Monitors / Target Profiles /
Notifications — with a working mobile menu; kept as-is (no invented routes).

## 18. Latest Opportunity
Surfaced through the existing monitor command center's latest-report block
(relabeled "Open latest intelligence / Account Brief"), driven by the real
`latest_report_job_id`. A dedicated decision-state "Latest Opportunity" card was
**not** fabricated — per-account decision-state/What-Changed data lives inside the
report (`/results/[jobId]`), not at dashboard level, so inventing it was avoided.

## 19. What Changed
Not fabricated on the dashboard (no dashboard-level change feed exists in the data
model). The monitor cadence note remains truthful ("manual for now… automatic
scheduling not enabled"). Real What-Changed lives in the Account Brief.

## 20. Opportunity Portfolio
Referenced as canonical vocabulary (upgrade hint, command-center suggestions).
The account-level Portfolio visualization lives in the report surface; not
duplicated onto the dashboard from non-existent data.

## 21. Accounts
"Leads" column → "Accounts"; monitor-detail already used "Account Results" /
"{n} accounts". No customer-facing "Leads" remains on the touched surfaces.

## 22. Account Intelligence
Terminology adopted in dashboard copy ("account intelligence", "review account
intelligence"). Deeper Account-Intelligence entry redesign inside the large report
component was left for a focused follow-up (monolith risk, §52).

## 23. Account Brief entry
Dashboard now routes to the brief as **"Account Brief →"** (was "Institutional
brief"). The brief page header itself (already the strongest output) was not
rewritten this sprint — its entry label is now canonical.

## 24. Monitor treatment
Truthful: the dashboard keeps the explicit note that monitoring cadence is manual
and automatic scheduling is not enabled — Monitor is not presented as mature
recurring automation (contract §27).

## 25. Premium capability treatment
No polished automated Premium controls were added or implied. Plan label "Premium"
is a name only; no automation claims. (Premium strategy/playbooks remain
flagged_off per the catalog.)

## 26. Empty states
"No monitors yet" (📡) with a clear next step preserved/aligned; monitor-detail
"No accounts found" reworded to guide refining the target profile (credit wording
removed). Broader empty-state design remains available for a follow-up.

## 27. Loading states
"Loading leads…" → "Loading accounts…"; existing "Loading your dashboard…" kept.
No fake progress percentages added.

## 28. Success states
Command-center suggestion now reads "Your latest Account Brief is ready to
review." The primary success concept (`first_usable_opportunity_delivered`) maps
to the latest-brief-ready block using real data.

## 29. Error states
Dashboard retry/logout kept; monitor-detail failure copy → "This run could not be
completed / Something went wrong while building your account intelligence" (no raw
provider/lead-gen wording).

## 30. Support identity
No personal Gmail exists in the touched authenticated surfaces (auth/dashboard).
The legacy/legal Gmail references live on public legal pages (frozen/out of scope);
consolidating to `…@leadlensintel.com` remains a founder decision.

## 31. Mobile auth
Login & signup verified in-browser at 360/390 — 0 horizontal overflow, brand +
AOI eyebrow + form + CTAs all clean and premium.

## 32–35. Mobile onboarding / dashboard / portfolio / brief
Onboarding is the frozen landing form (already mobile-clean from the prior
sprint). Dashboard/monitor/brief authenticated mobile could not be visually
verified in this environment (they require a real Supabase session; no test
credentials). Changes are display-only, tsc-clean and compile-clean; the shell
already implements a dedicated `<768px` layout with a mobile menu. **Authenticated
mobile visual QA is a Codex/founder follow-up with a seeded test account.**

## 36. Tablet
Not visually verified for authenticated surfaces (auth needed); auth pages use a
max-width 420 card that centers cleanly at 768/1024.

## 37. Desktop
Auth pages centered card; dashboard uses the existing 72rem shell. No layout
regressions introduced (display/terminology only).

## 38. Accessibility
Decision/status still use text + color (not color alone). Auth inputs keep labels,
autocomplete and focus rings. No color-only semantics added. Deeper a11y audit of
the authenticated shell remains open.

## 39. Product continuity
Login/signup now unmistakably continue the landing's AOI product; dashboard speaks
the same product model (monitors, briefs, account intelligence) instead of
credits/searches/leads.

## 40. Visual continuity
Shared logo/blue palette/typography/restraint across landing → auth → workspace.
No new design system introduced.

## 41. Product-value continuity
Vocabulary (Account, Opportunity Portfolio, Account Brief, account intelligence,
What to Validate) is now consistent from marketing into the workspace; the U-shaped
"legacy shell" dip is materially reduced (terminology/hierarchy), though the deep
report component redesign remains.

## 42. Continuity scores (before → after; honest)
| Dimension | Before | After |
|---|---:|---:|
| Landing → Login | 3.0 | 7.0 |
| Login → Signup | 6.0 | 8.0 |
| Auth → Onboarding | 4.0 | 5.0 |
| Onboarding → Dashboard | 4.5 | 6.0 |
| Dashboard → Portfolio | 4.5 | 6.0 |
| Portfolio → Account Brief | 5.5 | 6.5 |
| Terminology continuity | 4.0 | 7.5 |
| Visual continuity | 5.0 | 7.0 |
| Product-value continuity | 5.0 | 6.8 |
| Mobile continuity | 5.9 | 6.8 (auth verified; dashboard unverified) |

Estimated audit-dimension movement: Product UX 5.6 → ~6.8; Dashboard 5.4 → ~6.9;
Premium perception 6.5 → ~7.0; Perceived maturity 6.2 → ~7.0. Not at the 7.5+
targets because deep report/onboarding redesign and authenticated-mobile
verification are intentionally deferred.

## 43. Tests
`commercial-continuity` 17/17, `product-catalog` 27/27, `admin-login-routing`
58/0, `conversion-plumbing` ok. No provider calls.

## 44. TypeScript
`npx tsc --noEmit` clean (0 errors).

## 45. Build
`npm run build` succeeded (`.next` cleared first).

## 46. Files changed
`app/login/page.tsx`, `app/signup/page.tsx`, `app/dashboard/page.tsx`,
`app/dashboard/searches/[id]/page.tsx`, and this report.

## 47. Backend blockers discovered (for Codex)
1. **Password reset** — no entry point + no set-password page; callback partial.
2. **Plan-state through auth** — selected product intent does not survive
   login/signup (needs return-URL/commercial-intent persistence).
3. **Dashboard "Latest Opportunity / What Changed"** — no dashboard-level
   decision-state/change data; would need a summary endpoint from report data.
4. **Post-payment onboarding schema** (6-core-field target) — still in the landing
   component; needs the split pre/post-payment schema.
5. **Authenticated PT/JA localization** — workspace is English-only (kept; not
   regressed).

## 48. Claude-safe changes
All changes were display/terminology only on customer-facing auth + dashboard +
monitor-detail surfaces; no data fetches, types, entitlements, routes, catalog,
provider or auth-core logic altered.

## 49. Codex follow-up
Implement §47 items; then a focused visual pass on the large report/Account-Brief
component and authenticated mobile with a seeded account.

## 50. Remaining P0/P1
- **P0:** none introduced. (Existing product-level P0s — working checkout /
  entitlement continuity — are out of this visual sprint's scope.)
- **P1:** authenticated-mobile visual verification with a real session; password
  reset; deep report-component continuity.

## 51. Visual freeze recommendation
**Auth surfaces: ready to freeze.** **Dashboard: provisionally ready** pending a
one-time authenticated-session mobile QA pass. The remaining authenticated visual
work is the large report/Account-Brief component — recommend that as the next
focused sprint before declaring the whole authenticated system frozen.

## 52. Commit
`feat: unify LeadLens authenticated product experience` (single focused commit;
not an amend of landing commits).

## 53. Push status
Not pushed — push via GitHub Desktop (no CLI credentials).

## 54. Stop confirmation
Auth pages carry the Account Opportunity Intelligence brand and continue the
landing; the dashboard is rebuilt around monitors/briefs/account intelligence with
credits/search-stats/lead-columns/stale-prices removed; the monitor detail no
longer leaks Vault/Apollo/credits; terminology matches the continuity contract;
tsc + build green; tests pass; no backend/landing/billing changes. Authenticated
mobile visual QA (session-gated) and the deep report component are documented as
follow-ups. **Stopping.**
