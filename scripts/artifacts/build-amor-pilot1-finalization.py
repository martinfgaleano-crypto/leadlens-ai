#!/usr/bin/env python3
# Premium Amor de Gea Pilot 1 customer deliverables.
# Renders 4 customer-safe files from output/amor-pilot1-deliverable.data.json
# (single source of truth exported from the approved intelligence modules):
#   1. Final Report (premium boutique-strategy PDF)
#   2. Account Action Briefs (4 first-validation accounts)
#   3. Feedback (PDF)  4. Feedback (DOCX editable)
# No internal version tokens, no named buyers, no timing claims, evidence framed
# as public facts + limitations. Run: python build-amor-pilot1-finalization.py
import json
import shutil
from datetime import datetime
from pathlib import Path

import reportlab.rl_config
reportlab.rl_config.invariant = 1  # deterministic PDFs (fixed dates/ids) so download checksums stay stable
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table,
    TableStyle, KeepTogether, Flowable, HRFlowable, ListFlowable, ListItem,
    NextPageTemplate,
)
from reportlab.pdfgen import canvas as canvasmod
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT / "output/amor-pilot1-deliverable.data.json").read_text(encoding="utf-8"))
PDF = ROOT / "output/pdf"
DOCX = ROOT / "output/docx"
PUBLIC = ROOT / "public/pilot-deliverables"
for d in (PDF, DOCX, PUBLIC):
    d.mkdir(parents=True, exist_ok=True)

# ---- Palette --------------------------------------------------------------
NAVY = colors.HexColor("#17352C")
GREEN = colors.HexColor("#4E6A54")
GOLD = colors.HexColor("#B48A4A")
GOLD_SOFT = colors.HexColor("#D8C29A")
SAGE = colors.HexColor("#EAF0E9")
SAGE_LINE = colors.HexColor("#CAD8CD")
INK = colors.HexColor("#24332C")
MUTED = colors.HexColor("#6B7873")
CREAM = colors.HexColor("#F8F5ED")
CARD = colors.HexColor("#FBFAF5")
PAGE_W, PAGE_H = letter
LM = RM = 56
CONTENT_W = PAGE_W - LM - RM

styles = getSampleStyleSheet()
def _add(name, **kw):
    styles.add(ParagraphStyle(name=name, **kw))
_add("Kicker", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=GOLD, spaceAfter=3, tracking=1)
_add("H1x", fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, spaceAfter=4)
_add("H2x", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=4)
_add("H3x", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=GREEN, spaceBefore=6, spaceAfter=3)
_add("Body", fontName="Helvetica", fontSize=9.7, leading=14.5, textColor=INK, spaceAfter=7, alignment=TA_JUSTIFY)
_add("BodyL", fontName="Helvetica", fontSize=9.7, leading=14.5, textColor=INK, spaceAfter=7)
_add("Small", fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED, spaceAfter=4)
_add("Lead", fontName="Helvetica", fontSize=11.5, leading=16.5, textColor=NAVY, spaceAfter=10)
_add("CardH", fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=NAVY, spaceAfter=2)
_add("CardBody", fontName="Helvetica", fontSize=9.2, leading=13, textColor=INK, spaceAfter=3)
_add("Tag", fontName="Helvetica-Bold", fontSize=7.3, leading=9, textColor=colors.white)
_add("EvLabel", fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=GOLD)
_add("EvBody", fontName="Helvetica", fontSize=8.7, leading=12, textColor=INK)
_add("TH", fontName="Helvetica-Bold", fontSize=8.6, leading=11, textColor=colors.white)
_add("TD", fontName="Helvetica", fontSize=8.7, leading=12, textColor=INK)
_add("Callout", fontName="Helvetica-Bold", fontSize=11, leading=15.5, textColor=NAVY)
_add("Foot", fontName="Helvetica", fontSize=7.3, leading=9, textColor=MUTED)

def P(text, style="Body"):
    return Paragraph(text, styles[style])

# ---- Custom flowables ------------------------------------------------------
class Rule(Flowable):
    def __init__(self, width=CONTENT_W, color=GOLD, thick=1.4, gap=6):
        super().__init__(); self.width = width; self.color = color; self.thick = thick; self.gap = gap
    def wrap(self, aw, ah):
        return (self.width, self.gap + self.thick)
    def draw(self):
        self.canv.setStrokeColor(self.color); self.canv.setLineWidth(self.thick)
        self.canv.line(0, self.gap, self.width, self.gap)

def section(story, number, title, kicker=None):
    story.append(Spacer(1, 6))
    story.append(P(f"SECCIÓN {number}" if not kicker else kicker.upper(), "Kicker"))
    story.append(P(title, "H1x"))
    story.append(Rule(width=66, color=GOLD, thick=2.4, gap=5))
    story.append(Spacer(1, 8))

def tag(text, bg):
    t = Table([[P(text, "Tag")]], colWidths=[len(text) * 4.6 + 12])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("LEFTPADDING", (0, 0), (-1, -1), 6),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 3),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 3), ("ROUNDEDCORNERS", [3, 3, 3, 3])]))
    return t

ROUTE_BG = {"Hotelería y spa": colors.HexColor("#3E6B8A"), "Retail especializado": GREEN,
            "Regalos corporativos": GOLD, "Distribución regional": MUTED}

def table(story, header, rows, widths, zebra=True):
    data = [[P(c, "TH") for c in header]] + [[P(str(c), "TD") for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [("BACKGROUND", (0, 0), (-1, 0), NAVY), ("GRID", (0, 0), (-1, -1), 0.4, SAGE_LINE),
             ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7),
             ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6),
             ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]
    if zebra:
        for i in range(1, len(data)):
            style.append(("BACKGROUND", (0, i), (-1, i), CREAM if i % 2 else CARD))
    t.setStyle(TableStyle(style)); story.append(t)

def callout(story, text):
    t = Table([[P(text, "Callout")]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SAGE), ("LEFTPADDING", (0, 0), (-1, -1), 14),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 11),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 11), ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
                           ("ROUNDEDCORNERS", [4, 4, 4, 4])]))
    story.append(t); story.append(Spacer(1, 8))

def bullets(story, items, style="Body"):
    story.append(ListFlowable([ListItem(P(x, style), leftIndent=12, value="•") for x in items],
                              bulletType="bullet", start="•", bulletColor=GOLD, bulletFontSize=8))

def account_card(a, show_evidence=True):
    left = [P(a["name"], "CardH"), tag(a["route"], ROUTE_BG.get(a["route"], GREEN)), Spacer(1, 4),
            P(a["why"], "CardBody"), P(f'<b>Prueba inicial:</b> {a["test"]}', "CardBody"),
            P(f'<b>Por validar:</b> {a["next"]}', "CardBody")]
    ev = a["evidence"]
    if show_evidence and ev.get("source"):
        cells = [[P("FUENTE", "EvLabel")], [P(f'{ev["source"]} · sitio oficial', "EvBody")],
                 [P(f'HECHO PÚBLICO · consultado {ev["retrieved"]}', "EvLabel")], [P(ev["fact"], "EvBody")],
                 [P("CONFIRMA", "EvLabel")], [P(ev["proves"], "EvBody")],
                 [P("NO CONFIRMA", "EvLabel")], [P(ev["not_proves"], "EvBody")]]
        et = Table(cells, colWidths=[CONTENT_W * 0.42 - 16])
        et.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.white), ("LEFTPADDING", (0, 0), (-1, -1), 8),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5), ("BOX", (0, 0), (-1, -1), 0.5, SAGE_LINE)]))
        row = [[left, et]]
        widths = [CONTENT_W * 0.58, CONTENT_W * 0.42]
    else:
        row = [[left]]; widths = [CONTENT_W]
    card = Table(row, colWidths=widths)
    card.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CARD), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                              ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                              ("BOX", (0, 0), (-1, -1), 0.6, SAGE_LINE), ("LINEBEFORE", (0, 0), (0, -1), 3, ROUTE_BG.get(a["route"], GREEN)),
                              ("ROUNDEDCORNERS", [5, 5, 5, 5])]))
    return KeepTogether([card, Spacer(1, 9)])

class PortfolioMap(Flowable):
    """Qualitative three-column portfolio map with account chips + route legend."""
    def __init__(self, data):
        super().__init__(); self.data = data; self.width = CONTENT_W; self.height = 250
    def wrap(self, aw, ah):
        return (self.width, self.height)
    def draw(self):
        c = self.canv
        cols = [("PRIMERA SECUENCIA", self.data["portfolio"]["first_validation"], NAVY),
                ("PRIORIDAD ESTRATÉGICA", self.data["portfolio"]["strategic_priority"], GREEN),
                ("INVESTIGACIÓN SELECTIVA", self.data["portfolio"]["investigate_selectively"], MUTED)]
        route_of = {a["name"]: a["route"] for a in self.data["accounts"]}
        gap = 12; cw = (self.width - 2 * gap) / 3; top = self.height - 6
        for i, (label, names, col) in enumerate(cols):
            x = i * (cw + gap)
            c.setFillColor(col); c.roundRect(x, top - 22, cw, 22, 4, fill=1, stroke=0)
            c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(x + cw / 2, top - 15, label)
            c.setFillColor(colors.HexColor("#FCFBF6")); c.setStrokeColor(SAGE_LINE)
            c.roundRect(x, 24, cw, top - 22 - 24 - 6, 4, fill=1, stroke=1)
            y = top - 22 - 20
            for n in names:
                rc = ROUTE_BG.get(route_of.get(n, ""), GREEN)
                c.setFillColor(rc); c.circle(x + 12, y + 3, 3, fill=1, stroke=0)
                c.setFillColor(INK); c.setFont("Helvetica-Bold", 8.4)
                c.drawString(x + 20, y, n[:34])
                y -= 24
        # legend
        c.setFont("Helvetica-Bold", 7.2); lx = 0
        for route, rc in [("Hotelería y spa", ROUTE_BG["Hotelería y spa"]), ("Retail especializado", GREEN),
                          ("Regalos corporativos", GOLD)]:
            c.setFillColor(rc); c.circle(lx + 4, 8, 3, fill=1, stroke=0)
            c.setFillColor(MUTED); c.drawString(lx + 11, 5, route); lx += len(route) * 4.6 + 34

# ---- Canvas: cover + running header/footer + page X of N -------------------
class DocCanvas(canvasmod.Canvas):
    def __init__(self, *a, **k):
        super().__init__(*a, **k); self._saved = []
    def showPage(self):
        self._saved.append(dict(self.__dict__)); self._startPage()
    def save(self):
        n = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self._chrome(n)
            super().showPage()
        super().save()
    def _chrome(self, n):
        self.saveState()
        self.setStrokeColor(SAGE_LINE); self.setLineWidth(0.6)
        self.line(LM, PAGE_H - 44, PAGE_W - RM, PAGE_H - 44)
        self.setFont("Helvetica-Bold", 7.3); self.setFillColor(NAVY)
        self.drawString(LM, PAGE_H - 40, "LEADLENS")
        self.setFont("Helvetica", 7.3); self.setFillColor(MUTED)
        self.drawString(LM + 46, PAGE_H - 40, "Amor de Gea · Piloto 1 · Portafolio de oportunidades B2B")
        self.setStrokeColor(SAGE_LINE); self.line(LM, 40, PAGE_W - RM, 40)
        self.setFont("Helvetica", 7.3); self.setFillColor(MUTED)
        self.drawString(LM, 30, "Documento para revisión y conversación comercial · Confidencial")
        self.drawRightString(PAGE_W - RM, 30, f"Página {self._pageNumber - 1} de {n - 1}")
        self.restoreState()

def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY); canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#1E4034")); canvas.rect(0, PAGE_H - 250, PAGE_W, 250, fill=1, stroke=0)
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(2.2); canvas.line(LM, PAGE_H - 150, LM + 70, PAGE_H - 150)
    canvas.setFillColor(GOLD_SOFT); canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(LM, PAGE_H - 128, "LEADLENS")
    canvas.setFillColor(colors.white); canvas.setFont("Helvetica", 10.5)
    canvas.drawString(LM, PAGE_H - 178, "INTELIGENCIA DE OPORTUNIDADES B2B")
    canvas.setFillColor(colors.white); canvas.setFont("Helvetica-Bold", 30)
    canvas.drawString(LM, PAGE_H - 320, "Portafolio de")
    canvas.drawString(LM, PAGE_H - 356, "oportunidades B2B")
    canvas.setFillColor(GOLD_SOFT)
    canvas.drawString(LM, PAGE_H - 400, "y plan de validación")
    canvas.drawString(LM, PAGE_H - 436, "comercial")
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(1.2); canvas.line(LM, PAGE_H - 460, PAGE_W - RM, PAGE_H - 460)
    canvas.setFillColor(colors.white); canvas.setFont("Helvetica-Bold", 15)
    canvas.drawString(LM, PAGE_H - 492, "AMOR DE GEA")
    canvas.setFillColor(GOLD_SOFT); canvas.setFont("Helvetica", 10.5)
    canvas.drawString(LM, PAGE_H - 512, "Piloto LeadLens 1 · Infusiones botánicas · Colombia")
    canvas.setFillColor(colors.HexColor("#B9C9BE")); canvas.setFont("Helvetica", 10)
    canvas.drawString(LM, 150, "Diez cuentas · tres rutas comerciales · cuatro validaciones iniciales")
    canvas.setFillColor(colors.white); canvas.setFont("Helvetica-Bold", 10.5)
    canvas.drawString(LM, 120, DATA["meta"]["generated_label"])
    canvas.setFillColor(colors.HexColor("#8FA697")); canvas.setFont("Helvetica", 8.3)
    canvas.drawString(LM, 66, "Preparado por LeadLens para la conversación comercial de Amor de Gea.")
    canvas.drawString(LM, 52, "Las relaciones con cada cuenta deben confirmarse antes de cualquier contacto.")
    canvas.restoreState()

# ---- Report ----------------------------------------------------------------
def build_report():
    out = PDF / "Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf"
    frame = Frame(LM, 48, CONTENT_W, PAGE_H - 48 - 56, id="body")
    doc = BaseDocTemplate(str(out), pagesize=letter, title="Amor de Gea · Portafolio de oportunidades B2B y plan de validación comercial", author="LeadLens")
    doc.addPageTemplates([PageTemplate(id="cover", frames=[frame], onPage=cover),
                          PageTemplate(id="body", frames=[frame])])
    s = [NextPageTemplate("body"), PageBreak()]  # page 1 = canvas-drawn cover; switch to body after

    # 01 Conclusión ejecutiva
    section(s, "01", "Conclusión ejecutiva")
    callout(s, "Recomendamos comenzar con cuatro validaciones pequeñas y distintas: Éteka y Celestino en hotelería/spa, Sinergy On en regalos corporativos y Vitálica en retail natural.")
    s.append(P("El portafolio no afirma intención de compra. Organiza dónde aprender primero, qué validar y por qué, con pruebas compatibles con la capacidad actual de Amor de Gea.", "BodyL"))
    bullets(s, ["Diez cuentas activas, organizadas por secuencia y nivel de validación.",
                "La recomendación privilegia pruebas accesibles y mecanismos de recompra, no empresas famosas por su nombre.",
                "El éxito del piloto se mide por aprendizaje comercial verificable, no por promesas de venta."])
    s.append(Spacer(1, 4))
    s.append(P("<b>Decisión sugerida:</b> revisar la relación previa con cada cuenta, preparar cuatro conversaciones de descubrimiento y ejecutar solo pruebas comerciales acotadas.", "BodyL"))
    s.append(PageBreak())

    # 02 Índice / navegación
    section(s, "02", "Cómo leer este documento", kicker="Guía de navegación")
    nav = [["01 · Conclusión ejecutiva", "08 · Portafolio de un vistazo"],
           ["03 · Qué entendió LeadLens", "09 · Primera secuencia de validación"],
           ["04 · Cómo cambió la búsqueda", "10 · Prioridad estratégica"],
           ["05 · Preparación comercial", "11 · Investigación selectiva"],
           ["06 · Mapa de oportunidades", "12 · Cuatro briefs de acción"],
           ["07 · Rutas y evidencia", "13 · Qué cambió y qué sigue"],
           ["14 · Cuentas no priorizadas", "15 · Preparación comercial"],
           ["16 · Plan de validación 30–60 días", "17 · Marco de éxito"],
           ["18 · Evidencia y limitaciones", "19 · Cierre y Piloto 2"]]
    table(s, ["Sección", "Sección"], nav, [CONTENT_W / 2, CONTENT_W / 2], zebra=True)
    s.append(Spacer(1, 8))
    s.append(P("Cada recomendación se apoya en evidencia pública atribuida y en el contexto que Amor de Gea compartió. Donde no hay evidencia suficiente, el documento lo dice explícitamente.", "Small"))
    s.append(PageBreak())

    # 03 Qué entendió LeadLens
    section(s, "03", "Qué entendió LeadLens de Amor de Gea")
    bullets(s, ["Portafolio de tres elixires botánicos terminados con presentación premium (Agua, Tierra y Éter).",
                "Capacidad informada con escalamiento progresivo hacia ~300 unidades mensuales.",
                "Pedido mínimo de piloto preferido cercano a 50 unidades.",
                "Interés en retail especializado, hotelería/spa y regalos corporativos.",
                "Restricciones: evitar lenguaje médico, validar documentación, manejo del vidrio, márgenes y personalización."])
    s.append(Spacer(1, 4))
    s.append(P("Este contexto reorientó la búsqueda: dejó de buscar «empresas de bienestar en Colombia» y pasó a buscar mecanismos concretos de compra y de prueba compatibles con la operación real.", "BodyL"))
    s.append(PageBreak())

    # 04 Qué cambió la búsqueda (before/after)
    section(s, "04", "Cómo las respuestas de Amor de Gea cambiaron la búsqueda")
    wc = DATA["what_changed"]
    rows = [[b, a] for b, a in zip(wc["before"], wc["after"] + [""] * (len(wc["before"]) - len(wc["after"])))]
    if len(wc["after"]) > len(wc["before"]):
        for extra in wc["after"][len(wc["before"]):]:
            rows.append(["", extra])
    table(s, ["Antes del contexto completo", "Después del contexto completo"], rows, [CONTENT_W / 2, CONTENT_W / 2])
    s.append(Spacer(1, 6))
    s.append(P("El contexto no solo filtró nombres: cambió el tipo de mecanismo comercial que se busca y cómo se prepara cada conversación.", "Small"))
    s.append(PageBreak())

    # 05 Preparación comercial
    section(s, "05", "Preparación comercial")
    rd = DATA["readiness"]
    table(s, ["Fortalezas hoy", "Validar antes de vender"],
          [[st, va] for st, va in zip(rd["strengths"], rd["validate"])], [CONTENT_W / 2, CONTENT_W / 2])
    s.append(Spacer(1, 6))
    callout(s, "Recomendación: no escalar hasta observar una señal real de uso, economía y posibilidad de reposición.")
    s.append(PageBreak())

    # 06 Mapa de oportunidades
    section(s, "06", "Mapa de oportunidades")
    table(s, ["Ruta", "Cuenta de entrada", "Mecanismo a validar"],
          [["Hotelería / spa", "Éteka · Celestino", "Ritual, regalo o venta complementaria"],
           ["Regalos corporativos", "Sinergy On", "Producto terminado dentro de un kit"],
           ["Retail natural", "Vitálica", "Surtido pequeño y rotación (sell-through)"],
           ["Expansión estratégica", "Ser Saludable · Masaya · Natural + Mente", "Replicar solo tras el aprendizaje inicial"]],
          [110, 160, 210])
    s.append(Spacer(1, 6))
    s.append(P("No se asignó una cuota artificial por categoría. Cada ruta aporta un aprendizaje distinto.", "Small"))
    s.append(PageBreak())

    # 07 Rutas y evidencia
    section(s, "07", "Rutas y calidad de evidencia")
    table(s, ["Ruta", "Evidencia", "Mecanismo", "Conclusión"],
          [[r["route"], r["evidence"], r["mechanism"], r["conclusion"]] for r in DATA["route_review"]],
          [95, 95, 150, 140])
    s.append(Spacer(1, 6))
    bullets(s, [f'{m["route"].title()}: {m["summary"]}' for m in DATA["market_map"]], "Small")
    s.append(PageBreak())

    # 08 Portafolio de un vistazo + mapa visual
    section(s, "08", "Portafolio de un vistazo")
    s.append(PortfolioMap(DATA))
    s.append(Spacer(1, 10))
    s.append(P(DATA["relationship_disclosure"], "Small"))
    s.append(PageBreak())

    # 09/10/11 groups
    groups = [("09", "Primera secuencia de validación", "Primera validación", True),
              ("10", "Prioridad estratégica", "Prioridad estratégica", True),
              ("11", "Investigación selectiva", "Investigar selectivamente", False)]
    for num, title, group_key, show_ev in groups:
        section(s, num, title)
        if num == "09":
            s.append(P("Cuatro cuentas con evidencia pública actual y una prueba inicial compatible. Cada una incluye la fuente, el hecho público y lo que aún no está confirmado.", "BodyL"))
        for a in [x for x in DATA["accounts"] if x["group"] == group_key]:
            s.append(account_card(a, show_evidence=show_ev))
        s.append(PageBreak())

    # 12 Briefs
    for i, b in enumerate(DATA["briefs"], 1):
        section(s, "12", f"Brief de acción · {b['name']}", kicker=f"Brief {i} de 4 · {b['route']}")
        callout(s, b["thesis"])
        table(s, ["Elemento", "Detalle"],
              [["Prueba recomendada", b["test"]],
               ["Función compradora (hipótesis)", b["buyer_hyp"]],
               ["Estructura de decisión", b["procurement"]],
               ["Ciclo comercial", b["cycle"]],
               ["Por validar antes de contactar", b["next"]]], [150, CONTENT_W - 150])
        s.append(Spacer(1, 6))
        ev = b["evidence"]
        s.append(P("EVIDENCIA", "Kicker"))
        table(s, ["Fuente", "Hecho público", "No confirma"],
              [[f'{ev["source"]}\n(consultado {ev["retrieved"]})', ev["fact"], ev["not_proves"]]],
              [110, 210, 200])
        s.append(Spacer(1, 6))
        s.append(P("Preguntas para la reunión", "H3x"))
        bullets(s, b["questions"], "CardBody")
        s.append(P("Objeciones probables (hipótesis)", "H3x"))
        bullets(s, [f"Hipótesis de objeción: {o}" for o in b["objections"]], "CardBody")
        s.append(P("Materiales a preparar", "H3x"))
        bullets(s, b["prep"], "CardBody")
        s.append(PageBreak())

    # 13 Qué cambió (narrative)
    section(s, "13", "Qué cambió y por qué")
    bullets(s, DATA["what_changed"]["narrative"])
    s.append(PageBreak())

    # 14 Cuentas no priorizadas
    section(s, "14", "Cuentas no priorizadas ahora y por qué")
    s.append(P("Estas cuentas no se recomiendan para la primera acción. No son un rechazo definitivo: se conservan como aprendizaje y pueden reconsiderarse con nueva evidencia.", "BodyL"))
    for e in DATA["excluded"]:
        s.append(KeepTogether([P(e["name"], "H3x"), P(e["reason"], "CardBody"), Spacer(1, 3)]))
    s.append(PageBreak())

    # 15 Preparación comercial checklist
    section(s, "15", "Lista de preparación comercial")
    bullets(s, DATA["prep_checklist"])
    s.append(PageBreak())

    # 16 Plan 30-60
    section(s, "16", "Plan de validación · próximos 30–60 días")
    table(s, ["Periodo", "Acción", "Resultado esperado"],
          [["Días 1–10", "Revisión de relaciones, conflicto y materiales", "Cuatro cuentas autorizadas para descubrimiento"],
           ["Días 11–25", "Conversaciones de validación", "Necesidad, uso, comprador, economía y objeciones"],
           ["Días 26–40", "Uno o dos conceptos de prueba", "Tamaño, responsable, medición y salida"],
           ["Días 41–60", "Decisión de continuar o descartar", "Aprendizaje por ruta y foco del siguiente ciclo"]],
          [80, 190, 210])
    s.append(Spacer(1, 6))
    s.append(P("No avanzar por calendario si la evidencia comercial no mejora.", "Small"))
    s.append(PageBreak())

    # 17 Marco de éxito
    section(s, "17", "Marco de éxito del piloto")
    s.append(P(f'<b>Objetivo:</b> {DATA["success"]["objective"]}', "BodyL"))
    bullets(s, DATA["success"]["value"])
    s.append(Spacer(1, 4))
    callout(s, DATA["success"]["no_guarantee"])
    s.append(PageBreak())

    # 18 Evidencia y limitaciones
    section(s, "18", "Evidencia, límites y uso responsable")
    bullets(s, DATA["limitations"])
    s.append(Spacer(1, 4))
    s.append(P("Cuando una cuenta no pueda confirmar un mecanismo real, debe salir de la secuencia aunque su marca sea conocida.", "Small"))
    s.append(PageBreak())

    # 19 Cierre + pilot 2
    section(s, "19", "Cierre del Piloto 1 y vista del Piloto 2")
    callout(s, "Piloto 1 completado — portafolio preparado para validación comercial.")
    s.append(P("LeadLens convirtió una búsqueda amplia en una secuencia comercial defendible: cuatro conversaciones iniciales, tres rutas y diez cuentas con límites explícitos. El siguiente salto de calidad no depende de sumar más nombres, sino de observar qué hipótesis sobreviven al contacto real.", "BodyL"))
    s.append(P("Antes de cualquier contacto, confirme la relación previa con cada cuenta. La retroalimentación de Amor de Gea orientará un eventual Piloto 2, que priorizará nuevas rutas y evitará repetir cuentas ya trabajadas.", "BodyL"))
    s.append(Spacer(1, 6))
    s.append(P("Amor de Gea · LeadLens — de la búsqueda a la validación comercial.", "Small"))

    doc.build(s, canvasmaker=DocCanvas)
    return out

def _body_doc(out, title):
    frame = Frame(LM, 48, CONTENT_W, PAGE_H - 48 - 56, id="body")
    doc = BaseDocTemplate(str(out), pagesize=letter, title=title, author="LeadLens")
    doc.addPageTemplates([PageTemplate(id="body", frames=[frame])])
    return doc

# ---- Action Briefs ---------------------------------------------------------
def build_briefs():
    out = PDF / "Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf"
    doc = _body_doc(out, "Amor de Gea · Briefs de acción por cuenta")
    s = [Spacer(1, 30), P("LEADLENS · AMOR DE GEA", "Kicker"), P("Briefs de acción por cuenta", "H1x"),
         Rule(width=66, color=GOLD, thick=2.4, gap=5), Spacer(1, 8),
         P("Cuatro cuentas de la primera secuencia de validación. Cada brief se apoya en evidencia pública atribuida y en el contexto de Amor de Gea. No incluye contactos personales ni intención de compra: describe hipótesis a validar antes de cualquier acuerdo comercial.", "BodyL"),
         P("Antes de contactar cualquier cuenta, confirme la relación previa o un posible conflicto.", "Small"), PageBreak()]
    for i, b in enumerate(DATA["briefs"], 1):
        s.append(P(f"BRIEF {i} DE 4 · {b['route'].upper()}", "Kicker"))
        s.append(P(b["name"], "H1x"))
        s.append(Rule(width=66, color=GOLD, thick=2.4, gap=5)); s.append(Spacer(1, 8))
        callout(s, b["thesis"])
        table(s, ["Decisión", "Detalle"],
              [["Prueba recomendada", b["test"]],
               ["Función compradora (hipótesis)", b["buyer_hyp"]],
               ["Estructura de decisión", b["procurement"]],
               ["Ciclo comercial", b["cycle"]],
               ["Por validar antes de contactar", b["next"]]], [150, CONTENT_W - 150])
        s.append(Spacer(1, 6))
        ev = b["evidence"]
        table(s, ["Fuente (consultado " + ev["retrieved"] + ")", "Hecho público", "No confirma"],
              [[ev["source"] + " · sitio oficial", ev["fact"], ev["not_proves"]]], [120, 200, 200])
        s.append(Spacer(1, 8))
        s.append(P("Antes de la reunión", "H3x"))
        bullets(s, ["Confirmar relación previa o conflicto.", "Llevar muestra, ficha, condiciones y lenguaje seguro (no médico).",
                    "Definir el máximo de unidades y personalización que Amor de Gea puede cumplir."], "CardBody")
        s.append(P("Preguntas clave", "H3x"))
        bullets(s, b["questions"], "CardBody")
        s.append(P("Objeciones probables (hipótesis)", "H3x"))
        bullets(s, [f"Hipótesis de objeción: {o}" for o in b["objections"]], "CardBody")
        s.append(P("Materiales", "H3x"))
        bullets(s, b["prep"], "CardBody")
        s.append(P("Guía de decisión", "H3x"))
        table(s, ["Señal", "Respuesta"],
              [["Avanzar", "Uso específico + responsable + economía plausible + siguiente paso"],
               ["Pausar", "Interés general sin decisión, datos o plazo"],
               ["Descartar", "Sin caso de uso, conflicto, margen inviable o formato incompatible"]], [95, CONTENT_W - 95])
        s.append(Spacer(1, 6))
        s.append(P("No interpretar interés cordial como intención de compra. No prometer efectos de salud, volumen ni fechas.", "Small"))
        s.append(P("Notas de la conversación", "H3x"))
        for label in ["Caso de uso", "Responsable / área", "Economía y MOQ", "Objeciones", "Siguiente paso y fecha"]:
            s.append(P(f"{label}:  " + "_" * 46, "CardBody"))
        if i < len(DATA["briefs"]):
            s.append(PageBreak())
    doc.build(s, canvasmaker=DocCanvas)
    return out

# ---- Feedback --------------------------------------------------------------
ACC_NAMES = [a["name"] for a in DATA["accounts"]]
FIRST4 = [a["name"] for a in DATA["accounts"] if a["group"] == "Primera validación"]
SECTIONS = [
    ("A", "Quién responde", ["Nombre", "Cargo o relación con Amor de Gea", "Fecha"]),
    ("B", "Valor general del Piloto 1", ["Utilidad general", "Relevancia de las cuentas", "Utilidad de la priorización",
        "Utilidad de los briefs de acción", "Credibilidad de la evidencia", "Uso del contexto", "Claridad del reporte",
        "Confianza para decidir próximos pasos", "Probabilidad de usar un Piloto 2", "Valor frente a una base de datos"]),
    ("C", "Retroalimentación de las 10 cuentas", ACC_NAMES),
    ("D", "Primera secuencia", ["Seleccione las cuentas que validaría primero",
        "Indique cuentas conocidas, contactadas, activas o que deban excluirse"]),
    ("E", "Evaluación de los cuatro briefs de acción", FIRST4),
    ("F", "Preferencias por ruta", ["Hotelería / spa", "Retail natural", "Regalos corporativos", "Distribución u otra"]),
    ("G", "Correcciones de preparación comercial", ["Precio y margen", "Capacidad y MOQ", "Documentación", "Personalización", "Logística y vidrio"]),
    ("H", "Valor del piloto", ["¿Qué decisión permitió tomar?", "¿Qué faltó para generar más valor?"]),
    ("I", "Prioridades del Piloto 2", ["Nuevas categorías o regiones", "Cuentas que no deben repetirse", "Tipo de evidencia requerida"]),
    ("J", "Disposición comercial", ["¿Consideraría pagar por un siguiente ciclo?", "¿Qué resultado justificaría la inversión?"]),
    ("K", "Comentarios y consentimiento", ["Comentarios finales", "¿Autoriza usar esta respuesta para mejorar LeadLens?"]),
]

def build_feedback_pdf():
    out = PDF / "Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf"
    doc = _body_doc(out, "Amor de Gea · Retroalimentación Piloto 1")
    s = [Spacer(1, 34), P("LEADLENS · AMOR DE GEA", "Kicker"), P("Retroalimentación · Piloto 1", "H1x"),
         Rule(width=66, color=GOLD, thick=2.4, gap=5), Spacer(1, 8),
         P("Sus respuestas convertirán este portafolio en aprendizaje para el siguiente ciclo. Complete únicamente lo que pueda confirmar; puede dejar en blanco lo que no aplique.", "BodyL")]
    callout(s, "No hay respuestas prellenadas. Marque las casillas y escriba en los espacios provistos.")
    s.append(P("Secciones A–K · aproximadamente 15 minutos · las respuestas se revisan antes de usarse.", "Small"))
    s.append(PageBreak())
    for idx, (letter, name, qs) in enumerate(SECTIONS):
        section(s, letter, name, kicker=f"Sección {letter}")
        for q in qs:
            s.append(P(f"<b>{q}</b>", "CardBody"))
            if letter in ("B", "E"):
                s.append(P("Calificación 1–5:  ▢ 1   ▢ 2   ▢ 3   ▢ 4   ▢ 5", "CardBody"))
            if letter == "C":
                s.append(P("Relación:  ▢ nueva   ▢ conocida   ▢ contactada   ▢ conversación activa   ▢ cliente/socio   ▢ excluir", "CardBody"))
                s.append(P("Relevancia:  ▢ alta   ▢ media   ▢ baja      Acción:  ▢ validar primero   ▢ mantener   ▢ investigar   ▢ descartar", "CardBody"))
            s.append(P("_" * 92, "Small"))
        if idx < len(SECTIONS) - 1:
            s.append(PageBreak())
    doc.build(s, canvasmaker=DocCanvas)
    return out

def _shade(cell, fill):
    shd = OxmlElement("w:shd"); shd.set(qn("w:fill"), fill); cell._tc.get_or_add_tcPr().append(shd)

def build_feedback_docx():
    out = DOCX / "Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx"
    d = Document(); sec = d.sections[0]
    sec.page_width = Inches(8.5); sec.page_height = Inches(11)
    sec.top_margin = sec.bottom_margin = sec.left_margin = sec.right_margin = Inches(1)
    sec.header_distance = sec.footer_distance = Inches(0.5)
    normal = d.styles["Normal"]; normal.font.name = "Calibri"; normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(6); normal.paragraph_format.line_spacing = 1.12
    for sty, size, color, before, after in [("Heading 1", 16, "17352C", 16, 6), ("Heading 2", 13, "4E6A54", 12, 4), ("Heading 3", 11, "6B7873", 8, 3)]:
        x = d.styles[sty]; x.font.name = "Calibri"; x.font.size = Pt(size); x.font.color.rgb = RGBColor.from_string(color)
        x.paragraph_format.space_before = Pt(before); x.paragraph_format.space_after = Pt(after)
    hp = sec.header.paragraphs[0]; hp.text = "LEADLENS  ·  AMOR DE GEA · PILOTO 1"; hp.runs[0].font.size = Pt(8); hp.runs[0].font.color.rgb = RGBColor.from_string("6B7873")
    fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    fr = fp.add_run("Documento de retroalimentación · v1.1 · las respuestas se revisan antes de usarse"); fr.font.size = Pt(8); fr.font.color.rgb = RGBColor.from_string("6B7873")
    k = d.add_paragraph(); k.paragraph_format.space_before = Pt(30); r = k.add_run("LEADLENS · AMOR DE GEA"); r.bold = True; r.font.size = Pt(11); r.font.color.rgb = RGBColor.from_string("B48A4A")
    t = d.add_paragraph(); r = t.add_run("Retroalimentación · Piloto LeadLens 1"); r.bold = True; r.font.size = Pt(24); r.font.color.rgb = RGBColor.from_string("17352C")
    intro = d.add_paragraph("Sus respuestas convertirán este portafolio en aprendizaje para el siguiente ciclo. No hay respuestas prellenadas. Complete únicamente lo que pueda confirmar."); intro.paragraph_format.space_after = Pt(16)
    d.add_page_break()
    for letter, name, qs in SECTIONS:
        d.add_heading(f"{letter}. {name}", level=1)
        for q in qs:
            pq = d.add_paragraph(); pq.add_run(q).bold = True
            if letter in ("B", "E"):
                d.add_paragraph("Calificación 1–5:   ☐ 1    ☐ 2    ☐ 3    ☐ 4    ☐ 5")
            if letter == "C":
                d.add_paragraph("Relación:  ☐ nueva  ☐ conocida  ☐ contactada  ☐ conversación activa  ☐ cliente/socio  ☐ excluir")
                d.add_paragraph("Relevancia:  ☐ alta  ☐ media  ☐ baja      Acción:  ☐ validar primero  ☐ mantener  ☐ investigar  ☐ descartar")
            tb = d.add_table(rows=1, cols=1); tb.autofit = False; tb.alignment = WD_TABLE_ALIGNMENT.LEFT
            tb.columns[0].width = Inches(6.5); c = tb.cell(0, 0); c.width = Inches(6.5)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP; c.text = "Respuesta / nota:\n\n"; _shade(c, "F8F5ED")
        if letter not in ("A", "K"):
            d.add_page_break()
    cp = d.core_properties  # fixed timestamps → deterministic docx bytes
    cp.author = "LeadLens"; cp.title = "Amor de Gea · Retroalimentación Piloto 1"
    cp.created = cp.modified = datetime(2026, 8, 3)
    cp.last_modified_by = "LeadLens"; cp.revision = 1
    d.save(out)
    _normalize_zip(out)
    return out

def _normalize_zip(path):
    """Repack the .docx (a zip) with fixed member timestamps + order so bytes are
    deterministic across runs and the download checksum stays stable."""
    import zipfile
    with zipfile.ZipFile(path) as z:
        members = sorted(z.infolist(), key=lambda i: i.filename)
        data = {i.filename: z.read(i.filename) for i in members}
    tmp = path.with_suffix(".docx.tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for name in sorted(data):
            zi = zipfile.ZipInfo(name, date_time=(2026, 8, 3, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data[name])
    tmp.replace(path)

DENY = ["V3R3", "V3R2", "V4D", "Blueprint", "compiler", "provider", "Founder Review",
        "Revisión del fundador", "revisión interna", "No enviado", "internal", "admin_entry",
        "Phase 5", "conflict check", "NEEDS EVIDENCE", "actionability"]

def _selfcheck():
    from pypdf import PdfReader
    import re
    report = "\n".join((p.extract_text() or "") for p in PdfReader(str(PDF / "Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf")).pages)
    briefs = "\n".join((p.extract_text() or "") for p in PdfReader(str(PDF / "Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf")).pages)
    feedback = "\n".join((p.extract_text() or "") for p in PdfReader(str(PDF / "Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf")).pages)
    for label, text in [("report", report), ("briefs", briefs), ("feedback", feedback)]:
        for tok in DENY:
            assert not re.search(re.escape(tok), text, re.I), f"internal token '{tok}' leaked into {label}"
    names = [a["name"] for a in DATA["accounts"]]
    for n in names:
        assert n in report, f"missing account {n} in report"
        assert n in feedback, f"missing account {n} in feedback"
    for d in ["etekacartagena.com", "hotelcelestino.com", "sinergyon.com", "tiendavitalica.com"]:
        assert d in report and d in briefs, f"missing evidence source {d}"
    assert "Piloto 1 completado" in report, "missing customer-safe closing line"
    print("selfcheck: ok (no internal tokens · 10 accounts · evidence sources present)")

def main():
    files = [build_report(), build_briefs(), build_feedback_pdf(), build_feedback_docx()]
    for f in files:
        shutil.copy2(f, PUBLIC / f.name)
    _selfcheck()
    for f in files:
        print(f"{f}  ({f.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
