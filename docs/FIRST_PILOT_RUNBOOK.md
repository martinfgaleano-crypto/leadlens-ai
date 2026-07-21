# Primer piloto real (Colombia, sin cobro) — Runbook

## Requisitos previos (10 min)
1. `/admin/operations/providers` → **Anthropic, Serper y Tavily en verde** (hoy: Anthropic con límite de uso hasta 2026-08-01 — subir límite en console.anthropic.com → Settings → Limits; Serper recargar ≈$50; Tavily subir plan o esperar ciclo). Firecrawl ya tiene 897 créditos.
2. `npm run test:intelligence-v3 && npm run test:counterevidence` verdes.
3. Dev server: launch config **"leadlens-project-dev"** (puerto 3000) — o producción en Vercel.

## Pasos
1. **Sanity de calidad** (~15 min, ~$0.50): `npm run bench:company-first`. Revisar el `deep-validation trace` impreso: cada emitida debe tener empresa correcta, fecha, rol, fit y sin blockers. Si aparece una fuga → root cause → test → fix → repetir SOLO el subconjunto.
2. **Crear piloto:** `/admin/pilot` → nuevo cliente → ICP (usar el formulario guiado; los packs cubren flotas/logística/software operativo) → tier **Preview** → idioma ES → ejecutar.
3. **Monitorear:** estados en la misma consola (queued → processing → awaiting_review). Duración esperada ≤6 min.
4. **QA (≤10 min):** revisar cada oportunidad: ¿empresa correcta? ¿evento real y fechado? ¿tesis específica (no intercambiable)? ¿counterevidence y "qué validar" presentes? ¿acción clara? Si algo falla → refine, NO rescatar a mano.
5. **Publicar y enviar** el link del reporte (`/results/[jobId]` / brief). Verificar que abre sin sesión admin y en móvil.
6. **Debrief con el cliente** (preguntas): ¿Contactarías a alguna de estas cuentas esta semana? ¿La razón "por qué ahora" es creíble? ¿Qué cuenta sobra y por qué? ¿Qué esperabas ver que no está? ¿Pagarías $7/$25 por esto?
7. **Registrar outcomes:** botones de feedback del reporte o POST `/api/feedback/opportunity` con `feedback_signal`: investigated/saved/contacted/replied/meeting/qualified/rejected/thesis_confirmed/thesis_wrong/won/lost (persisten en `opportunity_feedback`; alimentan el learning loop).
8. **Decidir repetición:** si ≥1 cuenta útil confirmada → repetir con Brief mismo ICP (comparación $7 vs $25). Si 0 útiles → revisar trace: ¿ICP, cobertura de providers, ausencia real de señales o gates? Documentar antes de re-correr.

## Qué revisar SIEMPRE antes de enviar
- 0 publishers/entidades públicas/homónimos; asociación con word-boundary visible en el trace.
- Fechas ≤90 días preferible; nada >180 (hard block).
- Español consistente; sin términos internos (gate, candidate, provider) en el reporte.
