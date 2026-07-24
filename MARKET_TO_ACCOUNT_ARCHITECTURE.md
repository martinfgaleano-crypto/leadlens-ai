# Market-to-Account Intelligence (market-to-account-v1)

## Cambio de arquitectura
De `empresa → página estática → channel_access → investigate` a
`mercado → segmentos → universo → ranking estructural → selección → deep research → timing → acción`.
Clave: **una cuenta NO necesita señal reciente para entrar al universo**. Timing es un eje separado, no puerta.

## Módulo (lib/discovery/market-to-account.ts)
- **SEGMENTS** (7): retail, distribution, hospitality, wellness, food_service, corporate, amenities. Cada uno con ease_of_entry + commercial_potential (priors para marca wellness/botánica) + nota.
- **classifyBuyerSegment(name, sector, extra)** → {primarySegment, secondarySegments, buyerType, roleConfidence, segmentFit}.
- **computeStructuralScores(input)** → {fit, attractiveness, timing, evidence, actionability}. Dimensiones SEPARADAS. Reglas: timing null (sin fecha)→8; channel-only nunca act_now; act_now requiere timing≥62 + evidence≥60 + fit≥60.
- **selectAccounts(accounts, topN, perSegmentCap)** → shortlist por composite (attractiveness-led) con diversidad de segmento.
- **buildMarketLandscape(accounts, opts)** → {segments, buyer_types, funnel(discovered/verified/high_fit/shortlisted/validation/dynamic/monitor), top_by_segment, limitations}.

## Data contract (API /api/admin/pilot/artifact, requireAdmin)
Deriva de `discovery.metrics.universe_accounts` (sin costo live): { manifest, metrics, candidates[], marketLandscape, ranked[], shortlist[] }. Timing/corroboración se enriquecen si la cuenta coincide con un candidato emitido.

## Estados / actionability
act_now · validate_first · monitor · exclude. channel_fit_not_buying_intent preservado; score agregado NO domina — se muestran las 4 dimensiones.

## Pendiente (no implementado esta sesión)
Etapa 5 (deep account research por cuenta seleccionada con second-pass queries), event-first second pass en el harness, integración del ranking estructural DENTRO de la corrida (hoy se computa post-hoc desde el artefacto en la vista Admin).
