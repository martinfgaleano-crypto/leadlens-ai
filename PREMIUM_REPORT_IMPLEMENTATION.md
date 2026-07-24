# Premium Report — Implementation Notes

## Data contract (fuente única)
`GET /api/admin/pilot/artifact` (requireAdmin) → { origin, run_id, available_runs, client, market, manifest, metrics, candidates[] }.
- Lee ml/data/pilot-amor-de-gea/<latest>/{manifest.json,discovery.json}. `?run=<id>` selecciona corrida.
- candidates[] parseado de discovery.candidates.raw_context → {company, domain, date, confidence, org_type, signal_kind, materiality, corroboration, identity, fact, score, verdict, objections, opportunity_kind, channel_evidence_grade}.
- origin siempre "harness_artifact" + origin_note (sin jobId de Supabase; nunca falsificado).

## Componentes (app/admin/pilot/artifact/page.tsx, client)
- Cover · Executive Decision Brief (métricas + narrativa) · Research Coverage & charts · Portfolio Overview (tabla) · Account Dossiers (hecho vs inferencia) · Methodology & Limitations.
- Charts inline-SVG, sin libs: BarChart (funnel, role mix, rejection reasons) y ScatterMatrix (portfolio: fit×actionability, size=confidence). Todos derivan del payload (single source), manejan 0/1/N, con título+subtítulo+denominador y fallback textual.
- Auth: adminFetch (x-admin-token de localStorage); 401 → CTA a /admin/login.

## Decisiones visuales
Institucional/sobrio: cover oscuro, tarjetas, pills de status por color (act/validate/investigate/monitor/channel/excluded), banner honesto de delivery. Sin promoción artificial: channel_access siempre "investigate" + label channel_fit_not_buying_intent; score secundario a decisión/evidencia/limitación.

## Pendiente
Brief y PDF premium (reutilizar este data contract). Rubric de calidad + tests de consistencia Report/Brief/PDF/Admin.
