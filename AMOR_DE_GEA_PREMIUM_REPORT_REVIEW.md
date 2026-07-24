# Amor de Gea — Premium Report Review (run 2026-07-24T18-36-23-380Z)

## Funnel (full_discovery, brave+tavily; serper agotado)
15 empresas verificadas (buyer_channel 7 · unknown 6 · hospitality 2) → 29 queries → 82 URLs (42 junk-prefiltradas) → 15 extracciones → 3 fechas válidas → opp_status {0 opportunity, 3 investigate, 0 monitor, 12 reject} → **2 candidatos emitidos**, novel 1, **dynamic 0**. Costo ~$0.221 · 85s.

## Rechazos (gates funcionando)
no_valid_date 10 · no_material_event 7 · historical_metric 3 · signal_not_associated 2 · stale 2 · geography 2 · reference_information 1.

## Cuentas
| Empresa | Score | Status | Señal | Fecha | Evidencia | Clasificación |
|--|--|--|--|--|--|--|
| GHL Hoteles | 69 | investigar | informe sostenibilidad 2024 (historical_metric) | sin fecha | corr low, channel_access | **useful validation candidate** |
| Alimentos Sostenibles | 72 | investigar | distribución declarada | 2024-09-07 (envejecida) | corr low, channel_access | **useful validation candidate** |
Ambas: channel_fit_not_buying_intent · sin act_now · sin buying intent · do_not_deliver.

## Delivery
status **insufficient_dynamic_opportunities** · **do_not_deliver**. Honesto: se investigó el mercado con cobertura real y no hay eventos frescos/accionables.

## Comparación
- vs corrida limitada previa (provider_limited, 1 query, 3 cand, provider_coverage_insufficient): ahora full_discovery, 29 queries/82 URLs — cobertura real; diagnóstico pasó de "no pudimos buscar" a "buscamos y no hay evento fresco".
- vs reporte ~6.5: artefacto no disponible en disco; no se inventa la comparación.

## Recomendaciones
1. Re-correr con las event-first queries nuevas y medir dynamic_opportunity_count.
2. Validación humana dirigida de GHL y Alimentos Sostenibles (¿apertura/renovación/convocatoria de proveedores reciente?).
3. Considerar ventana de recencia más amplia para wellness/hospitality si el mercado publica poco.
