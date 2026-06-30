# Retention Engine

**Documento vivo** — actualizar cuando se implemente Account Memory, cuando haya datos reales de churn, o cuando cambie el modelo de suscripción.
Usado por: Claude normal (diseño del loop de retención) y Claude Code (implementación de Account Memory, Anti-Repetition, Vault).

---

## A. Propósito

Documentar la lógica de negocio que justifica por qué un cliente debería renovar el Monthly Monitor, para que el diseño técnico (Account Memory, Anti-Repetition, Vault) tenga una razón de negocio explícita detrás, no solo una especificación técnica aislada.

---

## B. Decisiones actuales

- La recurrencia depende de cinco mecanismos: **Account Memory**, **Anti-Repetition**, **Evidence Quality**, **Source Freshness**, y **"What changed since last report"**.
- El **Vault** (memoria de feedback acumulada por cliente) es la pieza de defensibilidad más importante del negocio.
- **No se debe vender el Monthly Monitor a clientes nuevos hasta que Account Memory esté funcionando de forma visible**, no solo en backend.

---

## C. Métricas clave *(SUPUESTO, sin datos reales aún)*

| Métrica | Umbral | Nota |
|---|---|---|
| Churn mensual tolerable en etapa inicial | 8–12% | Por encima de 15–20% mensual el modelo de suscripción no es sostenible |
| Conversión "compra one-time" → "se suscribe al Monitor" | 15–25% deseado | SUPUESTO |
| Retención promedio objetivo | 8–12 meses por cliente suscrito | SUPUESTO |

---

## D. Qué está implementado

- Feedback MVP persistente asociado a `job_id` real.
- Vault MVP conservador (`applyVaultHints()`) que agrega metadata explicable sin cambiar scoring agresivamente.
- Vault Memory UI dentro de Opportunity Cards (validated pattern / caution pattern / insufficient feedback).
- Feedback linkage: `opportunity_feedback.job_id` apunta al snapshot real del run.

---

## E. Qué falta

**Account Memory / Anti-Repetition:** clasificación de cuentas como:
- `new` — primera vez que aparece
- `previously_seen` — apareció en reportes anteriores
- `repeated_without_new_signal` — repite sin evidencia nueva (causa #1 de churn)
- `reactivated_with_new_signal` — vuelve con señal nueva (positivo)
- `upgraded` — sube de categoría vs. reporte anterior
- `downgraded` — baja de categoría
- `dropped` — ya no cumple criterios
- `do_not_show` — excluida por feedback del cliente

**"What changed since last report":** vista comparativa explícita entre el reporte actual y el anterior — pendiente.

**Medición real** de churn y conversión (no hay datos de clientes reales aún).

---

## F. Riesgos

| Riesgo | Descripción |
|---|---|
| Vender Monitor sin Account Memory | Genera reportes mes a mes muy similares → causa más probable de churn temprano. |
| Clientes que no usan feedback | Si el cliente no da feedback, el Vault no aprende y la promesa de "mejora con el tiempo" no se cumple — rompe la tesis central de recurrencia. |
| Mayoría de clientes compra solo una vez | Puede indicar que el modelo correcto es reportes por evento/trimestrales en vez de suscripción mensual fija — sería un pivote de modelo, no un fracaso de producto. |

---

## G. Próximas acciones

1. Diseñar la taxonomía completa de estados de Account Memory (lista en sección E) en términos de negocio antes de pasar a especificación técnica.
2. Diseñar la vista de "what changed since last report" como elemento central del Results Page, no como feature secundaria.
3. Instrumentar desde el primer cliente real: tasa de uso del feedback, tasa de marcado "useful"/"meeting_booked", y si el cliente regresa sin que se le pida.
4. Establecer un proceso explícito de revisión de churn mensual una vez haya al menos 10 suscriptores activos.

---

## H. Criterios de éxito

La tesis de retención se considera validada cuando, en un grupo de al menos 10 suscriptores reales del Monitor durante 3 meses consecutivos, el churn mensual se mantiene por debajo de 12% y al menos 50% de los clientes interactúan con el feedback en cada ciclo.

---

## Por qué un cliente renovaría

El mercado cambia constantemente (nuevas empresas, nuevas señales, cuentas que suben o bajan de prioridad), y el feedback del cliente mejora la calidad de los reportes futuros. La renovación solo tiene sentido si el cliente puede **ver** ese cambio y esa mejora — de lo contrario, está pagando por la misma información repetida.

---

## Señales tempranas de churn a monitorear

- El cliente deja de dar feedback en oportunidades (señal de desconexión del producto).
- El cliente no abre o no revisa el reporte del mes (si esta métrica se puede instrumentar).
- Las oportunidades del nuevo reporte se sienten repetidas o sin evidencia nueva (señal directa de que Anti-Repetition no está funcionando).
- El cliente pide cancelar o pausa la suscripción explícitamente — registrar siempre el motivo declarado.
