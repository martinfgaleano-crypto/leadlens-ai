# Financial Model

**Documento vivo** — actualizar cuando haya datos reales de costo, conversión o churn. Reemplazar cada supuesto marcado con números medidos antes de escalar marketing.
Usado por: Claude normal (decisiones de pricing/marketing) y Claude Code (no tocar pricing en código sin validar aquí primero).

---

## A. Propósito

Mantener un modelo financiero de referencia único, para que las decisiones de pricing, marketing y priorización se tomen con números consistentes en vez de supuestos improvisados en cada conversación.

---

## B. Decisiones actuales

- Precios de referencia vigentes: Mini Snapshot $19 · Opportunity Snapshot $49 · Market Intelligence Report $99 · Monthly Opportunity Monitor $129/mes.
- El producto **héroe** del negocio es el Monthly Monitor, porque es el único que sostiene un CAC competitivo con marketing pagado a futuro.
- Los productos one-time funcionan como gancho de confianza, no como negocio principal.
- Marketing pagado frío (ads) se evita hasta validar conversión real vía outreach directo.

---

## C. Métricas clave *(todas SUPUESTO hasta tener datos reales)*

| Ítem | Estimación |
|---|---|
| Costo variable — Mini Snapshot | ~$2 |
| Costo variable — Opportunity Snapshot | ~$5 |
| Costo variable — Market Report | ~$10 |
| Costo variable — Monthly Monitor | ~$15/mes |
| Costos fijos de infraestructura | $150–450/mes según escala |
| CAC vía outreach | ~$10–25 (principalmente tiempo) |
| CAC vía ads pagados | ~$40–90 por cliente |
| Landing conversion rate | 2–4% |
| Conversión lead→compra (outreach) | 8–15% |
| Conversión lead→compra (tráfico frío) | 3–6% |

---

## D. Qué está implementado

- Modelo de escenarios conservador/base/ambicioso a 1, 3 y 6 meses (ver tabla abajo).
- Estructura de pricing por producto definida.

---

## E. Qué falta

- Datos reales de costo de AI/API por reporte (hoy es estimación, no medición).
- Datos reales de conversión de landing/checkout (no hay tráfico real medido aún).
- Validación de CAC real vía outreach con un piloto controlado.

---

## F. Riesgos

| Riesgo | Descripción |
|---|---|
| Costos de AI más altos de lo estimado | Erosionan margen sin que se note hasta tarde — necesita monitoreo desde el primer cliente real. |
| Ads pagados fríos prematuros | No rentables con precios actuales de productos one-time; pueden quemar caja sin retorno. |
| Escenario conservador | No es rentable en primeros 6 meses — requiere ajustar mix de canal, no necesariamente el precio. |

---

## G. Próximas acciones

1. Medir costo real de AI/API por reporte en los primeros 5–10 reportes generados para clientes reales.
2. Medir conversión real de outreach (mensajes enviados → reuniones → ventas) en el piloto inicial.
3. Actualizar este documento con datos reales reemplazando cada supuesto marcado, antes de tomar decisiones de escalar marketing.
4. Recalcular CAC máximo sostenible por producto una vez haya costos variables reales.

---

## H. Criterios de éxito

El modelo se considera "validado" cuando al menos 10 clientes reales han pasado por el embudo completo (landing → compra → feedback) y los supuestos de la sección C pueden reemplazarse por datos medidos con menos de 30% de desviación frente a lo estimado aquí.

---

## Supuestos principales *(declarados explícitamente)*

- Valor promedio de orden one-time (mezcla de planes): ~$55 *(SUPUESTO)*
- "Mes 1" = primer mes con clientes pagando reales, no el mes calendario actual.
- Presupuesto de marketing progresivo: bajo en mes 1, moderado en mes 3, mayor pero controlado en mes 6.

---

## Escenarios *(ingresos, costos, resultado neto)*

| Escenario | Periodo | Clientes one-time | Suscriptores Monitor | Ingresos totales | Costos variables | Infra/Herramientas | Marketing | Resultado neto |
|---|---|---|---|---|---|---|---|---|
| Conservador | Mes 1 | 5 | 1 | $404 | $45 | $150 | $300 | **-$91** |
| Conservador | Mes 3 | 20 | 5 | $1,745 | $195 | $200 | $1,500 | **-$150** |
| Conservador | Mes 6 | 35 | 12 | $3,473 | $390 | $250 | $3,000 | **-$167** |
| Base | Mes 1 | 15 | 3 | $1,212 | $135 | $150 | $500 | **$427** |
| Base | Mes 3 | 50 | 15 | $4,685 | $525 | $250 | $2,500 | **$1,410** |
| Base | Mes 6 | 90 | 35 | $9,465 | $1,065 | $350 | $5,000 | **$3,050** |
| Ambicioso | Mes 1 | 30 | 6 | $2,424 | $270 | $150 | $800 | **$1,204** |
| Ambicioso | Mes 3 | 100 | 30 | $9,370 | $1,050 | $300 | $4,000 | **$4,020** |
| Ambicioso | Mes 6 | 180 | 70 | $18,930 | $2,130 | $450 | $8,000 | **$8,350** |

*Todas las cifras son SUPUESTO de planificación, no datos medidos.*

---

## CAC máximo sostenible por producto *(SUPUESTO)*

| Producto | Precio | Margen bruto est. | CAC máximo sostenible |
|---|---|---|---|
| Mini Snapshot | $19 | ~89% | ~$10–15 |
| Opportunity Snapshot | $49 | ~90% | ~$25–35 |
| Market Intelligence Report | $99 | ~90% | ~$50–75 |
| Monthly Monitor | $129/mes | ~88% | ~$80–100 (justificado por LTV recurrente) |

---

## Diferencia entre Revenue y MRR

**Revenue total del mes** = suma de todas las ventas one-time del mes + ingresos del Monitor en ese mes. Es una foto del flujo de caja de ese periodo específico.

**MRR (Monthly Recurring Revenue)** = únicamente el ingreso recurrente predecible del Monthly Monitor (suscriptores activos × $129), sin incluir ventas one-time. Es el indicador real de salud de negocio recurrente. Un revenue total alto con MRR bajo significa que el negocio sigue siendo transaccional, no recurrente.

---

## Métricas a actualizar cuando haya datos reales

- Costo variable real por tipo de reporte (AI/API).
- Conversión real landing → compra.
- Conversión real de one-time → suscripción mensual.
- Churn mensual real del Monitor.
- CAC real por canal (outreach vs. orgánico vs. pagado, si se prueba).
