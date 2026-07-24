# Checkpoint — Primera corrida full_discovery de Amor de Gea (2026-07-24)

## Estado
- Rama `main`, tree limpio. Último commit de código: `9ab0c0a` (+ checkpoint `9c638b4`). ESTA sesión NO modificó código (solo probes + corrida), así que no se corrió release:check.
- Decisiones protegidas (NO reabrir): ranking actionability-first; channel_access (investigate/validate_first, `channel_fit_not_buying_intent`, nunca act_now solo).

## Providers (probe 2026-07-24, post-recarga Tavily)
- anthropic OK · supabase OK · firecrawl OK (~600cr) · **brave OK · tavily OK** · serper agotado (400 "not enough credits").
- `searchCoverageReadiness().sufficient = true` (brave+tavily). El gate del harness dejó pasar la corrida.

## Corrida full_discovery (dir ml/data/pilot-amor-de-gea/2026-07-24T18-36-23-380Z)
- operating_mode: **full_discovery** (provider_status {brave:available, tavily:available, serper:unknown}).
- Funnel: 15 empresas verificadas → 29 queries → 82 URLs (42 junk-prefiltradas) → 15 extracciones → 3 investigate / 12 reject → **2 candidatos emitidos**, 1 novel, **0 dynamic**.
- Rechazos (correctos): no_valid_date 10, no_material_event 7, historical_metric 3, stale 2, geography 2.
- Candidatos (ambos channel_access / investigar, do_not_deliver):
  1. GHL Hoteles (hotelería) — señal = informe sostenibilidad 2024, SIN fecha, historical_metric, corr low, 69/100 → useful validation candidate.
  2. Alimentos Sostenibles (distribuidor) — fecha 2024-09-07 (envejecida), materiality medium, 72/100 → useful validation candidate.
- status: **insufficient_dynamic_opportunities** · delivery: **do_not_deliver** · costo ~$0.22 ($0.198 discovery + $0.023 LLM) · 85s.

## Hallazgo clave
Con cobertura de búsqueda REAL (29 queries, 82 URLs), el sistema encontró 0 eventos de compra fechados/dinámicos para este ICP → el bloqueo ya NO es de providers sino de MERCADO/QUERY: la niche wellness-beverage colombiana no arroja eventos públicos frescos, solo páginas estáticas de canal. Diagnóstico honesto pasó de "no pudimos buscar" (provider_coverage_insufficient) a "buscamos bien y no hay evento fresco" (insufficient_dynamic_opportunities).

## Próximo paso recomendado
El lever ya no es recargar providers. Es la ESTRATEGIA DE QUERY para canal/wellness: probar queries orientadas a EVENTO (aperturas de tienda/resort, nuevos programas wellness, alianzas de marca, expansión de surtido) en vez de páginas de portafolio de canal — para que channel_access encuentre eventos dinámicos, no solo fit estático. Requiere: revisar EVENT_VERBS/channel query builder para el vertical wellness, correr de nuevo full_discovery, comparar dynamic_opportunity_count. (Opcional menor: el manifest del harness no copia provider_status/coverage desde discovery.metrics — está en discovery.json; surfacearlo mejoraría auditoría.)
NO re-auditar. NO reabrir ranking/channel_access. Leer este checkpoint primero.
