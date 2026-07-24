# LeadLens — panorama completo de calidad y búsquedas

**Corte:** 2026-07-22  
**Alcance:** motor de descubrimiento, valor comercial, evidencia, aprendizaje y preparación para entregar resultados cobrables.  
**Meta de producto:** encontrar oportunidades no obvias que un cliente no obtendría con una búsqueda común, explicar por qué importan y mantener separadas evidencia, inferencia y acción.

## Leyenda

- `[x]` Verificado mediante pruebas o corrida real.
- `[~]` Implementado parcialmente o pendiente de validación empírica.
- `[ ]` No resuelto.
- `BLOCKER` impide afirmar que la búsqueda es repetible o entregar el piloto como éxito.

## Resumen ejecutivo

| Dimensión | Estado | Evidencia actual |
|---|---|---|
| Precisión y seguridad semántica | Fuerte | Gates deterministas, identidad, rol, fecha, geografía, materialidad y revisión adversarial pasan suites locales. |
| Honestidad del resultado | Fuerte | Corridas con 0 y 1 candidato fueron bloqueadas; nunca se rellenó la cuota. |
| Valor no obvio | Parcial | El replay recuperó Supernat y Fitt Global, pero el contrato nuevo sólo considera moderada la primera y preliminar la segunda; aún no hay 2/2 válidas. |
| Recall/cobertura | Débil-parcial | La última corrida emitió 0; el replay offline de su trace recuperó 2 hipótesis sin gasto, que requieren revalidación viva. |
| Colombia y homónimos | Fuerte | Contrato Colombia-only, filtros de TLD/geografía y dominio oficial. |
| Diferenciación frente a buscadores | En avance | Universo mixto, tesis falsable, counterevidence, acceso comercial y procedencia; falta feedback de outcomes. |
| Economía | Controlada | Última corrida: aprox. USD 0,208 providers + USD 0,017208 LLM, bajo cap de USD 0,30. |
| Aprendizaje acumulativo | Parcial | Memoria de fuentes reparada; falta aprender de aceptación, contacto y conversión. |
| Preparación para entregar Amor de Gea | **BLOCKER** | Sólo 1 oportunidad novedosa válida de mínimo 2; no entregar ni cobrar como resultado exitoso todavía. |

## 1. Calidad de entrada e interpretación del cliente

- [x] Oferta, propuesta de valor, país, industrias, señales y exclusiones llegan estructurados.
- [x] `target_countries` fuerza país exacto y no se sustituye silenciosamente por una región amplia.
- [x] Amor de Gea está configurado para Colombia y español.
- [x] Cuentas que el cliente ya conoce pueden excluirse con `known_accounts`.
- [x] El motor distingue ofertas de producto/canal frente a SaaS o consultoría.
- [~] La claridad del ICP tiene score y riesgos, pero falta una compuerta empírica que rechace automáticamente intakes demasiado amplios.
- [ ] Probar al menos cinco ofertas reales muy distintas y medir cuántas requieren corrección manual del ICP.

## 2. Construcción del universo de empresas

- [x] Flujo company-first: primero empresa, después evidencia.
- [x] Entidades públicas, medios, lugares, categorías y nombres genéricos se rechazan.
- [x] Seeds tienen país, vertical, dominio y notoriedad cuando se conoce.
- [x] Universo dinámico v2 reserva hasta 40% para nuevas empresas.
- [x] Las cuentas obvias sólo entran como backfill.
- [x] Consultas dinámicas buscan asociaciones, expositores, distribuidores y operadores regionales, no sólo rankings.
- [x] Enumeración wellness usa cinco lanes buyer-side: naturistas regionales, multimarca, hoteles boutique/spa, resorts y retail orgánico.
- [x] Cada empresa dinámica conserva procedencia.
- [x] Universo clasifica rol comercial: buyer channel, hospitality, operador, brand owner, seller network, service provider o unknown.
- [x] Ofertas físicas bloquean fabricantes/seller networks antes de gastar queries.
- [x] Portafolios con capacidad suficiente protegen dos buyer channels y dos hospitality operators cuando existen.
- [x] Rol, confianza y evidencia se propagan a candidato, manifest, CSV y UI.
- [x] Un dominio sólo se atribuye cuando nombre y host coinciden; directorios/medios nunca se vuelven dominio corporativo.
- [~] **Pendiente empírico:** validar que el universo v2 produzca empresas nuevas y correctas en una corrida real.
- [~] Se mide porcentaje seed/dinámico, obvio/no obvio y dominios verificados; faltan ciudad/subsegmento y grupos corporativos.
- [ ] Resolver relaciones matriz–marca–subsidiaria para no contar dos veces el mismo grupo económico.

## 3. Recuperación de fuentes y cobertura

- [x] Brave, Serper y Tavily tienen integración con degradación explícita.
- [x] La ausencia de un proveedor se registra y afecta confianza.
- [x] Presupuesto preventivo por consulta y extracción.
- [x] Ranking de URLs por evento, intención comercial y utilidad histórica.
- [x] La ronda de rescate usa la señal causal vertical más específica; “anuncio comunicado” queda sólo como fallback en tiers amplios.
- [x] Las consultas cubren año actual y anterior para no perder una ventana móvil de 180 días al cruzar enero.
- [x] Búsqueda y validación comparten vocabulario wellness (`nueva tienda`, `nueva categoría`, `nuevo spa`, etc.).
- [x] La deduplicación es empresa–URL: una noticia multiempresa puede evaluarse para cada cuenta.
- [x] La extracción se cachea por URL y se reutiliza sin duplicar costo; la asociación y rol se revalidan por empresa.
- [x] Una hipótesis preliminar ya no detiene Preview: obliga la segunda ronda de rescate por evento.
- [x] Hospitality usa queries de procurement/F&B/spa y rescates de apertura hotelera; no reutiliza lenguaje de distribuidor autorizado.
- [x] Hipótesis preliminares no consumen el cupo objetivo ni desplazan evidencia defendible por score bruto.
- [x] `emitted`, `defensible_emitted` y `preliminary_emitted` se reportan por separado en discovery y manifest.
- [x] Páginas de proveedores/marcas se priorizan sobre producto, privacidad o contenido genérico.
- [~] En la última corrida Brave y Tavily respondieron; Serper no produjo cobertura útil.
- [~] Cobertura de empresas pequeñas sigue limitada por poca prensa y sitios web débiles.
- [x] Se guarda trace resumido de consultas, resultados seleccionados y URLs no extraídas para auditar falsos negativos sin repetir gasto.
- [ ] Medir recall visible mediante una lista humana de eventos/canales conocidos por vertical.
- [ ] Definir combinación mínima de proveedores por país/idioma basada en rendimiento, no disponibilidad.

## 4. Identidad, geografía y asociación

- [x] Coincidencia de nombre con límites de palabra; evita `Inter` dentro de `internacional`.
- [x] Dominio corporativo verificado puede resolver falsos `ambiguous`.
- [x] Homónimos extranjeros se bloquean por geografía, dominio y TLD.
- [x] La empresa debe ser sujeto/operador del hecho, no una mención incidental.
- [x] Colombia-only se aplica antes y después de discovery.
- [x] Candidatos fuera del país se eliminan y contabilizan.
- [ ] Añadir resolución explícita de grupos empresariales, marcas comerciales y franquiciados.
- [ ] Benchmark humano de al menos 50 casos de identidad/homónimos con precisión objetivo ≥98%.

## 5. Clasificación de oportunidades

- [x] `timing_signal`: evento material, asociado, reciente y fechado.
- [x] `channel_fit`: evidencia oficial de canal multimarca/proveedores, sin fingir timing.
- [x] Contrato de evidencia separa `strong` (intake explícito), `moderate` (portafolio externo) y `preliminary` (capacidad general de distribución).
- [x] El score general queda limitado por la fuerza de la prueba de canal: 90/82/72; identidad o fit no pueden inflarla.
- [x] Metadata/snippets sin extracción viva del dominio oficial no califican para producción.
- [x] “Sé nuestro distribuidor” se distingue de “aceptamos/distribuimos marcas externas”.
- [x] Métricas, editoriales, aniversarios, rankings y marketing no disparan oportunidad.
- [x] Fecha desconocida nunca se inventa.
- [x] Eventos >180 días se bloquean como timing.
- [x] Fit operativo y comercial tiene hard blockers.
- [x] Fit comercial v2 exige evidencia explícita oferta–cuenta; un needs map ya no puede rescatar una relación inexistente.
- [x] Operación relevante usa tokens normalizados con límites semánticos y registra qué términos la demostraron.
- [x] Geografía sin evidencia aporta cero puntos y genera blocker; el score no puede asumir Colombia por contexto regional.
- [x] Counterevidence puede degradar la tesis.
- [x] Revisor adversarial independiente puede rechazar o degradar.
- [~] Fitt Global queda correctamente degradado a evidencia preliminar/monitor hasta demostrar ruta de proveedor; ya no cuenta para el mínimo 2/2.
- [~] Supernat es hipótesis moderada por catálogo multimarca y requiere revalidación viva de categoría y onboarding.
- [ ] Validación humana de Fitt Global: confirmar que realmente acepta categoría compatible y localizar proceso/decisor empresarial permitido.
- [ ] Obtener una segunda oportunidad válida y novedosa para Amor de Gea.

## 6. Valor diferencial y utilidad para el cliente

- [x] Cuentas conocidas del piloto se excluyen.
- [x] Máximo permitido de cuentas obvias puede configurarse en cero.
- [x] `discovery_value` separa alto, medio y bajo.
- [x] Cada candidato incorpora hecho observado, relevancia para la oferta, límite de evidencia y pregunta falsable.
- [x] `replicability_edge` explica qué aportó LeadLens más allá del nombre de la empresa.
- [x] Una oportunidad de bajo valor no puede presentarse como accionable.
- [x] El reporte se bloquea si no contiene cuentas novedosas.
- [x] El gate global bloquea reportes compuestos sólo por hipótesis preliminares, no únicamente el piloto Amor de Gea.
- [x] El scorecard contabiliza oportunidades defendibles por separado y falla un piloto con cero defendibles.
- [~] La diferenciación está implementada en CSV/Markdown y contexto; falta revisar visualmente la UI final.
- [ ] Medir con usuarios: “¿podías encontrar esto solo?”, “¿qué acción cambió?” y “¿pagarías por esta información?”.
- [ ] Definir benchmark: ≥60% de oportunidades entregadas consideradas nuevas o materialmente mejor explicadas por el cliente.

## 7. Acción recomendada y disciplina de claims

- [x] `act_now`, `validate_first`, `monitor`, `exclude` están separados del score bruto.
- [x] `channel_fit` nunca puede ser `act_now` automáticamente.
- [x] `channel_fit` preliminar es `monitor`; sólo evidencia moderada/fuerte puede llegar a `validate_first`.
- [x] Evidencia insuficiente nunca puede ser `act_now`.
- [x] QC fallido siempre excluye, incluso con score alto.
- [x] No se afirma intención de compra por un evento o por compatibilidad de canal.
- [x] Cada recomendación contiene límites y siguiente pregunta.
- [ ] Probar con usuarios si las acciones son suficientemente concretas para ejecutarse en menos de 15 minutos.
- [ ] Medir tasa de oportunidades que avanzan de `validate_first` a contacto aprobado.

## 8. Aprendizaje y efecto compuesto

- [x] Utilidad de fuentes aprende fechas, eventos y candidatos profundos por dominio.
- [x] Se persisten únicamente deltas de la corrida actual.
- [x] Historial se compacta preservando tasas; una fuente antigua no domina indefinidamente.
- [x] Priors afectan el orden de extracción, no pueden rescatar un gate fallido.
- [x] Feedback estructurado por oportunidad: investigated, contacted, replied, meeting, qualified, rejected, won/lost y thesis right/wrong.
- [x] Feedback humano de calidad está separado de outcomes comerciales afectados por precio, ejecución o timing.
- [x] Eventos son idempotentes por cuenta/corrida/señal y admiten clave estable de reintento; la migración 039 debe aplicarse en Supabase.
- [ ] Evitar que un solo cliente/vertical sobreentrene el sistema global.
- [ ] Crear score de utilidad comercial por arquetipo de consulta, vertical, país y tipo de oportunidad.

## 9. Costos, tiempos y repetibilidad

- [x] LLM medido por tokens y precio de lista identificado.
- [x] Providers estimados por consulta/extracción.
- [x] Cap preventivo antes de cada gasto.
- [x] Corridas fallidas conservan manifest, costos y diagnóstico.
- [x] Última corrida respetó USD 0,30 y consumió aproximadamente USD 0,225208.
- [~] Dos corridas similares costaron de forma consistente cerca de USD 0,225.
- [ ] Medir costo por oportunidad válida, no sólo costo por corrida.
- [ ] Medir tiempo P50/P90 por tier y país.
- [ ] Probar Brief/Intelligence y demostrar valor incremental frente a Preview.
- [ ] Definir margen mínimo sólo después de cinco pilotos reales.

## 10. Evidencia, exportación y experiencia

- [x] CSV incluye acción, evidencia, notoriedad, valor, tipo, hecho, relevancia, límite y pregunta.
- [x] CSV, Markdown y UI muestran grado, tipo de prueba, alineación de categoría y limitaciones del canal.
- [x] Markdown incorpora la tesis auditable.
- [x] Raw context separa hechos y limitaciones.
- [x] Empty/insufficient result bloquea entrega en vez de ocultarse.
- [~] No se ha generado todavía un reporte final Amor de Gea porque el gate 2/2 lo bloquea correctamente.
- [ ] Revisar UI de resultados y asegurar que muestra todos los campos nuevos.
- [ ] Revisar links, accesibilidad, móvil, impresión y consistencia CSV/Markdown/UI.
- [ ] Crear una muestra sanitizada con una oportunidad real validada.

## 11. Benchmarks necesarios antes de afirmar “calidad de mercado”

- [ ] **BLOCKER:** Amor de Gea con ≥2 oportunidades novedosas válidas.
- [ ] Benchmark de 3 verticales × 2 países × 2 corridas.
- [ ] ≥50 candidatos/rechazos adjudicados humanamente.
- [ ] Precisión de identidad ≥98% en entregados.
- [ ] Cero claims materiales falsos en entregados.
- [ ] ≥70% de oportunidades entregadas con evidencia y acción consideradas útiles por revisión humana.
- [ ] Duplicación entre corridas medida y explicada.
- [ ] Costo por oportunidad válida y P90 de tiempo conocidos.
- [ ] Al menos 5 clientes/pilotos con feedback estructurado.
- [ ] Al menos 2 outcomes comerciales posteriores para calibración inicial.

## 12. Prioridades desde este corte

1. Implementar feedback estructurado, idempotente y separado entre calidad y outcome.
2. Revalidar en vivo primero la hipótesis moderada de Supernat y buscar una segunda prueba moderada/fuerte; sólo con autorización de presupuesto.
3. Priorizar rutas explícitas de onboarding/proveedores sobre simples declaraciones de distribución.
4. Completar diversidad por ciudad/subsegmento y resolución de grupos corporativos.
5. Adjudicar humanamente Fitt Global y cualquier segundo candidato.
6. No entregar Amor de Gea hasta pasar 2/2 y el gate de valor novedoso.

## Veredicto actual

LeadLens ya es considerablemente más disciplinado que un buscador: construye un universo, verifica identidad y rol, distingue eventos de contexto, evalúa acceso comercial, representa contravidencia y produce una tesis falsable. Sin embargo, **todavía no está demostrado que su recall sea suficientemente repetible para el mercado**. La precisión y honestidad son fortalezas; cobertura, aprendizaje por outcomes y validación multi-vertical son los principales riesgos pendientes.
