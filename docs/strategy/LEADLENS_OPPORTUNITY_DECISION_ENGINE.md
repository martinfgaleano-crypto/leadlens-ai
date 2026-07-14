# Opportunity Decision Engine v1 — Premium Decision Layer

**La diferencia intelectual de LeadLens: decisiones explicables, no listas.**

## Qué es

Pass determinista post-pipeline (`lib/quality/opportunity-decision.ts`, misma familia
que evidence-quality/signal-freshness): explica cada oportunidad, **jamás re-decide**
(no toca scores ni ranking) y **jamás inventa** — cada frase se ensambla de campos que
el pipeline realmente produjo; cuando falta evidencia, el campo lo dice honestamente.

## Componentes

1. **OpportunityDecision** por cuenta: thesis, why now, why this company, why this
   quarter, risk factors, confidence drivers, y el flag `evidence_grounded`
   (true solo con evidencia fechada y sourced — el reporte muestra
   "Evidence-grounded" vs "Validate before acting").
2. **Executive Playbook** (solo HOT): stakeholder recomendado, timing, hipótesis de
   valor, objeción esperada, ángulo de primera conversación — todo de info disponible,
   con fallbacks honestos ("Not identified from available sources…").
3. **Report Intelligence** — "Why this report is different": embudo real
   considered → rejected → selected. Monitor runs: candidatos encontrados vs
   procesados + descartes. Reportes Vault: los selection_stats reales del bridge
   (total_considered + rejection_reasons) viajan en la metadata del job y se
   mergean al completar.
4. **Rejection Intelligence**: solo agregados (conteo + motivo con label
   customer-safe: stale, already delivered, low confidence, rights not cleared,
   suppressed…). Nombres de empresas rechazadas jamás aparecen.

## Regla de grounding (testeada)

Fixture test 18/18: cuenta rica → thesis/why-now/quarter/risks/drivers citan las
señales reales; cuenta pobre → cada campo declara la falta de evidencia
("No dated or timing signal…", "profile matching only…"). Playbook solo en HOT.
Reportes legacy sin `decision` renderizan el layout anterior sin cambios.

## Seguridad

Cero cambios en auth, async pipeline, Vault schema, workspace, payments o APIs
públicas. Todo aditivo y condicional en UI.
