# -*- coding: utf-8 -*-
"""Manual de uso — Cambio de EPPS · Compañía Minera Casma SAC."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "Manual_Uso_Cambio_de_EPPS.pdf"
LOGO = ROOT / "cita_minera_casma_sac-removebg-preview.png"

NAVY = colors.HexColor("#1a2636")
BLUE = colors.HexColor("#1a6fd4")
RED = colors.HexColor("#a32d2d")
GREEN = colors.HexColor("#1a9e5c")
AMBER = colors.HexColor("#b45309")
BG = colors.HexColor("#f0f4f8")
LINE = colors.HexColor("#d5dde6")
MUTED = colors.HexColor("#5b6775")
WHITE = colors.white

PAGE_W, PAGE_H = A4
ML, MR, MT, MB = 18 * mm, 18 * mm, 22 * mm, 18 * mm
CONTENT_W = PAGE_W - ML - MR


def styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(
        "CoverBrand", fontName="Helvetica-Bold", fontSize=11,
        textColor=MUTED, alignment=TA_CENTER, letterSpacing=1.4,
        spaceAfter=4,
    ))
    s.add(ParagraphStyle(
        "CoverTitle", fontName="Helvetica-Bold", fontSize=26,
        textColor=NAVY, alignment=TA_CENTER, leading=32, spaceAfter=6,
    ))
    s.add(ParagraphStyle(
        "CoverSub", fontName="Helvetica", fontSize=12,
        textColor=MUTED, alignment=TA_CENTER, leading=16, spaceAfter=4,
    ))
    s.add(ParagraphStyle(
        "H1", fontName="Helvetica-Bold", fontSize=14,
        textColor=NAVY, spaceBefore=12, spaceAfter=8, leading=18,
    ))
    s.add(ParagraphStyle(
        "H2", fontName="Helvetica-Bold", fontSize=11.5,
        textColor=BLUE, spaceBefore=10, spaceAfter=5, leading=15,
    ))
    s.add(ParagraphStyle(
        "Body", fontName="Helvetica", fontSize=10,
        textColor=NAVY, alignment=TA_JUSTIFY, leading=14, spaceAfter=6,
    ))
    s.add(ParagraphStyle(
        "BodyLeft", fontName="Helvetica", fontSize=10,
        textColor=NAVY, alignment=TA_LEFT, leading=14, spaceAfter=4,
    ))
    s.add(ParagraphStyle(
        "Small", fontName="Helvetica", fontSize=8.5,
        textColor=MUTED, leading=12, alignment=TA_LEFT,
    ))
    s.add(ParagraphStyle(
        "Footer", fontName="Helvetica", fontSize=8,
        textColor=MUTED, alignment=TA_CENTER,
    ))
    s.add(ParagraphStyle(
        "CellH", fontName="Helvetica-Bold", fontSize=8.5,
        textColor=WHITE, leading=11,
    ))
    s.add(ParagraphStyle(
        "Cell", fontName="Helvetica", fontSize=8.5,
        textColor=NAVY, leading=11,
    ))
    s.add(ParagraphStyle(
        "CellB", fontName="Helvetica-Bold", fontSize=8.5,
        textColor=NAVY, leading=11,
    ))
    s.add(ParagraphStyle(
        "StepN", fontName="Helvetica-Bold", fontSize=11,
        textColor=WHITE, alignment=TA_CENTER, leading=14,
    ))
    s.add(ParagraphStyle(
        "StepT", fontName="Helvetica-Bold", fontSize=10,
        textColor=NAVY, leading=13, spaceAfter=2,
    ))
    s.add(ParagraphStyle(
        "Callout", fontName="Helvetica", fontSize=9.5,
        textColor=NAVY, leading=13,
    ))
    s.add(ParagraphStyle(
        "CalloutT", fontName="Helvetica-Bold", fontSize=9.5,
        textColor=NAVY, leading=13, spaceAfter=3,
    ))
    s.add(ParagraphStyle(
        "TocItem", fontName="Helvetica", fontSize=10.5,
        textColor=NAVY, leading=16, leftIndent=8,
    ))
    s.add(ParagraphStyle(
        "Stamp", fontName="Helvetica-Bold", fontSize=10,
        textColor=WHITE, alignment=TA_CENTER, leading=13,
    ))
    s.add(ParagraphStyle(
        "Li", fontName="Helvetica", fontSize=10,
        textColor=NAVY, leading=14, leftIndent=4,
    ))
    return s


S = styles()


def p(text, style="Body"):
    return Paragraph(text, S[style])


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(ML, PAGE_H - 6.4 * mm, "COMPA\u00d1\u00cdA MINERA CASMA SAC")
    canvas.drawRightString(PAGE_W - MR, PAGE_H - 6.4 * mm, "Cambio de EPPS")
    canvas.setFillColor(BG)
    canvas.rect(0, 0, PAGE_W, 12 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(BLUE)
    canvas.setLineWidth(2)
    canvas.line(0, 12 * mm, PAGE_W, 12 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(ML, 5 * mm, "Manual de uso  |  RUC 20606447192")
    canvas.drawRightString(PAGE_W - MR, 5 * mm, "P\u00e1gina %d" % doc.page)
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 28 * mm, PAGE_W, 28 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 12 * mm, "COMPA\u00d1\u00cdA MINERA CASMA SAC")
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 18 * mm, "SSOMA  ·  Almac\u00e9n  ·  Operaciones")
    canvas.setFillColor(BLUE)
    canvas.rect(0, PAGE_H - 31 * mm, PAGE_W, 3 * mm, fill=1, stroke=0)

    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, 22 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(PAGE_W / 2, 12 * mm, "Uso interno  ·  No reproducir fuera de Casma sin autorizaci\u00f3n")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(PAGE_W / 2, 7 * mm, "Version 1.0  ·  Agosto 2026")
    canvas.restoreState()


def stamp(text):
    t = Table(
        [[Paragraph(text, S["Stamp"])]],
        colWidths=[52 * mm],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    wrap = Table([[t]], colWidths=[CONTENT_W])
    wrap.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return wrap


def callout(title, body, kind="info"):
    bar = {"info": BLUE, "warn": AMBER, "stop": RED, "ok": GREEN}[kind]
    inner = [
        [Paragraph(title, S["CalloutT"])],
        [Paragraph(body, S["Callout"])],
    ]
    box = Table(inner, colWidths=[CONTENT_W - 5 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (0, 0), 8),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBEFORE", (0, 0), (0, -1), 4, bar),
    ]))
    return KeepTogether([box, Spacer(1, 8)])


def step(n, title, body):
    num = Table(
        [[Paragraph(str(n), S["StepN"])]],
        colWidths=[9 * mm], rowHeights=[9 * mm],
    )
    num.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
    ]))
    right = [Paragraph(title, S["StepT"]), Paragraph(body, S["BodyLeft"])]
    row = Table([[num, right]], colWidths=[12 * mm, CONTENT_W - 12 * mm])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return KeepTogether([row, Spacer(1, 4)])


def grid(headers, rows, widths):
    head = [Paragraph(h, S["CellH"]) for h in headers]
    data = [head]
    for r in rows:
        data.append([Paragraph(c, S["CellB"] if i == 0 else S["Cell"]) for i, c in enumerate(r)])
    t = Table(data, colWidths=widths, repeatRows=1)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), BG))
    t.setStyle(TableStyle(cmds))
    return t


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S["Li"]), leftIndent=8, bulletColor=BLUE) for i in items],
        bulletType="bullet",
        start="bulletchar",
        leftIndent=14,
        bulletFontName="Helvetica",
        bulletFontSize=8,
        spaceBefore=2,
        spaceAfter=8,
    )


def build():
    story = []

    # ── Portada ──
    story.append(Spacer(1, 28 * mm))
    if LOGO.exists():
        img = Image(str(LOGO), width=38 * mm, height=38 * mm, kind="proportional")
        img.hAlign = "CENTER"
        story.append(img)
        story.append(Spacer(1, 8 * mm))
    story.append(p("COMPA\u00d1\u00cdA MINERA CASMA SAC", "CoverBrand"))
    story.append(p("Manual de uso", "CoverTitle"))
    story.append(p("Aplicaci\u00f3n de cambio de EPPS<br/>Vale de almac\u00e9n · Registro inmediato en celular", "CoverSub"))
    story.append(Spacer(1, 6 * mm))
    story.append(stamp("CAMBIO DE EPPS"))
    story.append(Spacer(1, 10 * mm))
    story.append(p(
        "Dirigido a personal de SSOMA, almac\u00e9n y jefes de \u00e1rea que registran, "
        "entregan o consultan cambios de equipo de protecci\u00f3n personal en operaciones Casma.",
        "CoverSub",
    ))
    story.append(Spacer(1, 8 * mm))
    meta = grid(
        ["Dato", "Valor"],
        [
            ["Empresa", "Compa\u00f1\u00eda Minera Casma SAC"],
            ["RUC", "20606447192"],
            ["Aplicaci\u00f3n", "Cambio de EPPS (vale de almac\u00e9n)"],
            ["Dispositivo", "Celular primero; tambi\u00e9n PC"],
            ["D\u00f3nde se guarda", "Google Sheet (datos) + Google Drive (fotos y firmas)"],
            ["Versi\u00f3n del manual", "1.0 — agosto 2026"],
        ],
        [45 * mm, CONTENT_W - 45 * mm],
    )
    story.append(meta)
    story.append(PageBreak())

    # ── Indice ──
    story.append(p("Contenido", "H1"))
    toc = [
        "1. Para qu\u00e9 sirve esta aplicaci\u00f3n",
        "2. Antes de empezar",
        "3. La regla de oro: no se retire hasta que sincronice",
        "4. Pantallas (pesta\u00f1as)",
        "5. Registrar un vale paso a paso",
        "6. EPPS entregados: tipo, talla y cantidad",
        "7. Qui\u00e9n solicita el cambio",
        "8. Fotos y firma",
        "9. Guardar y sincronizar",
        "10. Consultar, imprimir y Excel",
        "11. Seguimientos y estad\u00edsticas",
        "12. Sin internet",
        "13. Problemas frecuentes",
    ]
    for item in toc:
        story.append(p(item, "TocItem"))
    story.append(Spacer(1, 8))
    story.append(callout(
        "Como leer este manual",
        "Los campos marcados con asterisco (*) en la app son obligatorios. "
        "Si falta uno, el vale no se guarda. El solicitante del cambio es la persona "
        "que recibe el EPP: su nombre y DNI salen en la impresion final.",
        "info",
    ))

    # ── 1 ──
    story.append(p("1. Para qu\u00e9 sirve esta aplicaci\u00f3n", "H1"))
    story.append(p(
        "Es el vale digital de <b>cambio de EPPS</b> de Minera Casma. Reemplaza el "
        "registro en papel: SSOMA o almacen anota quien pide el cambio, que EPP se "
        "entrega (tipo, talla y cantidad), toma fotos y firma. Al guardar, el vale "
        "se envia al instante al Google Sheet de la empresa y las evidencias a Drive.",
        "Body",
    ))
    story.append(p(
        "No es un reporte RACS de desviacion. La persona que aparece en el vale es "
        "<b>quien solicita el cambio y recibe el EPP</b>, no un observado de un acto subestandar.",
        "Body",
    ))
    story.append(grid(
        ["Pieza", "Que guarda"],
        [
            ["Celular / PC", "Formulario, cola offline y vista de vales"],
            ["Google Sheet", "Datos del vale (solicitante, EPPS, fechas, enlaces)"],
            ["Google Drive", "Fotos de EPPS retirados, foto de quien recibe, firmas"],
        ],
        [40 * mm, CONTENT_W - 40 * mm],
    ))
    story.append(Spacer(1, 6))

    # ── 2 ──
    story.append(p("2. Antes de empezar", "H1"))
    story.append(bullets([
        "Abra <b>index.html</b> en el navegador del celular (Chrome) o en la PC.",
        "Se recomienda conexion a internet. Sin red el vale se guarda en el celular y se sube despues.",
        "Permita camara y almacenamiento si el navegador lo pide.",
        "Busque personal por <b>DNI de 8 digitos</b>: al coincidir se autocompletan nombre, area y cargo.",
        "El indicador de la esquina superior derecha muestra si esta en linea, sincronizando u offline.",
    ]))

    # ── 3 ──
    story.append(p("3. La regla de oro: no se retire hasta que sincronice", "H1"))
    story.append(callout(
        "Obligatorio en campo",
        "Despues de pulsar <b>Guardar vale</b> no cierre la app, no bloquee el celular "
        "y no se retire del area hasta que el aviso de sincronizacion desaparezca y el "
        "vale figure como <b>Sincronizado</b>. Si se va a mitad de envio, las fotos "
        "pueden quedar a medias y el vale se reintenta, pero usted debe esperar.",
        "stop",
    ))
    story.append(p(
        "Verá avisos en la parte superior: sin conexion, sincronizando evidencias, o "
        "vales pendientes. El punto del badge pasa de offline a sincronizando y luego "
        "a en linea.",
        "Body",
    ))

    # ── 4 ──
    story.append(p("4. Pantallas (pesta\u00f1as)", "H1"))
    story.append(grid(
        ["Pestana", "Para que se usa"],
        [
            ["Nuevo", "Registrar un vale de cambio de EPPS."],
            ["Reportes", "Lista de vales, busqueda, PDF, Excel y recarga del servidor."],
            ["Seguimientos", "Vales <b>Abiertos</b> agrupados por responsable de almacen."],
            ["Estadisticas", "EPPS por dia/mes, area, solicitante, tipo de EPP y categoria."],
        ],
        [32 * mm, CONTENT_W - 32 * mm],
    ))
    story.append(Spacer(1, 8))

    # ── 5 ──
    story.append(p("5. Registrar un vale paso a paso", "H1"))
    story.append(p(
        "Entre a la pestana <b>Nuevo</b> y complete de arriba hacia abajo. El estado "
        "por defecto es <b>Cerrado</b> (el cambio ya se atiende). Use <b>Abierto</b> "
        "solo si falta cerrar la entrega.",
        "Body",
    ))
    story.append(step(1, "Estado",
        "Elija <b>Cerrado</b> (usual) o <b>Abierto</b>. Si esta cerrado, debe describir las acciones de entrega."))
    story.append(step(2, "Motivo (acto / condicion)",
        "<b>Acto subestandar</b> si el cambio se origina en una conducta (por ejemplo perdida por descuido). "
        "<b>Condicion subestandar</b> si el EPP se desgasto, vencio o se rompio en la labor."))
    story.append(step(3, "Categoria",
        "Pérdida de EPPs · Robo · Desgaste por uso (antes de cambio) · Cambio de vida util · Otros. "
        "Si elige Otros, escriba la categoria."))
    story.append(step(4, "EPPS entregados",
        "Agregue cada EPP con tipo, talla y cantidad. Puede sumar varias filas (casco + botas, etc.). "
        "Vea la seccion 6."))
    story.append(step(5, "Observaciones",
        "Minimo 40 caracteres. No repita tipo ni talla: ya van en las filas. "
        "Indique estado del EPP retirado, labor o zona y lo que almacen debe saber."))
    story.append(step(6, "Responsable de atencion (Almacen)",
        "Busque por DNI o nombre al encargado de almacen que atiende el cambio."))
    story.append(step(7, "Lugar y solicitante",
        "Area/ubicacion (Campamento, Garita, Zona 1–6, Zona Lomas u Otros). "
        "DNI de 8 digitos, nombre, area y cargo de <b>quien solicita / recibe el EPP</b>. "
        "Jefe inmediato obligatorio."))
    story.append(step(8, "Fecha y hora",
        "Vienen cargadas con el momento actual. Ajustelas si el cambio ocurrio antes."))
    story.append(step(9, "Fotos y firma",
        "Foto de EPPS retirados (recomendado). Foto de EPPS nuevos <b>con la persona que recibe</b> (obligatoria). "
        "Firme en el recuadro blanco con el dedo."))
    story.append(step(10, "Guardar vale",
        "Pulse el boton azul. Espere la sincronizacion. No se retire."))

    story.append(p("Campos obligatorios", "H2"))
    story.append(grid(
        ["Campo", "Obligatorio", "Nota"],
        [
            ["Estado", "S\u00ed", "Por defecto Cerrado"],
            ["Motivo acto/condici\u00f3n", "S\u00ed", "Una de las dos fichas"],
            ["Categor\u00eda", "S\u00ed", "Si es Otros, describir"],
            ["Al menos 1 EPP (tipo + talla + cant.)", "S\u00ed", "Casco, botas, lentes, etc."],
            ["Observaciones (40+ caracteres)", "S\u00ed", "Motivo, no el listado de EPPS"],
            ["Responsable almac\u00e9n", "S\u00ed", "Buscar por DNI"],
            ["\u00c1rea / ubicaci\u00f3n", "S\u00ed", "Si es Otros, especificar"],
            ["DNI solicitante (8 d\u00edgitos)", "S\u00ed", "Qui\u00e9n recibe el EPP"],
            ["Nombre del solicitante", "S\u00ed", "Sale en la impresi\u00f3n"],
            ["\u00c1rea del solicitante", "S\u00ed", "Se autocompleta con el DNI"],
            ["Jefe inmediato", "S\u00ed", "Buscar por DNI o nombre"],
            ["Fecha y hora", "S\u00ed", "Precargadas"],
            ["Foto de quien recibe + EPPS nuevos", "S\u00ed", "M\u00e1ximo 5"],
            ["Firma del registrador", "S\u00ed", "Dibujar en el recuadro"],
            ["Foto de EPPS retirados", "No", "Recomendada para el vale"],
            ["Cargo del solicitante", "No", "Completar si se conoce"],
        ],
        [58 * mm, 22 * mm, CONTENT_W - 80 * mm],
    ))
    story.append(Spacer(1, 6))

    # ── 6 ──
    story.append(p("6. EPPS entregados: tipo, talla y cantidad", "H1"))
    story.append(p(
        "Cada fila es un EPP distinto. Pulse <b>+ Agregar otro EPP</b> si entrega mas de un tipo "
        "en el mismo vale. El total de unidades se calcula solo.",
        "Body",
    ))
    story.append(grid(
        ["Tipo", "Ejemplo de talla"],
        [
            ["Casco", "S / M / L"],
            ["Botas", "38 a 45"],
            ["Lentes", "\u00danica"],
            ["Respirador", "S / M / L"],
            ["Guantes", "8 / 9 / 10 / 11"],
            ["Protector auditivo", "\u00danica"],
            ["Overol", "S / M / L / XL"],
            ["Otro", "Escriba el EPP (barbiquejo, linterna…) y la talla o modelo"],
        ],
        [48 * mm, CONTENT_W - 48 * mm],
    ))
    story.append(Spacer(1, 6))
    story.append(callout(
        "Ejemplo",
        "Vale de perdida en Zona 2: Casco talla M × 1 + Guantes talla 9 × 1. "
        "Observacion: “Se perdio el casco en acceso a bocamina; se entrega casco nuevo y par de guantes.” "
        "Total: 2 unidades.",
        "ok",
    ))

    # ── 7 ──
    story.append(p("7. Qui\u00e9n solicita el cambio", "H1"))
    story.append(p(
        "La persona del vale es quien <b>pide el cambio y recibe el EPP</b>. "
        "Su nombre, DNI, area y cargo salen en el detalle y en la impresion, con una "
        "linea de firma para que rubrique el documento impreso.",
        "Body",
    ))
    story.append(bullets([
        "Escriba primero el <b>DNI (8 digitos)</b>. Si existe en la lista de personal, se rellena el resto.",
        "Si el DNI es nuevo, complete nombre, area y cargo: se guarda en la hoja Personal para la proxima.",
        "El jefe inmediato tambien se busca por DNI o nombre.",
        "El registrador queda como <b>SSOMA</b> por defecto; no hay que volver a llenar datos del reportante.",
    ]))

    # ── 8 ──
    story.append(p("8. Fotos y firma", "H1"))
    story.append(p("Fotos", "H2"))
    story.append(grid(
        ["Foto", "Obligatoria", "Que debe verse"],
        [
            ["EPPS retirados", "No (recomendada)", "El EPP viejo: roto, desgastado o el que se da de baja. Max. 5."],
            ["EPPS nuevos y quien recibe", "Si", "La persona que recibe, con el EPP nuevo visible. Max. 5."],
        ],
        [48 * mm, 32 * mm, CONTENT_W - 80 * mm],
    ))
    story.append(Spacer(1, 6))
    story.append(p(
        "Use <b>Tomar foto</b> en campo o <b>Galeria</b> si ya la tiene. Las imagenes se "
        "comprimen en el celular. En Drive quedan como archivo; en el Sheet solo el enlace.",
        "Body",
    ))
    story.append(p("Firma", "H2"))
    story.append(p(
        "Dibuje la firma del registrador (SSOMA o quien opera la app) en el recuadro blanco. "
        "Si se equivoca, pulse Limpiar firma. En la impresion hay una segunda linea vacia "
        "para la firma manuscrita de quien solicita el cambio.",
        "Body",
    ))

    # ── 9 ──
    story.append(p("9. Guardar y sincronizar", "H1"))
    story.append(bullets([
        "Pulse <b>Guardar vale</b>. Si falta un campo, un aviso amarillo indica cual.",
        "Con internet, la app sube fotos y firma a Drive y luego escribe la fila en el Sheet.",
        "Cuando termina, el vale aparece en Reportes con estado <b>Sincronizado</b>.",
        "Si falla la red a mitad de camino, el vale queda pendiente y se reintenta al volver en linea. No lo borre.",
        "Puede pulsar el badge de la esquina para forzar sincronizacion / recarga.",
    ]))
    story.append(callout(
        "No elimine un vale ya subido creyendo que desaparece del Sheet",
        "El boton Eliminar solo lo quita de la vista del celular. Si ya se sincronizo, "
        "al recargar vuelve a aparecer. Para anular un vale, edite o gestione la fila en el Sheet con SSOMA.",
        "warn",
    ))

    # ── 10 ──
    story.append(p("10. Consultar, imprimir y Excel", "H1"))
    story.append(p("Lista de vales", "H2"))
    story.append(p(
        "En <b>Reportes</b> cada tarjeta muestra los EPPS entregados, el solicitante, "
        "el lugar, la categoria y si esta sincronizado. Puede buscar por nombre, DNI, "
        "lugar o tipo de EPP, y filtrar Abierto / Cerrado.",
        "Body",
    ))
    story.append(p("Detalle y edicion", "H2"))
    story.append(p(
        "Toque una tarjeta para ver el vale completo (solicitante, EPPS, fotos, firma). "
        "Desde ahi: <b>Imprimir</b> (vale individual), <b>Editar</b> (cambiar estado y acciones "
        "con firma del editor) o Cerrar.",
        "Body",
    ))
    story.append(p("Impresion y exportacion", "H2"))
    story.append(grid(
        ["Accion", "Que obtiene"],
        [
            ["Imprimir (en el detalle)", "Vale CAMBIO DE EPPS con logo Casma, solicitante, EPPS (tipo/talla/cant.), fotos y firmas."],
            ["PDF (lista)", "Listado de todos los vales, con solicitante y EPPS entregados."],
            ["Excel", "Hoja Cambio de EPPS con columnas de solicitante, DNI, area, cargo y detalle de EPPS."],
            ["Imprimir (estadisticas)", "Resumen del mes: unidades, areas, solicitantes y tipos de EPP."],
        ],
        [42 * mm, CONTENT_W - 42 * mm],
    ))
    story.append(Spacer(1, 6))
    story.append(p(
        "Al imprimir, el navegador pedira permitir ventanas emergentes. Elija impresora o "
        "“Guardar como PDF”. El encabezado debe mostrar el logo y el sello CAMBIO DE EPPS.",
        "Body",
    ))

    # ── 11 ──
    story.append(p("11. Seguimientos y estad\u00edsticas", "H1"))
    story.append(p("Seguimientos", "H2"))
    story.append(p(
        "Agrupa vales <b>Abiertos</b> por responsable de almacen. Use <b>Descargar lista</b> "
        "para imprimir pendientes (incluye solicitante y EPPS). Cierre el vale desde Editar "
        "cuando la entrega este hecha.",
        "Body",
    ))
    story.append(p("Estadisticas", "H2"))
    story.append(p(
        "Filtro de mes y anio, o Todo. Se actualiza en vivo si hay internet. Incluye:",
        "Body",
    ))
    story.append(bullets([
        "EPPS entregados por dia y por mes (unidades, no solo numero de vales).",
        "Area con mas cambios.",
        "Personas (solicitantes) con mas cambios de EPPS.",
        "EPPS entregados por tipo (casco, botas, etc.).",
        "Clasificacion (perdida, robo, desgaste, vida util).",
        "Estado abierto / cerrado y motivo acto vs condicion.",
    ]))

    # ── 12 ──
    story.append(p("12. Sin internet", "H1"))
    story.append(p(
        "Puede registrar el vale igual: queda en el celular (cola local). Aparecera el aviso "
        "de sin conexion. <b>No se retire</b> si espera sincronizar en el momento; si no hay "
        "senal en interior mina, complete el vale, vuelva a zona con red y abra de nuevo la "
        "app: al detectar internet sincroniza sola.",
        "Body",
    ))
    story.append(callout(
        "No borre datos del navegador",
        "Si limpia cache o usa modo incognito, se pierde la cola pendiente que aun no subio. "
        "Trabaje en el mismo navegador y no borre sitios hasta ver Sincronizado.",
        "warn",
    ))

    # ── 13 ──
    story.append(p("13. Problemas frecuentes", "H1"))
    story.append(grid(
        ["Que ocurre", "Que hacer"],
        [
            ["No deja guardar", "Revise el aviso: casi siempre falta tipo/talla de EPP, DNI de 8, foto de quien recibe, firma u observaciones cortas."],
            ["No aparece personal al buscar DNI", "Complete nombre, area y cargo; se dara de alta. Luego recargue personal con internet."],
            ["Sigue en “sincronizando”", "Espere. Si hay muchas fotos, tarda. No cierre. Si falla, el aviso lo dira y se reintenta."],
            ["No salen fotos en la impresion", "Espere a que carguen (la app espera hasta 6 s) y vuelva a imprimir. Necesita internet para thumbs de Drive."],
            ["El vale no tiene tipo/talla", "Los vales anteriores a esta version solo tenian cantidad. Los nuevos si llevan filas de EPP."],
            ["La lista esta vacia", "Pulse Cargar (flecha) con internet. El servidor es la fuente de verdad."],
            ["Ventana de impresion bloqueada", "Permita ventanas emergentes para el sitio y pulse Imprimir otra vez."],
        ],
        [48 * mm, CONTENT_W - 48 * mm],
    ))
    story.append(Spacer(1, 10))
    story.append(callout(
        "Soporte interno",
        "Dudas de uso o personal mal cargado: SSOMA Casma. "
        "Problemas del Sheet o carpetas Drive: quien administra el despliegue de la Web App. "
        "No comparta la URL del script fuera de la empresa.",
        "info",
    ))
    story.append(Spacer(1, 8))
    story.append(p(
        "Compa\u00f1\u00eda Minera Casma SAC  ·  RUC 20606447192  ·  Cambio de EPPS  ·  Manual de uso v1.0",
        "CoverSub",
    ))

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=ML,
        rightMargin=MR,
        topMargin=MT,
        bottomMargin=MB,
        title="Manual de uso — Cambio de EPPS",
        author="Compania Minera Casma SAC",
        subject="Vale de almacen de cambio de EPPS",
    )
    doc.build(story, onFirstPage=cover_page, onLaterPages=header_footer)
    print("Wrote", OUT)


if __name__ == "__main__":
    build()
