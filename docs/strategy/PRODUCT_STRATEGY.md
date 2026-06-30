# Product Strategy

**Documento vivo** — actualizar cuando cambie la dirección de producto, el posicionamiento o los criterios de lanzamiento.
Usado por: Claude normal (decisiones de producto/estrategia) y Claude Code (decisiones técnicas que afectan el producto).

---

## A. Propósito

Definir qué es LeadLens, qué no es, a quién sirve primero, y cómo se diferencia, para que cualquier decisión de producto (de Claude normal o Claude Code) tenga un punto de referencia consistente en vez de depender de la memoria de conversaciones anteriores.

---

## B. Decisiones actuales

- LeadLens es una herramienta de **Opportunity Intelligence B2B a nivel de cuenta/empresa**, no una base de datos de contactos.
- No vendemos ni almacenamos emails personales, teléfonos, nombres individuales ni LinkedIn personales.
- No competimos con Apollo, ZoomInfo o Clay en volumen de contactos.
- **Propuesta central:** "Find the B2B accounts worth contacting this week — and know exactly why."
- No se lanza como SaaS público hasta que la experiencia se sienta automática y profesional, no como piloto manual.
- El diferenciador defendible a largo plazo es el **Vault** (memoria propietaria por cliente que mejora con feedback), no el modelo de IA en sí mismo.
- El go-to-market inicial se apoya en outreach directo y clientes reales, no en ads pagados fríos.

---

## C. Métricas clave

| Métrica | Estado | Meta inicial |
|---|---|---|
| % de prospectos en piloto que solicitan un segundo reporte sin que se les ofrezca activamente | SUPUESTO | >15% |
| % de oportunidades marcadas "useful" o "meeting_booked" en feedback | SUPUESTO — sin dato real aún | — |
| Tiempo que toma al usuario entender la propuesta de valor en la primera interacción | Cualitativo — sin número todavía | — |

---

## D. Qué está implementado

- Pivote de dirección de producto (de lead gen a account intelligence) decidido y documentado.
- Feedback MVP persistente, Vault MVP conservador, Vault Memory UI, Snapshot persistence, Admin Snapshots Dashboard.
- Feedback job_id linkage (oportunidades vinculadas al snapshot real del run).
- Status lifecycle en snapshot_reports (processing / completed / failed).

---

## E. Qué falta

- ICP formalizado con criterios verificables (industria, tamaño, geografía, señal de dolor).
- Mensaje de posicionamiento probado con prospectos reales (hoy es hipótesis, no validado).
- Definición explícita de qué verticales se atacan primero vs. cuáles se excluyen conscientemente.
- Criterio de lanzamiento documentado y acordado como checklist binario (ver sección H).

---

## F. Riesgos

| Riesgo | Descripción |
|---|---|
| **Output genérico** | Que el reporte se sienta reproducible con un chatbot genérico en 20 minutos. **Riesgo #1.** |
| Comoditización por IA | En 12–18 meses pueden aparecer competidores similares de "AI account scoring". |
| Mensaje mal entendido | "Account intelligence" no es un término que el ICP busque activamente — riesgo de que la propuesta no se entienda sin explicación. |

---

## G. Próximas acciones

1. Formalizar ICP inicial con criterios concretos y verificables.
2. Elegir 1–2 verticales de entrada (sugerido: agencias B2B, consultoras, exportadores/importadores) y excluir explícitamente verticales que no se atacarán todavía (enterprise con research interno propio).
3. Redactar el mensaje de posicionamiento en una sola frase clara y probarlo con 5–10 prospectos reales vía outreach.
4. Definir el criterio de lanzamiento (sección H) como checklist binario, no como sensación subjetiva.

---

## H. Criterios de éxito

**Qué es LeadLens:** un monitor mensual de oportunidades comerciales B2B a nivel de cuenta, que prioriza empresas con señales públicas de oportunidad y explica la evidencia detrás de cada recomendación.

**Qué NO es LeadLens:** no es una base de datos de contactos, no es un scraper de LinkedIn, no es un generador de leads personales, no es una herramienta de outreach automatizado de mensajes.

**Posicionamiento (borrador, sujeto a validación):** "LeadLens monitorea tu mercado y te muestra qué cuentas vale la pena atacar ahora — con la evidencia detrás de cada una."

**ICP inicial (borrador, sujeto a validación):** equipos de ventas B2B pequeños/medianos sin SDR dedicado a research, en verticales con ciclos de venta basados en identificar compradores activos (agencias, consultoras B2B, exportadores/importadores).

**Diferenciación:** memoria propietaria por cliente (Vault) que mejora con cada feedback, en vez de scoring estático genérico; honestidad explícita sobre calidad de evidencia en vez de falsa confianza.

**Checklist de lanzamiento como SaaS profesional (no lanzar hasta cumplir todo):**

- [ ] Account Memory / Anti-Repetition funcionando y visible al cliente.
- [ ] Evidence Quality / Insufficient Evidence implementado, no solo conceptual.
- [ ] Customer Dashboard y Results Page terminados (ver QUALITY_STANDARD.md).
- [ ] Payments/Stripe funcionando de extremo a extremo.
- [ ] Al menos 1 piloto real completado con feedback positivo medible.
