# LeadLens — Deliverable System V1.1 (Final Productization)

Extends the V1 interactive deliverable into a **repeatable LeadLens product** that makes the
full intelligence obvious — not "a list of companies." Closes the three V1 P1s (Comparison,
Exports, second fixture) and adds the strategic requirement: surface the complete value
(commercial context, criteria, validation queue, methodology) in every deliverable. V1
architecture preserved; landing frozen (guards 78/78). Initial HEAD `5c62721`.

## Value inventory (what LeadLens produces vs. what the product now shows)

| Intelligence | Exists in report | V1 shown | V1.1 shown | Export | Where |
|---|---|---|---|---|---|
| Commercial context (ICP summary, regions, industries) | yes (`context`) | ✗ (dropped) | **✓** | — | Portfolio (disclosure) |
| Opportunity criteria | Amor `what_changed.after`; institutional none yet | ✗ | **✓ where present** | — | Portfolio context |
| Prioritized portfolio + decision states | yes | ✓ | ✓ | CSV | Portfolio / Accounts |
| Decision distribution + allocation + funnel | yes | ✓ | ✓ | — | Portfolio |
| **Validation queue (cross-account)** | derived from `validations[]` | ✗ | **✓** | — | Portfolio |
| Account thesis / why-it-matters | yes | ✓ | ✓ | CSV | Account Brief |
| What Changed (dated) | yes | ✓ | ✓ | CSV | Account Brief / Compare |
| Evidence summary + provenance + relation | yes | ✓ | ✓ | Evidence CSV | Brief / Evidence tab |
| Freshness / age | yes (dated) | partial | ✓ | CSV | Brief / Compare |
| Corroboration (grounded) | yes | ✓ | ✓ + **coverage count** | CSV | Brief / Portfolio |
| Counter-signals / risks | yes | ✓ | ✓ | — | Account Brief |
| Limitations / what limits confidence | yes | ✓ | ✓ | CSV | Account Brief |
| What to validate | yes | ✓ | ✓ + **queue** | CSV | Brief / Portfolio |
| Decision rationale + next step | yes | ✓ | ✓ | CSV | Account Brief |
| **Account comparison** | derivable | ✗ | **✓ (Compare tab)** | — | Compare |
| **Methodology + decision/relation definitions** | static + `methodology[]` | partial | **✓ (How to read)** | in PDF | Portfolio |
| Market/segment intelligence, dossiers, strategy | sparse/absent in current reports | ✗ | capability slot, not fabricated | — | (gated; §data-gaps) |

**Hidden value now surfaced:** commercial context, opportunity criteria, cross-account
validation queue, corroboration coverage, per-account freshness in a comparison, and a
repeatable "How to read this" (decision-state + evidence-relation definitions).

## Architecture

- **View model** (`lib/deliverable/deliverable-view-model.ts`) extended: `commercialContext`,
  `validationQueue`, `coverage.corroborated`, `capabilities.showCompareTab`,
  `downloads{pdf,portfolioCsv,evidenceCsv}`. Adapters (`fromInstitutionalReport`,
  `fromAmorPilot`) populate them; no bespoke per-customer code.
- **Exports** (`lib/deliverable/exports.ts`): pure, testable `portfolioCsv`, `evidenceCsv`
  (RFC-4180 escaping; objects never leak), `deliverableFilename`. Client wiring in the
  workspace downloads a Blob (customer action). PDF is a **deliberate print document** — a
  hidden `.dlv-print` stack (cover → portfolio summary → every Account Brief) revealed only
  in print, with page-break rules; interactive chrome is suppressed.
- **Tabs:** Portfolio · Account Briefs · **Compare** · Evidence · Downloads (capability-gated).
- **Compare:** select 2–4 accounts; matrix of Decision / Fit / Timing / Evidence / Freshness /
  What Changed / Thesis / Primary limiter / Validate next / Next step. **No aggregate score.**
  A deterministic "LeadLens read" orders by decision priority then freshness and phrases the
  lead from the account's *own* fields (never fabricated). Desktop matrix (sticky row header);
  mobile scrolls inside its card.
- **Portfolio:** commercial-context disclosure, decision distribution + allocation + funnel,
  Where-to-focus, **validation queue**, coverage (dated / sources / corroborated / grade),
  and a **"How to read this"** disclosure (decision-state + evidence-relation definitions +
  methodology + the "absence of evidence ≠ evidence of absence" note).
- **Account nav:** decision filter chips (All / Prioritize / Validate / Monitor / Hold) when
  >3 accounts; reload-free switching + `?account=` deep link retained.

## Compatibility (real + second fixture)

| Report | Accounts | Market | Result |
|---|---|---|---|
| Amor de Gea (real, bespoke, ES) | 10 | Colombia | ✅ renders read-only; now also Compare + Downloads |
| Second fixture (institutional shape via real assembler) | 6 | UK/DE/FI/FR/DK/IE | ✅ 4 decision states incl. Hold; undated account graceful |
| Synthetic (Northstar/FreshRoute/Atlas) | 3 | US | ✅ |

**Note on "second real report":** the only *real customer deliverable* on disk is the Amor
pilot; production customer reports live in Supabase (`snapshot_reports`) behind auth and are
not accessible here. The `discovery-v2-*` files in `output/` are **internal discovery
instrumentation** (provider calls, candidate noise like "PMMI, The Association…") — not
deliverables; rendering them as opportunities would fabricate value, so they were rejected as
a fixture. The second fixture is therefore a distinct institutional-shape report (different
market/size/evidence density) run through the **real production assembler**, exercising the
exact code path. This is a renderer-generalization gap, logged separately from any
intelligence-generation gap.

## QA

- **Compare:** verified desktop (4-way matrix, LeadLens read, no score) and mobile (scrolls in
  card, page overflow 0). Undated account → "—"/"not dated" (graceful).
- **Exports:** portfolio CSV = header + 1 row/account; evidence CSV = header + 1 row/source;
  RFC-4180 escaping (commas/quotes/newlines), Unicode preserved (Éteka, GmbH), no
  `[object Object]`; safe dated filenames. PDF print doc contains all briefs, hidden on screen.
- **Responsive:** 0 horizontal overflow measured at 1280 and 375; tables scroll inside their
  card; filter chips/compare chips wrap; ≥44px tap targets on tabs/nav.
- **Tests:** `test:deliverable` **52/52** (adds context/queue/compare capability, CSV
  row-counts + escaping + Unicode + no-object-leak + filenames, second fixture with 4 states +
  Hold + graceful undated, export-source security). `test:v7-landing-guards` **78/78**.
  `test:commercial-continuity` **17/17**. `tsc` clean. `rm -rf .next && npm run build` clean.

## Security
Canonical `/results/[jobId]/brief` server-side ownership + assembly unchanged; the browser
receives only the curated view model. Exports derive **only** from the view model (guard 46:
no `report_json`/`processed_leads`/`_vault`). No new routes, no download URL, no billing/
discovery/provider/entitlement change. Amor preview stays dev-only (404 in prod).

## Tier mapping
`capabilities` (from `ReportExperience`) gate Portfolio/Compare/Evidence/Downloads/Methodology.
Preview → validation-focused subset; Brief → +compare/portfolio; Intelligence → +allocation/
coverage; Premium → deepest. Same workspace, different depth — no fake entitlements.

## Files
`lib/deliverable/deliverable-view-model.ts`, `lib/deliverable/adapters.ts`,
`lib/deliverable/exports.ts` (new), `components/deliverable/OpportunityWorkspace.tsx`,
`app/dev-brief-preview/page.tsx`, `scripts/fixtures/deliverable-renderer.test.ts`, this report.

## Remaining
- **P0:** none.
- **P1:** market/segment intelligence + dossiers + portfolio strategy (blocked on
  intelligence-generation, not the renderer — the report data is sparse); account search for
  20+; persist compare selection in URL.
- **P2:** Account Memory diff; annotations/collaboration; richer corroboration when the
  pipeline emits relation metadata; remove superseded `BriefView.tsx`.

**Recommended next sprint:** market/segment intelligence + dossiers (needs pipeline output),
plus account search + compare-URL state. Est. 8–12 hours.

**NOT PUSHED** (GitHub Desktop) — founder handoff for deploy.
