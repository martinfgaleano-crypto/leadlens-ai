# Strategic Docs — LeadLens AI

Documentos vivos de estrategia de producto, negocio y ejecución. Generados originalmente por Claude normal; mantenidos en este repositorio para que Claude Code y Claude normal compartan el mismo contexto de referencia sin depender de la memoria de conversaciones anteriores.

---

## Índice de documentos

| Documento | Qué contiene | Cuándo actualizar | Quién lo usa |
|---|---|---|---|
| [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) | Qué es / no es LeadLens, ICP, posicionamiento, diferenciación, criterios de lanzamiento | Cuando cambie la dirección de producto, el posicionamiento o el checklist de lanzamiento | Claude normal (decisiones de producto) · Claude Code (features que afectan el producto) |
| [FINANCIAL_MODEL.md](FINANCIAL_MODEL.md) | Pricing, escenarios financieros, CAC máximo, diferencia Revenue/MRR, supuestos a validar | Cuando haya datos reales de costo, conversión o churn — reemplazar supuestos con números medidos | Claude normal (pricing/marketing) · Claude Code (nunca tocar pricing en código sin validar aquí) |
| [RETENTION_ENGINE.md](RETENTION_ENGINE.md) | Por qué un cliente renueva, 5 mecanismos de recurrencia, Account Memory taxonomy, señales de churn | Cuando se implemente Account Memory, cuando haya datos reales de churn, o cambie el modelo de suscripción | Claude normal (diseño del loop de retención) · Claude Code (Account Memory, Anti-Repetition, Vault) |
| [QUALITY_STANDARD.md](QUALITY_STANDARD.md) | Qué hace un reporte vendible, Evidence Quality framework, Insufficient Evidence, checklist de QA, detección de genericidad | Cuando se implemente Evidence Quality o se formalice el checklist de QA | Claude normal (revisión de reportes antes de entrega) · Claude Code (Evidence Quality, source count, freshness) |
| [SOURCE_STRATEGY.md](SOURCE_STRATEGY.md) | Fuentes públicas por región, Region Source Matrix, freshness scoring, qué NO prometer | A medida que se valida cada fuente con research real — completar celdas vacías de la matriz | Claude normal (research de fuentes) · Claude Code (Source Access & Freshness Layer) |
| [DECISION_LOG.md](DECISION_LOG.md) | Registro cronológico de decisiones estratégicas significativas con razón y estado | Agregar entrada cada vez que se tome una decisión importante — nunca borrar entradas anteriores | Claude normal y Claude Code — punto de referencia para no contradecir decisiones ya tomadas |

---

## Relación Claude normal / Claude Code

**Claude normal** es el responsable de:
- Generar análisis, estrategia y contenido de estos documentos.
- Tomar decisiones de negocio (pricing, posicionamiento, canal, verticales).
- Revisar reportes contra el `QUALITY_STANDARD.md` antes de entregarlos a clientes reales.
- Actualizar `DECISION_LOG.md` cuando se tome una decisión importante.

**Claude Code** es el responsable de:
- Implementar lo que está decidido en estos documentos, no rediseñarlo.
- Leer `DECISION_LOG.md` antes de implementar algo que pueda contradecir una decisión vigente.
- No tocar pricing (`FINANCIAL_MODEL.md`) en el código sin validación explícita.
- No guardar datos personales (`PRODUCT_STRATEGY.md`) en ninguna parte del stack.
- Actualizar la sección "Qué está implementado" de cada documento cuando complete un bloque técnico.

---

## Principios de mantenimiento

1. **No borrar** — si una decisión se revierte, agregar una nueva entrada en `DECISION_LOG.md` que lo documente.
2. **Marcar supuestos** — todo número sin dato real medido debe estar marcado como `(SUPUESTO)`.
3. **Reemplazar supuestos con datos reales** — antes de escalar cualquier canal o decisión de inversión.
4. **Un documento por tema** — no duplicar información entre archivos; referenciar con links relativos.
5. **Estos archivos son texto plano** — sin imágenes, sin binarios, sin PDFs adjuntos en el repositorio.
