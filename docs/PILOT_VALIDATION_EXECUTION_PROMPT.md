# LeadLens — Prompt operativo de validación de pilotos

## Prompt

Continúa trabajando directamente en `/Users/martingaleano/leadlens-project` como responsable de producto, calidad de inteligencia, QA y operación de pilotos. El objetivo de esta fase es demostrar con evidencia reproducible si LeadLens entrega oportunidades B2B útiles y defendibles. No optimices para cantidad de código ni para métricas favorables: optimiza para descubrir la verdad rápidamente y mejorar el producto con ella.

Lee primero `docs/CONTINUITY.md`, `docs/GO_TO_MARKET_MASTER_CHECKLIST.md`, `docs/FIRST_PILOT_RUNBOOK.md` y `docs/HUMAN_OPPORTUNITY_ADJUDICATION.md`. Revisa el estado real del repositorio y preserva cambios existentes. Pagos y Lemon Squeezy están fuera de alcance hasta nueva autorización.

Prioridades, en orden:

1. conseguir una corrida real, sin mock, con provenance completa y presupuesto explícitamente autorizado;
2. adjudicar humanamente todas las oportunidades emitidas y rechazos cercanos al umbral;
3. medir precisión observada, fallas críticas, accionabilidad, cobertura de evidencia, costo y tiempo;
4. capturar utilidad, confianza, cuentas que el cliente trabajaría y cambio de decisión;
5. convertir cada falla material en causa raíz, prueba de regresión y corrección;
6. repetir Preview y Brief sobre el mismo ICP antes de sacar conclusiones de valor por tier.

Reglas de evidencia:

- fixtures prueban lógica, no calidad de mercado;
- una corrida sin revisión humana no demuestra precisión;
- `needs_validation` no cuenta como true positive;
- una falla crítica de identidad, rol, fecha, evidencia, privacidad o mock invalida el lote;
- no estimar recall global; solo registrar falsos negativos visibles;
- no afirmar “listo”, “preciso” o “validado” con menos de 5 oportunidades adjudicadas;
- para una señal inicial favorable exigir precisión observada ≥80%, cero fallas críticas y feedback completo;
- distinguir score automático, veredicto humano y outcome comercial;
- contacto, reply o meeting no prueban causalidad ni revenue;
- cuando falten datos, emitir `insufficient_data`, nunca rellenar o inferir.

Flujo de ejecución:

1. ejecutar preflight sin consumir proveedores;
2. si hay blockers de configuración, documentarlos y seguir con trabajo local que reduzca riesgo;
3. solo ejecutar providers con confirmación de presupuesto y token de confirmación;
4. conservar report, benchmark, deep trace, usage, adjudication y feedback bajo un mismo `pilot_id`;
5. generar el scorecard mediante `npm run pilot:scorecard -- <directorio-del-piloto>`;
6. revisar cualquier estado `blocked` o `review_required` antes de entrega;
7. actualizar continuidad únicamente con resultados observados;
8. escoger la siguiente corrección por severidad y frecuencia, no por facilidad.

Entregable de cada ciclo:

- estado honesto: `insufficient_data`, `failed`, `promising` o `validated`;
- denominadores junto a toda proporción;
- fallas críticas y clases de error;
- cuentas accionables vs validar/monitor/excluir;
- delivery readiness;
- costo y duración observados cuando existan;
- feedback del cliente cuando exista;
- claims permitidos y claims todavía prohibidos;
- siguiente experimento concreto.

No desplegar, comprar créditos, ejecutar una corrida con costo, contactar clientes ni modificar servicios externos sin autorización explícita.
