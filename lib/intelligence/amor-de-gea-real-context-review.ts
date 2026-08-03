import {AMOR_QUESTIONS} from "./client-questionnaire";

export const AMOR_CONTEXT_REVIEW_VERSION = "amor-real-context-review-v1";
export const AMOR_QUESTIONNAIRE_FINGERPRINT = "sha256:705f79dede329cb1a50a2083358fac0caa9f328e3c251f5d069c7ec13fae13b7";

export type ReviewCompletion = "answered" | "missing" | "ambiguous" | "not_applicable" | "clarification_recommended";
export type EvidenceState = "no_evidence" | "client_statement" | "client_marketing_material" | "client_document_supplied" | "independently_verified";
export type OperationalClassification = "sufficient_to_continue" | "pending_non_blocking" | "conditioning" | "route_specific_blocker" | "customer_safe_blocker";
export type PreviewDirection = "strengthen" | "weaken" | "uncertain";
export type ResolutionSource = "client_questionnaire" | "client_marketing_material" | "founder_pilot_decision" | "system_interpretation" | "open_validation";

export interface FounderResolution {
  question_id:string;
  source:ResolutionSource;
  resolution:string;
  limitation:string;
  influence:{discovery:boolean;prioritization:boolean;customer_safe:boolean};
  candidate_action:"include"|"include_with_limitation"|"exclude_route"|"keep_open";
}

export interface RealContextAnswer {
  question_id: string;
  field: string;
  question: string;
  completion: ReviewCompletion;
  original_answer: string;
  mapped_fields: string[];
  source_fingerprint: string;
  annotation_page: number | null;
  client_stated_confidence: "not_marked";
  reviewer_confidence: number;
  evidence_state: EvidenceState;
  operational_classification: OperationalClassification;
  affected_routes: string[];
  affected_accounts: string[];
  customer_safe_impact: string;
  reviewer_state: "unreviewed";
  clarification: string | null;
}

const RAW: Record<string, Omit<RealContextAnswer, "question_id" | "question" | "field" | "source_fingerprint" | "client_stated_confidence" | "reviewer_state">> = {
  product_formats: {
    completion: "answered", annotation_page: 2, reviewer_confidence: .92, evidence_state: "client_statement", operational_classification: "sufficient_to_continue",
    original_answer: "Amor de Gea ofrece actualmente concentrados líquidos botánicos premium para el bienestar diario, desarrollados a partir de extractos naturales cuidadosamente seleccionados y formulados para integrarse como rituales cotidianos de autocuidado.\n\nActualmente el portafolio disponible comprende:\n\n• Agua – Mezcla botánica orientada al descanso y la relajación.\n• Tierra – Mezcla botánica para acompañar el bienestar digestivo.\n• Éter – Mezcla botánica diseñada para favorecer la energía y la claridad mental\n\nLos productos se presentan en formatos aptos para comercialización B2B y pueden adaptarse a diferentes necesidades comerciales según el canal y el volumen del proyecto.",
    mapped_fields: ["product_formats", "offering"], affected_routes: ["retail", "hospitality", "distribution", "wellness"], affected_accounts: ["all"], customer_safe_impact: "Los productos y usos son declaraciones del cliente; los beneficios no son claims verificados.", clarification: "Confirmar presentación de 50 ml, unidades por caja, vida útil y disponibilidad por SKU."
  },
  customization_capacity: {
    completion: "answered", annotation_page: 2, reviewer_confidence: .9, evidence_state: "client_statement", operational_classification: "sufficient_to_continue",
    original_answer: "Amor de Gea ofrece flexibilidad para desarrollar soluciones B2B mediante personalización de etiquetas, empaques, kits corporativos y experiencias de regalo. Dependiendo del volumen y del proyecto, también es posible evaluar desarrollos de surtidos especiales y estrategias de co-branding bajo criterios previamente acordados.",
    mapped_fields: ["customization_capacity"], affected_routes: ["hospitality", "corporate_gifting", "retail"], affected_accounts: ["Hotel Spa La Colina", "Somos Consiente"], customer_safe_impact: "Puede describirse como capacidad declarada, no como servicio garantizado.", clarification: "Precisar mínimos, tiempos y límites por tipo de personalización."
  },
  white_label_capacity: {completion:"missing",annotation_page:null,reviewer_confidence:1,evidence_state:"client_marketing_material",operational_classification:"route_specific_blocker",original_answer:"",mapped_fields:["white_label_capacity"],affected_routes:["private_label"],affected_accounts:["Distribuidora DAM"],customer_safe_impact:"La imagen comercial menciona private label, pero el cuestionario no lo confirma.",clarification:"¿La marca blanca está operativamente disponible hoy y bajo qué condiciones?"},
  price_positioning: {completion:"answered",annotation_page:3,reviewer_confidence:.93,evidence_state:"client_statement",operational_classification:"sufficient_to_continue",original_answer:"Dependiendo del volumen de compra, se pueden otorgar descuentos al mayorista de entre un 20 y un 30%; el precio de venta por producto es de $59,000 \ny por bundle de 3 es de 149,000 pesos colombianos.",mapped_fields:["price_positioning","preliminary_wholesale_discount"],affected_routes:["retail","distribution","hospitality"],affected_accounts:["all"],customer_safe_impact:"No derivar ni publicar un precio mayorista confirmado; IVA, vigencia y condiciones están pendientes.",clarification:"Confirmar IVA, vigencia, referencias cubiertas y si el descuento es indicativo o política vigente."},
  minimum_order: {completion:"answered",annotation_page:3,reviewer_confidence:.94,evidence_state:"client_statement",operational_classification:"sufficient_to_continue",original_answer:"Mínimo 50 unidades para iniciar piloto, se espera crecer a 300 unidades mensuales en los siguientes 5 meses",mapped_fields:["minimum_order"],affected_routes:["retail","hospitality","distribution"],affected_accounts:["all"],customer_safe_impact:"El crecimiento esperado no debe presentarse como compromiso de compra.",clarification:"Confirmar si las 50 unidades pueden mezclar SKUs y si el mínimo cambia en recurrencia."},
  margins: {completion:"clarification_recommended",annotation_page:3,reviewer_confidence:.9,evidence_state:"client_statement",operational_classification:"pending_non_blocking",original_answer:"Por negociar de acuerdo a volumen o proyección del negocio",mapped_fields:["margins"],affected_routes:["distribution","retail"],affected_accounts:["Distribuidora DAM","BioPlaza"],customer_safe_impact:"No afirmar viabilidad económica ni margen final.",clarification:"Puede validarse después: margen mínimo, descuento máximo y tratamiento de IVA/flete."},
  account_size_constraints: {completion:"clarification_recommended",annotation_page:3,reviewer_confidence:.82,evidence_state:"client_statement",operational_classification:"conditioning",original_answer:"La capacidad actual permite atender pilotos y primeras cuentas recurrentes, con escalamiento progresivo conforme aumenta la demanda",mapped_fields:["account_size_constraints"],affected_routes:["retail","hospitality","distribution"],affected_accounts:["all"],customer_safe_impact:"No convierte cuentas grandes en viables sin volumen normal y capacidad por SKU.",clarification:"Definir rango atractivo para piloto, recurrencia y distribuidor/multisede."},
  production_capacity: {completion:"clarification_recommended",annotation_page:4,reviewer_confidence:.9,evidence_state:"client_statement",operational_classification:"conditioning",original_answer:"Mas de 1,000 unidades pero con 1 mes de notificación previa. Ideal estos volúmenes pero preferible la constancia",mapped_fields:["production_capacity"],affected_routes:["distribution","multi_site_retail","hospitality"],affected_accounts:["Distribuidora DAM","BioPlaza","Hotel Spa La Colina"],customer_safe_impact:"No afirmar capacidad normal de 1.000 unidades; es capacidad declarada con preaviso.",clarification:"Confirmar capacidad mensual normal, máxima y aproximada por SKU."},
  delivery_radius: {completion:"clarification_recommended",annotation_page:4,reviewer_confidence:.92,evidence_state:"client_statement",operational_classification:"conditioning",original_answer:"Cobertura nacional",mapped_fields:["delivery_radius","distribution_capability"],affected_routes:["retail","distribution","hospitality"],affected_accounts:["all"],customer_safe_impact:"Cobertura declarada sin método, costos ni SLA verificados.",clarification:"Confirmar transportador, ciudades, flete, costo y manejo de rotura."},
  fulfillment_constraints: {completion:"answered",annotation_page:4,reviewer_confidence:.94,evidence_state:"client_statement",operational_classification:"conditioning",original_answer:"Dias de despacho, pueden ser entre 2 y 5\nEmpaque de vidrio",mapped_fields:["fulfillment_constraints"],affected_routes:["retail","distribution","hospitality"],affected_accounts:["all"],customer_safe_impact:"El plazo y riesgo de vidrio deben mostrarse como declaración pendiente de política logística.",clarification:"Confirmar desde qué hito corren los 2–5 días y quién asume daños/roturas."},
  certifications: {completion:"clarification_recommended",annotation_page:4,reviewer_confidence:.9,evidence_state:"client_statement",operational_classification:"customer_safe_blocker",original_answer:"Invima",mapped_fields:["certifications"],affected_routes:["retail","distribution","hospitality"],affected_accounts:["all"],customer_safe_impact:"El cliente marcó INVIMA, ficha técnica, etiquetado, RUT y cámara como activos, pero no adjuntó documentos ni números verificables.",clarification:"Solicitar soportes, números, alcance por producto y vigencias antes de usar claims externos."},
  business_model: {completion:"missing",annotation_page:null,reviewer_confidence:1,evidence_state:"no_evidence",operational_classification:"conditioning",original_answer:"",mapped_fields:["business_model"],affected_routes:["all"],affected_accounts:["all"],customer_safe_impact:"No afirmar que una modalidad opera actualmente.",clarification:"Seleccionar los modelos B2B que ya soporta Amor de Gea."},
  preferred_deal_type: {completion:"missing",annotation_page:null,reviewer_confidence:1,evidence_state:"no_evidence",operational_classification:"conditioning",original_answer:"",mapped_fields:["preferred_deal_type"],affected_routes:["all"],affected_accounts:["all"],customer_safe_impact:"La priorización de rutas sigue provisional.",clarification:"Ordenar las tres modalidades que LeadLens debe priorizar."},
  current_partnerships: {completion:"missing",annotation_page:null,reviewer_confidence:1,evidence_state:"no_evidence",operational_classification:"conditioning",original_answer:"",mapped_fields:["current_partnerships"],affected_routes:["all"],affected_accounts:["all"],customer_safe_impact:"No se conocen conflictos, exclusividades o accesos existentes.",clarification:"Indicar clientes, distribuidores, aliados o cuentas que deban considerarse o evitarse."},
  sales_cycle_tolerance: {completion:"answered",annotation_page:5,reviewer_confidence:.95,evidence_state:"client_statement",operational_classification:"sufficient_to_continue",original_answer:"Por ahora necesitamos empezar con ciclos menores a 30 días. Cuando ya se lleve una relación comercial duradera se puede extender el ciclo",mapped_fields:["sales_cycle_tolerance"],affected_routes:["all"],affected_accounts:["all"],customer_safe_impact:"Es preferencia del cliente, no evidencia de que una cuenta cerrará en 30 días.",clarification:null},
  company_stage: {completion:"answered",annotation_page:6,reviewer_confidence:.98,evidence_state:"client_statement",operational_classification:"sufficient_to_continue",original_answer:"Consolidando operaciones",mapped_fields:["company_stage"],affected_routes:["all"],affected_accounts:["all"],customer_safe_impact:"Puede presentarse como autodescripción del cliente.",clarification:null},
  distribution_capability: {completion:"clarification_recommended",annotation_page:6,reviewer_confidence:.86,evidence_state:"client_statement",operational_classification:"conditioning",original_answer:"Construir relaciones comerciales duraderas y que beneficien a ambas partes",mapped_fields:["pilot_objectives"],affected_routes:["all"],affected_accounts:["all"],customer_safe_impact:"Es un objetivo estratégico, no tres resultados medibles.",clarification:"Definir tres objetivos medibles a 90–180 días."},
};

export interface AccountImpactPreview {account:string;direction:PreviewDirection;relevant_context:string[];reason:string;missing_dependency:string;dependency_scope:"discovery"|"recommendation"|"customer_safe"|"later_negotiation";}
export const AMOR_ACCOUNT_IMPACT_PREVIEW: AccountImpactPreview[] = [
  {account:"BioPlaza",direction:"strengthen",relevant_context:["portafolio definido","empaque terminado","MOQ piloto de 50","cobertura nacional declarada"],reason:"La entrada retail puede evaluarse con una oferta concreta y un piloto manejable.",missing_dependency:"Soportes de cumplimiento, unidades por caja y economía final del canal.",dependency_scope:"customer_safe"},
  {account:"Distribuidora DAM",direction:"uncertain",relevant_context:["capacidad declarada superior a 1.000 con preaviso","ambición nacional","personalización"],reason:"Hay potencial de escala, pero la ruta distribuidor depende de operación y requisitos aún no confirmados.",missing_dependency:"Capacidad normal/por SKU, modelo distribuidor, margen y private label.",dependency_scope:"recommendation"},
  {account:"Natural + Mente",direction:"strengthen",relevant_context:["posicionamiento wellness","formato premium compacto","MOQ piloto"],reason:"El formato y tamaño de prueba son compatibles con una validación de retail especializado.",missing_dependency:"Documentación por producto y términos del piloto.",dependency_scope:"customer_safe"},
  {account:"Tu Tienda Saludable",direction:"strengthen",relevant_context:["pedido inicial pequeño","formato simple","cobertura nacional declarada"],reason:"Puede funcionar como aprendizaje de entrada directa y reposición.",missing_dependency:"Surtido por caja, freight y economics de recurrencia.",dependency_scope:"later_negotiation"},
  {account:"Hotel Spa La Colina",direction:"strengthen",relevant_context:["empaque premium","gotero","gifting","co-branding"],reason:"Aparecen casos plausibles de amenity, experiencia o regalo; ninguno está aplicado ni validado.",missing_dependency:"Modelo hotelero soportado, personalización mínima y compliance del uso propuesto.",dependency_scope:"recommendation"},
  {account:"Somos Consiente",direction:"strengthen",relevant_context:["afinidad de marca","co-branding","kits y experiencias"],reason:"La colaboración gana plausibilidad estratégica.",missing_dependency:"Modelo comercial repetible, volumen y responsable de compra.",dependency_scope:"recommendation"},
];

export const PILOT_SUCCESS_CONTRACT = {
  decision: "Definir qué cuentas debe trabajar Amor de Gea primero y cómo prepararse.",
  value_dimensions: ["Inteligencia comercial","Priorización","Preparación pre-reunión","Aprendizaje de mercado","Revisión estratégica"],
  indicators: {
    quality: ["Cuentas consideradas relevantes","Cuentas rechazadas y razón","Utilidad de las tesis"],
    action: ["Cuentas trabajadas","Rutas de comprador validadas","Acciones iniciadas por el cliente","Conversaciones comerciales"],
    learning: ["Objeciones recurrentes","Respuesta por segmento","Aprendizaje de precio/formato/canal","Recomendaciones modificadas"],
    outcomes: ["Oportunidades","Pilotos","Pedidos","Ventas cuando existan"],
  },
  cadence: ["Revisión de línea base","Revisión después de las primeras acciones","Actualización mensual cuando aporte valor"],
  no_sales_response: ["Verificar si el cliente actuó","Revisar selección y buyer path","Revisar oferta y encaje","Capturar objeciones","Recalibrar","Ejecutar otra búsqueda limitada solo si se justifica"],
  database_difference: "Una base de datos muestra empresas. LeadLens determina cuáles tienen sentido para tu negocio, en qué orden trabajarlas, cómo prepararte y qué aprender de los resultados.",
  client_strategic_objective:"Construir relaciones comerciales duraderas y que beneficien a ambas partes.",
  founder_objectives:[
    {id:"account_relevance",label:"Relevancia de cuentas",definition:"Identificar y priorizar un portafolio que Amor de Gea considere comercialmente relevante y operativamente plausible."},
    {id:"commercial_action",label:"Acción comercial",definition:"Permitir que Amor de Gea trabaje un primer conjunto de cuentas con preparación específica y próximos pasos claros."},
    {id:"market_learning",label:"Aprendizaje de mercado",definition:"Determinar qué tipos de cuenta, casos de uso, objeciones y rutas muestran mayor potencial práctico."},
  ],
  client_expectation_feedback:{
    source:"client_direct" as const,
    dimensions:[
      {id:"commercial_intelligence",label:"Inteligencia comercial, no solo una base de datos",expectation:"Una selección refinada de cuentas relevantes —no cientos de empresas— con explicación de por qué cada una importa.",examples:["hoteles boutique enfocados en bienestar","spas premium","clínicas de medicina funcional","tiendas naturales de alto nivel","empresas con programas sólidos de bienestar corporativo"],boundary:"La expectativa de probabilidad se traduce en priorización explicada; no se inventa una probabilidad numérica de conversión."},
      {id:"prioritization",label:"Priorización",expectation:"Responder a quién visitar primero usando facilidad de entrada, volumen esperado, ciclo, recompra y alineación de marca.",examples:[],boundary:"Las variables son criterios cualitativos hasta que outcomes reales permitan calibrarlas."},
      {id:"pre_meeting",label:"Información antes de la reunión",expectation:"Preparar decisión/área probable, oferta comparable visible, prioridades, propuesta plausible y adaptación del discurso.",examples:[],boundary:"No afirmar decisores exactos, prioridades privadas o propuestas aceptadas sin evidencia."},
      {id:"market_learning",label:"Aprendizaje del mercado",expectation:"Entender por qué algunas cuentas avanzan o no: precio, formato, amenities, personalización y política de distribución.",examples:[],boundary:"No recomendar una asignación como 70% a un segmento antes de outcomes suficientes."},
      {id:"strategy_review",label:"Revisión estratégica",expectation:"Convertir resultados y objeciones en cambios de foco y siguientes experimentos.",examples:[],boundary:"Requiere acciones y outcomes; no es una conclusión disponible en esta fase."},
    ],
    evaluation_questions:["¿Cómo miden el éxito de un piloto?","¿Qué indicadores de desempeño entregan?","¿Con qué frecuencia revisan la estrategia?","¿Qué ocurre si las primeras recomendaciones no generan ventas?","¿Cómo incorporan el aprendizaje para mejorar las siguientes recomendaciones?","¿Qué diferencia a LeadLens de una simple base de datos de empresas?"],
  },
} as const;

export const FOUNDER_RESOLUTIONS:FounderResolution[]=[
  {question_id:"margin",source:"open_validation",resolution:"El descuento indicativo de 20%–30% permanece client-stated; margen, IVA y economics finales se validan antes de propuesta o negociación.",limitation:"No existe precio mayorista derivado ni exclusión automática por margen.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"account_size",source:"founder_pilot_decision",resolution:"Escalera interna: Tier 1 piloto ~50; Tier 2 recurrencia temprana ~100–300/mes; Tier 3 escala estratégica >300 condicionada; Tier 4 ~1.000+ con validación y planeación.",limitation:"Interpretación conservadora aprobada para el piloto; Amor de Gea no seleccionó explícitamente estos tiers y mixed-SKU sigue abierto.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"monthly_capacity",source:"system_interpretation",resolution:"Capacidad ordinaria y por SKU sin confirmar. Priorizar solo pilotos y recurrencia temprana; >300 condicionado y ~1.000+ bloqueado por ruta hasta validar.",limitation:"La declaración de más de 1.000 con un mes de aviso no es capacidad normal.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"delivery_coverage",source:"system_interpretation",resolution:"Búsqueda nacional en Colombia; favorecer pedidos concentrados fuera de la región base. Flete, SLA, carrier y rotura se validan antes de propuesta.",limitation:"Cobertura y 2–5 días son declaraciones del cliente, no promesa logística verificada.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"certifications",source:"client_questionnaire",resolution:"Documentación tratada como CLIENT-STATED AVAILABLE para inteligencia interna.",limitation:"Sin archivos, números o vigencias revisados; compliance y health claims siguen bloqueados customer-safe.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"pilot_objectives",source:"founder_pilot_decision",resolution:"Tres objetivos direccionales: relevancia de cuentas, acción comercial y aprendizaje de mercado.",limitation:"El cliente solo declaró el objetivo estratégico de relaciones duraderas; no se garantiza venta.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"private_label",source:"open_validation",resolution:"Marca blanca no confirmada; todas las demás rutas continúan.",limitation:"La mención en material comercial no prueba capacidad operativa.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"exclude_route"},
  {question_id:"current_models",source:"system_interpretation",resolution:"Rutas potenciales, no históricamente probadas: wholesale directo, retail especializado, pilotos, gifting, co-branding, hospitalidad boutique y alianzas.",limitation:"Historia operacional por canal desconocida.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"preferred_models",source:"founder_pilot_decision",resolution:"Hipótesis Phase 2: P1 retail wellness independiente; P2 hospitalidad/spa; P3 gifting/co-branding; distribuidores selectivos exploratorios; distribución nacional compleja y private label diferidos.",limitation:"Hipótesis reversible del fundador; no es preferencia declarada por el cliente.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"include_with_limitation"},
  {question_id:"existing_partners",source:"open_validation",resolution:"No hay lista de exclusión. Cada cuenta prioritaria requiere chequeo de relación/conflicto antes de outreach.",limitation:"Relaciones y conflictos existentes son desconocidos.",influence:{discovery:true,prioritization:true,customer_safe:false},candidate_action:"keep_open"},
];

export function buildAmorRealContextReview() {
  const keyToRaw:Record<string,string>={products_b2b:"product_formats",customization:"customization_capacity",private_label:"white_label_capacity",wholesale_price:"price_positioning",minimum_order:"minimum_order",margin:"margins",account_size:"account_size_constraints",monthly_capacity:"production_capacity",delivery_coverage:"delivery_radius",operational_constraints:"fulfillment_constraints",certifications:"certifications",current_models:"business_model",preferred_models:"preferred_deal_type",existing_partners:"current_partnerships",sales_cycle:"sales_cycle_tolerance",company_stage:"company_stage",pilot_objectives:"distribution_capability"};
  const answers = AMOR_QUESTIONS.map(question => {
    const source = RAW[keyToRaw[question.key]];
    if (!source) throw new Error(`missing_real_context_mapping:${question.key}`);
    return {...source, question_id:question.key, field:question.internal_fields[0]??question.key, question:question.question, mapped_fields:question.internal_fields.length?question.internal_fields:source.mapped_fields, source_fingerprint:AMOR_QUESTIONNAIRE_FINGERPRINT, client_stated_confidence:"not_marked" as const, reviewer_state:"unreviewed" as const};
  });
  const count=(value:ReviewCompletion)=>answers.filter(answer=>answer.completion===value).length;
  return {
    version: AMOR_CONTEXT_REVIEW_VERSION,
    state: "preview_not_applied" as const,
    source: {type:"client_questionnaire" as const,fingerprint:AMOR_QUESTIONNAIRE_FINGERPRINT,pages:9,format:"iOS FreeText annotations",reviewed_at:"2026-08-02"},
    marketing_materials: {count:3,evidence_state:"client_marketing_material" as const,fingerprints:["sha256:439cb09362e0acb83b763d5d6e2b1962e9373da98957ff42ca1d19eb9a24acf4","sha256:d6bddaf9dcd8cc84a766d23351dbafb1745fad58472d814b4a7b72bd5cdcee75","sha256:eb854afe6eb56187ea4b5a1cba56fc3e375d7354a846bce19ac5d7206487bd3f"]},
    summary:{answered:count("answered"),missing:count("missing"),ambiguous:count("ambiguous"),clarification_recommended:count("clarification_recommended"),not_applicable:count("not_applicable"),usable_for_preliminary_intelligence:answers.filter(a=>a.completion!=="missing").length,pending_non_blocking:answers.filter(a=>a.operational_classification==="pending_non_blocking").length,route_specific_blockers:answers.filter(a=>a.operational_classification==="route_specific_blocker").length,customer_safe_blockers:answers.filter(a=>a.operational_classification==="customer_safe_blocker").length,evidence_missing:answers.filter(a=>["no_evidence","client_statement","client_marketing_material"].includes(a.evidence_state)).length},
    answers,
    route_preview:{enabled:["pilotos retail pequeños","retail especializado"],strengthened:["gifting y co-branding","hospitalidad experiencial","wellness retail"],conditioned:["distribución","multi-sede","compras con compliance alto"],deprioritized:["private label hasta confirmación","cuentas que exijan ciclos largos inmediatos"],favored_account_types:["retail natural premium","boutique wellness","hospitalidad de experiencia"],penalized_account_types:["distribuidores de gran escala sin piloto","procurement pesado sin documentos"]},
    account_preview: AMOR_ACCOUNT_IMPACT_PREVIEW,
    success_contract:PILOT_SUCCESS_CONTRACT,
    founder_resolutions:FOUNDER_RESOLUTIONS,
    account_size_ladder:[{tier:1,label:"Piloto",volume:"~50 unidades",state:"usable"},{tier:2,label:"Cuenta recurrente temprana",volume:"~100–300/mes",state:"preferred_initial"},{tier:3,label:"Escala estratégica",volume:">300/mes",state:"conditioned"},{tier:4,label:"Alto volumen",volume:"~1.000+",state:"route_blocked_until_validated"}],
    commercial_route_hypothesis:{label:"FOUNDER-APPROVED SEARCH HYPOTHESIS — NOT CLIENT-STATED PREFERENCE",priority_1:["retail especializado","wellness retail independiente"],priority_2:["hospitalidad boutique","spas","experiencias wellness"],priority_3:["gifting corporativo","kits curados","co-branding"],exploratory:["distribuidores regionales selectivos"],deferred:["distribución nacional de gran escala","private label complejo","cadenas con procurement pesado"]},
    acceptance_readiness:{state:"ready_for_founder_acceptance" as const,label:"READY FOR FOUNDER ACCEPTANCE",global_blockers:[],limitations:["Exact economics remain pending.","Ordinary and per-SKU capacity remain unconfirmed.","Logistics details remain pending.","Private label is excluded from prioritization until confirmed.","Documents are client-stated, not independently verified.","Health and regulatory claims remain customer-safe blocked.","Existing client relationships remain unknown.","Route priorities are founder-approved hypotheses, not client-stated facts."],automatic_acceptance:false},
    clarification:{before_acceptance:[],later:["¿El descuento mayorista preliminar de 20%–30% incluye IVA?","¿Cómo funcionan flete, costo y manejo de rotura de vidrio?","¿Private label está disponible hoy?","¿Qué márgenes o estructuras finales aplican?","¿Cuál es la capacidad ordinaria y aproximada por SKU?","¿Qué relaciones o conflictos existentes deben respetarse?"]},
    invariants:{context_accepted:false,theses_recalculated:false,ranking_changed:false,provider_calls:false,customer_safe_promoted:false,final_report_generated:false},
  };
}

export function buildFounderAcceptanceCandidate(questions:Array<{question_id:string;field:string}>) {
  const review=buildAmorRealContextReview();
  const questionnaireByField=new Map<string,typeof review.answers[number]>();
  for(const answer of review.answers)for(const field of answer.mapped_fields)questionnaireByField.set(field,answer);
  const candidateAnswers=questions.map(question=>{
    const client=questionnaireByField.get(question.field);
    const resolution=client?review.founder_resolutions.find(item=>item.question_id===client.question_id):undefined;
    return {question_id:question.question_id,field:question.field,status:client?.original_answer?"answered":"unknown",original_answer:client?.original_answer??"",client_source:client?.original_answer?{type:"client_questionnaire" as const,fingerprint:review.source.fingerprint,page:client.annotation_page,evidence_state:client.evidence_state}:null,founder_resolution:resolution?.source==="founder_pilot_decision"?resolution:null,system_interpretation:resolution?.source==="system_interpretation"?resolution:null,open_validation:resolution?.source==="open_validation"?resolution:null,operational_classification:client?.operational_classification??"conditioning",review_status:"unreviewed" as const,included_in_candidate:resolution?.candidate_action!=="exclude_route"};
  });
  return {candidate_version:"amor-founder-acceptance-candidate-v1",pilot_id:"amor-de-gea",state:"submitted_for_founder_review" as const,source_review_version:review.version,answers:candidateAnswers,founder_decisions:review.founder_resolutions.filter(x=>x.source==="founder_pilot_decision"),system_interpretations:review.founder_resolutions.filter(x=>x.source==="system_interpretation"),open_validations:review.founder_resolutions.filter(x=>x.source==="open_validation"),limitations:review.acceptance_readiness.limitations,accepted_context_created:false,theses_recalculated:false,ranking_impact:"off" as const,provider_calls:0,customer_safe_promoted:false};
}
