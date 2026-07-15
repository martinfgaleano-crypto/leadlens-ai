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

## Recency lever validado (2026-07-15, next-step b)

Re-corrida de las mismas 24 queries con operadores de recencia nativos
(Brave `freshness=pm/py`, Serper `tbs=qdr:m/y`, ≤90d). Comparación (flags
auto-evaluados, pendientes de revisión humana — el efecto es real y grande,
pero la magnitud exacta se confirma con calibración humana):

| Métrica | Wide | ≤90d |
|---|---|---|
| Fresh rate | 25% | **56%** |
| Resolved-date rate | 79% | 89% |
| Valid-signal yield | 75% | 83% |
| Qualified yield | 24% | **50%** |
| Extraction success | 93% | 90% |
| Costo/oportunidad calificada | $0.043 | **$0.021** |

Por región (qualified yield wide→≤90d): US 33%→63%, **CO 21%→63%**, MX 17%→25%.
El filtro de recencia **duplica** el qualified yield y **cierra el gap de
Colombia**; México sigue siendo el más débil (cobertura de fuentes ES, no
provider ni recencia). Costo por oportunidad calificada cae a la mitad porque
el yield sube (mismo número de llamadas).

**Recomendación actualizada (sigue en observación, defaults sin cambiar):**
al conectar `provider_search` al Lead Hunter, aplicar operadores de recencia
por defecto (≤90d, configurable por brief). Es la palanca de mayor impacto
medido y reduce costo. México necesita official-domain/ES targeting aparte.
