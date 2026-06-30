# Decision Log

**Registro de decisiones estratégicas** — agregar una entrada por cada decisión significativa de producto, técnica o de negocio. No borrar entradas anteriores; si una decisión se revierte, agregar una nueva entrada que lo documente y explique por qué.

---

## Formato de entrada

```
### [YYYY-MM-DD] Título corto de la decisión
**Decisión:** Qué se decidió.
**Por qué:** Razón principal.
**Implicaciones:** Qué cambia o no cambia como consecuencia.
**Estado:** Vigente / Revertida / Superada por [referencia]
```

---

## Decisiones vigentes

---

### [2026] Pivote a Account-Level Opportunity Intelligence

**Decisión:** LeadLens pivota de ser una herramienta de lead database / contact scraping a ser una plataforma de Opportunity Intelligence a nivel de cuenta/empresa.

**Por qué:** El espacio de contact databases (Apollo, ZoomInfo, Clay) está saturado con players con ventaja de datos enorme. El diferenciador posible es inteligencia de oportunidad — explicar *por qué* una cuenta vale la pena, no solo *qué* cuenta existe.

**Implicaciones:** LeadLens no vende ni almacena emails personales, teléfonos, nombres individuales ni LinkedIn personales. El pipeline trabaja con datos a nivel de empresa, no de persona. Todo el scoring, feedback y Vault opera sobre cuentas, no sobre individuos.

**Estado:** Vigente.

---

### [2026] No Personal Data — Política core de producto

**Decisión:** LeadLens no vende ni almacena emails personales, teléfonos, nombres individuales ni LinkedIn personales.

**Por qué:** (1) Legal y compliance — reduce riesgo regulatorio significativamente. (2) Diferenciación — la propuesta es inteligencia de *empresa*, no de contacto. (3) Coherencia con el pivote a account intelligence.

**Implicaciones:** Esta restricción aplica a todo el stack — pipeline, Supabase, reportes, feedback, admin. Ningún agente debe buscar, almacenar ni retornar datos de personas individuales.

**Estado:** Vigente. No negociable.

---

### [2026] Propuesta central: "Find the B2B accounts worth contacting this week — and know exactly why"

**Decisión:** Esta frase es la propuesta de valor central de referencia para todas las decisiones de producto y comunicación.

**Por qué:** Captura las dos cosas que el ICP necesita: saber *cuáles* cuentas y saber *por qué* — sin generación de contactos personales y con evidencia explícita.

**Implicaciones:** Cualquier feature o cambio de producto que no sirva a este objetivo debe justificarse o descartarse. Cualquier copy que contradiga esta propuesta debe corregirse.

**Estado:** Vigente — sujeto a validación con prospectos reales.

---

### [2026] El Vault es el diferenciador defendible a largo plazo

**Decisión:** El diferenciador de LeadLens no es el modelo de IA en sí mismo, sino el **Vault** — la memoria propietaria por cliente que mejora con feedback acumulado.

**Por qué:** Los modelos de IA son commodities reemplazables. La memoria propietaria de cada cliente (qué empresas funcionaron, qué industrias generaron reuniones, qué señales son relevantes para su ICP específico) es difícil de replicar y aumenta con el tiempo.

**Implicaciones:** El Vault debe ser visible y explicable para el cliente, no solo operativo en backend. Sin visibilidad del Vault, el cliente no percibe el valor de permanecer suscrito.

**Estado:** Vigente. Vault MVP conservador implementado; Account Memory pendiente.

---

### [2026] No lanzar Monthly Monitor hasta tener Account Memory / Anti-Repetition y Evidence Quality visibles

**Decisión:** El Monthly Monitor no debe venderse a clientes nuevos hasta que Account Memory esté funcionando de forma visible y Evidence Quality esté implementado.

**Por qué:** Sin Account Memory, los reportes mensuales se repiten sin diferenciación clara → causa principal de churn temprano. Sin Evidence Quality visible, la promesa de mejora con el tiempo no es verificable por el cliente.

**Implicaciones:** El criterio de lanzamiento del Monitor es técnico, no solo comercial. Ver checklist completo en `PRODUCT_STRATEGY.md` sección H.

**Estado:** Vigente.

---

### [2026] Go-to-market inicial: outreach directo y orgánico, no ads fríos

**Decisión:** El canal de adquisición inicial es outreach directo (mensajes 1:1 a prospectos específicos) y crecimiento orgánico, no advertising pagado frío.

**Por qué:** Con los precios actuales de productos one-time, los ads fríos no son rentables — el CAC estimado por ads ($40–90) supera el margen de los productos de entrada. El outreach directo tiene CAC bajo (principalmente tiempo) y permite validar el mensaje de posicionamiento en conversaciones reales antes de escalar.

**Implicaciones:** No invertir en Meta Ads, Google Ads ni similares hasta tener (a) datos reales de conversión y (b) un plan del que el Monthly Monitor (LTV recurrente) sea el producto ganador.

**Estado:** Vigente hasta que haya datos reales de conversión que justifiquen otro canal.

---

### [2026] Regiones iniciales para Source Strategy: US/Canada, Colombia, México, UK

**Decisión:** Las 4 regiones prioritarias para el Source Access Layer son US/Canada, Colombia, México y UK.

**Por qué:** Combinan buena cobertura de fuentes públicas, costo razonable de acceso, y relevancia para el mercado inicial esperado de clientes.

**Implicaciones:** No invertir en mapear otras regiones (Europa completa, Brasil, Asia) antes de tener tracción comercial en estas 4. Ver `SOURCE_STRATEGY.md` para detalle.

**Estado:** Vigente.

---

### [2026] Output genérico es el riesgo #1

**Decisión:** El riesgo principal identificado es que el output de LeadLens se sienta genérico — reproducible con un chatbot en 20 minutos.

**Por qué:** Si el reporte no aporta inteligencia específica y verificable (evidencia con fuente y fecha, razón clara por qué esa cuenta es relevante para ese ICP), el cliente no tiene razón para pagar ni para renovar.

**Implicaciones:** Toda decisión de arquitectura de agentes, Evidence Quality, Source freshness y QA debe apuntar a eliminar este riesgo. Ver `QUALITY_STANDARD.md` para el estándar de vendibilidad.

**Estado:** Vigente. Riesgo no resuelto — Evidence Quality y detección de genericidad pendientes.

---

### [2026] Métrica clave de validación

**Decisión:** La métrica principal de validación de la tesis de negocio es: **porcentaje de compradores one-time que dan feedback útil y piden otro reporte o se suscriben al Monitor dentro de 30 días**.

**Por qué:** Esta métrica combina dos señales: (1) que el reporte fue lo suficientemente valioso para generar feedback, y (2) que el cliente quiere repetir la experiencia — lo que valida tanto calidad de output como retención.

**Implicaciones:** Instrumentar esta métrica desde el primer cliente real. No es posible calcularla sin (a) feedback persistente vinculado a job_id real y (b) seguimiento de si el cliente vuelve a comprar. La infraestructura de feedback job_id linkage implementada es el prerequisito técnico de esta métrica.

**Estado:** Vigente — no hay datos reales todavía.

---

### [2026] Próximo bloque estratégico prioritario: Account Memory / Anti-Repetition

**Decisión:** El siguiente bloque de desarrollo estratégico a priorizar es Account Memory / Anti-Repetition.

**Por qué:** Es el prerequisito bloqueante para: (1) lanzar el Monthly Monitor, (2) demostrar el valor del Vault al cliente, (3) reducir el riesgo de churn por reportes repetidos.

**Implicaciones:** Antes de implementar, diseñar la taxonomía completa de estados de cuenta (ver `RETENTION_ENGINE.md` sección E) en términos de negocio, no solo como especificación técnica.

**Estado:** Vigente — pendiente de implementación.
