# Source Strategy

**Documento vivo** — actualizar a medida que se valida cada fuente con datos reales. Las celdas vacías de la matriz deben completarse con research real, no con supuestos.
Usado por: Claude normal (research de fuentes por región) y Claude Code (implementación del Source Access & Freshness Layer).

---

## A. Propósito

Documentar qué fuentes públicas existen por región, su confiabilidad y limitaciones, para que el Source Access & Freshness Layer se construya sobre research real en vez de supuestos, y para que LeadLens sea honesto sobre su cobertura en cada mercado.

---

## B. Decisiones actuales

- LeadLens debe leer mercados en distintas regiones, pero **no debe prometer acceso global perfecto en tiempo real**.
- **Regiones iniciales priorizadas:** US/Canada, Colombia, México, UK — elegidas por buena cobertura, costo razonable y relevancia para el mercado inicial.
- Cuando la cobertura de una región es baja, el sistema debe decirlo explícitamente en vez de generar recomendaciones con falsa confianza.
- No se debe usar scraping riesgoso o de legalidad dudosa bajo ninguna circunstancia.

---

## C. Métricas clave *(SUPUESTO hasta completar research real por fuente)*

| Métrica | Estado |
|---|---|
| Reliability score por fuente | Escala 1–5, a calibrar durante el research inicial |
| Region confidence | Nivel agregado de cobertura por región, derivado del número y calidad de fuentes activas |
| Umbral mínimo de fuentes activas por región para considerarla "cubierta" | A definir — provisional: al menos 3–4 tipos de fuente con reliability ≥3 |

---

## D. Qué está implementado

Ninguna pieza del Source Access & Freshness Layer está implementada técnicamente todavía. Este documento es la base de research que debe preceder esa implementación.

---

## E. Qué falta

- Region Source Matrix completa para las 4 regiones prioritarias (estructura definida abajo, contenido por investigar).
- Criterios de scoring de fuentes calibrados con casos reales.
- Definición técnica de qué constituye "real-time" vs. "semi-fresh" vs. "context-only" para cada tipo de fuente.

---

## F. Riesgos

| Riesgo | Descripción |
|---|---|
| Prometer cobertura uniforme entre regiones | La realidad es desigual (UK con Companies House vs. LATAM con registros fragmentados) — puede generar expectativas que el producto no cumple. |
| Usar fuentes de legalidad ambigua | Por presión de cubrir una región rápidamente — debe evitarse explícitamente. |
| Sobreinvertir en mapear regiones | (ej. Europa completa, Brasil) antes de tener tracción comercial en las 4 regiones prioritarias. |

---

## G. Próximas acciones

1. Completar la Region Source Matrix (estructura en sección H) para US/Canada, Colombia, México y UK únicamente — no expandir a otras regiones todavía.
2. Para cada fuente identificada, clasificarla como real-time, semi-fresh o context-only.
3. Definir el umbral exacto que activa el mensaje de "cobertura limitada" por región.
4. Revisar explícitamente riesgo de compliance por fuente antes de integrarla técnicamente.

---

## H. Criterios de éxito

El Source Access Layer se considera listo para una región cuando existe al menos un conjunto mínimo de fuentes con reliability conocida, freshness estimada, y el sistema puede generar un region confidence score honesto (alto, medio o bajo) en vez de tratar todas las regiones como si tuvieran la misma calidad de datos.

---

## Source Access Layer *(concepto)*

Capa que determina, para cada región y tipo de señal, qué fuentes puede consultar el sistema, con qué frecuencia, y con qué nivel de confianza — alimentando directamente el Evidence Quality definido en `QUALITY_STANDARD.md`.

---

## Region Source Matrix *(estructura propuesta — completar con research real)*

| Región | Fuentes candidatas | Tipo | Reliability (1–5) | Freshness esperada | Costo | Idioma | Riesgo compliance |
|---|---|---|---|---|---|---|---|
| **US/Canada** | Company websites, news, job boards, SEC filings (US), registros estatales | — | — | — | — | EN | Bajo |
| **Colombia** | Cámara de Comercio (RUES), prensa económica local, job boards | — | — | — | — | ES | Bajo-medio |
| **México** | DENUE, prensa de negocios, job boards | — | — | — | — | ES | Bajo-medio |
| **UK** | Companies House (API pública), prensa de negocios, job boards | — | — | — | — | EN | Bajo |

*Las celdas vacías deben completarse con research real, no con supuestos. Este documento se actualiza a medida que se valida cada fuente.*

---

## Freshness scoring *(marco)*

Cada fuente debe clasificarse según qué tan reciente y verificable es la información que entrega:

| Tipo | Descripción |
|---|---|
| **real-time** | APIs con datos actualizados constantemente |
| **semi-fresh** | Actualización periódica con retraso conocido |
| **context-only** | Información estable pero no indicativa de timing, útil solo para fit/ICP |

---

## Region confidence

Score agregado por región que resume cuántas fuentes confiables están activas y qué tan fresca es la información disponible. Debe comunicarse al cliente de forma honesta cuando es baja, en vez de ocultarse.

---

## Cómo manejar regiones con baja cobertura

Si una región no alcanza el umbral mínimo de fuentes confiables (a definir, ver sección C), el sistema debe activar el mecanismo de Insufficient Evidence a nivel regional, mostrando explícitamente algo como:

> "Cobertura limitada en esta región — recomendaciones basadas en evidencia parcial"

En vez de generar scoring con la misma confianza que en regiones bien cubiertas.

---

## Qué fuentes investigar primero

Por orden de prioridad:

1. **Companies House UK** — alta calidad, API pública gratuita, buen punto de partida técnico.
2. **Fuentes de noticias/prensa de negocios en US/Canada.**
3. **Cámaras de Comercio y registros públicos en Colombia y México.**
4. **Job boards regionales** como señal de actividad/crecimiento empresarial en las 4 regiones.

---

## Qué NO prometer

- No prometer acceso en tiempo real perfecto en ninguna región.
- No prometer cobertura uniforme entre regiones con infraestructura de datos públicos muy distinta (ej. UK vs. LATAM).
- No prometer que toda señal tendrá múltiples fuentes — cuando no las haya, el sistema debe decirlo, no rellenar con inferencia no verificada.
