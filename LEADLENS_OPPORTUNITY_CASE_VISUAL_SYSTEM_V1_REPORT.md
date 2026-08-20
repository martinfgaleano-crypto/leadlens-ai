# LeadLens — Opportunity Case Visual System V1

Defines LeadLens's own visual language: the **Opportunity Case** as a recognizable object, a
documented palette, and a reasoning-spine signature — applied to the real portable deliverable.
Product architecture and security unchanged; landing outside the sample frozen. Initial HEAD
`cc63fd6`.

## Palette (see `LEADLENS_VISUAL_SYSTEM_V1.md`)
Verdict: **refine + formalize** the existing navy/blue/neutral family into named semantic tokens.
Brand Navy `#0b1220→#0c4a6e` (frame only, never all-dark) · Primary Intelligence Blue `#0284c7`
(selection/links/Prioritize) · Interactive Accent `#0ea5e9` (signature/spine nodes) · Evidence
`#0e7490` · Confirmed/Supporting green `#15803d` (evidence only — never "Prioritize=green") ·
Validate amber `#b45309` · Monitor/Hold slate · Uncertainty = calm neutral (never red) ·
background `#f5f7fa` · surface `#fff` · text `#0f172a/#475569/#94a3b8`. Decision states always
carry a **text label**; grayscale/print-safe.

## Two pilots (rendered, scored)
Same synthetic Opportunity Case, two compositions (`output/pilots/`):

| Criterion (of 10) | A · Flow-forward (reasoning spine) | B · Canvas-forward (framework grid) |
|---|---:|---:|
| Clarity | 9.4 | 8.9 |
| Distinctiveness | 9.4 | 8.8 |
| Friendliness | 9.3 | 8.7 |
| Premium | 9.3 | 9.2 |
| Info hierarchy | 9.4 | 9.0 |
| Decision clarity | 9.3 | 9.0 |
| Landing suitability | 9.4 | 8.7 |
| **Mobile adaptability** | **9.5** | 8.4 |
| **Overall** | **9.3** | **9.0** |

**Winner: Pilot A (Flow-forward).** Its left reasoning spine embodies LeadLens's differentiation
(a reasoning chain), gives one linear reading order, is a recognizable signature without the
logo, and stacks naturally on mobile — Canvas's two-column reading fights the eye and weakens on
small screens. Both screenshots preserved: `output/pilots/case-pilot-a-flow.html`,
`case-pilot-b-canvas.html`.

## Final Opportunity Case grammar (one coherent object)
Header band (Account Role · Opportunity Type when present → **account name + decision badge** →
segment·geography → **Opportunity Thesis** lead paragraph → Fit/Timing/Evidence strip) then a
**reasoning spine** of bands, each with a node on a 2px rail:
**What Changed** (signature accent node) → **Why It Matters Now** → **Evidence** (strength ·
independent support · latest · claim-first sources with Direct/Supporting/Context) → **What Could
Change the Case** (Weakens / Still unknown) → **What to Validate** (Decision-critical) →
**Decision** (badge + why + Recommended Next Step, closing node). Bands render only when data
exists — graceful absence, no fabrication, **no aggregate score**. Verified: the Case renders as
**one object with 0 inner cards** (box-box-box eliminated), 0 horizontal overflow at 1280 & 390.

**15-second test:** at a glance a reader gets account, decision, Fit/Timing/Evidence, the thesis,
and What Changed; the spine then leads them to Evidence → uncertainty → validation → decision.

## Applied to the portable deliverable
`render-portable.ts` `briefHtml` rewritten to the flow-forward Case; locked customer vocabulary
(Opportunity Thesis, What Changed, Why It Matters Now, Evidence, What Could Change the Case, What
to Validate, Decision, Direct/Supporting/Context). View model gained optional `accountRole` /
`opportunityType` (**null unless the source provides them** — architecture ready for
Supplier/Distributor/Partner per §8, never fabricated for Amor/institutional). Portfolio executive
layer (LeadLens Read, Where to Focus, Validation Agenda, Decision distribution) from V1.1 retained.
Amor HTML **94.2 → 97.0 KB** (well under 200); still zero external assets / zero network,
file://-verified, secret-scan clean.

## Amor de Gea (regenerated, real, ES)
`output/deliverables/amor-de-gea/2026-08-03/LeadLens_Opportunity_Portfolio_Amor_de_Gea_2026-08-03.html`
— 10 accounts, each an Opportunity Case; pilot data **unmodified**, no content lost (thesis →
Thesis, evidence → Evidence spine, unknown → What Could Change, test → What to Validate, next →
Decision). Role/Type omitted (Amor has none — graceful). Admin preview/download preserved.

## Landing-sample decision — DEFERRED (honest)
The Opportunity Case is clearly superior to the current landing sample, **but the landing sample
area is locked by 78 passing guard tests** that assert its exact structure/classes; swapping it
means rewriting those guards and destabilizing a frozen, shipped surface. Per the sprint's own
fallback rule (§80), the safer call is to **keep the existing landing sample and defer the swap**
to a dedicated landing sprint (update guards + hero-context in one pass). The pilots + the live
portable Case are the proof that the replacement is ready. **Landing unchanged; guards 78/78.**

## QA / tests
- `test:portable` **45/45** (adds Opportunity-Case-object guards: one object + spine + locked
  grammar; role/type-not-fabricated; palette/thesis). `test:deliverable` 52/52,
  `test:v7-landing-guards` 78/78, `test:commercial-continuity` 17/17. `tsc` clean. `npm run build`
  clean. Injection/secret/URL/offline/file:// guards still green.
- Multi-role architecture test: `accountRole`/`opportunityType` render (pilot shows Potential
  Customer · Supplier Expansion) without breaking structure; null-safe for real data.

## Freeze
**Opportunity Case Visual Grammar Freeze = YES** for the portable deliverable (grammar, spine,
palette, decision states). Landing-sample adoption and workspace adoption are the next passes.

## Files
`lib/deliverable/portable/render-portable.ts`, `lib/deliverable/deliverable-view-model.ts`,
`lib/deliverable/adapters.ts`, `scripts/deliverable/render-case-pilots.ts` (new),
`scripts/fixtures/portable-deliverable.test.ts`, `LEADLENS_VISUAL_SYSTEM_V1.md`,
regenerated `output/deliverables/**` + `output/pilots/**`, this report. **Landing, workspace,
auth, billing, discovery, providers — unchanged.**

## Remaining
- **P0:** none.
- **P1:** adopt the Case grammar on the landing sample (with guard rewrite) and in the
  authenticated workspace via shared primitives; emit `accountRole`/`opportunityType` +
  Potential Value/Feasibility from the pipeline so the Case shows them for real reports.
- **P2:** Living Case / Account Memory evolution view; Decision Basis deep drill-down layer.

**NOT PUSHED** (GitHub Desktop) — founder handoff.
