# LeadLens — Client Pilot Pack (Colombia) · managed_pilot_v0

Paquete operacional para ejecutar el primer piloto gratuito con un cliente colombiano real.
Sin pagos (Lemon Squeezy NO conectado). Cada ejecución conserva product_code, versión,
precio de referencia, entitlements, límites y quality gates — exactamente como una compra real.

---

## A. Pilot brief (para compartir con el cliente)

**Propósito.** Validar si LeadLens encuentra oportunidades comerciales defendibles para tu
negocio, con evidencia pública verificable. Es un piloto gratuito de la primera cohorte.

**Qué recibirás.** Un reporte institucional del tier seleccionado:
- **Preview** (ref. $7): 2 oportunidades completas + veredicto sobre tu ICP (proceed/refine/stop).
- **Brief** (ref. $25): 6 oportunidades comparadas y rankeadas + Executive Opportunity Brief.
- **Intelligence** (ref. $59): 12 oportunidades + estados de portafolio explicados (Act now /
  Investigate / Monitor / Reserve / Reject), asignación de esfuerzo, frescura de evidencia
  (decay) y momentum por cuenta + Executive Intelligence Brief.
- **Premium** (ref. $129): 18 oportunidades + todo lo anterior con mayor alcance. *Nota
  honesta: los playbooks estratégicos y el análisis de escenarios están en desarrollo; si
  eliges Premium hoy, esa capa se entrega parcialmente.*

**Qué NO incluye.** Datos de contacto personales, emails, teléfonos, perfiles individuales,
garantía de ventas, monitoreo continuo, consultoría ilimitada.

**Tiempo estimado.** 24–48h desde que confirmas tu ICP.

**Confidencialidad y transparencia.**
- Es un piloto gratuito; no genera obligación de compra.
- Toda la inteligencia proviene de fuentes públicas citadas con enlace y fecha.
- Las hipótesis van marcadas como hipótesis y deben validarse antes de actuar.
- Puedes (y te pedimos) señalar cualquier error — ese feedback es el objetivo del piloto.
- No usamos datos sensibles ni personales innecesarios.

---

## B. Onboarding guide (preguntas al cliente)

1. ¿Qué vendes exactamente y a qué precio promedio? *(ej.: "software de gestión de flotas,
   ~USD 800/mes por cliente")*
2. ¿Quién es tu cliente ideal? Sector, tamaño, cargo que decide. *(ej.: "empresas de
   logística y transporte en Colombia, 50–500 empleados")*
3. ¿Qué región? Ciudad/departamento específico o cobertura nacional; ¿otros mercados?
4. ¿Qué cambios en una empresa te indican que es buen momento para contactarla?
   *(expansión, nueva bodega, inversión, alianza, nombramiento...)*
5. ¿Qué empresas o sectores debemos excluir? (competidores, clientes actuales)
6. ¿Objetivo comercial del trimestre? (abrir mercado, llenar pipeline, entrar a un sector)
7. ¿Idioma del reporte? (español por defecto)
8. ¿Fuentes locales que sigues? (La República, Portafolio, cámaras de comercio, gremios...)

---

## C. Delivery guide (cómo presentar sin sobreprometer)

- Presentar el brief en pantalla, empezando por el Executive Brief y el funnel de selección.
- Recorrer 2-3 cuentas: **What Changed → evidencia con fecha y fuente → por qué ahora → qué
  validar antes de contactar**. Abrir al menos una fuente en vivo.
- Decir explícitamente: "esto viene de fuentes públicas; las hipótesis se validan antes de
  actuar; si una cuenta está mal, dínoslo — para eso es el piloto".
- NO prometer: contactos, respuestas garantizadas, monitoreo automático, más cuentas gratis.
- Si hubo shortfall (menos oportunidades que el objetivo del tier), explicarlo con el
  coverage gap real — nunca rellenar con cuentas débiles.

## D. Feedback interview (por tier)

**Preview:** ¿Las 2 oportunidades demuestran valor? ¿El veredicto del ICP te sirvió?
¿Seguirías con LeadLens? ¿Pagarías $7?

**Brief:** ¿Cuántas de las 6 investigarías? ¿La comparación/secuencia inicial ayudó?
¿Pagarías $25? ¿Te falta análisis de portafolio?

**Intelligence:** ¿La priorización cambió alguna decisión? ¿La asignación de esfuerzo es
útil? ¿Qué acción tomarías el lunes? ¿Pagarías $59? ¿Necesitas capa estratégica?

**Premium:** ¿La profundidad adicional se nota? ¿Qué esperabas y no recibiste? ¿Qué
eliminarías? ¿Pagarías $129?

Registrar en `/admin/pilot` → botón **Debrief** (persiste en `tier_feedback`, migración 038).

## E. Internal scorecard (por pilot run)

| Métrica | Cómo | Target |
|---|---|---|
| Cuentas útiles / entregadas | Debrief por cuenta | ≥50% |
| Would-pay al precio de referencia | Debrief | sí |
| Acción concreta declarada | Debrief | ≥1 |
| Fuentes abiertas por el cliente | Observación en delivery | ≥1 |
| Costo variable observado | Estimado en pilot + API usage | Preview <$3 · Brief <$8.75 · Intelligence <$17.7 · Premium <$45 |
| Tiempo de review manual | Cronometrar QA interna | Premium <2h |
| Upgrade / monitoring interest | Debrief | registrar |

---

## F. Procedimiento exacto (admin)

1. Abrir **`/admin/pilot`** (Pilot Console).
2. Completar cliente (nombre, empresa, email, país) + tier (empezar por **Preview**) +
   idioma **español** + ICP con las respuestas del onboarding guide.
3. **Crear y ejecutar piloto** → queda `processing` (~3-6 min). La consola se refresca sola.
4. QA interna: abrir `brief` y verificar con la sección C (empresas correctas, fechas
   reales, fuentes accesibles, sin relleno). Si falla calidad → no entregar; corregir ICP y
   crear un segundo intento (límite configurable por cliente: PILOT_MAX_PER_CLIENT, default 6).
5. Entregar el link del brief al cliente y presentarlo (guía C).
6. Debrief con la guía D → botón **Debrief** en la consola.
7. Para comparación controlada: crear los otros tiers para el MISMO cliente con el MISMO
   ICP — la consola agrupa por cliente y marca "comparación N tiers".
8. Revisar costos estimados vs. alertas del scorecard antes del siguiente piloto.

**Rollback:** `MANAGED_PILOT_V0=off` desactiva la creación de pilotos (los existentes no se tocan).
