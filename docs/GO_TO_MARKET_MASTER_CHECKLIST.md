# LeadLens — Checklist maestro de salida al mercado

**Estado de referencia:** 2026-07-21  
**Propietario:** Martín  
**Fuente de verdad operativa:** este documento reemplaza como checklist vigente a los checklists históricos de la raíz. Esos archivos se conservan como contexto, pero contienen producto, precios y proveedores anteriores.  
**Objetivo inmediato:** vender y entregar un primer piloto guiado de Opportunity Intelligence con evidencia verificable, sin contactos personales, sin datos simulados y con revisión humana.  
**Objetivo posterior:** habilitar compra self-serve solamente después de validar calidad, repetibilidad y operación con pilotos.

## 1. Definición de “salir al mercado”

LeadLens no necesita esperar a tener automatización total para comenzar a vender. Sí necesita cumplir una promesa pequeña, precisa y repetible.

### Compuerta A — Piloto guiado vendible

Puede abrirse cuando:

- el cliente entiende que compra investigación de cuentas y oportunidades, no una base de contactos;
- el ICP y la oferta del cliente son aptos para al menos un vertical soportado;
- los proveedores necesarios para la corrida están operativos;
- Preview y Brief completan un E2E real con el motor actual;
- al menos dos oportunidades emitidas pasan revisión humana sin falsos positivos materiales;
- el reporte muestra fuentes, fecha, evidencia, counterevidence, limitaciones de cobertura y siguiente acción;
- existe un proceso manual claro de cobro, intake, QA, entrega, soporte y reembolso;
- no se expone información mock, PII ni afirmaciones no sustentadas;
- hay rollback y registro de cada decisión humana.

### Compuerta B — Self-serve público

Solo puede abrirse después de la Compuerta A y además requiere:

- checkout y webhook probados en modo real y de prueba;
- creación idempotente de orden, créditos, job y acceso;
- recuperación automática o manual de jobs interrumpidos;
- métricas suficientes para estimar calidad, costo y tiempo por tier;
- soporte, reembolso, privacidad, términos y comunicaciones transaccionales definitivos;
- observabilidad y alertas para pagos, proveedores, pipeline y entrega;
- capacidad demostrada para cumplir el SLA publicado sin intervención improvisada.

## 2. Leyenda y regla de prioridad

- `[x]` verificado con evidencia actual.
- `[ ]` pendiente o no verificado.
- `BLOCKER` impide abrir la compuerta indicada.
- `P0` riesgo inmediato de seguridad, dinero, datos o promesa incumplida.
- `P1` necesario para una venta/entrega confiable.
- `P2` mejora importante posterior al primer piloto.

No se marca un ítem como terminado por existencia de código. Debe existir evidencia ejecutada: test, captura, log, registro de base de datos, reporte revisado o prueba real.

## 3. Estado ejecutivo actual

### Fortalezas verificadas

- [x] Propuesta vigente documentada: Account Opportunity Intelligence.
- [x] Motor company-first con filtros fail-closed, identidad corporativa, rol de entidad, materialidad, fit comercial, counterevidence y revisión adversarial.
- [x] Modos de degradación explícitos: `full_discovery`, `targeted_discovery`, `provider_limited`, `analysis_only`, `stopped`.
- [x] Cobertura limitada se comunica en el reporte.
- [x] Tiers y entitlements definidos server-side: Preview $7, Brief $25, Intelligence $59 y Premium $129 guiado.
- [x] Consola de salud de proveedores y ledger de uso.
- [x] RLS y aislamiento por origen documentados; migraciones 001–038 existentes.
- [x] TypeScript limpio el 2026-07-21 (`npx tsc --noEmit`).
- [x] Checkout público desactivado de forma explícita; no se acepta dinero accidentalmente.

### Bloqueadores conocidos de la Compuerta A

- [ ] **BLOCKER P0 — Anthropic operativo:** el límite de uso está agotado hasta 2026-08-01 o hasta que Martín lo aumente.
- [ ] **BLOCKER P0 — búsqueda operativa:** Brave, Serper y Tavily estaban sin crédito; validar cuáles se reactivan según ROI.
- [ ] **BLOCKER P0 — validación full-stack:** ejecutar benchmark con providers verdes y obtener al menos 2 oportunidades limpias.
- [ ] **BLOCKER P0 — E2E actual:** ejecutar Preview y Brief con el motor company-first vigente.
- [ ] **BLOCKER P1 — piloto real:** completar intake, corrida, QA, entrega y feedback con un prospecto/cliente real.
- [ ] **P1 — publicación:** confirmar deploy productivo, dominio, variables y smoke post-deploy.

### Bloqueadores adicionales de la Compuerta B

- [ ] **BLOCKER P0 — decisión de pagos:** elegir y documentar un único proveedor activo; eliminar contradicción operativa Stripe/Lemon Squeezy.
- [ ] **BLOCKER P0 — payment E2E:** pago → webhook verificado → orden idempotente → job/crédito → intake → resultado → email/acceso.
- [ ] **BLOCKER P1 — economía:** costo real, margen y tiempo de entrega medidos por tier.
- [ ] **BLOCKER P1 — resiliencia:** reintentos, reconciliación y atención de pagos/jobs fallidos probados.

## 4. Checklist P0 — Seguridad, privacidad y confianza

### Secretos y configuración

- [x] `.env.local` está ignorado por Git.
- [ ] Confirmar mediante escaneo que nunca se versionaron secretos en el historial Git.
- [ ] Rotar cualquier secreto que haya sido pegado en logs, chats, commits o capturas.
- [ ] Verificar en producción: `ADMIN_SECRET_TOKEN`, `INTERNAL_RUN_SECRET` y `CRON_SECRET` son distintos y de alta entropía.
- [ ] Verificar que `SUPABASE_SERVICE_ROLE_KEY` nunca llega al cliente ni aparece en bundles/logs.
- [ ] Crear inventario de variables por entorno: local, preview y producción.
- [ ] Verificar que producción no tiene `DEMO_MODE=true` ni flags que permitan mock.
- [ ] Verificar que URLs públicas no contienen caracteres extra ni apuntan a previews antiguas.
- [ ] Definir rotación y propietario de cada credencial.

### Autorización y aislamiento

- [x] `requireAdmin` falla cerrado en producción cuando falta `ADMIN_SECRET_TOKEN`.
- [ ] Enumerar todas las rutas `/api/admin/*` y confirmar `requireAdmin` en cada una.
- [ ] Confirmar que ninguna página/admin API filtra datos por confiar solamente en la UI.
- [ ] Confirmar owner 200, non-owner 404, anonymous 401 y admin 200 para reportes contra Supabase de prueba.
- [ ] Confirmar que processor, drainer y cron rechazan secretos faltantes/incorrectos.
- [ ] Probar horizontal privilege escalation entre dos usuarios reales de prueba.
- [x] Cerrar procesamiento por UUID: `/api/process/search/[id]` exige owner JWT/internal/admin (7/7 tests, 2026-07-21).
- [ ] Probar acceso por IDs predecibles a jobs, reports y delivery packages.
- [ ] Verificar RLS real en Supabase productivo para tablas sensibles.
- [ ] Confirmar aislamiento `data_origin` fail-closed en resultados, Vault y exportaciones.

### Entrada, archivos y abuso

- [x] Retirar upload público legacy de contactos y logo; las cuatro mutaciones legacy responden 410.
- [ ] Establecer límites de payload en formularios y APIs costosas.
- [x] Añadir límites por instancia a demo (3/min) y eventos (60/min), con payload caps.
- [ ] Migrar a rate limiting distribuido y cubrir login, signup, feedback y webhooks antes de self-serve.
- [ ] Verificar protección CSRF o semántica segura en mutaciones autenticadas por cookies.
- [ ] Sanitizar contenido del cliente antes de renderizarlo, exportarlo o introducirlo en prompts.
- [ ] Tratar páginas web recuperadas como contenido no confiable; defenderse de prompt injection.
- [ ] Impedir SSRF: solo HTTP(S), bloquear hosts internos/metadata/IP privadas y limitar redirects.
- [ ] Definir timeout, tamaño máximo y tipos permitidos para extracción.

### Webhooks, pagos y dinero

- [x] Lemon webhook verifica firma en producción cuando se configura.
- [ ] Nunca responder éxito irreversible si no se persistió una orden pagada; crear reconciliación explícita.
- [ ] Confirmar idempotencia por event ID y external order ID bajo concurrencia.
- [ ] Verificar monto, moneda, producto/variant y estado directamente desde evento firmado.
- [ ] No confiar en plan, precio, email ni job ID enviados por el navegador.
- [ ] Probar eventos duplicados, fuera de orden, reembolso, chargeback y pago incompleto.
- [ ] Definir procedimiento manual para reconciliar pago cobrado sin job creado.
- [ ] Definir política de reembolso y registrar quién puede ejecutarla.

### Privacidad, cumplimiento y claims

- [x] Estrategia vigente excluye PII, scraping agresivo y LinkedIn autenticado.
- [ ] Auditar reportes, CSV, logs y tablas para cero emails/teléfonos personales.
- [ ] Verificar que fuentes públicas permiten el uso realizado y guardar provenance.
- [ ] Definir retención y eliminación de intake, reportes, eventos y feedback.
- [ ] Implementar canal verificable para solicitudes de acceso/eliminación.
- [ ] Revisar Privacy, Terms y Refund para que describan el producto y proveedor de pago reales.
- [ ] Eliminar promesas de leads/contactos, reuniones garantizadas o cobertura total.
- [ ] Mostrar metodología, fecha de corte, limitaciones y distinción entre hechos e inferencias.
- [ ] Revisar nombre, marca, dominio y uso de logos de terceros.

## 5. Checklist P0/P1 — Calidad del producto central

### Definición de calidad de una oportunidad

- [x] Empresa identificada sin ambigüedad material.
- [x] Evento reciente y fechado o con incertidumbre explícita.
- [x] Evidencia enlazada y atribuida.
- [x] Relevancia específica para la oferta del cliente.
- [x] Rol correcto de la empresa respecto del evento.
- [x] Counterevidence y riesgos representados.
- [x] Hard blockers no se relajan para llenar cupos.
- [x] Revisión adversarial puede rechazar y no emite por cuota.
- [x] Definir rúbrica humana final PASS/HOLD/FAIL en `docs/HUMAN_OPPORTUNITY_ADJUDICATION.md`.
- [x] Definir umbral: homónimo, rol, fecha/evidencia falsa, PII o mock bloquean todo el lote.

### Validación empírica

- [ ] Reactivar Anthropic y los providers mínimos elegidos.
- [ ] Registrar health snapshot antes de cada benchmark.
- [ ] Ejecutar `npm run bench:company-first` con los 3 ICPs establecidos.
- [ ] Revisar manualmente cada emisión y cada rechazo de alta puntuación.
- [ ] Obtener ≥2 oportunidades emitidas limpias en una corrida full discovery.
- [ ] Registrar falsos positivos, falsos negativos visibles y razones de rechazo.
- [ ] Ejecutar Preview real y conservar input, trace, output, costos y tiempo.
- [ ] Ejecutar Brief real con el mismo ICP y comparar valor incremental.
- [ ] Ejecutar segunda corrida para medir consistencia y duplicación.
- [ ] Verificar que un resultado vacío se entrega honestamente y conserva valor diagnóstico.
- [ ] Probar al menos un ICP fuera del soporte y confirmar rechazo/intake guiado.
- [ ] No recomprar Serper hasta satisfacer la regla de ROI documentada.

### Reporte y experiencia

- [ ] Cada oportunidad explica: qué cambió, cuándo, por qué importa, evidencia, dudas, qué validar y próxima acción.
- [ ] El reporte no confunde inferencia con hecho.
- [ ] Links funcionan, son públicos y corresponden a la afirmación.
- [ ] Fechas y zonas horarias se presentan sin ambigüedad.
- [ ] Score tiene explicación útil; no aparenta precisión estadística no validada.
- [ ] Empty state explica cobertura y próximos pasos sin culpar al usuario.
- [ ] Preview demuestra valor sin prometer profundidad del Brief.
- [ ] Brief ofrece una diferencia observable respecto de Preview.
- [ ] Intelligence entrega dossiers consistentes con su precio.
- [ ] PDF/CSV/HTML, si se ofrecen, contienen la misma verdad y provenance.
- [ ] Mobile, desktop, impresión y accesibilidad básica revisados.
- [ ] Idiomas visibles están completos; no mezclar copy traducido y sin traducir.

## 6. Checklist P1 — Operación del primer piloto

### Antes de vender

- [x] Elegir vertical/ICP inicial: Colombia, flota/logística/software operativo según packs.
- [x] Definir piloto guiado, SLA inicial de 2 días hábiles y máximo 1 activo.
- [x] Definir cliente apto/no apto en el runbook v2.
- [x] Preparar intake de 10 minutos: oferta, ticket, geografía, industrias, triggers, exclusiones, objetivo y capacidad.
- [ ] Preparar muestra sanitizada del reporte.
- [ ] Definir máximo de pilotos simultáneos.
- [ ] Definir canal y horario de soporte.
- [ ] Definir método de cobro manual permitido mientras self-serve está cerrado.
- [ ] Definir factura/recibo y tratamiento tributario con asesoría correspondiente.

### Por cada piloto

- [ ] Crear ID del piloto y carpeta/registro de evidencia.
- [ ] Confirmar consentimiento, alcance y datos permitidos.
- [ ] Validar ICP antes de consumir providers.
- [ ] Capturar health, configuración, versión/commit y modo operativo.
- [ ] Ejecutar sin flags mock.
- [ ] Revisar trace y provenance.
- [ ] Realizar QA humana de todas las oportunidades emitidas.
- [ ] Corregir presentación, nunca inventar evidencia para “salvar” un resultado.
- [ ] Entregar dentro del SLA y confirmar acceso.
- [ ] Recoger feedback estructurado: investigated, saved, contacted, replied, meeting, qualified, rejected, won/lost, thesis right/wrong.
- [ ] Registrar soporte, refund o incidentes.
- [ ] Programar seguimiento para medir outcome real.

### Criterio de éxito de los primeros cinco pilotos

- [ ] 5/5 entregados dentro del SLA pactado.
- [ ] 0 incidentes de privacidad o acceso cruzado.
- [ ] 0 oportunidades con identidad/rol materialmente incorrectos en entrega final.
- [ ] Coste y tiempo por tier medidos, no estimados.
- [ ] Al menos 3 clientes consideran accionable una parte clara del reporte.
- [ ] Al menos 2 outcomes posteriores que permitan calibrar tesis.
- [ ] Razones de churn/no-compra documentadas.

## 7. Checklist P1 — Plataforma, datos y resiliencia

### Base de datos

- [x] Migraciones 001–038 existen en el repo.
- [ ] Verificar 001–038 aplicadas en producción y registrar checksums/fecha.
- [ ] Ejecutar `npm run check:supabase` sin FAIL.
- [ ] Ejecutar `npm run probe:supabase` sin MISSING.
- [ ] Verificar índices en queries críticas y evitar full scans crecientes.
- [ ] Definir backup, PITR y prueba de restauración.
- [ ] Definir borrado/anonimización por cliente.
- [ ] Confirmar constraints de idempotencia para pagos, feedback y jobs.

### Jobs y ejecución asíncrona

- [ ] Verificar creación, claim atómico, heartbeat, timeout, retry y abandono.
- [ ] Simular crash a mitad de proceso y recuperar sin doble cobro/doble entrega.
- [ ] Simular timeout de Vercel y confirmar que drainer continúa.
- [ ] Confirmar límites reales del plan Vercel y duración máxima.
- [ ] Probar cron con secretos correctos e incorrectos.
- [ ] Crear procedimiento manual de replay seguro.
- [ ] Evitar fire-and-forget como única garantía de procesamiento.

### Providers

- [x] Health model distingue missing, invalid, exhausted y rate-limited.
- [x] Ledger instrumentado para uso.
- [ ] Definir provider mínimo por tier y modo permitido.
- [ ] Definir circuit breaker y límites diarios de costo.
- [ ] Alertar antes de quedarse sin crédito.
- [ ] Conservar respuesta suficiente para auditoría sin almacenar datos innecesarios.
- [ ] Verificar licencias/términos de cada fuente.
- [ ] Probar degradación individual de Anthropic, búsqueda y extractor.

## 8. Checklist P1 — Pagos y monetización

- [x] Catálogo server-side vigente con códigos versionados.
- [x] Checkout público cerrado intencionalmente.
- [x] Checkout queda fail-closed con gate explícito y no crea jobs huérfanos mientras está cerrado.
- [ ] Elegir proveedor de pago compatible con entidad/país y documentar decisión.
- [ ] Alinear landing, catálogo, términos, privacidad, admin, emails y webhooks con esa decisión.
- [ ] Confirmar precios finales, impuestos, moneda y descriptor bancario.
- [ ] Confirmar qué significa “crédito” y cuándo se consume/restituye.
- [ ] Probar compra en sandbox y producción con monto pequeño.
- [ ] Probar éxito, cancelación, abandono, duplicado, reembolso y disputa.
- [ ] Probar email distinto al usuario registrado.
- [ ] Probar pago recibido antes/después del intake.
- [ ] Implementar reconciliación diaria de provider ↔ orders ↔ jobs.
- [ ] Medir fees, costo de providers, costo de IA, revisión humana y margen por tier.
- [ ] No habilitar Premium self-serve; mantener guided pilot hasta demostrar operación.

## 9. Checklist P1 — Landing, adquisición y conversión

- [ ] Hero explica resultado y cliente ideal en menos de 10 segundos.
- [ ] Ejemplo real/sanitizado visible con evidencia y limitaciones.
- [ ] CTA primario coherente: solicitar piloto mientras checkout está cerrado.
- [ ] CTA nunca lleva a una acción muerta o contradictoria.
- [ ] Pricing usa únicamente $7/$25/$59/$129 y entitlements vigentes.
- [ ] Copy elimina referencias legacy a lead lists/contact databases/outreach automatizado.
- [ ] FAQ cubre fuentes, precisión, tiempos, privacidad, resultados vacíos y reembolsos.
- [ ] Contacto y soporte visibles.
- [ ] Metadata, favicon, Open Graph, canonical, sitemap y robots revisados.
- [ ] Analytics con consentimiento adecuado y sin PII.
- [ ] Eventos mínimos: landing_view, sample_view, pilot_request, intake_started/completed, report_viewed, feedback_submitted.
- [ ] UTM y fuente de adquisición preservados hasta el piloto.
- [ ] Performance: Core Web Vitals razonables en móvil.
- [ ] Accesibilidad: teclado, labels, contraste, focus, encabezados y reduced motion.

## 10. Checklist P1 — Comunicaciones y soporte

- [ ] Dominio remitente verificado (SPF, DKIM, DMARC).
- [ ] Emails transaccionales: solicitud recibida, intake confirmado, procesamiento, entrega, fallo/retraso y reembolso.
- [ ] Emails no incluyen secretos, datos de otros clientes ni links permanentes inseguros.
- [ ] Links de acceso expiran o tienen revocación y suficiente entropía.
- [ ] Resend/servicio elegido tiene alertas de bounce y complaint.
- [ ] Política de soporte: canal, horario, SLA de primera respuesta y escalamiento.
- [ ] Plantilla de incidente y comunicación honesta al cliente.
- [ ] Registro de incidentes y postmortem para P0/P1.

## 11. Checklist P1 — Deploy, observabilidad y rollback

- [ ] Repo remoto actualizado; resolver bloqueo de push/keychain.
- [ ] Branch protection o mínimo PR/check antes de producción.
- [ ] CI ejecuta typecheck, suites críticas y build.
- [ ] Preview deployment no usa datos/secretos productivos innecesarios.
- [ ] Producción vinculada al commit exacto aprobado.
- [ ] `NEXT_PUBLIC_APP_URL` coincide con dominio canónico.
- [ ] Headers: CSP, HSTS en producción y políticas actuales verificadas.
- [ ] Logging estructurado con run_id/job_id/provider, sin PII ni secrets.
- [ ] Error tracking y alertas configurados.
- [ ] Métricas: requests, errores, latencia, jobs, provider health, gasto, emisiones/rechazos, report views y feedback.
- [ ] Alertas accionables: pago sin job, job estancado, provider agotado, tasa de error, costo anómalo, entrega vencida.
- [ ] Rollback de app probado.
- [ ] Roll-forward/rollback de migraciones documentado; migraciones destructivas requieren backup.
- [ ] Runbook de incidente accesible sin depender de la app caída.

## 12. Checklist técnico obligatorio antes de cada release

- [ ] `git status --short` revisado; no incluir artefactos/ledgers por accidente.
- [ ] `npx tsc --noEmit`.
- [ ] Suites de inteligencia vigentes.
- [ ] `npm run test:ops-modes`.
- [ ] Smokes correspondientes a las superficies modificadas.
- [ ] `npm run test:beta-e2e-readiness`.
- [ ] `npm run build` sin dev server concurrente.
- [ ] Test manual de rutas y acciones críticas.
- [ ] Revisión de diff buscando secretos, bypasses, mocks, precios y copy legacy.
- [ ] Actualizar este checklist con evidencia, no solo con intención.

Comando de referencia local (ajustar si se añaden suites):

```bash
npx tsc --noEmit
npm run test:intelligence-v2
npm run test:intelligence-v3
npm run test:deep-validation
npm run test:company-first
npm run test:date-es
npm run test:counterevidence
npm run test:provider-health
npm run test:entity-v3
npm run test:production-eligibility
npm run test:ops-modes
npm run build
```

## 13. Secuencia de ejecución recomendada

### Fase 0 — Ahora, sin gastar providers

- [ ] Consolidar checklist y prompt maestro.
- [ ] Ejecutar auditoría estática de rutas admin/internal, pagos, uploads y auth.
- [ ] Corregir P0/P1 reproducibles sin credenciales.
- [x] Añadir CI y un comando único `npm run release:check` (verificado 2026-07-21).
- [ ] Limpiar contradicciones de copy/precios/proveedor de pago en superficies públicas.
- [x] Preparar harness, matriz y plantillas E2E (`pilot:e2e:run`), no ejecutable desde CI.

### Fase 1 — Al reactivar providers

- [ ] Aumentar límite de Anthropic.
- [ ] Activar solo búsqueda necesaria según experimento de ROI.
- [ ] Capturar health snapshot.
- [ ] Benchmark company-first.
- [ ] Adjudicación humana.
- [ ] Preview E2E, Brief E2E, comparación y segunda corrida.

### Fase 2 — Primer piloto

- [ ] Seleccionar cliente apto.
- [ ] Cobro/manual agreement.
- [ ] Intake, corrida, QA, entrega y feedback.
- [ ] Medir costo, tiempo, calidad percibida y outcome.
- [ ] Incorporar aprendizaje sin relajar hard blockers.

### Fase 3 — Repetibilidad

- [ ] Completar 3–5 pilotos.
- [ ] Ajustar posicionamiento, vertical y pricing con evidencia.
- [ ] Definir SLA real y capacidad.
- [ ] Automatizar únicamente los cuellos de botella observados.

### Fase 4 — Self-serve

- [ ] Elegir/activar pagos.
- [ ] Payment E2E y reconciliación.
- [ ] Load/failure testing.
- [ ] Legal y soporte finales.
- [ ] Apertura gradual con límite de volumen y rollback.

## 14. Decisión Go / No-Go

### Go para piloto guiado

Solo si todos son `sí`:

- [ ] ¿Providers requeridos verdes para esta corrida?
- [ ] ¿E2E actual pasó sin mock y con provenance?
- [ ] ¿Dos o más oportunidades limpias o un empty state honesto previamente acordado?
- [ ] ¿QA humana completada?
- [ ] ¿Alcance, SLA, precio, soporte y refund comunicados?
- [ ] ¿Acceso y aislamiento verificados?
- [ ] ¿Hay responsable disponible para recuperación manual?

### No-Go automático

- cualquier secreto o acceso cruzado;
- identidad corporativa/rol dudoso en una oportunidad que se pretende entregar;
- datos mock o sin provenance en superficie de cliente;
- proveedor agotado sin degradación comunicada;
- cobro sin capacidad de crear/reconciliar orden;
- copy/precio/entitlement distinto entre landing, checkout y entrega;
- build o suite crítica roja;
- imposibilidad de cumplir el SLA ofrecido.

## 15. Evidencia de avance

Cada sesión debe agregar una entrada breve aquí o enlazar un artefacto:

| Fecha | Commit/estado | Trabajo | Evidencia | Riesgo restante | Próximo paso |
|---|---|---|---|---|---|
| 2026-07-21 | working tree | Checklist consolidado y auditoría inicial | TypeScript 0 errores; `docs/CONTINUITY.md`; health conocido | Providers agotados; E2E vigente pendiente | Auditoría estática P0 + release gate |
| 2026-07-21 | working tree | Gate determinista + cierre de exposición legacy | Suites seleccionadas y build 130/130 páginas; jobs/process/results protegidos | `process/search`, onboarding y upload requerían hardening | Proteger trigger de procesamiento y retirar upload legacy |
| 2026-07-21 | working tree | Cierre P0 de triggers, PII legacy, demo y checkout | `release:check` verde; 238/238 assertions; build 130/130; tests owner/internal/admin | Rate limiting distribuido y E2E con providers siguen pendientes | Preparar preflight E2E + auditar events/provider-status |
| 2026-07-21 | working tree | Abuso público + preflight real | 247 assertions acumuladas; typecheck/build 130/130; preflight no consumió providers | Mock híbrido activo e `INTERNAL_RUN_SECRET` ausente; health vivo aún no probado | Corregir env y ejecutar provider health antes de E2E |
| 2026-07-21 | working tree | Gate HTTP + harness + QA/operación humana | `release:check` 263/263; build 130/130; harness detenido con `provider_calls_made=false` | Mock activo, internal secret y presupuesto ausentes; health vivo no probado | Martín corrige 3 variables; luego preflight y health mínimo |
