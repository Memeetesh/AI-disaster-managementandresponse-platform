"""Build SIH_Final_Presentation.pptx on top of the official SIH 2026 IDEA template.

Keeps all mandated branding + section titles + 6-slide limit. Rebuilds the
content of every slide. Original files are never touched.
"""
import copy
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

SRC = "/home/falseprophet/Documents/projects 3rd sem/sar drone/SIH2026-IDEA-Presentation-Format.pptx"
OUT = "/home/falseprophet/Documents/projects 3rd sem/sar drone/SIH_Final_Presentation.pptx"

# ---- palette -------------------------------------------------------------
NAVY  = RGBColor(0x0B, 0x2E, 0x4E)
TEAL  = RGBColor(0x0E, 0x7C, 0x7B)
AMBER = RGBColor(0xB9, 0x5C, 0x0E)
RED   = RGBColor(0xA9, 0x33, 0x2A)
GREEN = RGBColor(0x27, 0x6B, 0x2E)
SLATE = RGBColor(0x47, 0x55, 0x63)
INK   = RGBColor(0x1E, 0x29, 0x36)
MUT   = RGBColor(0x55, 0x64, 0x74)
LINE  = RGBColor(0xCF, 0xD9, 0xE1)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BAND  = RGBColor(0xED, 0xF2, 0xF4)
TEALBG= RGBColor(0xE4, 0xF0, 0xEF)
REDBG = RGBColor(0xF7, 0xE9, 0xE7)
GRNBG = RGBColor(0xE8, 0xF1, 0xE8)
AMBBG = RGBColor(0xF7, 0xEE, 0xE1)
FONT  = "Calibri"

# =======================================================================
# helpers
# =======================================================================
def delete_slide(prs, index):
    lst = prs.slides._sldIdLst
    slides = list(lst)
    rId = slides[index].get(qn("r:id"))
    prs.part.drop_rel(rId)
    lst.remove(slides[index])


def shape_by_kw(slide, *kw):
    for sp in slide.shapes:
        if any(k in sp.name for k in kw):
            return sp
    return None


def strip_content(slide, keep_kw):
    """Remove every shape whose name doesn't match a keep keyword."""
    for sp in list(slide.shapes):
        if any(k in sp.name for k in keep_kw):
            continue
        sp._element.getparent().remove(sp._element)


def no_shadow(sp):
    sp.shadow.inherit = False


def rect(slide, x, y, w, h, fill=None, line=None, lw=1.0, rounded=True, rad=0.055):
    shp = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h))
    no_shadow(shp)
    try:
        if rounded:
            shp.adjustments[0] = rad
    except Exception:
        pass
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid(); shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line; shp.line.width = Pt(lw)
    return shp


def chevron(slide, x, y, w, h, fill):
    shp = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x), Inches(y), Inches(w), Inches(h))
    no_shadow(shp)
    shp.fill.solid(); shp.fill.fore_color.rgb = fill
    shp.line.fill.background()
    return shp


def connect(slide, x1, y1, x2, y2, color=SLATE, w=1.5):
    ln = slide.shapes.add_connector(2, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    ln.line.color.rgb = color; ln.line.width = Pt(w)
    no_shadow(ln)
    return ln


def tb(slide, x, y, w, h, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right"):
        setattr(tf, m, Inches(0.07))
    tf.margin_top = Inches(0.03); tf.margin_bottom = Inches(0.03)
    return box, tf


def para(tf, text, size=11, bold=False, color=INK, align=PP_ALIGN.LEFT,
         first=False, before=0, after=3, bullet=False, spacing=1.0):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(before); p.space_after = Pt(after)
    try:
        p.line_spacing = spacing
    except Exception:
        pass
    r = p.add_run()
    r.text = ("•  " + text) if bullet else text
    f = r.font
    f.name = FONT; f.size = Pt(size); f.bold = bold; f.color.rgb = color
    return p


def rich(tf, segs, size=11, align=PP_ALIGN.LEFT, first=False, before=0, after=3, bullet=False):
    """segs: list of (text, color, bold)."""
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(before); p.space_after = Pt(after)
    if bullet:
        r = p.add_run(); r.text = "•  "
        r.font.name = FONT; r.font.size = Pt(size); r.font.color.rgb = MUT
    for text, color, bold in segs:
        r = p.add_run(); r.text = text
        r.font.name = FONT; r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color
    return p


def card(slide, x, y, w, h, title=None, tcolor=TEAL, body=CARDBG if False else WHITE,
         border=LINE):
    c = rect(slide, x, y, w, h, fill=WHITE, line=border, lw=1.0)
    if title:
        strip = rect(slide, x, y, w, 0.34, fill=tcolor, line=None, rounded=True, rad=0.12)
        _, tf = tb(slide, x + 0.02, y + 0.005, w - 0.04, 0.33, anchor=MSO_ANCHOR.MIDDLE)
        para(tf, title, size=10.5, bold=True, color=WHITE, first=True, after=0)
    return c


def styled_table(slide, x, y, w, h, data, col_w=None, header_fill=NAVY,
                 header_color=WHITE, fs=9.5, hfs=9.5, body_fill=WHITE,
                 alt_fill=RGBColor(0xF4, 0xF7, 0xF9), align0=PP_ALIGN.LEFT):
    rows, cols = len(data), len(data[0])
    gt = slide.shapes.add_table(rows, cols, Inches(x), Inches(y), Inches(w), Inches(h))
    t = gt.table
    t.first_row = False; t.horz_banding = False
    # neutralise the default table style
    tblPr = t._tbl.find(qn("a:tblPr"))
    if tblPr is not None:
        tblPr.set("firstRow", "0"); tblPr.set("bandRow", "0")
        for st in tblPr.findall(qn("a:tableStyleId")):
            tblPr.remove(st)
    if col_w:
        for i, cw in enumerate(col_w):
            t.columns[i].width = Inches(cw)
    for ri, row in enumerate(data):
        try:
            t.rows[ri].height = Inches(h / rows)
        except Exception:
            pass
        for ci, val in enumerate(row):
            cell = t.cell(ri, ci)
            cell.margin_left = Inches(0.06); cell.margin_right = Inches(0.06)
            cell.margin_top = Inches(0.02); cell.margin_bottom = Inches(0.02)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.fill.solid()
            if ri == 0:
                cell.fill.fore_color.rgb = header_fill
            else:
                cell.fill.fore_color.rgb = body_fill if ri % 2 else alt_fill
            tf = cell.text_frame; tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = align0 if ci == 0 else PP_ALIGN.LEFT
            r = p.add_run(); r.text = str(val)
            r.font.name = FONT
            r.font.size = Pt(hfs if ri == 0 else fs)
            r.font.bold = (ri == 0)
            r.font.color.rgb = header_color if ri == 0 else INK
    return gt


def set_title(slide, text, size=30, color=NAVY):
    t = shape_by_kw(slide, "Title")
    t.left, t.top, t.width, t.height = Inches(2.02), Inches(0.10), Inches(8.45), Inches(1.02)
    tf = t.text_frame
    tf.clear(); tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = text
    r.font.name = FONT; r.font.size = Pt(size); r.font.bold = True; r.font.color.rgb = color
    return t


def takeaway(slide, text, y=1.16):
    _, tf = tb(slide, 0.55, y, 12.3, 0.42, anchor=MSO_ANCHOR.MIDDLE)
    rich(tf, [(text, TEAL, True)], size=12.5, first=True, after=0)


def team_oval(slide):
    o = shape_by_kw(slide, "Oval")
    if o is None:
        return
    o.left, o.top, o.width, o.height = Inches(0.30), Inches(0.20), Inches(1.66), Inches(0.60)
    o.fill.solid(); o.fill.fore_color.rgb = WHITE
    o.line.color.rgb = NAVY; o.line.width = Pt(1.25)
    no_shadow(o)
    tf = o.text_frame; tf.clear(); tf.word_wrap = True
    tf.margin_left = Inches(0.02); tf.margin_right = Inches(0.02)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = "Team Innovexis"
    r.font.name = FONT; r.font.size = Pt(9); r.font.bold = True; r.font.color.rgb = NAVY


# =======================================================================
prs = Presentation(SRC)
S = prs.slides

# -------------------------------------------------- SLIDE 1 : TITLE
s1 = S[0]
sub = shape_by_kw(s1, "Subtitle")
if sub is not None:
    sub.left, sub.top, sub.width, sub.height = Inches(0.55), Inches(1.30), Inches(9.4), Inches(0.6)
    tf = sub.text_frame; tf.clear(); tf.word_wrap = True
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r = p.add_run()
    r.text = "Aasha Setu — Disaster Intelligence, Response & Situational Awareness"
    r.font.name = FONT; r.font.size = Pt(16); r.font.bold = True; r.font.color.rgb = TEAL

box = shape_by_kw(s1, "TextBox 9")
tf = box.text_frame
tf.clear(); tf.word_wrap = True
rows1 = [
    ("Problem Statement ID – ", "26223"),
    ("Problem Statement Title – ",
     "Disaster management and Risk mitigation System (Pre, During, Post Disaster)"),
    ("Theme – ", "Disaster Management"),
    ("PS Category – ", "Software + Hardware"),
    ("Team ID – ", "_______"),
    ("Team Name – ", "Innovexis"),
]
for i, (a, b) in enumerate(rows1):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.space_after = Pt(10)
    r = p.add_run(); r.text = a
    r.font.name = FONT; r.font.size = Pt(19); r.font.bold = False; r.font.color.rgb = INK
    r = p.add_run(); r.text = b
    r.font.name = FONT; r.font.size = Pt(19); r.font.bold = True; r.font.color.rgb = NAVY

# =======================================================================
# SLIDE 2 : IDEA
# =======================================================================
s2 = S[1]
strip_content(s2, keep_kw=["Title", "Slide Number", "Footer Placeholder",
                           "Rectangle 8", "Oval", "Picture 10"])
team_oval(s2)
set_title(s2, "Aasha Setu: one live loop — local risk to verified rescue", size=19)
takeaway(s2, "Three clients, one API, one real-time loop — a citizen's live risk becomes a verified, dispatched rescue.")

TOP = 1.66
BOT = 6.82
# --- left column : GAP / FIX
lx, lw = 0.36, 3.42
lh = (BOT - TOP - 0.16) / 2
card(s2, lx, TOP, lw, lh, "THE GAP TODAY", RED)
_, tf = tb(s2, lx + 0.12, TOP + 0.42, lw - 0.24, lh - 0.5)
for i, t in enumerate([
    "Hazard alerts, SOS, shelters and family status live in separate apps & hotlines",
    "Responders can't tell who needs help, where, or how urgently",
    "Unverified reports flood control rooms — no way to rank or trust them",
]):
    para(tf, t, size=9.5, color=INK, first=(i == 0), bullet=True, after=6, spacing=1.05)

card(s2, lx, TOP + lh + 0.16, lw, lh, "HOW AASHA SETU FIXES IT", GREEN)
_, tf = tb(s2, lx + 0.12, TOP + lh + 0.58, lw - 0.24, lh - 0.5)
for i, t in enumerate([
    "One place, updated in real time — no app-switching mid-emergency",
    "Every report carries GPS + photo/voice + a priority score",
    "Human-verified before dispatch — false alarms don't burn rescue capacity",
]):
    para(tf, t, size=9.5, color=INK, first=(i == 0), bullet=True, after=6, spacing=1.05)

# --- middle column : THE LOOP
mx, mw = 4.02, 5.42
card(s2, mx, TOP, mw, BOT - TOP, "THE LIVE LOOP", TEAL)
steps = [
    ("1  SEE", "Live local risk map + rainfall / flood / cyclone / landslide forecast for your exact GPS point"),
    ("2  RAISE", "One-tap Report, or a 3-second-hold SOS with photo, voice note and a fresh GPS fix"),
    ("3  PRIORITISE", "Auto-scored on the Command Centre queue: severity x people affected x zone risk x report age"),
    ("4  DISPATCH", "Operator verifies, then the nearest available responder is routed on an OSRM safe path"),
    ("5  CLOSE THE LOOP", "Status streams back live over SSE to the citizen, their family and their “I am safe” circle"),
]
sh = 0.80
gap = 0.075
sy = TOP + 0.46
for i, (h, d) in enumerate(steps):
    rect(s2, mx + 0.18, sy, mw - 0.36, sh, fill=BAND, line=LINE, lw=0.75)
    _, tf = tb(s2, mx + 0.32, sy + 0.03, mw - 0.62, sh - 0.06, anchor=MSO_ANCHOR.MIDDLE)
    rich(tf, [(h + "    ", TEAL, True), (d, INK, False)], size=9.5, first=True, after=0)
    if i < len(steps) - 1:
        tri = s2.shapes.add_shape(MSO_SHAPE.ISOSCELES_TRIANGLE,
                                  Inches(mx + mw / 2 - 0.10), Inches(sy + sh + 0.005),
                                  Inches(0.20), Inches(gap - 0.015))
        no_shadow(tri); tri.rotation = 180
        tri.fill.solid(); tri.fill.fore_color.rgb = TEAL; tri.line.fill.background()
    sy += sh + gap

# --- right column : USP
rx, rw = 9.58, 3.42
card(s2, rx, TOP, rw, BOT - TOP, "WHY IT'S DIFFERENT", NAVY)
usp = [
    ("One real-time loop", "SSE to every client — no Redis, no WebSocket infra to run"),
    ("Deterministic where lives are at stake", "Risk & priority are auditable pure functions; AI only recommends, a human approves"),
    ("Degrades, never fails", "Every external API follows real → cache → demo data"),
    ("Software + hardware", "Drone SAR camera (ESP32-CAM + YOLO11) feeds the same ops queue"),
]
uy = TOP + 0.46
ustep = (BOT - TOP - 0.5) / 4
for i, (h, d) in enumerate(usp):
    _, tf = tb(s2, rx + 0.16, uy, rw - 0.32, ustep)
    rich(tf, [("▸  " + h, TEAL, True)], size=10, first=True, after=2)
    para(tf, d, size=9, color=MUT, after=0, spacing=1.05)
    uy += ustep

# =======================================================================
# SLIDE 3 : TECHNICAL APPROACH
# =======================================================================
s3 = S[2]
strip_content(s3, keep_kw=["Title", "Slide Number", "Footer Placeholder",
                           "Rectangle 9", "Oval", "Picture 11"])
team_oval(s3)
set_title(s3, "TECHNICAL APPROACH")
takeaway(s3, "Open-source & API-first, deterministic core, deployed on free tiers — 103 backend tests green.")

# ---- left : architecture diagram
ax, aw = 0.36, 7.55
card(s3, ax, 1.70, aw, 5.05, "SYSTEM ARCHITECTURE", TEAL)
ix = ax + 0.18
iw = aw - 0.36

# clients row
cy = 2.16
cbw = (iw - 0.36) / 3
clients = ["Android app\nKotlin · Jetpack Compose", "Citizen PWA\nNext.js 16 · React 19", "Command Centre\nNext.js · MapLibre"]
for i, c in enumerate(clients):
    b = rect(s3, ix + i * (cbw + 0.18), cy, cbw, 0.66, fill=BAND, line=LINE, lw=0.75)
    _, tf = tb(s3, ix + i * (cbw + 0.18), cy + 0.03, cbw, 0.60, anchor=MSO_ANCHOR.MIDDLE)
    head, body = c.split("\n")
    para(tf, head, size=9, bold=True, color=NAVY, align=PP_ALIGN.CENTER, first=True, after=0)
    para(tf, body, size=7.6, color=MUT, align=PP_ALIGN.CENTER, after=0)
connect(s3, ix + iw / 2, cy + 0.66, ix + iw / 2, cy + 0.94, SLATE, 1.25)
_, tf = tb(s3, ix, cy + 0.90, iw, 0.24, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "HTTPS  ·  REST  ·  Server-Sent Events (live)", size=8, bold=True,
     color=SLATE, align=PP_ALIGN.CENTER, first=True, after=0)

# backend box
by = cy + 1.20
rect(s3, ix, by, iw, 1.34, fill=TEALBG, line=TEAL, lw=1.0)
_, tf = tb(s3, ix + 0.1, by + 0.05, iw - 0.2, 0.30)
para(tf, "FastAPI backend  (Python)", size=10, bold=True, color=TEAL, first=True, after=0)
chips = ["JWT auth · server-side roles", "Risk engine", "Priority engine",
         "Safe routing (OSRM)", "SSE broker · in-process pub/sub"]
chy = by + 0.40
cxx = ix + 0.10
for i, ch in enumerate(chips):
    wch = 2.34 if i % 2 == 0 else 2.30
    if i == 4:
        wch = 3.1
    b = rect(s3, cxx, chy, wch, 0.40, fill=WHITE, line=TEAL, lw=0.75)
    _, tf = tb(s3, cxx, chy + 0.02, wch, 0.36, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, ch, size=8, bold=True, color=INK, align=PP_ALIGN.CENTER, first=True, after=0)
    cxx += wch + 0.10
    if i == 2:
        cxx = ix + 0.10; chy += 0.46
connect(s3, ix + iw / 2, by + 1.34, ix + iw / 2, by + 1.60, SLATE, 1.25)

# data row
dy = by + 1.62
dbw = (iw - 0.18) / 2
rect(s3, ix, dy, dbw, 0.78, fill=GRNBG, line=GREEN, lw=1.0)
_, tf = tb(s3, ix + 0.08, dy + 0.04, dbw - 0.16, 0.70, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "PostgreSQL + PostGIS", size=9, bold=True, color=GREEN, first=True, after=0)
para(tf, "spatial queries · GIST indexes · Supabase", size=7.6, color=MUT, after=0)
rect(s3, ix + dbw + 0.18, dy, dbw, 0.78, fill=AMBBG, line=AMBER, lw=1.0)
_, tf = tb(s3, ix + dbw + 0.26, dy + 0.04, dbw - 0.16, 0.70, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "External-API gateway  (real → cache → demo)", size=8.6, bold=True, color=AMBER, first=True, after=0)
para(tf, "Open-Meteo · GloFAS · OSM Overpass · OSRM · Gemini", size=7.4, color=MUT, after=0)

# drone module
gy = dy + 0.92
rect(s3, ix, gy, iw, 0.62, fill=RGBColor(0xEE, 0xEA, 0xF3), line=SLATE, lw=0.9)
_, tf = tb(s3, ix + 0.1, gy + 0.03, iw - 0.2, 0.56, anchor=MSO_ANCHOR.MIDDLE)
rich(tf, [("Drone SAR module  ", NAVY, True),
          ("(hardware prototype):  ESP32-CAM MJPEG → YOLO11 person + yellow-marker detection → detections to Command Centre",
           INK, False)], size=8, first=True, after=0)

# ---- right : stack table + status
sx, sw = 8.12, 4.86
tech = [
    ["Layer", "Stack"],
    ["Frontend", "Next.js 16, React 19, TS, Tailwind v4, MapLibre GL"],
    ["Android", "Kotlin, Jetpack Compose, Hilt, Room, WorkManager"],
    ["Backend", "FastAPI, SQLAlchemy 2 + GeoAlchemy2, Pydantic v2"],
    ["Database", "PostgreSQL 16 + PostGIS 3.4"],
    ["Realtime", "Server-Sent Events + in-process broker"],
    ["Hardware / CV", "ESP32-CAM, Ultralytics YOLO11 (n/s)"],
    ["Hosting", "Vercel · Render · Supabase (free tier)"],
]
styled_table(s3, sx, 1.70, sw, 2.86, tech, col_w=[1.15, sw - 1.15], fs=8.6, hfs=9)

st = card(s3, sx, 4.72, sw, 2.03, "BUILD STATUS  (implemented vs prototyped)", NAVY)
_, tf = tb(s3, sx + 0.14, 5.08, sw - 0.28, 1.6)
rich(tf, [("Running now:  ", GREEN, True),
          ("citizen app ~90% of demo scope · Command Centre ~70% · live on Vercel + Render + Supabase · 103 backend tests",
           INK, False)], size=8.7, first=True, after=5, bullet=True)
rich(tf, [("Prototyped:  ", AMBER, True),
          ("drone person/marker CV, Gemini situation summary, AI confidence-scoring verification — human-in-the-loop by design",
           INK, False)], size=8.7, after=5, bullet=True)
rich(tf, [("Method:  ", TEAL, True),
          ("API-first · every integration behind the backend · deterministic core · realtime without extra infra",
           INK, False)], size=8.7, after=0, bullet=True)

# =======================================================================
# SLIDE 4 : FEASIBILITY AND VIABILITY
# =======================================================================
s4 = S[3]
strip_content(s4, keep_kw=["Title", "Slide Number", "Footer Placeholder",
                           "Rectangle 9", "Oval", "Picture 10"])
team_oval(s4)
set_title(s4, "FEASIBILITY AND VIABILITY")
takeaway(s4, "Zero paid-API cost, free hosting, and a graceful-degradation path for every failure mode.")

fy, fh = 1.70, 1.66
fbw = (12.97 - 0.36 * 2) / 3
feas = [
    ("TECHNICAL", TEAL, [
        "100% open-source stack; no paid API keys",
        "PostGIS does the spatial maths — no hand-rolled geo code",
        "Boots without a .env file; 103 tests; already deployed",
    ]),
    ("OPERATIONAL", NAVY, [
        "3 roles (citizen / responder / admin) on one typed API contract",
        "Auto-sign-in demo path; role re-checked on every request",
        "Degrades gracefully if venue Wi-Fi or a provider drops",
    ]),
    ("ECONOMIC", GREEN, [
        "Open-Meteo / OSM / OSRM are free at demo scale",
        "One codebase → 3 clients; scales on managed Postgres",
        "Runs on low-end Android (minSdk 26, ~99% reach)",
    ]),
]
for i, (h, col, items) in enumerate(feas):
    x = 0.36 + i * (fbw + 0.36)
    card(s4, x, fy, fbw, fh, h, col)
    _, tf = tb(s4, x + 0.12, fy + 0.40, fbw - 0.24, fh - 0.46)
    for j, t in enumerate(items):
        para(tf, t, size=8.8, color=INK, first=(j == 0), bullet=True, after=4, spacing=1.03)

# challenge -> strategy table
ty = fy + fh + 0.22
rows = [
    ["Challenge / risk", "Strategy to overcome it"],
    ["Connectivity fails during a disaster",
     "Offline reads (Room cache) + WorkManager SOS queue + downloadable offline map; drone/mesh relay as a designed fallback"],
    ["An external API goes down mid-demo",
     "real → cache → demo fallback chain, already implemented for every integration"],
    ["False / duplicate reports overwhelm the control room",
     "Confidence scoring + a mandatory human verify gate before any dispatch"],
    ["Traffic spikes / horizontal scale",
     "SSE broker contract is a drop-in for Redis; stateless JWT; GIST spatial indexes"],
    ["SOS location is inaccurate",
     "High-accuracy GPS fix captured during the 3-second hold; UI warns on coarse location"],
    ["Location-sharing privacy",
     "Opt-in only; server-authoritative roles; JWT encrypted at rest; no third-party key ever on a client"],
]
styled_table(s4, 0.36, ty, 12.6, 6.78 - ty, rows, col_w=[3.4, 12.6 - 3.4], fs=8.6, hfs=9.2)

# =======================================================================
# SLIDE 5 : IMPACT AND BENEFITS
# =======================================================================
s5 = S[4]
strip_content(s5, keep_kw=["Title", "Slide Number", "Footer Placeholder",
                           "Rectangle 9", "Oval", "Picture 10"])
team_oval(s5)
set_title(s5, "IMPACT AND BENEFITS")
takeaway(s5, "From scattered hotlines to one auditable loop — on a low-end phone, for any disaster type.")

# left : stakeholder cards
lx, lw2 = 0.36, 4.05
stake = [
    ("FOR CITIZENS", TEAL, [
        "Hazard forecast + risk for their exact location",
        "SOS with evidence that survives a dead network",
        "Nearest shelter / hospital; family safety status",
    ]),
    ("FOR RESPONDERS & AUTHORITIES", NAVY, [
        "One prioritised queue — act on the right case first",
        "Verified incidents only; nearest-responder + safe route",
        "Area-wide alerts + live situational picture",
    ]),
    ("FOR STATE DM AGENCIES", GREEN, [
        "Disaster-type-agnostic — new hazard = new type value",
        "Full audit trail for post-event review",
        "Deploys on free / low-cost managed infra",
    ]),
]
sy = 1.70
for i, (h, col, items) in enumerate(stake):
    hh = 1.50
    card(s5, lx, sy, lw2, hh, h, col)
    _, tf = tb(s5, lx + 0.12, sy + 0.38, lw2 - 0.24, hh - 0.42)
    for j, t in enumerate(items):
        para(tf, t, size=8.4, color=INK, first=(j == 0), bullet=True, after=3, spacing=1.02)
    sy += hh + 0.12

# right top : comparison table
cx, cw = 4.66, 8.31
comp = [
    ["Aspect", "Today", "With Aasha Setu"],
    ["Hazard info", "Generic city-wide bulletins", "Per-GPS-point, 4 hazards, live"],
    ["Who needs help", "Phone calls, guesswork", "Geotagged reports, ranked by priority"],
    ["Report trust", "Unverified, duplicated", "Confidence score + human verify gate"],
    ["Dispatch", "Manual radio coordination", "Nearest responder + OSRM safe route"],
    ["When network drops", "Nothing gets through", "Queued SOS + offline map + drone relay (designed)"],
]
styled_table(s5, cx, 1.70, cw, 2.60, comp, col_w=[1.5, 3.0, cw - 4.5], fs=8.4, hfs=8.8)

# right bottom : benefit columns
by = 4.46
bbw = (cw - 0.28) / 3
bens = [
    ("SOCIAL", TEAL, "Faster help; families reconnected via check-ins; equal access on free OSM maps + low-end phones"),
    ("ECONOMIC", NAVY, "No paid-API cost; open-source; reuses free hosting tiers; less duplicated field effort"),
    ("SYSTEMIC", GREEN, "One platform for every hazard; structured data trail enables post-disaster audit & learning"),
]
for i, (h, col, txt) in enumerate(bens):
    x = cx + i * (bbw + 0.14)
    card(s5, x, by, bbw, 1.86, h, col)
    _, tf = tb(s5, x + 0.12, by + 0.40, bbw - 0.24, 1.4)
    para(tf, txt, size=8.2, color=INK, first=True, after=0, spacing=1.04)

_, tf = tb(s5, 0.36, 6.50, 12.6, 0.32, anchor=MSO_ANCHOR.MIDDLE)
rich(tf, [("One warning  ·  one SOS  ·  one verified rescue — that is the loop.", NAVY, True)],
     size=11, align=PP_ALIGN.CENTER, first=True, after=0)

# =======================================================================
# SLIDE 6 : RESEARCH AND REFERENCES
# =======================================================================
s6 = S[5]
strip_content(s6, keep_kw=["Title", "Slide Number", "Footer Placeholder",
                           "Rectangle 9", "Oval", "Picture 11"])
team_oval(s6)
set_title(s6, "RESEARCH AND REFERENCES")
takeaway(s6, "Built entirely on open data, open standards and open-source frameworks.")

colw = 6.28
ch = 2.48
c1 = card(s6, 0.36, 1.74, colw, ch, "DATA & APIs  (all free / open)", TEAL)
_, tf = tb(s6, 0.54, 2.26, colw - 0.34, ch - 0.6)
for i, t in enumerate([
    "Open-Meteo — weather + flood (GloFAS river discharge) · open-meteo.com",
    "OpenStreetMap / Overpass API · openstreetmap.org",
    "OSRM routing engine · project-osrm.org",
    "Google Gemini API · ai.google.dev",
]):
    para(tf, t, size=10.5, color=INK, first=(i == 0), bullet=True, after=12, spacing=1.05)

c2 = card(s6, 0.36 + colw + 0.4, 1.74, colw, ch, "DOMAIN & STANDARDS", NAVY)
_, tf = tb(s6, 0.54 + colw + 0.4, 2.26, colw - 0.34, ch - 0.6)
for i, t in enumerate([
    "NDMA National Disaster Management Guidelines · ndma.gov.in",
    "Common Alerting Protocol (CAP) · Sachet · sachet.ndma.gov.in",
    "ISRO Bhuvan geoplatform · bhuvan.nrsc.gov.in",
    "Ultralytics YOLO11 — aerial person detection · docs.ultralytics.com",
]):
    para(tf, t, size=10.5, color=INK, first=(i == 0), bullet=True, after=12, spacing=1.05)

c3y = 1.74 + ch + 0.30
c3 = card(s6, 0.36, c3y, 12.6, 2.12, "FRAMEWORKS & PROJECT", GREEN)
_, tf = tb(s6, 0.54, c3y + 0.50, 12.3, 1.5)
para(tf, "Frameworks:  FastAPI · PostGIS · SQLAlchemy + GeoAlchemy2 · Next.js · Jetpack Compose · MapLibre GL · Ultralytics YOLO11",
     size=10.5, color=INK, first=True, bullet=True, after=13, spacing=1.05)
para(tf, "Prototype code:  computer-vision scripts in  ml/computer_vision/   ·   Gemini situation summary in  ml/nlp/",
     size=10.5, color=INK, bullet=True, after=13, spacing=1.05)
para(tf, "Project links:  code repository  ·  live citizen app  ·  Command Centre dashboard  ·  docs/ARCHITECTURE.md      [ add URLs before PDF upload ]",
     size=10.5, color=INK, bullet=True, after=0, spacing=1.05)

# -------------------------------------------------- drop instructions slide
delete_slide(prs, 6)

prs.save(OUT)
print("saved", OUT, "slides:", len(prs.slides.__iter__.__self__._sldIdLst))
