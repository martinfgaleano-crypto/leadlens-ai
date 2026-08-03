from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import shutil

ROOT=Path(__file__).resolve().parents[2]
PDF=ROOT/'output/pdf'; DOCX=ROOT/'output/docx'; PUBLIC=ROOT/'public/pilot-deliverables'
for p in (PDF,DOCX,PUBLIC): p.mkdir(parents=True,exist_ok=True)
NAVY=colors.HexColor('#17352C'); GREEN=colors.HexColor('#57745A'); SAGE=colors.HexColor('#E8EFE8'); GOLD=colors.HexColor('#B48A4A'); INK=colors.HexColor('#24332C'); MUTED=colors.HexColor('#66736D'); CREAM=colors.HexColor('#F8F5ED')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='Cover',fontName='Helvetica-Bold',fontSize=26,leading=31,textColor=NAVY,alignment=TA_CENTER,spaceAfter=14))
styles.add(ParagraphStyle(name='Sub',fontName='Helvetica',fontSize=13,leading=18,textColor=GREEN,alignment=TA_CENTER,spaceAfter=18))
styles.add(ParagraphStyle(name='H1x',fontName='Helvetica-Bold',fontSize=19,leading=23,textColor=NAVY,spaceAfter=14))
styles.add(ParagraphStyle(name='H2x',fontName='Helvetica-Bold',fontSize=12,leading=15,textColor=GREEN,spaceBefore=8,spaceAfter=6))
styles.add(ParagraphStyle(name='Bodyx',fontName='Helvetica',fontSize=9.6,leading=14,textColor=INK,spaceAfter=7))
styles.add(ParagraphStyle(name='Smallx',fontName='Helvetica',fontSize=8,leading=11,textColor=MUTED,spaceAfter=5))
styles.add(ParagraphStyle(name='Callx',fontName='Helvetica-Bold',fontSize=11,leading=16,textColor=NAVY,backColor=SAGE,borderPadding=10,spaceAfter=12))

PORTFOLIO={
'Primera validación':['Éteka','Celestino Hotel Boutique & Spa','Sinergy On','Vitálica'],
'Prioridad estratégica':['Ser Saludable','Masaya Collection','Natural + Mente'],
'Investigar selectivamente':['Hotel Charleston Santa Teresa Spa','Habibi Plantitas','Funat']}
ACCOUNTS=[
('Éteka','Spa / hospitalidad','Su propuesta pública de spa permite explorar un ritual de bienestar o regalo para huéspedes.','Validar un único caso de uso con 50 unidades.','No está confirmado que compre productos de terceros ni quién decide.','Confirmar modelo de retail/regalo, responsable de compra y manejo de vidrio.'),
('Celestino Hotel Boutique & Spa','Hotel boutique / spa','La combinación hotel boutique y spa crea una hipótesis concreta de regalo o venta complementaria.','Probar una referencia en una propiedad y medir aceptación.','No se verificó retail de terceros ni frecuencia de reposición.','Confirmar área compradora, caso de uso y cadencia potencial.'),
('Sinergy On','Regalos corporativos','Su oferta pública de soluciones corporativas permite evaluar un producto terminado dentro de un kit.','Presentar un kit muestra para un brief compatible.','No hay evidencia de un proyecto activo ni de aceptación del formato.','Validar brief, volumen, plazo, personalización y economía.'),
('Vitálica','Retail natural','El surtido natural visible permite contrastar un formato botánico líquido diferenciado.','Proponer un surtido mixto pequeño y medir rotación.','Margen, onboarding y desempeño de líquidos no están confirmados.','Preguntar por categoría, documentación, margen y reposición.'),
('Ser Saludable','Retail bienestar','La operación pública en bienestar sugiere afinidad estructural para una prueba acotada.','Validar encaje de posicionamiento y una prueba de baja exposición.','Apertura de categoría, comprador y requisitos documentales.','Confirmar lenguaje no médico, documentación y proceso de alta.'),
('Masaya Collection','Hospitalidad','Su presencia en hospitalidad ofrece una plataforma para explorar gifting o experiencia de huésped.','Diseñar una prueba en una sola propiedad antes de escalar.','No se verificó compra de terceros, autonomía local ni encaje de 50 unidades.','Identificar propiedad, caso de uso y nivel de decisión.'),
('Natural + Mente','Retail / fitoterapia','El ecommerce activo y categorías de fitoterapia muestran adyacencia de surtido multimarcas.','Evaluar una prueba pequeña con posicionamiento seguro.','Acceso comprador, margen, premiumización y recompra.','Confirmar onboarding, comparación de precio y criterios de rotación.'),
('Hotel Charleston Santa Teresa Spa','Lujo / spa','Los rituales de spa visibles justifican una validación de alto nivel como referencia de mercado.','Explorar solo si existe patrocinador operativo para una prueba pequeña.','Procurement puede ser complejo y no hay retail de terceros confirmado.','Validar autonomía del spa, canal de compra y tamaño mínimo.'),
('Habibi Plantitas','Regalos corporativos','La oferta pública de regalos personalizados abre una hipótesis para integrar un producto terminado.','Probar compatibilidad en un kit estacional o corporativo.','Aceptación de ingeribles, volumen y recurrencia.','Confirmar manejo de producto, temporadas, personalización y margen.'),
('Funat','Botánicos / benchmark','Su catálogo botánico aporta aprendizaje de categoría y una posible afinidad comercial.','Determinar primero si existe espacio no competitivo para terceros.','Apertura a marcas externas y solapamiento competitivo.','Validar rol comercial, política de terceros y diferenciación.')]

def header_footer(canvas,doc):
    canvas.saveState(); canvas.setStrokeColor(colors.HexColor('#CAD8CD')); canvas.line(54,740,558,740)
    canvas.setFont('Helvetica',7.5); canvas.setFillColor(MUTED); canvas.drawString(54,752,'LEADLENS · AMOR DE GEA · PILOTO 1'); canvas.drawRightString(558,36,f'{doc.page}'); canvas.restoreState()
def title(story,kicker,title,subtitle=None):
    story += [Spacer(1,45),Paragraph(kicker.upper(),styles['Smallx']),Paragraph(title,styles['H1x'])]
    if subtitle: story.append(Paragraph(subtitle,styles['Bodyx']))
def p(story,text,style='Bodyx'): story.append(Paragraph(text,styles[style]))
def bullets(story,items):
    for x in items:p(story,'• '+x)
def table(story,rows,widths):
    t=Table([[Paragraph(str(c),styles['Smallx']) for c in r] for r in rows],colWidths=widths,repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#B8C7BB')),('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,1),(-1,-1),CREAM),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]));story.append(t)
def build_report():
    out=PDF/'Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf'; s=[]
    s += [Spacer(1,120),Paragraph('AMOR DE GEA',styles['Sub']),Paragraph('Opportunity Portfolio &<br/>Commercial Validation Plan',styles['Cover']),Paragraph('Piloto LeadLens — Inteligencia de oportunidades B2B',styles['Sub']),Spacer(1,65),Paragraph('Documento para revisión y conversación comercial',styles['Callx']),Paragraph('Agosto 2026 · Colombia',styles['Sub']),PageBreak()]
    title(s,'01','Conclusión ejecutiva');p(s,'LeadLens recomienda comenzar con cuatro validaciones pequeñas y distintas: Éteka y Celestino para hospitalidad, Sinergy On para gifting corporativo y Vitálica para retail natural. La cartera no afirma intención de compra: organiza dónde aprender primero, qué validar y por qué.','Callx');bullets(s,['Diez cuentas activas, organizadas por secuencia y nivel de validación.','La recomendación privilegia pruebas compatibles con la capacidad actual, no empresas famosas por sí mismas.','El éxito del piloto se medirá por aprendizaje comercial verificable, no por promesas de ventas.']);p(s,'Decisión sugerida: revisar relaciones existentes, preparar cuatro conversaciones de descubrimiento y ejecutar solo pruebas comerciales acotadas.');s.append(PageBreak())
    title(s,'02','Cómo usamos el contexto de Amor de Gea');bullets(s,['Portafolio de tres elixires botánicos terminados y presentación premium.','Capacidad informada cercana a 300 unidades mensuales.','MOQ piloto preferido alrededor de 50 unidades.','Interés en retail especializado, hospitalidad y regalos corporativos.','Restricciones: evitar lenguaje médico, validar documentación, vidrio, márgenes y personalización.']);p(s,'Este contexto cambió la búsqueda desde “empresas de bienestar en Colombia” hacia mecanismos concretos de compra y prueba.');s.append(PageBreak())
    title(s,'03','Commercial Readiness');table(s,[['Fortalezas hoy','Validar antes de vender'],['Producto terminado y visualmente diferenciado','Precio mayorista, margen y condiciones'],['Prueba pequeña compatible','Documentación y lenguaje no médico'],['Tres rutas comerciales plausibles','Logística del envase de vidrio'],['Opciones de gifting y retail','Personalización y capacidad por pedido']],[240,240]);p(s,'Recomendación: no escalar hasta observar una señal real de uso, economía y posibilidad de reposición.');s.append(PageBreak())
    title(s,'04','Market Opportunity Map');table(s,[['Ruta','Cuenta de entrada','Mecanismo a validar'],['Hospitalidad / spa','Éteka · Celestino','Ritual, regalo o venta complementaria'],['Regalos corporativos','Sinergy On','Producto terminado dentro de un kit'],['Retail natural','Vitálica','Surtido pequeño y rotación'],['Expansión estratégica','Masaya · Ser Saludable · Natural + Mente','Replicar solo después de aprendizaje']],[130,150,200]);p(s,'No se asignó una cuota artificial por categoría. Cada ruta aporta un aprendizaje distinto.');s.append(PageBreak())
    title(s,'05','Portfolio Overview');rows=[['Grupo','Cuentas']]+[[g,' · '.join(a)] for g,a in PORTFOLIO.items()];table(s,rows,[150,330]);p(s,'Relación previa no confirmada: antes de contactar, Amor de Gea debe indicar si conoce, ha contactado o desea excluir alguna cuenta.');s.append(PageBreak())
    for idx,(group,names) in enumerate(PORTFOLIO.items(),6):
        title(s,f'{idx:02d}',group)
        for name in names:
            a=next(x for x in ACCOUNTS if x[0]==name);s.append(KeepTogether([Paragraph(name,styles['H2x']),Paragraph(a[2],styles['Bodyx']),Paragraph('<b>Prueba:</b> '+a[3],styles['Bodyx']),Paragraph('<b>Validar:</b> '+a[5],styles['Smallx'])]))
        s.append(PageBreak())
    for i,a in enumerate(ACCOUNTS[:4],9):
        title(s,f'{i:02d}',f'Account Action Brief — {a[0]}',a[1]);p(s,a[2],'Callx');table(s,[['Elemento','Recomendación'],['Hipótesis de prueba',a[3]],['Qué no sabemos',a[4]],['Próximo paso',a[5]],['Función probable','Operación, categoría, spa, compras o gifting; confirmar persona'],['Señal positiva','Acepta discutir caso de uso, economía y prueba acotada'],['Señal de salida','Sin caso de uso, margen inviable o conflicto existente']],[130,350]);p(s,'Preguntas de reunión: ¿Qué problema o experiencia resolvería? ¿Quién valida la categoría? ¿Qué cantidad mínima tiene sentido? ¿Cómo se mediría una segunda orden?');p(s,'Materiales: muestras, ficha de producto, lenguaje seguro, condiciones mayoristas, dimensiones y tiempos reales.');s.append(PageBreak())
    title(s,'13','Qué cambió');table(s,[['Antes','Ahora'],['Lista amplia por afinidad de categoría','Portafolio de mecanismos comerciales comprobables'],['Empresas conocidas podían dominar','Se prioriza accesibilidad, prueba y aprendizaje'],['Encaje genérico','Uso, comprador probable, incógnita y siguiente paso'],['Conflicto como bloqueo','Relación previa declarada y capturada mediante feedback'],['Una recomendación estática','Memoria para evitar repetición en el Piloto 2']],[215,265]);s.append(PageBreak())
    title(s,'14','Plan de validación · 30–60 días');table(s,[['Periodo','Acción','Resultado esperado'],['Días 1–10','Revisión interna, conflicto y materiales','Cuatro cuentas autorizadas para descubrimiento'],['Días 11–25','Conversaciones de validación','Necesidad, uso, comprador, economía y objeciones'],['Días 26–40','Uno o dos conceptos de prueba','Tamaño, responsable, medición y salida'],['Días 41–60','Decisión de continuar o descartar','Aprendizaje por ruta y foco del siguiente ciclo']],[90,190,200]);p(s,'No avanzar por calendario si la evidencia comercial no mejora.');s.append(PageBreak())
    title(s,'15','Pilot Success Contract');bullets(s,['Utilidad: Amor de Gea identifica a quién validar primero.','Relevancia: las cuentas reflejan capacidad, formato, rutas y restricciones reales.','Preparación: cada primera cuenta tiene preguntas, riesgos y próximo paso.','Aprendizaje: se documenta por qué una ruta avanza o se descarta.','Disciplina: no se interpreta una respuesta amable como intención de compra.']);p(s,'El piloto no garantiza ventas. Sí debe reducir tiempo perdido y producir decisiones comerciales mejor informadas.','Callx');s.append(PageBreak())
    title(s,'16','Evidencia, límites y uso responsable');bullets(s,['Las descripciones se apoyan en superficies públicas revisadas durante el piloto y en contexto entregado por Amor de Gea.','Una afinidad pública no demuestra interés, presupuesto, timing, margen ni autorización de compra.','No se identifican compradores nominales sin verificación.','Los casos de uso son hipótesis de validación, no hechos comerciales.','No se atribuyen efectos de salud ni se recomienda lenguaje médico.','La relación comercial previa con cada cuenta no está confirmada y debe capturarse antes del contacto.']);p(s,'Cuando una cuenta no pueda confirmar un mecanismo real, debe salir de la secuencia aunque su marca sea conocida.');s.append(PageBreak())
    title(s,'17','Account Directory · 10 cuentas');table(s,[['Cuenta','Ruta','Siguiente validación']]+[[a[0],a[1],a[5]] for a in ACCOUNTS],[150,110,220]);s.append(PageBreak())
    title(s,'18','Matriz de conversación');table(s,[['Cuenta','Abrir con','Evitar']]+[[a[0],a[3],a[4]] for a in ACCOUNTS[:5]],[130,175,175]);s.append(PageBreak())
    title(s,'19','Matriz de conversación · continuación');table(s,[['Cuenta','Abrir con','Evitar']]+[[a[0],a[3],a[4]] for a in ACCOUNTS[5:]],[130,175,175]);s.append(PageBreak())
    title(s,'20','Registro de aprendizaje recomendado');table(s,[['Campo','Qué registrar'],['Relación previa','Conocida, contactada, activa, excluida o nueva'],['Caso de uso','Retail, ritual, gifting u otro'],['Economía','Precio, margen, MOQ y costo de personalización'],['Operación','Documentación, vidrio, logística y plazo'],['Resultado','Avanzar, pausar, descartar y razón'],['Repetición','Probabilidad observada y condición de segunda orden']],[130,350]);s.append(PageBreak())
    title(s,'21','Próxima decisión');p(s,'Aprobar únicamente las cuatro primeras validaciones que superen la revisión de relación previa y preparación comercial. Mantener las otras seis como cartera de aprendizaje, sin contacto automático.','Callx');bullets(s,['Revisar el informe y los cuatro briefs.','Completar la lista de control del fundador.','Entregar el paquete y solicitar feedback.','Registrar respuestas reales.','Cerrar el Piloto 1 solo tras incorporar el aprendizaje.']);s.append(PageBreak())
    title(s,'22','Cierre recomendado');p(s,'LeadLens ha convertido una búsqueda amplia en una secuencia comercial defendible: cuatro conversaciones iniciales, tres rutas, diez cuentas con límites explícitos y un plan de aprendizaje. El siguiente salto de calidad no depende de sumar más nombres, sino de observar qué hipótesis sobreviven al contacto real.','Callx');p(s,'Estado del documento: revisión del fundador requerida. No enviado. Piloto 2 planeado, no autorizado.');
    SimpleDocTemplate(str(out),pagesize=letter,rightMargin=54,leftMargin=54,topMargin=62,bottomMargin=54,title='AMOR DE GEA Opportunity Portfolio & Commercial Validation Plan',author='LeadLens').build(s,onFirstPage=header_footer,onLaterPages=header_footer);return out

def build_briefs():
    out=PDF/'Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf';s=[]
    for i,a in enumerate(ACCOUNTS[:4]):
        title(s,'ACTION BRIEF',a[0],a[1]);p(s,a[2],'Callx');table(s,[['Decisión','Detalle'],['Prueba recomendada',a[3]],['Incógnita crítica',a[4]],['Próximo paso',a[5]],['Entrada','Canal oficial de la empresa; confirmar función, no inventar persona'],['Objetivo','Aprender si existe uso, economía y camino de reposición']],[130,350]);p(s,'ANTES DE LA REUNIÓN','H2x');bullets(s,['Confirmar relación previa o conflicto.','Llevar muestra, ficha, términos y lenguaje seguro.','Definir el máximo de unidades y personalización que Amor de Gea puede cumplir.']);p(s,'PREGUNTAS CLAVE','H2x');bullets(s,['¿Qué caso de uso real podría justificar una prueba?','¿Quién evalúa y quién aprueba?','¿Qué margen, documentación o logística es indispensable?','¿Qué resultado permitiría una segunda orden?']);s.append(PageBreak());title(s,'GUÍA DE DECISIÓN',a[0]);table(s,[['Señal','Respuesta'],['Avanzar','Uso específico + responsable + economía plausible + siguiente paso'],['Pausar','Interés general sin decisión, datos o plazo'],['Descartar','Sin caso de uso, conflicto, margen inviable o formato incompatible']],[100,380]);p(s,'No interpretar interés cordial como intención de compra. No prometer efectos de salud, volumen ni fechas.');p(s,'Notas de la conversación','H2x');bullets(s,['Caso de uso: ______________________________________________','Responsable/área: __________________________________________','Economía y MOQ: ___________________________________________','Objeciones: ________________________________________________','Siguiente paso y fecha: _____________________________________']);
        if i<3:s.append(PageBreak())
    SimpleDocTemplate(str(out),pagesize=letter,rightMargin=54,leftMargin=54,topMargin=62,bottomMargin=54,title='Amor de Gea Account Action Briefs',author='LeadLens').build(s,onFirstPage=header_footer,onLaterPages=header_footer);return out

SECTIONS=[('A','Quién responde',['Nombre','Cargo o relación con Amor de Gea','Fecha']),('B','Valor general del Piloto 1',['Utilidad general','Relevancia de las cuentas','Utilidad de la priorización','Utilidad de los Action Briefs','Credibilidad de la evidencia','Uso del contexto','Claridad del reporte','Confianza para decidir próximos pasos','Probabilidad de usar un Piloto 2','Valor comparado con una base de datos']),('C','Retroalimentación de las 10 cuentas',[a[0] for a in ACCOUNTS]),('D','Primera secuencia',['Seleccione las cuentas que validaría primero','Indique cuentas conocidas, contactadas, activas o excluidas']),('E','Evaluación de los cuatro Action Briefs',[a[0] for a in ACCOUNTS[:4]]),('F','Preferencias por ruta',['Hospitalidad / spa','Retail natural','Regalos corporativos','Distribución u otra']),('G','Correcciones de preparación comercial',['Precio y margen','Capacidad y MOQ','Documentación','Personalización','Logística y vidrio']),('H','Valor del piloto',['¿Qué decisión permitió tomar?','¿Qué faltó para generar más valor?']),('I','Prioridades del Piloto 2',['Nuevas categorías o regiones','Cuentas que no deben repetirse','Tipo de evidencia requerida']),('J','Disposición comercial',['¿Consideraría pagar por un siguiente ciclo?','¿Qué resultado justificaría la inversión?']),('K','Comentarios y consentimiento',['Comentarios finales','¿Autoriza usar esta respuesta para mejorar LeadLens?'])]
def feedback_story():
    s=[Spacer(1,95),Paragraph('AMOR DE GEA',styles['Sub']),Paragraph('Retroalimentación<br/>Piloto LeadLens 1',styles['Cover']),Paragraph('Sus respuestas convertirán este portafolio en aprendizaje para el siguiente ciclo.',styles['Sub']),Spacer(1,50),Paragraph('No hay respuestas prellenadas. Complete únicamente lo que pueda confirmar.',styles['Callx']),PageBreak()]
    for idx,(letter,name,qs) in enumerate(SECTIONS):
        title(s,letter,name)
        for q in qs:
            p(s,'<b>'+q+'</b>')
            if letter in ('B','E'):p(s,'Calificación 1–5:  ☐ 1   ☐ 2   ☐ 3   ☐ 4   ☐ 5')
            if letter=='C':
                p(s,'Relación: ☐ nueva ☐ conocida ☐ contactada ☐ conversación activa ☐ cliente/socio ☐ excluir')
                p(s,'Relevancia: ☐ alta ☐ media ☐ baja · Acción: ☐ validar primero ☐ mantener ☐ investigar ☐ descartar')
            p(s,'Respuesta / nota: _______________________________________________________________')
            p(s,'________________________________________________________________________________','Smallx')
        if idx<len(SECTIONS)-1:s.append(PageBreak())
    return s
def build_feedback_pdf():
    out=PDF/'Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf';SimpleDocTemplate(str(out),pagesize=letter,rightMargin=54,leftMargin=54,topMargin=62,bottomMargin=54,title='Amor de Gea Pilot 1 Feedback',author='LeadLens').build(feedback_story(),onFirstPage=header_footer,onLaterPages=header_footer);return out

def set_cell_shading(cell,fill):
    shd=OxmlElement('w:shd');shd.set(qn('w:fill'),fill);cell._tc.get_or_add_tcPr().append(shd)
def build_feedback_docx():
    out=DOCX/'Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx';d=Document();sec=d.sections[0];sec.page_width=Inches(8.5);sec.page_height=Inches(11);sec.top_margin=sec.bottom_margin=sec.left_margin=sec.right_margin=Inches(1);sec.header_distance=sec.footer_distance=Inches(.492)
    normal=d.styles['Normal'];normal.font.name='Calibri';normal.font.size=Pt(11);normal.paragraph_format.space_after=Pt(6);normal.paragraph_format.line_spacing=1.1
    for sty,size,color,before,after in [('Heading 1',16,'2E745B',16,8),('Heading 2',13,'2E745B',12,6),('Heading 3',12,'1F4D3B',8,4)]:
        x=d.styles[sty];x.font.name='Calibri';x.font.size=Pt(size);x.font.color.rgb=RGBColor.from_string(color);x.paragraph_format.space_before=Pt(before);x.paragraph_format.space_after=Pt(after)
    hp=sec.header.paragraphs[0];hp.text='LEADLENS  |  AMOR DE GEA · PILOTO 1';hp.style=d.styles['Normal'];hp.runs[0].font.size=Pt(8);hp.runs[0].font.color.rgb=RGBColor.from_string('66736D')
    fp=sec.footer.paragraphs[0];fp.alignment=WD_ALIGN_PARAGRAPH.RIGHT;fp.add_run('Documento de retroalimentación · versión 1.0').font.size=Pt(8)
    p0=d.add_paragraph();p0.alignment=WD_ALIGN_PARAGRAPH.LEFT;p0.paragraph_format.space_before=Pt(36);p0.paragraph_format.space_after=Pt(8);r=p0.add_run('AMOR DE GEA');r.bold=True;r.font.name='Calibri';r.font.size=Pt(11);r.font.color.rgb=RGBColor.from_string('57745A')
    t=d.add_paragraph();t.paragraph_format.space_after=Pt(6);r=t.add_run('Retroalimentación\nPiloto LeadLens 1');r.bold=True;r.font.name='Calibri';r.font.size=Pt(25);r.font.color.rgb=RGBColor.from_string('17352C')
    p1=d.add_paragraph('Sus respuestas convertirán este portafolio en aprendizaje para el siguiente ciclo. No hay respuestas prellenadas.');p1.paragraph_format.space_after=Pt(18)
    d.add_page_break()
    for letter,name,qs in SECTIONS:
        d.add_heading(f'{letter}. {name}',level=1)
        for q in qs:
            p=d.add_paragraph();r=p.add_run(q);r.bold=True
            if letter in ('B','E'):d.add_paragraph('Calificación 1–5:  ☐ 1   ☐ 2   ☐ 3   ☐ 4   ☐ 5')
            if letter=='C':
                d.add_paragraph('Relación: ☐ nueva  ☐ conocida  ☐ contactada  ☐ conversación activa  ☐ cliente/socio  ☐ excluir')
                d.add_paragraph('Relevancia: ☐ alta  ☐ media  ☐ baja    Acción: ☐ validar primero  ☐ mantener  ☐ investigar  ☐ descartar')
            tb=d.add_table(rows=1,cols=1);tb.autofit=False;tb.alignment=WD_TABLE_ALIGNMENT.LEFT;tb.columns[0].width=Inches(6.5);c=tb.cell(0,0);c.width=Inches(6.5);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.TOP;c.text='Respuesta / nota:\n\n';set_cell_shading(c,'F8F5ED');c.margin_top=c.margin_bottom=Inches(.08)
        if letter not in ('A','K'):d.add_page_break()
    d.save(out);return out
def main():
    files=[build_report(),build_briefs(),build_feedback_pdf(),build_feedback_docx()]
    for f in files:shutil.copy2(f,PUBLIC/f.name)
    print('\n'.join(str(f) for f in files))
if __name__=='__main__':main()
