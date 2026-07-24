# Premium Report V2 — Spec

## Estructura objetivo (orden)
Cover · Executive Decision Brief · **Market Landscape & Buyer Segments** · **Structural Account Ranking** · Portfolio Overview · Account Dossiers · Research Coverage & Diagnóstico · Methodology & Limitations.
(Implementado esta sesión: las dos secciones en negrita + las existentes. Pendiente: Timing&Signals, Commercial Strategy, Priority-account deep dossiers V2, Brief, PDF.)

## Admin vs Customer
- **Admin view** (actual, /admin/pilot/artifact): muestra todo incl. diagnóstico técnico (providers, rejection reasons, run mode, delivery codes, costos).
- **Customer report** (pendiente): misma data, sin códigos internos (do_not_deliver → lenguaje comercial), sin JSON/harness/provider diagnostics. Reutilizar el mismo data contract; ocultar secciones de diagnóstico.

## Componentes / charts (app/admin/pilot/artifact/page.tsx, inline-SVG, 0/1/N)
BarChart · ScatterMatrix (portfolio fit×actionability) · **SegmentMatrix (ease×potential, size=#)**. Charts nuevos: Buyer Segment Map, Segment Attractiveness Matrix, Market Funnel, Buyer Type Distribution. Todos derivan del payload (fuente única) con título+subtítulo+denominador.

## Data contract
Ver MARKET_TO_ACCOUNT_ARCHITECTURE.md. La página consume marketLandscape/ranked/shortlist/candidates/metrics/manifest.

## Decisiones visuales
Cover oscuro, tarjetas sobrias, pills por actionability, banner honesto de delivery, timing bajo en rojo. Score secundario a decisión/evidencia. Sin promoción artificial (channel_fit siempre investigate/monitor).

## Pendiente
Brief premium + PDF (reutilizar contract) · Customer/Admin split real (dos vistas) · rubric de consistencia Report/Brief/PDF con tests · deep dossiers V2 con second-pass evidence.
