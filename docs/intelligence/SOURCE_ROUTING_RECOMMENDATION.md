# Source Routing Recommendation v1 (2026-07-15 — observación, sin automatizar)

Base: 24 queries reales (8 US/CO/MX), 72 extracciones. Artifacts:
ml/data/source-benchmark/. Auto-flags heurísticos pendientes de revisión humana.

## Evidencia que corrige la hipótesis del primer benchmark (n=1)

1. **Brave y Serper son COMPLEMENTARIOS, no primary/fallback**: 177 URLs únicas
   cada uno, solo 15 duplicados cruzados en 24 queries (~4% overlap). Ejecutarlos
   en paralelo casi duplica el descubrimiento. La ventaja de fechas de Serper del
   primer benchmark no se sostuvo a escala (dated ratio: Brave 62% vs Serper 59%).
2. **Tavily Extract funciona como extractor primario**: 60/72 extracciones
   directas; **Firecrawl ganó su lugar como fallback** (12 rescates; 93% éxito
   combinado). No usar Firecrawl como buscador general: confirmado.
3. **Regional**: calidad US > CO > MX (qualified yield 33%/21%/17%), pero sin
   evidencia para routing regional diferenciado (dated ratios similares).
   El gap real es de **cobertura de fuentes en español**, no de provider.

## Recomendación (routing en observación — default sin cambios)

- Discovery: **Brave + Serper en paralelo** + dedupe canónico.
- Extracción: **Tavily primario, Firecrawl fallback por URL**.
- Sin especialización regional todavía (insufficient evidence).
- Gap a atacar: official-source rate ~3% — las queries genéricas casi nunca
  traen dominios oficiales; se necesita official-domain targeting
  (site:empresa.com/news) en la fase de corroboración.
- Bottleneck de qualified yield (24%): **freshness** (solo 25% ≤90d), no
  relevancia (85%) ni extracción (93%). Priorizar recency operators/filtros.

## Costo estimado (precios de lista, no facturado)

$0.73 total la corrida · $0.014/señal válida · $0.043/oportunidad calificada.
A este costo, 100 oportunidades calificadas ≈ $4.30 de sourcing.
