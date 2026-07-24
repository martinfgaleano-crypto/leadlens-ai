# Primer piloto real (Colombia, guiado) — Runbook v2

Objetivo: validar utilidad y operación, no self-service. El primer piloto puede
ser sin cobro o bajo acuerdo manual explícito; ningún botón/webhook de pago se
activa. SLA conservador inicial: **entrega dentro de 2 días hábiles después de
aceptar el intake**, condicionado a providers verdes. Máximo: **1 piloto activo**.

## Cliente apto / no apto

**Apto:** empresa B2B con oferta clara para operaciones de flota, logística,
distribución o software operativo; geografía Colombia; puede explicar ticket,
triggers, exclusiones y qué haría con una cuenta priorizada.

**No apto:** solicita contactos/PII, cobertura exhaustiva, volumen garantizado,
LinkedIn scraping, resultados inmediatos, o vende algo sin relación verificable
con los vertical packs actuales.

## Requisitos previos (sin gasto)

1. `npm run pilot:e2e:preflight` → `ready=true`.
2. Working tree y commit registrados; `DEMO_MODE=false`, mock desactivado,
   payments cerrados, `PILOT_E2E_MAX_USD` explícito (máximo USD 5).
3. `npm run release:check` verde.
4. Intake y consentimiento archivados bajo un `pilot_id`; cero PII de prospectos.
5. Revisor humano y responsable de recuperación disponibles.

## Intake de 10 minutos

- empresa/oferta/value proposition/ticket;
- geografía, industrias y tamaño;
- problemas operativos que resuelve;
- señales de compra observables y exclusiones;
- objetivo (investigar, priorizar, crear watchlist);
- capacidad comercial y tolerancia al riesgo;
- qué sería un resultado útil y qué no debe aparecer;
- consentimiento para investigar fuentes públicas y retener el reporte/feedback.

## Pasos

1. **Health + benchmark con confirmación:** únicamente con preflight verde:
   `PILOT_E2E_CONFIRM=RUN_WITHIN_CONFIRMED_BUDGET npm run pilot:e2e:run`.
   El harness hace probes mínimos, detiene si Anthropic/Supabase/search/extraction
   no están verdes y guarda artefactos en `ml/data/pilot-e2e/<timestamp>/`.
   Nunca ejecutar desde CI.
2. **Crear piloto:** `/admin/pilot` → nuevo cliente → ICP (usar el formulario guiado; los packs cubren flotas/logística/software operativo) → tier **Preview** → idioma ES → ejecutar.
3. **Monitorear:** queued → processing → awaiting_review. Registrar tiempo real;
   no prometer ≤6 min hasta medirlo con stack vivo.
4. **QA:** completar `adjudication.csv` usando
   `docs/HUMAN_OPPORTUNITY_ADJUDICATION.md`. Cualquier critical → lote HOLD/FAIL,
   root cause → test → fix; nunca editar evidencia para rescatar.
5. **Comparación:** si Preview pasa, ejecutar Brief con el mismo ICP. Completar
   `comparison.md`: costo/tiempo, oportunidades compartidas, evidencia incremental,
   consistencia y valor de decisión. Una cantidad mayor no basta como valor.
6. **Publicar y verificar acceso:** owner 200, anon 401, no-owner 404; móvil y
   links de fuentes. Entregar solo después de `PASS` humano.
7. **Debrief con el cliente** (preguntas): ¿Contactarías a alguna de estas cuentas esta semana? ¿La razón "por qué ahora" es creíble? ¿Qué cuenta sobra y por qué? ¿Qué esperabas ver que no está? ¿Pagarías $7/$25 por esto?
8. **Registrar outcomes:** botones de feedback del reporte o POST `/api/feedback/opportunity` con `feedback_signal`: investigated/saved/contacted/replied/meeting/qualified/rejected/thesis_confirmed/thesis_wrong/won/lost (persisten en `opportunity_feedback`; alimentan el learning loop).
9. **Decidir repetición:** si ≥1 cuenta útil confirmada → repetir con Brief mismo ICP (comparación $7 vs $25). Si 0 útiles → revisar trace: ¿ICP, cobertura de providers, ausencia real de señales o gates? Documentar antes de re-correr.

## Entrega, soporte e incidentes

- Canal inicial: el acordado manualmente con el cliente; respuesta en 1 día hábil.
- Retraso/provider rojo: avisar, detener SLA y ofrecer nueva fecha o cancelación.
- Privacy/access incident: no entregar, revocar acceso, preservar logs mínimos,
  registrar incidente y avisar a Martín inmediatamente.
- Resultado vacío: entregar contexto de cobertura y qué se investigó; no rellenar.
- Refund: si hubo cobro manual, Martín decide/ejecuta y se registra la razón; el
  código de pagos self-serve permanece cerrado.
- Seguimiento: 7 y 30 días para outcomes; registrar tesis correcta/incorrecta.

## Qué revisar SIEMPRE antes de enviar
- 0 publishers/entidades públicas/homónimos; asociación con word-boundary visible en el trace.
- Fechas ≤90 días preferible; nada >180 (hard block).
- Español consistente; sin términos internos (gate, candidate, provider) en el reporte.
