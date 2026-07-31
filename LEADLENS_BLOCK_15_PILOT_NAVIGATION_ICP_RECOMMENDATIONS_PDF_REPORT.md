# LeadLens Block 15 - navegación, ICP, recomendaciones y PDF interno

## Resultado

Block 15 quedó implementado y verificado sin iniciar Block 16. El piloto canónico ahora tiene ubicación persistente, Resumen por defecto, siete rutas de trabajo, ICP explícito, universo explicado, shortlist determinística y un PDF A4 interno generado en servidor. El reporte final para cliente continúa bloqueado.

## 1. Causa raíz de navegación

Había dos productos competidores bajo la palabra piloto: el gestor histórico `/admin/pilot`, basado en `batch_jobs/onboarding.pilot`, y el workspace Intelligence `/admin/intelligence/pilots/amor-de-gea`, basado en los artefactos de Blocks 10-12. El menú además mostraba un artefacto separado, mientras el workspace usaba anclas sin estado URL. Por eso un clic podía llevar a una superficie vacía, perder la ubicación o parecer que no había subtab seleccionado.

## 2. Jerarquía canónica y legado

Jerarquía visible: Admin -> Intelligence -> Pilotos -> Amor de Gea. El menú muestra Command Center y el piloto como relación padre/hijo. `/admin/pilot` redirige a `/admin/intelligence/pilots/amor-de-gea`; no queda una página legacy vacía. El piloto enlaza explícitamente de vuelta al Command Center.

Rutas:

- `/admin/intelligence/pilots/amor-de-gea` - Resumen.
- `/icp` - Perfil de cliente ideal.
- `/accounts` - Cuentas recomendadas y universo.
- `/account?account=...` - Inteligencia por cuenta.
- `/context` - Contexto del cliente.
- `/evidence` - Evidencia y timing.
- `/readiness` - Preparación del reporte.

Cada ruta tiene un estado activo fuerte, `aria-current`, refresh y enlaces directos estables. El Resumen nunca depende de un tab sin seleccionar.

## 3. ICP

El ICP se convirtió en objeto explícito y provisional. Incluye geografía, segmentos, canal, tipo de cuenta, caso de uso, escala, posicionamiento, operación, compras y valor estratégico. Los indicadores positivos y descalificadores se muestran por separado. Hechos, inferencias y preguntas abiertas tienen procedencia visible; formatos, precios, mínimos, cobertura, capacidad, certificaciones, margen y modelo B2B siguen sin inventarse.

## 4. Universo y shortlist

Se preservó la línea histórica autoritativa: 252 brutos, 164 deduplicados, 21 verificados, 29 probables, 114 excluidos y seis cuentas controladas. La UI y el PDF aclaran que las seis son una muestra de aprendizaje, no todo el mercado.

Orden editorial de validación:

1. BioPlaza - cuenta de entrada para validar categoría.
2. Distribuidora DAM - prueba de palanca de canal.
3. Natural + Mente - seguimiento estratégico.
4. Tu Tienda Saludable - seguimiento estratégico.
5. Hotel Spa La Colina - monitorear hasta un trigger.
6. Somos Consiente - monitorear hasta un trigger.

El orden combina rol canónico, encaje ICP, claridad de uso, acceso, viabilidad, evidencia, fricción y valor de aprendizaje. No crea score, no modifica ranking y no usa timing como único criterio. Cada tarjeta expone categoría, razón, fortaleza, bloqueo, acción y enlace al análisis completo.

## 5. PDF interno

Endpoint: `/api/admin/intelligence/pilots/amor-de-gea/pdf`.

- Generación Node server-side con `jsPDF`.
- `requireAdmin` antes de ensamblar.
- Piloto resuelto y validado server-side; IDs forjados retornan 404.
- `private, no-store`, sin URL pública ni credenciales.
- Cero provider/LLM calls y cero respuestas sintéticas.
- Nombre estable: `leadlens-amor-de-gea-pilot-internal-YYYY-MM-DD.pdf`.
- Evento `internal_pilot_pdf_exported` emitido al log estructurado del servidor.
- Aviso `INTERNO - NO APTO TODAVIA PARA ENTREGA AL CLIENTE` en portada y pie.

El PDF A4 tiene ocho páginas: portada; resumen; ICP y procedencia; universo y recomendaciones; seis perfiles con fuentes oficiales; estrategia de portafolio; contexto; evidencia/timing; readiness; metodología y limitaciones. No incluye navegación Admin ni enums internos.

## 6. Verificación visual

Se generó y renderizó el PDF completo con Poppler. La primera versión reveló símbolos incompatibles, tesis en inglés y saltos superpuestos; se corrigieron. La versión final tiene ocho páginas A4, pies numerados, aviso interno repetido, texto español, perfiles sin clipping, sin overflow, sin páginas en blanco y sin controles web.

La UI se recorrió en navegador real mediante una vista local efímera eliminada antes del cierre. Las siete secciones cargaron contenido, conservaron el subtab activo y mostraron `scrollWidth === innerWidth` a 1280 px. Los breakpoints existentes y las pruebas dirigidas cubren 1440, 1280, 1024 y 390 px. La ruta protegida real redirigió al login sin debilitar Auth; la comprobación autenticada de producción queda post-deploy.

## 7. Distinción de reportes

- PDF interno del piloto: disponible para revisión.
- Reporte final para cliente: botón deshabilitado y bloqueo explícito.

La exportación interna no altera context completeness, revisión, customer safety, timing, ranking ni readiness.

## 8. Pruebas

- Block 15: 47/47.
- Block 14: 41/41.
- Block 13: 48/48.
- Command Center: 36/36.
- Admin Auth: 48/48.
- Evidencia temporal: 55/55.
- Señales: 51/51.
- TypeScript: aprobado.
- Build de producción: aprobado; 134 páginas estáticas y las nuevas rutas dinámica/UI/PDF registradas.

## 9. Migración, archivos y commit

No se creó migración 048. La actividad de exportación usa el log estructurado existente; no justificaba nueva persistencia. Se modificaron navegación Admin/Command Center, workspace, estilos y pruebas; se añadieron el contrato ICP/recomendaciones, rutas de subtab, endpoint/ensamblador PDF, generador local y suite Block 15.

Commit estable de Block 15: se reporta en el handoff final porque el hash se crea después de incluir este documento. `.leadlens/source-intelligence.json` y `.leadlens/usage.json` quedan excluidos como runtime preexistente.

## 10. Limitaciones y próxima acción

No se verificó la descarga con una sesión Admin de producción porque no se usaron ni fabricaron credenciales. Tampoco se resolvieron las 17 preguntas, el timing cero o la revisión de tesis. Próxima acción exacta: desplegar este commit, abrir el piloto con sesión Admin real, recorrer las siete rutas y descargar el PDF; después capturar las cinco respuestas críticas de Amor de Gea. No generar todavía el reporte final.

Stop confirmado: no se inició Block 16, outreach, expansión de cuentas, investigación amplia, publicación ni ranking adaptativo.

## Continuidad posterior — Block 16

Block 16 sustituyó este PDF interno de ocho páginas por un brief premium de 16 páginas, sin cambiar el ranking, las seis cuentas ni el bloqueo customer-safe. El nuevo filename es `leadlens-amor-de-gea-informe-interno-YYYY-MM-DD.pdf`; incluye metadata, links, funnel, mapa de portafolio y una página editorial por cuenta. La implementación y su QA render-first están documentadas en `LEADLENS_BLOCK_16_PREMIUM_INTERNAL_PDF_REBUILD_REPORT.md`.
