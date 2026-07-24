# LeadLens — Prompt maestro de aceleración de calidad de cuentas

## Cómo usar este prompt

Continúa trabajando directamente en `/Users/martingaleano/leadlens-project`. Este prompt no autoriza gasto externo, despliegues, pagos, mensajes a clientes ni acciones irreversibles. Las corridas pagadas requieren autorización explícita con cap. Sí autoriza inspección y edición local, fixtures, typecheck, build, replay offline, documentación y mejoras deterministas.

## Misión

Transforma LeadLens de un motor disciplinado pero con recall irregular en un sistema que encuentre empresas colombianas comercialmente útiles, no obvias y defendibles para clientes reales. El resultado no es “más candidatos”; es un portafolio pequeño de cuentas que un vendedor serio considere nuevas, relevantes, comprobables y dignas de investigación.

LeadLens debe superar a una búsqueda común mediante la combinación de:

1. universo de cuentas buyer-side relevante para la oferta;
2. identidad corporativa y geografía verificadas;
3. operación que pueda comprar, listar, servir o utilizar el producto;
4. evidencia de timing o ruta de acceso comercial;
5. clasificación explícita de dirección comprador–vendedor;
6. prueba de categoría y limitaciones;
7. counterevidence y revisión adversarial;
8. portafolio diverso, novedoso y no dominado por nombres famosos;
9. aprendizaje acumulativo que no permita a un falso positivo sobreentrenar el sistema;
10. métricas que distingan hipótesis preliminares de oportunidades defendibles.

## Estado real heredado del piloto Amor de Gea del 22 de julio de 2026

La corrida `ml/data/pilot-amor-de-gea/2026-07-22T23-04-37-703Z` consumió aproximadamente USD 0,208 de providers y USD 0,024651 de LLM. Investigó 15 empresas, con 5 dinámicas y 10 seeds, sin cuentas obvias. Detectó tres capacidades preliminares y una evidencia moderada, pero terminó con cero oportunidades defendibles y bloqueó correctamente la entrega.

Aprendizajes obligatorios de esa corrida:

- Supernat mostró catálogo oficial con Labfarve, Jaquin de Francia y Biopronat. Fue rechazado por una resolución de identidad demasiado dependiente de similitud literal entre marca y dominio. Una marca curada puede operar en un dominio no homónimo; la evidencia oficial y el pack deben influir sin regalar confianza a dominios dinámicos.
- MADRETIERRA mostró una página dirigida a reclutar distribuidores de su propia oferta y después fue promovida por una homepage de mayorista. La dirección observada debe persistir durante toda la investigación de la empresa.
- Fitt Global fue tratado como señal vencida porque su página corporativa tenía fecha histórica. La antigüedad aplica a timing signals, no a capacidad evergreen extraída en vivo.
- Tavily devolvió eventos de H&M, Alkomprar y Prochampions para consultas de otras empresas. No se debe pagar extracción si título/snippet no asocia visiblemente la cuenta consultada.
- El universo quedó dominado por retailers/distribuidores y no protegió capacidad para hoteles, resorts o spas, aunque el ICP los pedía.
- Varias empresas investigadas parecen fabricantes, proveedores o marcas que buscan distribuidores, no compradores o curadores de portafolio.
- Una hipótesis preliminar no debe detener Preview, consumir el cupo objetivo ni vencer evidencia defendible por score.

## Principios no negociables

- Colombia es contrato exacto cuando el intake lo exige; `gl=co` no prueba país.
- Una cuenta conocida o evidente no crea valor por sí sola.
- Un retailer famoso sin ángulo específico no vale una entrega pagada.
- `timing_signal` requiere evento material, fecha válida, asociación, rol y causalidad.
- `channel_fit` nunca implica intención de compra ni puede ser `act_now` automáticamente.
- Evidencia `preliminary` es monitor; no cuenta para mínimos de entrega.
- Evidencia `moderate` o `strong` requiere extracción viva de dominio oficial.
- Un score agregado nunca rescata identidad, geografía, rol, dirección o fit fallidos.
- No rellenar resultados para alcanzar una cuota.
- No repetir gasto sin una hipótesis concreta derivada del trace anterior.
- Cada corrección nacida de una corrida real debe incluir prueba de regresión.

## Objetivo de calidad de universo

Antes de buscar señales, clasifica cada empresa por rol comercial:

- `buyer_channel`: retailer, distribuidor multimarca, mayorista comprador, marketplace o cadena que lista productos externos;
- `hospitality_operator`: hotel, resort, spa, club o experiencia con control plausible de F&B/wellness;
- `end_user_operator`: empresa que utiliza directamente la capacidad ofrecida;
- `brand_owner`: fabricante o marca que principalmente vende su propia oferta;
- `seller_network`: empresa que recluta distribuidores/resellers para productos propios;
- `service_provider`: agencia, consultora, medio, directorio o proveedor que no es el comprador objetivo;
- `unknown`: evidencia insuficiente; puede investigarse, pero no dominar el presupuesto.

Para ofertas físicas de canal:

- prioriza `buyer_channel` y `hospitality_operator`;
- protege diversidad de subsegmentos;
- no permitas que distribuidores genéricos ocupen todo el universo;
- penaliza `brand_owner` y bloquea `seller_network` salvo evidencia explícita opuesta más fuerte;
- conserva al menos dos rutas comerciales distintas cuando el universo las tenga;
- separa fabricante compatible de comprador compatible.

Cada empresa debe conservar:

- rol y confianza;
- evidencia que sustentó el rol;
- origen seed/dinámico;
- país y evidencia geográfica;
- dominio y evidencia de identidad;
- notoriedad;
- subsegmento;
- grupo económico cuando sea resoluble;
- razón concreta de inclusión.

## Objetivo de recuperación

Las consultas deben responder a hipótesis distintas:

1. acceso de proveedor/marca;
2. catálogo multimarca;
3. evento causal vertical;
4. expansión de operación relevante;
5. onboarding o convocatoria;
6. hospitality/F&B/wellness cuando corresponda.

No uses el mismo query genérico para todos los arquetipos. Una consulta de evento debe exigir asociación visible antes de extracción. Una consulta de canal puede entrar sin nombre en título únicamente si la URL pertenece al dominio oficial y después supera extracción, identidad y dirección.

Optimiza costo por oportunidad defendible, no costo por query. Reutiliza extracción por URL, pero reevalúa asociación y rol por empresa. Registra resultados no seleccionados para auditar falsos negativos.

## Contrato de evidencia de canal

- `strong`: portal, registro, convocatoria, submission u onboarding explícito de proveedores/marcas externas y categoría compatible.
- `moderate`: catálogo oficial con al menos dos marcas externas verificables o evidencia equivalente de portafolio externo.
- `preliminary`: declaración general de distribuidor/mayorista sin ruta de proveedor.
- `insufficient`: snippets sin extracción, dominio no oficial, categoría desconocida, dirección conflictiva o evidencia no clasificable.

La evidencia debe guardar proof type, category alignment, URLs, limitaciones y pregunta falsable. Si aparece seller recruitment, esa memoria persiste. Sólo intake explícito o portafolio externo fuerte puede superar el conflicto.

## Contrato de timing

Un timing signal necesita:

- empresa inequívoca;
- verbo de cambio, no estado estático;
- fecha real dentro de ventana;
- empresa como sujeto/operador;
- operación relacionada con la oferta;
- Colombia confirmada;
- página no editorial, métrica, referencia o marketing;
- counterevidence aceptable.

Búsqueda y validación deben compartir el mismo vocabulario vertical. Si se busca `nueva tienda`, `nueva categoría`, `nuevo spa` o `programa de bienestar`, el clasificador debe reconocer exactamente esos cambios sin convertir `tienda`, `spa` o `retail` estáticos en eventos.

## Construcción del portafolio

Ordena por fuerza epistemológica antes que score:

1. timing defendible;
2. channel strong;
3. channel moderate;
4. preliminary monitor;
5. unknown/insufficient.

Dentro del mismo nivel usa fit, identidad, novedad, geografía, corroboración y score. Protege diversidad por rol/subsegmento/ciudad cuando exista. No permitas que una sola clase de distribuidores ocupe todos los cupos. Preliminares nunca desplazan defendibles.

## Aprendizaje y observabilidad

Toda corrida debe reportar:

- universo por origen, rol, subsegmento, notoriedad y país;
- consultas por lane;
- URLs consideradas, seleccionadas, reutilizadas y descartadas antes de extracción;
- costo fresco y evidencia reutilizada;
- blockers por etapa;
- channel grades;
- emitted total, defensible y preliminary;
- objeciones exactas del revisor adversarial;
- falsos negativos visibles en trace;
- costo por oportunidad defendible;
- decisión de entrega.

No mezcles outcome comercial con calidad del hallazgo. Feedback de reunión o venta no debe convertir un falso positivo en buen fit; feedback humano de identidad/evidencia tampoco garantiza conversión.

## Protocolo de implementación

1. Lee código y último artifact antes de cambiar.
2. Formula una hipótesis de fallo.
3. Implementa una corrección determinista pequeña pero transversal.
4. Añade fixture basado en el caso real.
5. Ejecuta typecheck y suites afectadas.
6. Ejecuta build cuando cambie UI, rutas o contratos compartidos.
7. Usa replay offline antes de pedir nueva corrida.
8. No ejecutes providers sin autorización y cap.
9. Actualiza panorama sólo con evidencia.
10. Informa qué cambió en precisión, recall, costo y honestidad.

## Secuencia inmediata de trabajo

1. Añadir rol comercial al universo y a los seeds.
2. Proteger diversidad buyer-channel/hospitality en portfolios wellness.
3. Penalizar fabricantes/seller networks antes de gastar queries.
4. Crear métricas de composición por rol.
5. Rejugar el trace anterior y verificar que MADRETIERRA se bloquee y Supernat no muera sólo por identidad literal.
6. Auditar consultas de hospitality y asegurar que GHL/Movich u operadores regionales tengan capacidad protegida.
7. Mejorar enumeración dinámica buyer-side por ciudades y subsegmentos colombianos.
8. Crear benchmark offline de cuentas correctas/incorrectas basado en casos reales.
9. Sólo entonces solicitar autorización para otra corrida controlada.

## Criterio de salida

No declares éxito por tests solamente. El sistema estará listo para mostrar empresas de calidad cuando una corrida real produzca al menos dos oportunidades colombianas novedosas, defendibles y comercialmente relevantes; ninguna debe ser una cuenta obvia sin ángulo específico, fabricante confundido con comprador, seller-direction, homónimo o evidencia preliminar presentada como oportunidad.

