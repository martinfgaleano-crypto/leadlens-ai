# LeadLens Customer Intelligence Real E2E V1

## 1. Git

- Branch: `main`
- Baseline HEAD: `cf944e6d699855d23d0ba6a62066f699e76bf734`
- Baseline origin/main: `d804d4cc0805d5a2284033fc7d46b420507a645d`
- Baseline ahead/behind: 2/0.
- Eight unrelated untracked visual/product audit documents were preserved untouched.
- No push was attempted.

## 2. Journey Audit

Before this sprint the backend spine existed, but the browser discarded the signed Stage-A confirmation token, the interpretation CTA only opened an illustrative sample, and `/results/[jobId]` loaded productive `intel_*` jobs through the legacy `search_id` ownership path. A productive run also depended on opening the Institutional Brief to initialize Account Memory.

Current canonical path:

`authenticated Stage A -> signed confirmation -> persisted context -> productive run -> persisted Lead Hunter universe -> Research -> canonical Cases -> durable owner-scoped result -> baseline Account Memory -> canonical customer Monitor`.

## 3. Previous Customer Friction

| Seam | Previous state | Current state |
|---|---|---|
| Confirmation | Token discarded by browser | Preserved and submitted by explicit authenticated action |
| Run start | API only | Existing interpretation interaction starts canonical sample run |
| Result | `intel_*` queried through incompatible legacy endpoint | `intel_*` uses owner-scoped productive endpoint |
| Account Memory | Brief view caused hidden initialization write | Productive completion initializes baseline |
| Monitor | API existed, no result action | Result has a minimal canonical review action |

Remaining friction: an anonymous visitor must sign in and repeat Stage A; run progress is coarse; synchronous runtime is unsafe for the observed full run; Account Memory detail remains summary-level.

## 4. Customer Auth

Real Supabase Auth was used. Two disposable confirmed users were created, signed in through the anon client, and removed in `finally`. Customer ownership originated from bearer JWTs. No service-role shortcut represented the customer request; service role was used only for setup, inspection and cleanup.

## 5. Stage A

- Real `/api/interpret` route.
- Real Anthropic model mode (`llm`), one call.
- Status `ready_for_confirmation`.
- Latency: 12,762 ms on the passing E2E (14,334 ms on the diagnostic run).
- No Evidence, Timing, Decision or account ranking returned.

## 6. Confirmation

- Real `/api/customer/contexts/confirm` action.
- Signed token owner-bound and explicitly submitted.
- Context persisted through the product API, not direct DB insertion.
- Latency: 784 ms.
- Same `context_id` and `client_id` were persisted independently for two owners.

## 7. Intelligence Run

- Real `/api/customer/intelligence-runs` route.
- Plan `sample`, delivery limit 2, Research limit 8.
- Completed and durably reloaded.
- Total run latency: 508,576 ms (8m 28.6s), above the route's 300s deployment budget: **blocking serverless risk**.
- Retry returned the same completed run with `reused=true`; no duplicate Research.

## 8. Lead Hunter

Lead Hunter ran autonomously from the confirmed context. No candidate list was supplied by the customer or acceptance harness. Its durable run reference was persisted and reloaded before Research.

A real integration defect was found and fixed: `company-first` knew candidate country, but `DiscoveryMetrics.universe_accounts` and the Lead Hunter adapter dropped it. The productive geography gate therefore rejected 13/13 US candidates. Country now survives Company Universe -> Lead Hunter -> Research, and the rerun retained 14/14.

## 9. Candidate Universe

Passing run: 14 unique candidates; 13 had verified domain identity and one (`ALAC International`) was plausible without a domain. No duplicate or explicit wrong-entity was observed in the persisted set.

Manual autonomy review:

- Identity precision was generally good.
- Commercial relevance was weak: wellness, grocery and hospitality accounts entered a manufacturing/distribution automation context.
- Candidate-universe precision is therefore insufficient for self-serve despite identity correctness.

## 10. Research

- 8 persisted candidates researched.
- 8 evidence-quality classifications completed; 0 reported as technically insufficient.
- Outcomes logged: 6 COLD, 2 DISCARD.
- 0 grounded opportunities, 0 dated material events, 0 Prioritize decisions.
- This was honest but low-value output.

## 11. Canonical Case

Canonical Cases were generated through the existing `synthesizeCase` authority. No alternate customer-facing decision engine was added. The delivered cases remained non-priority and did not manufacture Timing.

## 12. Durable Result

`snapshot_reports` held the productive run and report. The owner reloaded it through `/api/customer/intelligence-runs/[runId]`; the second tenant received 404.

## 13. Result Surface

`/results/[jobId]` now detects `intel_*` IDs and loads the canonical authenticated endpoint. Legacy/search-backed jobs keep `/api/report`. Build confirms the route is present. The acceptance verified the same data contract used by the page, but did not retain a disposable customer long enough for a post-run visual browser session.

## 14. Manual Monitor

The immediate LIVE customer Monitor action completed against the canonical engine but selected 0 accounts because the new baseline was not due. This is correct cadence behavior and used no provider.

A separate CONTROLLED provider-backed smoke used an old synthetic snapshot for the real public identity Rockwell Automation:

- authenticated customer route;
- canonical name + United States + corporate domain query identity;
- 1 due / 1 selected / 1 attempted;
- 8 search results considered;
- 1 provider failure, viable remaining coverage;
- 8 temporal/materiality rejects;
- 0 accepted events;
- `completed_no_change=1`;
- latency 3,676 ms;
- all rows and auth user removed.

## 15. Account Memory

The passing productive run persisted 2 baseline snapshots for 2 delivered cases before result viewing. Immediate Monitor created no duplicate because no account was due. The controlled Monitor acceptance exercised accepted Review2 persistence in prior canonical tests and no-change provider behavior here.

## 16. Cross-Tenant Safety

- Same context/client labels persisted independently.
- Productive run IDs differ by owner.
- Owner B received 404 for Owner A's run.
- Account Memory rows are owner + client scoped.
- Disposable records and auth users were cleaned.

## 17. Provider Health

Observed probes on 2026-08-27:

| Provider | State |
|---|---|
| Anthropic | healthy; one-token probe passed |
| Brave | healthy, HTTP 200 |
| Tavily | healthy, HTTP 200 |
| Firecrawl | healthy, HTTP 200 |
| Exa | healthy, 3 normalized results |
| SEC EDGAR | healthy, 1 normalized record |
| Serper | degraded, HTTP 400 |
| SAM.gov | degraded/provider error |

Provider presence was not treated as health; each state came from a live probe.

## 18. Real Provider Intelligence Run

Synthetic context: warehouse automation/WMS for US manufacturers and distributors with owned logistics infrastructure and recent operational change.

- candidates persisted: 14;
- researched: 8;
- delivered: 2;
- observed run ledger deltas: Anthropic 20 calls, Brave 89, Serper 89, Tavily 84;
- exact success/error split and dollar cost were not captured correctly by the first acceptance artifact; the script is corrected for future runs;
- latency: 508,576 ms;
- outcome: technically completed, commercially weak, no grounded opportunity.

The observed search-call volume is too high for a supposedly small acceptance and requires budget enforcement before self-serve.

## 19. Real Provider Monitor Run

See section 14. Outcome was honest no-change. It did not fabricate a material event to make the smoke pass.

## 20. Full-Text

- LIVE customer Intelligence: provider retrieval ran, but the stored report did not expose a defensible full-text fetch count.
- CONTROLLED live Monitor: no page naturally crossed escalation gates (`pagesEscalated=0`).
- CONTROLLED deterministic integration: 23/23 canonical full-text tests prove fetch, structured extraction, injection defense, event validation and fallback.

Therefore full-text is **CONTROLLED-VERIFIED, not live-triggered in this E2E**.

## 21. Manual Quality Review

| Account | Identity | Context relevance | Evidence | Event date | What Changed | Fit | Timing | Counterevidence | Decision | Manual verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| Sprouts Farmers Market | Correct domain/country | Adjacent, not core stated ICP | Weak; ambiguous `Sprouts.ai` association | None | None | Plausible structural | Unsupported | Honest incumbent/ambiguity risks | COLD / Monitor | BORDERLINE MONITOR, not outreach-ready |
| ALAC International | Plausible, no domain | Structurally relevant distributor | Very weak | None | None | Requires warehouse/size proof | Unsupported | Honest 3PL/size/compliance risks | COLD / Monitor | MONITOR/REJECT until identity and operations verified |

No obvious wrong entity was accepted. Neither account is a commercially defendible opportunity now. The result is honest but does not establish customer value.

## 22. Latency

| Stage | Passing live measurement |
|---|---:|
| Stage A | 12,762 ms |
| Confirmation | 784 ms |
| Lead Hunter + Research + Case/report | 508,576 ms |
| Immediate Monitor (0 due) | 352 ms |
| Controlled provider Monitor | 3,676 ms |
| Total passing journey harness | 525,894 ms |

## 23. COGS

Provider call counts above are observed ledger deltas. Exact USD cost is unavailable for this run; it is not estimated. The acceptance script now records errors, token deltas, calculated Anthropic list cost and pricing source correctly for future executions.

## 24. Retry / Failure

- Completed retry: idempotent, same run ID, `reused=true`.
- Research failure: deterministic productive-spine regression leaves durable `failed` state and retained universe for retry.
- No fake completed result is produced.

## 25. Zero-Candidate / Low-Evidence

- Diagnostic E2E exposed a zero-after-geography path and still produced a completed empty report; it did not fabricate accounts.
- Lead Hunter all-provider failure tests return an honest failed/empty universe.
- Low-evidence live cases remained COLD/Monitor with empty timing signals and explicit missing data.

## 26. Legacy Paths

- `/api/customer/discovery`: **DEPRECATED BUT SAFE**, delegates productive spine.
- `/api/monitor/[id]/run`: **STILL REQUIRED** dashboard compatibility adapter to canonical Monitor.
- `/api/report`: **STILL REQUIRED** legacy/search-backed result loading; productive `intel_*` bypasses it.
- Legacy reports without owner scope: **REMOVE BEFORE BROADER LAUNCH** or retain admin-only.

## 27. Tests

- New customer journey seams: 12/12.
- Productive spine: 25/25.
- Geography: 5/5.
- Lead Hunter: 27/27.
- Required Intelligence/Monitor/Memory/context/full-text/provider/case/deliverable/commercial regressions: 371/371.
- Deterministic total reported this sprint: **440/440**.
- Live customer E2E: diagnostic 13/14, then passing 15/15 after fix.
- Controlled live Monitor: passed.
- TypeScript: passed sequentially.
- Build: passed, 150 pages.
- `git diff --check`: passed.

## 28. Production Verdict

`CUSTOMER INTELLIGENCE E2E NOT VERIFIED`

The chain is technically real and owner-safe, but the observed 8m28s synchronous runtime exceeds deployment safety and the only two delivered accounts were weak COLD/Monitor cases. A customer-reachable chain alone is not enough to call this production-verified.

## 29. Maturity

- Core Intelligence components: 91%.
- Operationally integrated Intelligence: 82%.
- Limited Self-Serve Intelligence readiness: 58%.
- Broader paid-launch Intelligence readiness: 38%.
- Normal happy-path autonomy: 75% technically, materially lower for commercial quality.

## 30. Launch Readiness

- Internal pilot: YES, with founder QA.
- Closed alpha: YES, bounded and manually reviewed.
- Limited self-serve beta: NO.
- Paid public launch: NO.

## 31. Remaining Blockers

### BLOCKER BEFORE LIMITED SELF-SERVE

1. Move/continue long Research outside a synchronous 300s request or prove a bounded configuration consistently below the limit.
2. Improve Candidate Universe commercial relevance; correct identity is not enough.
3. Enforce real provider/research call budgets; the sample run made excessive observed calls.
4. Prevent commercially weak COLD-only output from feeling like a successful opportunity delivery; preserve an explicit honest terminal state.
5. Exercise a naturally triggered live full-text escalation.

### IMPORTANT NON-BLOCKING

1. Preserve authenticated Stage-A state across login instead of asking the user to repeat it.
2. Show finer-grained processing progress.
3. Add deeper Account Memory state to customer result reload.
4. Capture exact COGS in the acceptance artifact.

### POST-BETA

1. Remove legacy unowned report semantics.
2. Activate scheduler only after soak and stale-run recovery.

## 32. Cron Activation Recommendation

**NOT YET SAFE TO ACTIVATE.** Canonical Monitor itself is consolidated, but customer-run latency/budget behavior and live-provider soak are insufficient.

## 33. Recommended Next Move

Smallest next sprint: **BOUNDED ASYNC CUSTOMER RUN + DISCOVERY RELEVANCE ACCEPTANCE V1**. Preserve the current spine, move material work behind the existing durable lifecycle, enforce sample budgets, and require one manually confirmed commercially relevant Case before limited self-serve.
