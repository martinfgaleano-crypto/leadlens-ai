# LeadLens — Customer Delivery System V1

```
COMPLETED INTELLIGENCE SNAPSHOT
        │
        ▼
  DeliveryDocumentV1  (canonical DTO — tier/channel-agnostic)
        │
   ┌────┴─────┐
   ▼          ▼
TierComposer  ExportPolicy
   └────┬─────┘
        ▼
  PresentationModel  (one document, tier+channel resolved)
        │
   ┌────┼────┐
   ▼    ▼    ▼
  WEB  PDF  CSV
 living snap  operational
 product shot   data
```

## Why
Previously the deliverable layer conflated three concerns inside one `DeliverableViewModel`: the
content, the **tier** shaping (baked into `capabilities`), and the **channel** shaping (baked into
`downloads`), with ad-hoc CSV/PDF/web renderers reading it differently. Delivery System V1 separates
them into explicit, testable stages so one snapshot yields Web/PDF/CSV from a single source of truth.

## Stages (`lib/delivery-system/`)
- **`delivery-document.ts` — `DeliveryDocumentV1`**: the canonical, tier/channel-agnostic DTO. Reuses
  the proven deliverable ontology (`AccountBriefVM` etc., decisions from the single `caseDecision`
  authority). `fromDeliverableViewModel(vm)` bridges today's canonical VM into it (drops `capabilities`
  and `downloads`). This layer **never** makes a Decision, invents Evidence, or changes a date.
- **`tier-composer.ts` — TierComposer**: `TIER_COMPOSITION` (preview/brief/intelligence/premium →
  account cap + dossier depth `mini|standard|full` + section flags) + `composeForTier(doc, tier)`.
  Caps accounts, trims each dossier to depth, gates portfolio sections, and **recounts** the synthesis
  from the surviving accounts (numbers stay honest). Mirrors the frozen catalog limits (2/6/12/18).
- **`export-policy.ts` — ExportPolicy**: `EXPORT_POLICY` per channel (`web`=living product, `pdf`=
  snapshot artifact, `csv`=operational data) — which sections/fields each channel renders, orthogonal
  to tier. CSV columns are decision-oriented (no outreach, no opaque score — product truth).
- **`presentation-model.ts` — PresentationModel**: `toPresentationModel(doc, tier, channel)` applies
  the composer then the policy → one tier+channel-resolved `DeliveryDocumentV1` + channel metadata.
  `presentAllChannels(doc, tier)` yields all three from one document.
- **`renderers/`**: `renderCsv(pm)` (flat rows), `renderPdfHtml(pm)` (self-contained print HTML, no
  scripts), `toWebPresentation(pm)` (ordered section model the interactive web consumes). `shared.ts`
  has `deliveryFilename` + `dimensionValue`.

Tests: `scripts/fixtures/delivery-system-v1.test.ts` (31/31) — caps, depth, gating, honest recount,
channel policy, CSV columns/escaping, PDF section-honoring/escaping/no-scripts, web section order, and
"one document → three consistent outputs".

## Integration plan (replacing the fragmented path — staged for review)
The pipeline is additive and bridges from today's `DeliverableViewModel`, so existing surfaces keep
working until each is switched:
1. **CSV** (lowest risk): have the CSV export route/action call `renderCsv(toPresentationModel(
   fromDeliverableViewModel(vm), tier, "csv"))` instead of `lib/deliverable/exports.ts#portfolioCsv`.
2. **PDF**: point the PDF/print route at `renderPdfHtml(toPresentationModel(doc, tier, "pdf"))`.
3. **Web**: adapt `app/results/[jobId]/brief/BriefView.tsx` to render from `toWebPresentation(
   toPresentationModel(doc, tier, "web"))` (the section model), retiring the ad-hoc capability/download
   flags. This is the largest change (interactive React) — do it as its own reviewed step.
Tier comes from the product/order (`preview|brief|intelligence|premium`); the server passes it in — the
browser never chooses tier or channel content.

## Boundaries kept
No Intelligence/Decision/Evidence/temporal change; no pricing/billing/auth change; billing branch
untouched. This lives on `delivery-system-v1` (off clean `origin/main`) for review before any merge.
