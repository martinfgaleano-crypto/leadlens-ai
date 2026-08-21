# LeadLens — Product Truth & Parity Repair V1

## Baseline and scope

- Initial HEAD: `a02098e65829e1493c3ddfefc7db7a7b60a1640c`
- Source audit: `LEADLENS_CLIENT_CANVAS_PRODUCT_AUDIT_V1.md`
- Scope: product truth, cross-surface parity, localization, deterministic rendering, and low-risk navigation refinements.
- Preserved: Client Canvas architecture, auth, report ownership, landing outside the sample, pilots, billing, and the underlying intelligence pipeline.

## P0 repairs

### P0 #1 — attention order contradicted decisions

Root cause: Amor's legacy report rank/allocation order was rendered directly, so `Validate` accounts with smaller ranks appeared before `Prioritize` accounts.

Fix: `orderByAttention()` is now the shared canonical ordering contract. It orders by decision state:

`Prioritize → Validate → Monitor → Hold`

Inside one decision state only, an existing explicit report/allocation rank is the first tie-break; original array position is the stable final tie-break. No aggregate score was introduced.

Verification:

- Negative fixture proves a legacy-ranked `Validate` case cannot outrank `Prioritize`.
- Amor renders Ser Saludable, Masaya Collection, and Natural + Mente first as `Prioritize`, followed by the `Validate` cohort.
- The same helper feeds Canvas landscape, workspace focus, and account navigation.

### P0 #2 — hydration mismatch/root replacement

Root cause: static CSS constants were inserted as React style children (`<style>{CSS}</style>`). Browser raw-text parsing caused the hydrated style text—particularly selectors containing `>`—to differ from the server representation on the landing sample and authenticated Opportunity Workspace.

Fix: both trusted, hard-coded CSS constants now use deterministic style insertion with `dangerouslySetInnerHTML={{ __html: CSS }}`. No customer data enters these values, and `suppressHydrationWarning` is not used.

Verification:

- Source guards cover deterministic style insertion and prohibit suppression.
- Production-build browser QA at desktop and 390 px found no hydration mismatch, root replacement, error, or warning in the console.

## Commercial context contract

- **Client description:** what the client/company or its offer is.
- **Commercial Objective:** what the client wants LeadLens to determine, find, prioritize, or evaluate.
- **Scope / Market:** geography and commercial boundary of the work.

Amor paths:

- Objective: `success.objective`
- Client description: `readiness.strengths[0]`
- Scope/market: existing commercial-context geography and ICP fields

Before, the objective showed a product description: “Portafolio de tres elixires botánicos terminados con presentación premium.” After, it truthfully shows: “Mejorar qué cuentas validar primero y cómo preparar cada conversación.” Missing objectives remain absent instead of being invented.

## Change and evidence honesty

All current change pathways were classified as `true_change`, `recent_event`, `static_context`, `inference`, or `unknown` at the view-model boundary.

- Institutional dated fact-basis evidence is conservatively a `recent_event`.
- Amor's 10 legacy evidence facts have retrieval dates, not verified event dates, and are therefore `static_context`.
- Static evidence renders as **Evidencia actual**, not **Qué cambió**.
- A single-source case never claims independent corroboration.
- Unsupported Role, Opportunity Type, Fit, and Timing are omitted rather than rendered as unknown/empty chips.
- Portfolio Intelligence V0 explicitly says when cross-account patterns have not been established.

## Tab ontology and utilities

| Surface | Before | After |
|---|---|---|
| Landing | Overview / Opportunity Cases / Evidence / Compare / Strategy | Overview / Opportunity Cases / Evidence / Compare / Portfolio Intelligence |
| Portable | Portafolio / Cuentas / Comparar / Evidencia / Metodología | Resumen / Casos de oportunidad / Evidencia / Comparar / Inteligencia del portafolio |
| Workspace | Portfolio / Account Briefs / Compare / Evidence / Downloads | Overview / Opportunity Cases / Evidence / Compare / Portfolio Intelligence |

Methodology/How to Read and downloads are now compact secondary utilities outside the five intelligence tabs. Portfolio Intelligence V0 uses only existing facts: LeadLens Read, decision landscape, sequence, validation agenda, evidence coverage, and honest gaps. No market pattern or causal synthesis is fabricated.

## Localization

The Spanish Amor interface now localizes deterministic system copy, including Fit/Timing/Evidence dimensions, strength labels, Compare headers, focus summary, navigation, and absence states. Proper names and source-authored content remain unchanged. The inspected real case contains none of the known English glue labels (`Focus sharpened to`, `Strong`, `Moderate`, `Limited`, raw freshness labels).

## Product truth matrix

| Capability | Landing | Amor | Workspace | Real pipeline support |
|---|---|---|---|---|
| Decision-aligned ordering | Synthetic fixture | Yes | Yes | Shared renderer contract |
| Commercial objective | Explicit synthetic | `success.objective` | Shown when present | Optional truthful field |
| Opportunity Cases | Rich illustrative sample | Real cases | Real reports | Yes; depth varies |
| Evidence relations | Illustrative | Existing evidence only | Existing evidence only | Partial |
| True change | Illustrative | Static facts labeled current evidence | Structured semantics only | Partial; no full change engine |
| Role / Opportunity Type | Illustrative | Omitted | Omitted if absent | Not yet structured end-to-end |
| Portfolio Intelligence | Rich illustrative | Honest V0 | Honest V0 | Facts/coverage only; no synthesis engine |
| Corroboration | Illustrative | Zero independent support | Only when structured true | Partial |

## Mobile, accessibility, and utilities

- Primary tabs preserve `tablist`, `tab`, `tabpanel`, `aria-selected`, focus, and Arrow/Home/End keyboard navigation.
- At 390 px, an edge mask and partially scrollable tab rail communicate additional depth.
- Internal tab scrolling is allowed; page horizontal overflow measured zero.
- Tabs/utilities meet the 44 px interaction-height target.
- Exports remain discoverable but collapsed under secondary utilities.
- Existing Overview opportunity tiles were sufficiently explanatory, so no duplicate selected-case teaser was added.

## Real deliverable and QA

Regenerated artifact:

`output/deliverables/amor-de-gea/2026-08-03/LeadLens_Opportunity_Portfolio_Amor_de_Gea_2026-08-03.html`

Verified:

- client is Amor de Gea;
- 10 accounts remain;
- no useful account/evidence content was removed;
- `Prioritize` precedes `Validate`;
- objective is semantically correct;
- validations remain visible;
- static evidence and single-source limitations are honest;
- primary tabs and secondary utilities behave correctly;
- desktop/mobile page overflow is zero;
- portable output has zero remote assets and is self-contained;
- print CSS creates a deliberate print document and hides interactive UI.

Admin preview/download code and auth suites pass. A live admin-session visual check was not performed because the local route correctly redirected to the admin login guard; no auth bypass or ownership change was made.

## Screenshot evidence

Before:

- `/Users/martingaleano/leadlens-client-canvas-audit-screenshots/amor-opening-1280.png`
- `/Users/martingaleano/leadlens-client-canvas-audit-screenshots/amor-opening-390.png`
- `/Users/martingaleano/leadlens-client-canvas-audit-screenshots/amor-case-eteka-1280.png`
- `/Users/martingaleano/leadlens-client-canvas-audit-screenshots/landing-overview-1280.png`
- `/Users/martingaleano/leadlens-client-canvas-audit-screenshots/workspace-overview-1280.png`

After:

- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/amor-overview-1280.png`
- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/amor-overview-390.png`
- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/amor-case-1280.png`
- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/amor-portfolio-intelligence-1280.png`
- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/landing-1280.png`
- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/landing-390.png`
- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/workspace-1280.png`
- `/Users/martingaleano/leadlens-product-truth-parity-screenshots/workspace-390.png`

## Remaining honest gaps

P0 remaining: none.

P1:

- structured Account Role / Opportunity Type / Fit / Timing pipeline;
- full temporal change detection;
- evidence corroboration and relation depth;
- real cross-account Portfolio Intelligence synthesis;
- a truthful client name is unavailable in the representative institutional workspace contract, so its header remains generic rather than inferring identity from customer references.

P2:

- decision-first Compare refinement;
- automated authenticated visual QA and downloaded-PDF preview;
- deeper account dossiers and Account Memory presentation.

Recommended Sprint #2: enrich real Opportunity Cases with structured Role/Type, explicit Fit/Timing provenance, genuine temporal events, evidence relationships/corroboration, and client-safe validation rationale before adding full portfolio synthesis.
