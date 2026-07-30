# LeadLens Block 14 — Radical Pilot Experience Rebuild

## Resultado

El piloto de Amor de Gea fue reconstruido como un workspace de inteligencia comercial orientado a decisiones. Conserva exactamente el mismo estado real —seis cuentas, seis tesis internas, 17 preguntas sin respuesta, cero timing actual, cero revisiones y cero salidas customer-safe— pero deja de presentar esa verdad como un dump técnico.

No se creó migración 048, no se cambió ranking, no se llamó a proveedores, no se generó el reporte final y no se fabricó contexto.

## Auditoría de la experiencia anterior

La ruta anterior era funcional, pero la primera pantalla priorizaba estado interno, contadores y una pared de preguntas. La tabla de cuentas trataba seis tesis diferentes como filas casi idénticas. El detalle comercial estaba enterrado en `details`; readiness se percibía como lista de fallos; el workflow de aceptación exigía un intake ID y una lista de IDs separados por comas.

Clasificación aplicada:

| Sección anterior | Decisión |
|---|---|
| Pilot Overview | Rediseñar como Executive Brief |
| Client Context de 17 preguntas | Reagrupar y priorizar cinco; doce bajo disclosure |
| Tabla de seis cuentas | Reemplazar por portafolio visual y mapa categórico |
| Lista plana de tesis | Integrar en detalle de cuenta con contenido completo |
| Feasibility aislada | Integrar por cuenta y conectar con respuestas |
| Evidence/Research/Signals genérico | Fusionar como Evidencia y Temporalidad interpretada |
| Review Queue técnica | Reemplazar por formulario guiado sin IDs visibles |
| Report Readiness negativo | Replantear como mapa de progreso |
| Checklist y actividad técnica | Mover fuera de la vista primaria |
| IDs, versiones y metodología | Mantener solo como detalle avanzado o backend |

## Nueva arquitectura

1. Executive Brief
2. Account Portfolio
3. Account Intelligence
4. Client Readiness
5. Evidence & Monitoring
6. Review & Finalization

Una navegación secundaria sticky conecta las seis áreas. La progresión visual aplica tres niveles: conclusiones y acciones primero; tesis, viabilidad y evidencia después; metodología, riesgos e historia bajo disclosure.

## Executive Brief

El hero comunica en lenguaje humano:

- seis cuentas colombianas relevantes;
- cuatro para validación y dos para monitoreo;
- ausencia de timing actual;
- BioPlaza como primer candidato de validación según el rol persistido `accessible_entry_account`;
- Natural + Mente como cuenta estratégica según el portafolio real;
- la imposibilidad honesta de señalar “mayor fricción” porque acceso y fit comparten valores base;
- la próxima decisión: confirmar oferta, mínimos y capacidad.

Solo cinco métricas relevantes permanecen en el hero. Ceros internos como customer safety no dominan la presentación.

## Portafolio y diferenciación

La tabla fue sustituida por seis filas editoriales diferenciadas y un mapa de roles comerciales:

- BioPlaza: mejor candidato para validar entrada;
- Distribuidora DAM: palanca potencial de distribución;
- Natural + Mente y Tu Tienda Saludable: cuentas estratégicas de segunda fase;
- Hotel Spa La Colina: caso de hospitalidad sujeto a trigger;
- Somos Consiente: afinidad wellness sujeta a evidencia de alianza.

El mapa usa decisión, segmento y rol persistidos, no números inventados. Muestra validación frente a monitoreo y ruta directa de categoría frente a alianza/canal.

## Auditoría de fit y accesibilidad

Los valores `client_fit: 0.72` y `accessibility: 0.48` son idénticos en las seis tesis. La auditoría confirmó que son una base metodológica compartida del sintetizador Block 11, no mediciones diferenciadas por evidencia de cuenta. Block 14 no inventó variación.

Corrección aplicada:

- los números dejan de liderar;
- se traducen como “Encaje estructural sólido” y “Acceso moderado, sin verificar”;
- el Executive Brief declara que no existe diferenciación confiable de fricción;
- segmento, rol, caso de uso, comprador probable y trigger producen la diferenciación válida;
- la futura variación cuantitativa queda condicionada a evidencia por cuenta.

## Detalle de cuenta y tesis

La cuenta seleccionada abre una experiencia completa:

1. tesis ejecutiva en español;
2. decisión y razón;
3. recomendación;
4. caso de uso y ruta comercial;
5. limitación temporal y operativa;
6. por qué esta cuenta;
7. camino de compra probable;
8. doce dimensiones de viabilidad;
9. dominio oficial, fecha y atribución;
10. trigger de monitoreo;
11. contraevidencia y metodología;
12. revisión humana.

La tesis original no se sobrescribe. La presentación distingue consistentemente HECHO, INFERENCIA, RECOMENDACIÓN y LIMITACIÓN.

## Client Readiness

Las 17 preguntas se organizaron en oferta, capacidad, precios, cobertura, cumplimiento y estrategia. Las cinco respuestas de mayor impacto aparecen primero:

1. formatos B2B;
2. pedido mínimo;
3. rango mayorista;
4. radio de entrega;
5. capacidad productiva.

Las doce restantes usan progressive disclosure. Cada pregunta explica cuántas cuentas y tesis afecta. Se conservaron borrador, envío, estados unknown/not applicable/conflict, fuente, evidencia y nota.

Tras enviar un intake, las respuestas elegibles se seleccionan mediante checkboxes. La aceptación parcial usa el ID retornado por el servidor internamente; desaparecieron los campos manuales de intake ID y listas separadas por comas.

## Review, evidencia y timing

La revisión permite aprobar internamente, solicitar corrección/contexto/evidencia o rechazar encaje. El ID de tesis permanece dentro del payload seguro y no aparece al operador. Aprobar internamente sigue sin producir customer safety.

El módulo temporal interpreta el cero:

- no existe ventana pública inmediata;
- se revisaron expansión, alianzas, surtido, contratación, lanzamientos y proveedores;
- fallaron atribución, fecha, relevancia o corroboración;
- los próximos triggers son ubicación, surtido, proveedor y alianza.

## Report readiness y próximas acciones

Las veinte secciones ahora se agrupan como:

- base sólida con limitaciones;
- necesita confirmación del cliente;
- necesita evidencia o revisión.

Cada grupo explica lo completado y lo pendiente. El cierre muestra tres acciones y su efecto esperado. La prohibición permanece explícita:

> El reporte final permanecerá deshabilitado hasta completar las confirmaciones y revisiones necesarias.

## Sistema visual

- Paleta verde profunda, sage, papel y acento dorado sobrio.
- Tipografía editorial para conclusiones y sans-serif para operación.
- Bordes limitados, sombras mínimas, alto contraste y spacing amplio.
- Account cards diferenciadas por segmento y rol.
- Layout desktop-first con mapa sticky.
- Breakpoints específicos para escritorio compacto, tablet y móvil.
- Navegación horizontal contenida en móvil.

## Verificación visual

Se usó una ruta efímera exclusivamente local, eliminada antes del commit, para no debilitar Admin Auth. No se enviaron formularios ni se escribieron datos.

- 1440 px: sin overflow; brief, portafolio, detalle, readiness, evidencia, reporte y review legibles.
- 1280 px: sin overflow.
- 1024 px: el portafolio y los paneles colapsan sin perder jerarquía.
- 390 px: lectura lineal, navegación desplazable y métricas apiladas; sin overflow del documento.
- Consola: cero errores.

Capturas:

- `artifacts/block14-premium-pilot/01-executive-brief-1440.png`
- `02-portfolio-1440.png`
- `03-account-detail-1440.png`
- `04-client-readiness-1440.png`
- `05-evidence-timing-1440.png`
- `06-report-readiness-1440.png`
- `07-review-workflow-1440.png`
- `08-desktop-1280.png`
- `09-tablet-1024.png`
- `10-mobile-390.png`

## Pruebas y migración

- Suite Block 14: 41 casos.
- Suite Block 13: 48 casos.
- Regresiones de Block 12, Auth, evidencia y señales: ejecutadas.
- Typecheck: ejecutado.
- Build de producción: ejecutado.
- Migración nueva: ninguna.
- Migraciones 045–047: reutilizadas.

## Limitaciones restantes

- Los puntajes base de fit/acceso no pueden diferenciarse honestamente hasta capturar evidencia específica.
- Las preguntas permanecen sin responder; el rediseño no cambia esa verdad.
- La vista carga artefactos versionados como fallback mientras el registro canónico persiste el estado operativo.
- La validación autenticada final en producción requiere push, Vercel Ready y una sesión Admin real.

## Próxima acción exacta

Desplegar Block 14, verificar la ruta autenticada y capturar las primeras cinco respuestas reales de Amor de Gea como borrador. No aceptar contexto ni generar reporte hasta revisión humana.

Block 15, publicación, outreach, expansión de cuentas y reporte final no fueron iniciados.

## Continuidad posterior — Block 15

Block 15 ya fue ejecutado de forma aditiva: convirtió la navegación por anclas en subtabs con URL, hizo explícitos ICP/universo/recomendaciones y añadió un PDF interno Admin-only. No invalida las decisiones de Block 14: el reporte final sigue bloqueado, ranking permanece sin cambios y no se crearon respuestas sintéticas. Ver `LEADLENS_BLOCK_15_PILOT_NAVIGATION_ICP_RECOMMENDATIONS_PDF_REPORT.md`.
