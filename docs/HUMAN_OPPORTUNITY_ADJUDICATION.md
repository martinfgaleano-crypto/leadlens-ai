# LeadLens — Rúbrica humana de oportunidades v1

Usar después del benchmark y antes de publicar cualquier reporte real. La QA
humana puede rechazar o pedir una nueva corrida; nunca rescata una oportunidad
añadiendo hechos sin evidencia.

## Regla de lote

Una falla crítica de **identidad**, **rol**, **fecha** o **evidencia** produce
`FAIL` para la oportunidad. Si una oportunidad con falla crítica llegó a estar
lista para entrega, el lote completo queda `HOLD` hasta encontrar la causa,
añadir un test de regresión y volver a generar/revisar.

## Ficha obligatoria por oportunidad

| Campo | PASS | FAIL crítico |
|---|---|---|
| Empresa | Razón social/marca inequívoca | Homónimo, publisher, lugar, categoría o entidad pública no apta |
| Dominio | Pertenece a la empresa y fue verificado | Dominio inventado, de tercero o ambiguo |
| Evento | Cambio concreto atribuible | Métrica histórica, marketing, feria, premio o afirmación genérica |
| Rol | Empresa es actor/owner/comprador correcto | Mención incidental, proveedor/contratista confundido con comprador |
| Fecha | Sustentada, no futura y dentro de ventana | Ausente presentada como reciente, futura o >180 días |
| Fuente | URL pública apoya la afirmación | Link roto, contenido distinto o fuente sin provenance |
| Evidencia | Hecho e inferencia diferenciados | Claim material no sustentado o extracto contradictorio |
| Fit comercial | Necesidad específica para la oferta | Tesis intercambiable o producto no relacionado |
| Counterevidence | Riesgos/dudas y alternativa representados | Riesgo conocido oculto o tercerización ignorada |
| Siguiente acción | Proporcional: validar/monitor/contactar | Promesa, certeza o outreach sin validación requerida |
| Privacidad | Solo empresa/cuenta | Nombre, email, teléfono, cargo personal o perfil LinkedIn |
| Origen | Real y provenance visible | Mock/demo, origen desconocido o reused presentado como fresh |
| Cobertura | Modo y limitación comunicados | Implica búsqueda completa cuando fue degraded/targeted |

## Clasificación del revisor

- `true_positive`: oportunidad material y correctamente sustentada.
- `false_positive`: el sistema emitió algo que no debía.
- `needs_validation`: no es entregable todavía; existe una pregunta concreta.
- `false_negative_visible`: señal relevante observada por el revisor que el
  sistema rechazó/perdió; no implica estimación de recall global.
- `correct_rejection`: rechazo correcto que confirma un gate.

## Taxonomía mínima del error

`identity` · `domain` · `entity_role` · `date` · `source` · `evidence` ·
`materiality` · `commercial_fit` · `counterevidence` · `privacy` · `mock_leak` ·
`coverage_claim` · `duplicate` · `presentation`.

Severidad:

- `critical`: identidad/rol/evidencia falsa, PII, mock o acceso cruzado.
- `major`: oportunidad no accionable o limitación material escondida.
- `minor`: presentación que no cambia la decisión.

## Decisión final del lote

- `PASS`: todas las emitidas pasan campos críticos; issues menores corregidos.
- `HOLD`: hay `needs_validation`, fuentes inaccesibles o QA incompleta.
- `FAIL`: ≥1 critical o el lote no corresponde al ICP/oferta.

## Outcomes posteriores

Registrar cuando ocurra: `investigated`, `saved`, `contacted`, `replied`,
`meeting`, `qualified`, `rejected`, `thesis_confirmed`, `thesis_wrong`, `won`,
`lost`. No convertir actividad temprana en ingreso ni atribuir causalidad a
LeadLens sin evidencia.

