# LeadLens — Customer Deliverables V2 · Premium Experience Audit

Audit only (no redesign implemented). Grounded in the **actual rendered product**: the real
`OpportunityWorkspace` digital report rendered via the dev-only synthetic harness
`/dev-brief-preview?tier=premium&ctx=1` (dev server, NODE_ENV=development), plus source inspection of
the PDF renderer, tier composer, and synthesis. Main HEAD `0c4673f`.

## Headline finding
The current deliverable is **better than "too basic"** — it is a clean, editorial, tabbed commercial-
intelligence workspace with genuinely strong information architecture and company dossiers. The
founder's concern is partly valid but localized: the weaknesses are **the chart system (near-absent),
the PDF's typographic/character limits, Overview visual density, a partially-empty Compare table, a
mixed-language synthesis bug, and subtle Premium differentiation** — not the core structure. The right
move is **refine + add**, not rebuild.

## Repository / rendering system
- Digital report: `app/results/[jobId]/brief/{page,BriefView}.tsx` → `getBriefForViewer` (server,
  ownership + assembly) → `components/deliverable/OpportunityWorkspace.tsx` (1046 lines; tabbed).
- Tier composition: `lib/delivery-system/tier-composer.ts` (sections per tier, `maxAccounts`).
- PDF: `app/api/results/[jobId]/export/pdf/route.ts` → `lib/delivery-system/renderers/pdf.ts` (jsPDF,
  439 lines); CSV: `export/csv`. HTML renderer also present (`renderers/pdf-html.ts`, 139 lines).
- Dev visual harness: `app/dev-brief-preview` (synthetic data, `?tier=`, `?ctx=1`; 404 in production).
- **Historical designs:** no materially-different earlier "Codex" report design was located; the
  current OpportunityWorkspace + `delivery-system`/`packaging-clarity` lineage IS the current design
  (branches `delivery-system-v1`, `packaging-clarity-v1` are its history, now in main). The founder's
  recollection of "market mapping / buyer types / portfolio ranking / dossiers / charts": dossiers,
  portfolio ranking (Compare + Portfolio Intelligence), and a decision-distribution bar **exist today**;
  **market-mapping and buyer-type charts do not.**

## Visual evidence captured (dev harness, Premium tier)
1. **Overview** — wordmark + "ACCOUNT OPPORTUNITY INTELLIGENCE" + `Premium` badge · "Opportunity
   Portfolio" title · scope line (market · N evaluated · generated date) · tabs (Overview / Decision
   context / Opportunity Cases / Evidence / Compare / Portfolio Intelligence) · executive headline
   ("1 priority account identified across 3 markets") + summary · a Portfolio-Intelligence teaser card ·
   a **Decision Distribution** segmented bar (prioritize/validate/monitor/hold) with counts. **Issue:**
   a large empty vertical gap below the fold (dead space).
2. **Opportunity Cases** — master-detail: left account list (rank · decision · age); right dossier with
   **Fit / Timing / Evidence** tri-metric, Account Thesis, What Changed (dated + source), Supported-By
   evidence record (DIRECT source · Establishes/Observed/Affects), Counter-signals & Risks, Validate-
   Before-Acting. **Strong** — a real intelligence workflow, not an AI biography.
3. **Compare** — account chips (select N to compare) · a "LeadLens Read" synthesis · an attribute table
   (Decision / Account Role / Opportunity Type / Fit / Timing / Evidence × companies). **Issues:** the
   "LeadLens Read" **mixes Spanish into English** ("prioritize: encaje strong, señal temporal…"), and
   **Account Role / Opportunity Type cells are empty ("—")** — data-wiring gaps.
4. **Portfolio Intelligence** — a genuine portfolio synthesis: LeadLens Read, Where to Focus, Evidence
   Coverage (verified-recent / independent-support / no-verified-change), Recommended Direction
   (Focus / Monitor). **Strong.**

## Brand audit
- **Wordmark:** the existing "Lead**Lens**" name-based wordmark is applied consistently — web header,
  PDF cover, and PDF footer (reproduced natively in `pdf.ts`; rounded "L" mark + sky accent). No new
  logo needed; the system is coherent. Minor: the tier badge could be more prominent as a premium cue.
- **Palette:** cobalt/sky accent on near-black ink over white/very-light neutrals — restrained,
  professional, good contrast. Decision colors are present (prioritize cobalt, monitor slate, etc.) and
  correctly paired with text labels (color is not the sole carrier). No garish red/yellow/green scoring.
- **Typography (web):** clean sans hierarchy (bold ink headings, slate body, uppercase micro-labels) —
  reads editorial. **PDF typography is the weak point:** jsPDF core **helvetica only** (no brand type)
  and **`ascii()` strips accents** — Spanish company names/content lose diacritics in PDF.

## Information architecture
Executive summary: present + strong (headline + synthesis + decision distribution). Company dossiers:
strong (see above). Portfolio synthesis: present + strong. Premium context ("Decision context" tab):
present (commercial benchmark, competitors, adjacent opportunities, ecosystem) but visually similar to
the rest. Evidence: dated, sourced, with Establishes/Observed/Affects — excellent. Uncertainty +
counter-evidence + next-validation: all present and prominent. **The first-30-seconds test passes** on
Overview (you learn what you bought, the headline conclusion, the decision split, where to start).

## Chart audit (the priority gap — §32)
- **Existing:** one **Decision Distribution** segmented bar (Overview) + text-based Evidence Coverage
  counts (Portfolio Intelligence). That is essentially the entire "chart system."
- **Missing, well-supported by existing structured data (presentation-only):**
  - Company **Fit × Timing** matrix/scatter (fit_score + timing are in the model) — the single most
    valuable premium visual; positions accounts by strength-of-fit vs recency-of-signal.
  - **Evidence recency timeline** per account (observed dates exist) — makes "what changed & when" legible.
  - **Source coverage / independence** small-multiples (sources per account, independent support) — feeds
    the coverage narrative already shown as text.
  - **Decision distribution** upgraded from a bar to a labeled composition with per-account drill.
- **Data-dependent (NOT presentation-only → HQ dependency, §45):** market mapping (needs geographic
  precision the model does not carry), buyer-type composition (needs a buyer-type field), market share /
  ROI / opportunity-probability (**forbidden** — §34, fabrication). Do not build these from absent data.

## Tier differentiation matrix (`tier-composer.ts`, verified)
| Section | Preview (2) | Brief (6) | Portfolio (12) | Premium (18) |
|---|---|---|---|---|
| Portfolio synthesis | ✅ | ✅ | ✅ | ✅ |
| Commercial context | — | ✅ | ✅ | ✅ |
| Validation queue / What changed / Coverage | — | ✅ | ✅ | ✅ |
| Allocation · Compare · Methodology | — | — | ✅ | ✅ |
| Premium decision-architecture (synthesis/pathways/briefs/exec) | — | — | — | ✅ |
Tiers differ by **sections + depth**, not just company count — good and contract-honest. Premium's
differentiator (`premiumArchitecture` + Decision Context) exists but reads too close to Portfolio
**visually**; it needs a distinct visual treatment, not new content.

## Preserve / Improve / Rebuild / Remove
- **PRESERVE:** tabbed IA, company dossier (Fit/Timing/Evidence + thesis + what-changed + evidence +
  counter-signals + validate), Portfolio Intelligence synthesis, decision-distribution concept, the
  wordmark system, the tier-section model.
- **IMPROVE:** chart system (add Fit×Timing, evidence-recency, coverage small-multiples from existing
  data); Overview density (kill dead space, tighten rhythm); Compare (wire the empty Account
  Role / Opportunity Type cells; add light visual encoding); PDF typography (embed a real brand font,
  fix accent/Unicode handling); Premium **visual** differentiation; add an editorial **cover** to the
  web report; fix the **mixed-language** "LeadLens Read" (`portfolio-intelligence.ts`/`client-canvas-vm.ts`).
- **REBUILD:** PDF chart rendering (jsPDF hand-drawn → proper vector charts, or move the PDF to the
  existing HTML→PDF path `pdf-html.ts` for richer, font-embeddable layout).
- **REMOVE:** the Overview dead-space block.

## Three visual directions (for founder review — do not implement all)
- **A · Refined Cobalt Editorial (RECOMMENDED).** Keep the current cobalt/ink system; elevate with an
  editorial cover, a real type scale, the Fit×Timing signature chart, and tighter density. Lowest risk,
  preserves the strong IA, fastest path to "premium." Palette: ink `#0F172A`, cobalt `#1D4ED8`, sky
  `#38BDF8` accent, warm neutral ground `#FAFAF7`, rule `#E2E8F0`.
- **B · Deep-Navy Executive Research.** Navy `#0B1F3A` grounds, warm neutral paper `#F5F1E9`, restrained
  cobalt + a single amber `#C2703D` accent for "act-now" emphasis. More consulting-report gravitas;
  higher effort; risk of feeling heavier/less digital.
- **C · Light Ink-and-Accent (broadsheet).** Near-white ground, high-contrast ink, a single distinctive
  accent, hairline rules, serif display for titles + sans body. Most distinctive/editorial; highest risk
  of feeling less "software," and serif needs careful print/screen testing.

## V2 architecture (spec, not built)
- **Digital:** keep OpportunityWorkspace tabs; add a compact editorial cover/hero, the Fit×Timing chart
  on Overview + per-account evidence-recency, tightened spacing, Premium visual skin. Responsive/mobile:
  **not audited this sprint** (harness reviewed at desktop) — mobile behavior is an open V2 item.
- **PDF:** move to font-embeddable rendering (embed brand type; fix Unicode/accents); real vector charts;
  keep cover + section bands + branded footer; verify pagination/widow/table-split on 12- and 18-account
  orders.
- **Shared design system (minimum):** brand header/cover, decision indicator (color+label), company
  identity block, evidence record, uncertainty callout, next-validation block, comparison table, chart
  container (one primitive powering all charts, web+PDF), portfolio-synthesis block, source references,
  footer. Build only these — no speculative components.

## Implementation plan (phased; all presentation-only unless noted)
- **Phase 1 (largest customer-facing gain, lowest risk):** chart system (Fit×Timing + evidence-recency +
  coverage from existing structured data), Overview density fix, Compare empty-cell wiring + light
  encoding, mixed-language fix. No new Intelligence data.
- **Phase 2:** PDF typography (embed font + accent/Unicode) + PDF charts + cover polish + pagination QA
  on 12/18-account orders.
- **Phase 3:** Premium visual differentiation, web editorial cover, mobile/responsive audit + fixes.
- **Dependencies:** market-mapping / buyer-type charts require data the frozen model does not carry →
  **separate HQ decision** (do not silently expand Intelligence V1, §45); everything else is
  presentation-only.

## Scorecard (0–10, justified by observed evidence)
| Dimension | Score | Basis |
|---|---|---|
| Professionalism | 7 | Clean editorial layout, tabbed IA, wordmark + tier badge |
| Premium feel | 6 | Good but minimal charts, Overview dead space, ASCII-only PDF |
| Brand identity | 7 | Wordmark consistent web + PDF cover + footer |
| Color | 7 | Restrained cobalt/ink, good contrast, decision colors + labels |
| Typography | 6 | Strong on web; PDF helvetica-only, accent-stripping |
| Executive clarity | 8 | Headline + summary + decision distribution up top |
| Company intelligence | 8 | Fit/Timing/Evidence + thesis + dated evidence + counter-signals + validate |
| Charts | 4 | Only a decision-distribution bar + text coverage; biggest gap |
| Portfolio synthesis | 8 | Real Portfolio-Intelligence tab (focus/coverage/direction) |
| Premium differentiation | 6 | Decision-architecture layer exists but visually close to Portfolio |
| PDF quality | 5 | Branded cover/footer, but no real charts + accent loss |
| Digital usability | 7 | Tabbed master-detail, keyboard nav; Overview dead space |
| Commercial utility | 8 | Evidence-driven, validate-before-acting, honest uncertainty |
| Anti-generic-AI feel | 7 | Structured intelligence, not cards/biography; minor card repetition |

## Final red-team (three most serious)
1. **Chart system is near-absent** — for a "visually compelling, premium" report this is the #1 gap;
   the good news is the highest-value charts (Fit×Timing, evidence-recency) are fully supported by
   existing structured data (presentation-only).
2. **PDF is typographically/character limited** — helvetica-only + ASCII stripping degrades the paid
   artifact and breaks Spanish diacritics (the accepted market is Colombia); needs a font-embeddable
   PDF path.
3. **Mixed-language synthesis bug + empty Compare cells** — a real quality defect visible to customers
   in the exact accepted (Spanish-language) market; undermines the premium impression.

## Next action (one)
**Implement Phase 1 (charts + Overview density + Compare wiring + language fix)** — presentation-only,
no Intelligence-scope change, and the single set of changes that most raises the perceived premium value
using data the report already carries. This audit stops here for founder review before implementation.
