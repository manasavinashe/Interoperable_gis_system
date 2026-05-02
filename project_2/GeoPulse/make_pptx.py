"""
Generate GeoPulse presentation as PPTX.
Run: python make_pptx.py
Output: GeoPulse_Presentation.pptx
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import copy

# ── Colours ──────────────────────────────────────────────────────────────────
BG        = RGBColor(0x0f, 0x14, 0x23)   # dark navy
BG2       = RGBColor(0x16, 0x1c, 0x2e)   # card bg
ACCENT    = RGBColor(0x0f, 0xd6, 0xc2)   # teal
ACCENT2   = RGBColor(0x4f, 0x6e, 0xf7)   # blue
WARN      = RGBColor(0xfb, 0x92, 0x3c)   # orange
GREEN     = RGBColor(0x4a, 0xde, 0x80)   # green
WHITE     = RGBColor(0xff, 0xff, 0xff)
GREY      = RGBColor(0x94, 0xa3, 0xb8)
LIGHT     = RGBColor(0xcb, 0xd5, 0xe1)
BORDER    = RGBColor(0x2a, 0x35, 0x50)

# ── Slide dimensions (widescreen 16:9) ───────────────────────────────────────
W = Inches(13.33)
H = Inches(7.5)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H

BLANK = prs.slide_layouts[6]   # completely blank layout


# ── Helpers ───────────────────────────────────────────────────────────────────

def add_slide():
    slide = prs.slides.add_slide(BLANK)
    # dark background
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = BG
    return slide


def txb(slide, text, x, y, w, h,
        size=18, bold=False, color=WHITE, align=PP_ALIGN.LEFT,
        italic=False, wrap=True):
    """Add a simple text box."""
    shape = slide.shapes.add_textbox(x, y, w, h)
    tf = shape.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return shape


def heading(slide, title, subtitle=None):
    """Standard slide heading with teal underline."""
    txb(slide, title,
        Inches(0.5), Inches(0.25), Inches(12.33), Inches(0.6),
        size=28, bold=True, color=ACCENT)
    # underline rule
    line = slide.shapes.add_shape(
        1,  # rectangle
        Inches(0.5), Inches(0.88), Inches(12.33), Inches(0.025))
    line.fill.solid(); line.fill.fore_color.rgb = ACCENT
    line.line.fill.background()
    if subtitle:
        txb(slide, subtitle,
            Inches(0.5), Inches(0.95), Inches(12.33), Inches(0.4),
            size=13, color=GREY)


def card(slide, x, y, w, h, title, bullets, title_color=ACCENT):
    """Rounded card with title + bullet list."""
    box = slide.shapes.add_shape(1, x, y, w, h)
    box.fill.solid(); box.fill.fore_color.rgb = BG2
    box.line.color.rgb = BORDER

    ty = y + Inches(0.08)
    txb(slide, title, x + Inches(0.15), ty,
        w - Inches(0.3), Inches(0.35),
        size=13, bold=True, color=title_color)

    tf_shape = slide.shapes.add_textbox(
        x + Inches(0.15), ty + Inches(0.38),
        w - Inches(0.3), h - Inches(0.55))
    tf = tf_shape.text_frame
    tf.word_wrap = True
    first = True
    for b in bullets:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.alignment = PP_ALIGN.LEFT
        run = p.add_run()
        run.text = ("▸ " if b and not b.startswith("  ") else "") + b
        run.font.size = Pt(11)
        run.font.color.rgb = LIGHT


def code_box(slide, code_text, x, y, w, h):
    """Dark code block."""
    box = slide.shapes.add_shape(1, x, y, w, h)
    box.fill.solid(); box.fill.fore_color.rgb = RGBColor(0x0a, 0x0e, 0x1a)
    box.line.color.rgb = BORDER

    tf_shape = slide.shapes.add_textbox(
        x + Inches(0.15), y + Inches(0.12),
        w - Inches(0.3), h - Inches(0.24))
    tf = tf_shape.text_frame
    tf.word_wrap = False
    first = True
    for line in code_text.strip().split("\n"):
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        run = p.add_run()
        run.text = line
        run.font.size = Pt(9.5)
        run.font.name = "Courier New"
        run.font.color.rgb = RGBColor(0xf8, 0xf8, 0xf2)


def tag_box(slide, label, x, y, color=ACCENT, bg=None):
    """Small coloured tag."""
    r, g, b = color[0], color[1], color[2]   # RGBColor is a tuple subclass
    box = slide.shapes.add_shape(1, x, y, Inches(1.1), Inches(0.28))
    box.fill.solid(); box.fill.fore_color.rgb = RGBColor(r // 6, g // 6, b // 6)
    box.line.color.rgb = color
    txb(slide, label, x + Inches(0.06), y + Inches(0.02),
        Inches(0.98), Inches(0.24),
        size=9, bold=True, color=color, align=PP_ALIGN.CENTER)


def flow_box(slide, label, sublabel, x, y, w=Inches(2.0), border_color=ACCENT2):
    box = slide.shapes.add_shape(1, x, y, w, Inches(0.85))
    box.fill.solid(); box.fill.fore_color.rgb = RGBColor(0x16, 0x1c, 0x2e)
    box.line.color.rgb = border_color
    txb(slide, label,
        x + Inches(0.1), y + Inches(0.06),
        w - Inches(0.2), Inches(0.35),
        size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    if sublabel:
        txb(slide, sublabel,
            x + Inches(0.1), y + Inches(0.42),
            w - Inches(0.2), Inches(0.35),
            size=9, color=GREY, align=PP_ALIGN.CENTER)


def arrow(slide, x, y, vertical=False):
    if vertical:
        txb(slide, "↓", x, y, Inches(0.4), Inches(0.4),
            size=18, color=ACCENT, align=PP_ALIGN.CENTER)
    else:
        txb(slide, "→", x, y, Inches(0.4), Inches(0.4),
            size=18, color=ACCENT, align=PP_ALIGN.CENTER)


def table(slide, headers, rows, x, y, w, h, col_widths=None):
    n_cols = len(headers)
    n_rows = len(rows) + 1
    t = slide.shapes.add_table(n_rows, n_cols, x, y, w, h).table

    if col_widths:
        for i, cw in enumerate(col_widths):
            t.columns[i].width = cw

    row_h = h // n_rows
    for ri in range(n_rows):
        t.rows[ri].height = row_h

    # header row
    for ci, hdr in enumerate(headers):
        cell = t.cell(0, ci)
        cell.fill.solid(); cell.fill.fore_color.rgb = RGBColor(0x1a, 0x28, 0x40)
        p = cell.text_frame.paragraphs[0]
        run = p.add_run(); run.text = hdr
        run.font.size = Pt(11); run.font.bold = True
        run.font.color.rgb = ACCENT
        cell.text_frame.paragraphs[0].alignment = PP_ALIGN.LEFT

    for ri, row_data in enumerate(rows, 1):
        for ci, val in enumerate(row_data):
            cell = t.cell(ri, ci)
            bg = RGBColor(0x12, 0x18, 0x2a) if ri % 2 == 0 else BG2
            cell.fill.solid(); cell.fill.fore_color.rgb = bg
            p = cell.text_frame.paragraphs[0]
            run = p.add_run(); run.text = val
            run.font.size = Pt(10); run.font.color.rgb = LIGHT


# ═════════════════════════════════════════════════════════════════════════════
#  SLIDES
# ═════════════════════════════════════════════════════════════════════════════

# ── Slide 1: Title ────────────────────────────────────────────────────────────
s = add_slide()
txb(s, "◈", Inches(6.4), Inches(0.7), Inches(1.0), Inches(0.9),
    size=42, color=ACCENT, align=PP_ALIGN.CENTER)
txb(s, "GeoPulse",
    Inches(2.0), Inches(1.5), Inches(9.33), Inches(1.1),
    size=54, bold=True, color=ACCENT, align=PP_ALIGN.CENTER)
txb(s, "An OGC-Compliant Geospatial Web Portal",
    Inches(2.0), Inches(2.55), Inches(9.33), Inches(0.5),
    size=20, color=ACCENT2, align=PP_ALIGN.CENTER)
# divider
div = s.shapes.add_shape(1, Inches(3.5), Inches(3.15), Inches(6.33), Inches(0.03))
div.fill.solid(); div.fill.fore_color.rgb = BORDER
div.line.fill.background()
txb(s, "GNR629  ·  Project 2  ·  CSRE, IIT Bombay",
    Inches(2.0), Inches(3.3), Inches(9.33), Inches(0.4),
    size=14, color=GREY, align=PP_ALIGN.CENTER)
txb(s, "Manas Avinashe  ·  2026",
    Inches(2.0), Inches(3.75), Inches(9.33), Inches(0.4),
    size=13, color=GREY, align=PP_ALIGN.CENTER)
for i, (lbl, col) in enumerate([
    ("OGC WMS", ACCENT2), ("OGC WFS", WARN),
    ("OGC SOS 2.0", ACCENT), ("O&M · SensorML", GREEN)
]):
    tag_box(s, lbl, Inches(2.6 + i * 1.9), Inches(4.55), col)


# ── Slide 2: What We Built ────────────────────────────────────────────────────
s = add_slide()
heading(s, "What We Built",
        "A unified portal for two OGC projects — one URL, two services")

card(s, Inches(0.5), Inches(1.3), Inches(5.9), Inches(4.6),
     "🗺  OGC Tab — Project 1", [
     "WMS GetCapabilities",
     "WFS GetCapabilities & GetFeature",
     "Live OpenLayers map",
     "Layer management + BBOX draw",
     "GeoServer integration (port 8080)",
])
card(s, Inches(6.9), Inches(1.3), Inches(5.93), Inches(4.6),
     "📡  SOS Tab — Project 2", [
     "OGC SOS 2.0 operations",
     "25 global weather sensor stations",
     "Spatial + temporal + parameter filters",
     "Interactive map with temperature markers",
     "Live Chart.js charts & data table",
])
txb(s, "Both projects served from a single URL:  http://127.0.0.1:8000",
    Inches(1.5), Inches(6.1), Inches(10.33), Inches(0.4),
    size=12, color=ACCENT, align=PP_ALIGN.CENTER)


# ── Slide 3: The Problem ──────────────────────────────────────────────────────
s = add_slide()
heading(s, "The Problem — Why Do We Need OGC SOS?")

card(s, Inches(0.5), Inches(1.3), Inches(5.9), Inches(3.6),
     "Without Standards", [
     "Every sensor vendor uses a different API",
     "Data formats incompatible across systems",
     "No uniform way to query multiple sources",
     "Vendor lock-in everywhere",
], title_color=WARN)
card(s, Inches(6.9), Inches(1.3), Inches(5.93), Inches(3.6),
     "With OGC SOS 2.0", [
     "Universal operations: GetCapabilities,",
     "  DescribeSensor, GetObservation",
     "Standardised XML responses (O&M)",
     "Any compliant client ↔ any server",
     "Interoperability by design",
], title_color=GREEN)

box = s.shapes.add_shape(1, Inches(0.5), Inches(5.15), Inches(12.33), Inches(0.85))
box.fill.solid(); box.fill.fore_color.rgb = RGBColor(0x07, 0x2a, 0x27)
box.line.color.rgb = ACCENT
txb(s, "GeoPulse implements the SOS 2.0 operation structure on top of real historical "
       "weather data, making it queryable by any OGC-aware tool.",
    Inches(0.7), Inches(5.25), Inches(11.93), Inches(0.65),
    size=13, color=ACCENT)


# ── Slide 4: Standards Stack ──────────────────────────────────────────────────
s = add_slide()
heading(s, "The OGC Standards Stack",
        "Three standards working together in this project")

card(s, Inches(0.5), Inches(1.3), Inches(3.9), Inches(5.3),
     "SOS — Sensor Observation Service", [
     "Defines HOW to ask for data",
     "",
     "Three core operations:",
     "  GetCapabilities",
     "  DescribeSensor",
     "  GetObservation",
     "",
     "Specifies allowed filters,",
     "response format, service metadata",
], title_color=ACCENT)

card(s, Inches(4.7), Inches(1.3), Inches(3.9), Inches(5.3),
     "O&M — Observations & Measurements", [
     "Defines WHAT a reading looks like",
     "",
     "Every observation has:",
     "  featureOfInterest (where)",
     "  observedProperty (what)",
     "  procedure (which sensor)",
     "  phenomenonTime (when)",
     "  result (the value + unit)",
], title_color=GREEN)

card(s, Inches(8.9), Inches(1.3), Inches(3.93), Inches(5.3),
     "SensorML — Sensor Model Language", [
     "Defines the sensor's IDENTITY",
     "",
     "For each sensor describes:",
     "  Unique identifier",
     "  Physical location (GML Point)",
     "  Output capabilities",
     "  Units of measurement",
     "",
     "Our file: 10 sensors described",
], title_color=ACCENT2)


# ── Slide 5: Architecture ─────────────────────────────────────────────────────
s = add_slide()
heading(s, "System Architecture")

# Row 1
flow_box(s, "Browser", "index.html\nsos.js / map.js",
         Inches(0.6), Inches(1.6), Inches(2.5), ACCENT)
arrow(s, Inches(3.2), Inches(1.88))
txb(s, "HTTP GET\nfetch()", Inches(3.1), Inches(2.28), Inches(0.85), Inches(0.4),
    size=8, color=GREY, align=PP_ALIGN.CENTER)

flow_box(s, "FastAPI", "main.py\nport 8000",
         Inches(3.7), Inches(1.6), Inches(2.5), ACCENT2)
arrow(s, Inches(6.3), Inches(1.88))
txb(s, "SQL query", Inches(6.2), Inches(2.28), Inches(0.85), Inches(0.3),
    size=8, color=GREY, align=PP_ALIGN.CENTER)

flow_box(s, "SQLite DB", "weather.db\n17,775 rows",
         Inches(6.8), Inches(1.6), Inches(2.5), WARN)

flow_box(s, "SensorML", "sensorml.xml\nstatic file",
         Inches(9.9), Inches(1.6), Inches(2.83), ACCENT)

# Row 2
txb(s, "↓  XML Response (O&M structured)", Inches(3.7), Inches(2.7),
    Inches(3.5), Inches(0.4), size=11, color=ACCENT)

flow_box(s, "XML / JSON", "application/xml\napplication/json",
         Inches(3.7), Inches(3.2), Inches(2.5), GREEN)
arrow(s, Inches(6.3), Inches(3.48))
txb(s, "DOMParser\nparse → render", Inches(6.2), Inches(3.5), Inches(0.9), Inches(0.4),
    size=8, color=GREY, align=PP_ALIGN.CENTER)

flow_box(s, "Map Markers", "OpenLayers\ntemperature colour",
         Inches(6.8), Inches(3.2), Inches(2.5), GREEN)
flow_box(s, "Charts", "Chart.js\nbar + doughnut",
         Inches(9.5), Inches(3.2), Inches(3.23), GREEN)

# Stats row
for i, (num, lbl) in enumerate([
    ("25", "sensor stations"),
    ("~17k", "observations"),
    ("5", "parameters"),
    ("3", "SOS operations"),
]):
    bx = s.shapes.add_shape(1,
        Inches(0.5 + i * 3.2), Inches(4.4), Inches(2.9), Inches(0.85))
    bx.fill.solid(); bx.fill.fore_color.rgb = RGBColor(0x0c, 0x1a, 0x2e)
    bx.line.color.rgb = BORDER
    txb(s, num, Inches(0.5 + i * 3.2), Inches(4.42), Inches(2.9), Inches(0.45),
        size=26, bold=True, color=ACCENT, align=PP_ALIGN.CENTER)
    txb(s, lbl, Inches(0.5 + i * 3.2), Inches(4.86), Inches(2.9), Inches(0.3),
        size=10, color=GREY, align=PP_ALIGN.CENTER)


# ── Slide 6: Data Pipeline ────────────────────────────────────────────────────
s = add_slide()
heading(s, "The Data Pipeline",
        "Real historical weather data, curated for proper time-series structure")

flow_box(s, "GlobalWeatherRepository.csv",
         "138,583 rows · 257 cities · 35 MB",
         Inches(0.3), Inches(1.5), Inches(3.4), GREY)
arrow(s, Inches(3.82), Inches(1.76))
txb(s, "process_data.py\nselect 25 cities", Inches(3.75), Inches(2.18),
    Inches(1.1), Inches(0.4), size=9, color=GREY, align=PP_ALIGN.CENTER)

flow_box(s, "cleaned_weather.csv",
         "17,775 rows · 2 MB",
         Inches(4.9), Inches(1.5), Inches(3.0), ACCENT2)
arrow(s, Inches(8.02), Inches(1.76))
txb(s, "db_setup.py", Inches(7.96), Inches(2.18),
    Inches(0.9), Inches(0.3), size=9, color=GREY, align=PP_ALIGN.CENTER)

flow_box(s, "weather.db",
         "SQLite · 1.7 MB",
         Inches(9.0), Inches(1.5), Inches(3.0), WARN)

# Problem callout
box2 = s.shapes.add_shape(1, Inches(0.3), Inches(2.75), Inches(12.73), Inches(1.0))
box2.fill.solid(); box2.fill.fore_color.rgb = RGBColor(0x18, 0x10, 0x08)
box2.line.color.rgb = WARN
txb(s, "⚠  Original data issue: raw dataset used df.sample(5000) — random sampling "
       "destroyed time-series continuity.\n"
       "Fix: rewrote process_data.py to select 25 specific cities and keep ALL their readings (~710 each).",
    Inches(0.5), Inches(2.82), Inches(12.33), Inches(0.86),
    size=11, color=LIGHT)

# 5 parameters
txb(s, "5 Observed Parameters",
    Inches(0.3), Inches(4.1), Inches(4.0), Inches(0.4),
    size=14, bold=True, color=ACCENT)
for i, (param, unit, col) in enumerate([
    ("Temperature", "°C", ACCENT),
    ("Humidity", "%", ACCENT2),
    ("Wind Speed", "kph", GREEN),
    ("Pressure", "mb", WARN),
    ("Precipitation", "mm", GREY),
]):
    bx = s.shapes.add_shape(1,
        Inches(0.3 + i * 2.55), Inches(4.65), Inches(2.35), Inches(0.75))
    bx.fill.solid(); bx.fill.fore_color.rgb = BG2
    bx.line.color.rgb = col
    txb(s, param, Inches(0.3 + i * 2.55), Inches(4.68),
        Inches(2.35), Inches(0.38),
        size=12, bold=True, color=col, align=PP_ALIGN.CENTER)
    txb(s, unit, Inches(0.3 + i * 2.55), Inches(5.03),
        Inches(2.35), Inches(0.28),
        size=10, color=GREY, align=PP_ALIGN.CENTER)


# ── Slide 7: 25 Sensors ───────────────────────────────────────────────────────
s = add_slide()
heading(s, "25 Global Sensor Stations",
        "Geographically distributed — one sensor_id per city (e.g. Tokyo_Japan)")

table(s,
    ["Region", "Cities", "Count"],
    [
        ["Asia",        "Tokyo, New Delhi, Beijing, Bangkok, Singapore, Tehran",  "6"],
        ["Europe",      "Berlin, Rome, Warsaw, Moscow, London",                   "5"],
        ["Africa",      "Cairo, Nairobi, Dakar, Accra, Pretoria",                 "5"],
        ["Americas",    "Ottawa, Mexico City, Lima, Buenos Aires, Montevideo",    "5"],
        ["Middle East", "Riyadh, Muscat",                                         "2"],
        ["Oceania",     "Canberra, Wellington",                                   "2"],
    ],
    Inches(0.5), Inches(1.3), Inches(12.33), Inches(4.3),
    col_widths=[Inches(1.8), Inches(8.8), Inches(1.0)],
)

box3 = s.shapes.add_shape(1, Inches(0.5), Inches(5.85), Inches(12.33), Inches(0.7))
box3.fill.solid(); box3.fill.fore_color.rgb = RGBColor(0x07, 0x1e, 0x2a)
box3.line.color.rgb = ACCENT
txb(s, "Each sensor_id links a DB row (O&M procedure) to its SensorML <System> entry — "
       "~710 readings per station · timestamps 2024-05-16 → 2026-04-30",
    Inches(0.7), Inches(5.93), Inches(11.93), Inches(0.55),
    size=12, color=ACCENT)


# ── Slide 8: SensorML ─────────────────────────────────────────────────────────
s = add_slide()
heading(s, "SensorML — DescribeSensor",
        "GET /sos/sensor  →  the sensor's identity document (served as static XML file)")

code_box(s, """\
<SensorML xmlns="http://www.opengis.net/sensorml/2.0"
          xmlns:gml="http://www.opengis.net/gml/3.2">
  <member>
    <System>
      <identifier>Tokyo_Japan</identifier>          <!-- unique sensor ID -->
      <description>Weather sensor in Tokyo, Japan</description>

      <location>
        <gml:Point srsName="EPSG:4326">             <!-- coordinate reference system -->
          <gml:coordinates>139.69,35.69</gml:coordinates>
        </gml:Point>
      </location>

      <outputs>
        <OutputList>
          <output name="temperature" unit="Celsius"/>
          <output name="humidity"    unit="%"/>
          <output name="wind_speed"  unit="kph"/>
          <output name="pressure"    unit="mb"/>
        </OutputList>
      </outputs>
    </System>
  </member>
</SensorML>""",
    Inches(0.5), Inches(1.25), Inches(7.5), Inches(5.4))

card(s, Inches(8.2), Inches(1.25), Inches(4.63), Inches(2.4),
     "Key Elements", [
     "identifier — unique sensor ID",
     "gml:Point — location in EPSG:4326",
     "OutputList — what it measures + units",
     "srsName — coordinate system declaration",
])
card(s, Inches(8.2), Inches(3.85), Inches(4.63), Inches(2.8),
     "Our Implementation", [
     "10 representative sensors described",
     "Covers all 6 continents",
     "Served as a static file (not from DB)",
     "In full istSOS: dynamic, DB-backed",
     "sensor_id links to DB via O&M procedure",
])


# ── Slide 9: GetCapabilities ──────────────────────────────────────────────────
s = add_slide()
heading(s, "GetCapabilities — Service Discovery",
        "GET /sos/capabilities  →  answers: what can this service do?")

code_box(s, """\
<Capabilities version="2.0.0"
              xmlns:sos="http://www.opengis.net/sos/2.0">
  <ServiceIdentification>
    <Title>GeoPulse Sensor Observation Service</Title>
    <ServiceType>OGC:SOS</ServiceType>
    <ServiceTypeVersion>2.0.0</ServiceTypeVersion>
  </ServiceIdentification>

  <OperationsMetadata>
    <Operation name="GetCapabilities"/>
    <Operation name="DescribeSensor"/>
    <Operation name="GetObservation">
      <Parameter name="param">
        <AllowedValues>
          <Value>temperature</Value>
          <Value>humidity</Value>
          <Value>wind_speed</Value>
          <Value>pressure</Value>
          <Value>precipitation</Value>
        </AllowedValues>
      </Parameter>
    </Operation>
  </OperationsMetadata>

  <ObservationOfferingList>
    <ObservationOffering>
      <identifier>weather_global</identifier>
      <responseFormat>application/xml</responseFormat>
      <responseFormat>application/json</responseFormat>
    </ObservationOffering>
  </ObservationOfferingList>
</Capabilities>""",
    Inches(0.5), Inches(1.25), Inches(7.5), Inches(5.9))

card(s, Inches(8.2), Inches(1.25), Inches(4.63), Inches(2.4),
     "Three sections", [
     "ServiceIdentification — who we are",
     "OperationsMetadata — what we support",
     "ObservationOfferingList — the datasets",
])
card(s, Inches(8.2), Inches(3.85), Inches(4.63), Inches(2.4),
     "Why it matters", [
     "A client can discover this service",
     "without prior knowledge of its API",
     "Standard structure = any OGC tool",
     "can parse it automatically",
])


# ── Slide 10: GetObservation filters ─────────────────────────────────────────
s = add_slide()
heading(s, "GetObservation — Three Filter Dimensions",
        "GET /sos/observations  —  all filters are optional and combinable")

card(s, Inches(0.5), Inches(1.3), Inches(3.9), Inches(3.5),
     "🌍  Spatial", [
     "country=Japan",
     "  case-insensitive exact match",
     "",
     "bbox=60,10,140,50",
     "  minLon, minLat, maxLon, maxLat",
     "  EPSG:4326",
     "",
     "Draw tool fills bbox from map",
])

card(s, Inches(4.7), Inches(1.3), Inches(3.9), Inches(3.5),
     "⏱  Temporal", [
     "after=2025-01-01 00:00:00",
     "  returns everything after",
     "",
     "start=2025-01-01",
     "end=2025-03-31",
     "  time window (inclusive)",
     "",
     "datetime-local inputs in UI",
])

card(s, Inches(8.9), Inches(1.3), Inches(3.93), Inches(3.5),
     "📊  Parameter Filter", [
     "param=temperature",
     "  temperature / humidity /",
     "  wind_speed / pressure /",
     "  precipitation",
     "",
     "op=gt  value=30",
     "Operators: eq neq lt lte",
     "          gt gte between",
])

box4 = s.shapes.add_shape(1, Inches(0.5), Inches(5.05), Inches(12.33), Inches(0.9))
box4.fill.solid(); box4.fill.fore_color.rgb = RGBColor(0x07, 0x1e, 0x2a)
box4.line.color.rgb = ACCENT
txb(s, "Example: Asian sensors where temperature was between 30–40°C in Jan 2025\n"
       "/sos/observations?bbox=60,5,150,55&param=temperature&op=between&value=30&value2=40&start=2025-01-01&end=2025-01-31",
    Inches(0.7), Inches(5.12), Inches(11.93), Inches(0.76),
    size=11, color=ACCENT)


# ── Slide 11: SQL Engine ──────────────────────────────────────────────────────
s = add_slide()
heading(s, "Dynamic SQL — Safe Parameterized Queries",
        "How URL filters become database queries in main.py")

code_box(s, """\
conditions = []
bind_params = []

# Spatial
if country:
    conditions.append("LOWER(country) = LOWER(?)")
    bind_params.append(country)

if bbox:
    min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(","))
    conditions.append("longitude BETWEEN ? AND ?")
    conditions.append("latitude  BETWEEN ? AND ?")
    bind_params += [min_lon, max_lon, min_lat, max_lat]

# Temporal
if start:
    conditions.append("timestamp >= ?")
    bind_params.append(start)

# Parameter filter (param validated against allowlist — no injection risk)
if param in ALLOWED_PARAMS and op == "between":
    conditions.append(f"{param} BETWEEN ? AND ?")
    bind_params += [value, value2]

# Build and execute
where = "WHERE " + " AND ".join(conditions) if conditions else ""
sql   = f"SELECT * FROM observations {where} LIMIT ?"
bind_params.append(limit)
rows  = conn.execute(sql, bind_params).fetchall()""",
    Inches(0.5), Inches(1.25), Inches(7.8), Inches(5.7))

card(s, Inches(8.5), Inches(1.25), Inches(4.33), Inches(2.6),
     "Security: SQL Injection Prevention", [
     "? placeholders keep values",
     "separate from the SQL string",
     "",
     "User input NEVER pasted",
     "directly into SQL",
     "",
     "param column name validated",
     "against an explicit allowlist",
])
card(s, Inches(8.5), Inches(4.05), Inches(4.33), Inches(2.9),
     "Response Formats", [
     "fmt=xml (default):",
     "  rows_to_xml() wraps each",
     "  row in <Observation> tags",
     "",
     "fmt=json:",
     "  FastAPI returns list of",
     "  dicts directly as JSON",
])


# ── Slide 12: O&M Mapping ─────────────────────────────────────────────────────
s = add_slide()
heading(s, "O&M — Observations & Measurements",
        "How our SQLite rows map to the ISO 19156 / OGC standard")

table(s,
    ["O&M Concept", "Definition", "Our Database Column"],
    [
        ["featureOfInterest", "The place being observed",
         "location_name, latitude, longitude"],
        ["observedProperty",  "What is being measured",
         "column name: temperature / humidity / ..."],
        ["procedure",         "The sensor that made the observation",
         "sensor_id  →  links to SensorML <System>"],
        ["phenomenonTime",    "When the observation was made",
         "timestamp  (e.g. '2025-01-15 11:30:00')"],
        ["result",            "The measured value + unit",
         "numeric value + unit declared in SensorML"],
    ],
    Inches(0.5), Inches(1.3), Inches(12.33), Inches(3.8),
    col_widths=[Inches(2.5), Inches(3.8), Inches(5.5)],
)

box5 = s.shapes.add_shape(1, Inches(0.5), Inches(5.35), Inches(12.33), Inches(1.35))
box5.fill.solid(); box5.fill.fore_color.rgb = RGBColor(0x07, 0x1e, 0x2a)
box5.line.color.rgb = ACCENT
txb(s, "XML output from /sos/observations:", Inches(0.7), Inches(5.4),
    Inches(4.0), Inches(0.35), size=11, bold=True, color=ACCENT)
code_box(s,
    "<Observations count=\"30\">  <Observation>  <location_name>Berlin</location_name>"
    "  <temperature>6.3</temperature>  <timestamp>2025-01-01 11:30:00</timestamp>"
    "  <sensor_id>Berlin_Germany</sensor_id>  </Observation>  ...</Observations>",
    Inches(0.5), Inches(5.82), Inches(12.33), Inches(0.75))


# ── Slide 13: Backend ─────────────────────────────────────────────────────────
s = add_slide()
heading(s, "Backend — FastAPI",
        "Python web framework: each URL is a decorated function")

code_box(s, """\
# @app.get decorates a function to handle an HTTP GET at that path

@app.get("/sos/capabilities")
def get_capabilities():
    return Response(content=xml_string, media_type="application/xml")

@app.get("/sos/sensor")
def describe_sensor():
    with open("sensorml.xml") as f:
        return Response(content=f.read(), media_type="application/xml")

@app.get("/sos/sensors")
def get_sensors():
    rows = conn.execute("SELECT sensor_id, AVG(lat)... GROUP BY sensor_id")
    return [dict(r) for r in rows]   # FastAPI auto-converts to JSON

@app.get("/sos/observations")
def get_observations(country=None, bbox=None, start=None, ...):
    # ... build SQL, return XML or JSON

# Frontend static files served at /app  (MUST be last — after all API routes)
app.mount("/app", StaticFiles(directory="../frontend"), name="frontend")""",
    Inches(0.5), Inches(1.25), Inches(7.8), Inches(5.0))

card(s, Inches(8.5), Inches(1.25), Inches(4.33), Inches(2.3),
     "SOS Operations → Endpoints", [
     "GetCapabilities → /sos/capabilities",
     "DescribeSensor  → /sos/sensor",
     "GetObservation  → /sos/observations",
     "  (custom)      → /sos/sensors",
])
card(s, Inches(8.5), Inches(3.75), Inches(4.33), Inches(2.5),
     "Key middleware", [
     "CORSMiddleware — allows browser",
     "  to call API from any origin",
     "",
     "StaticFiles — serves the whole",
     "  frontend at /app/",
     "  single port for everything",
])


# ── Slide 14: Frontend Architecture ──────────────────────────────────────────
s = add_slide()
heading(s, "Frontend Architecture",
        "Pure HTML / CSS / JS — no framework, loads in any browser")

for i, (fname, desc) in enumerate([
    ("index.html",     "UI skeleton. Two tab divs: #ogcTab and #sosTab. Only one visible at a time via tabs.js."),
    ("tabs.js",        "Switches between OGC and SOS tabs. Initialises the SOS OpenLayers map on first open."),
    ("sos.js",         "Entire SOS tab brain: map init, fetch pipeline, XML parser, table builder, Chart.js charts."),
    ("map.js",         "OGC tab map. OpenLayers base + WMS layer add/remove + BBOX draw interaction."),
    ("ogcRequests.js", "WMS/WFS request builders — constructs GetCapabilities, GetMap, GetFeature URLs."),
    ("config.js",      "Shared globals: setStatus() updates header dot; showNotification() shows toast popups."),
]):
    row_y = Inches(1.3 + i * 0.9)
    bx = s.shapes.add_shape(1, Inches(0.5), row_y, Inches(2.5), Inches(0.7))
    bx.fill.solid(); bx.fill.fore_color.rgb = BG2
    bx.line.color.rgb = ACCENT
    txb(s, fname, Inches(0.6), row_y + Inches(0.18), Inches(2.3), Inches(0.35),
        size=12, bold=True, color=ACCENT)
    txb(s, desc, Inches(3.2), row_y + Inches(0.12), Inches(9.63), Inches(0.5),
        size=11, color=LIGHT)


# ── Slide 15: SOS Map ─────────────────────────────────────────────────────────
s = add_slide()
heading(s, "SOS Tab — Interactive Map",
        "OpenLayers map · 25 sensor markers · temperature colour encoding")

card(s, Inches(0.5), Inches(1.3), Inches(3.9), Inches(3.4),
     "Marker Colour = Temperature", [
     "< 0°C      blue  (#60a5fa)",
     "0–15°C     teal  (#34d399)",
     "15–25°C    green (#4ade80)",
     "25–35°C    orange(#fb923c)",
     "> 35°C     red   (#ef4444)",
     "",
     "Grey = no data loaded yet",
])

card(s, Inches(4.7), Inches(1.3), Inches(3.9), Inches(3.4),
     "Map Layers (z-index stacking)", [
     "Layer 0: OSM base tiles",
     "Layer 1: sensor marker dots",
     "          (zIndex = 10)",
     "Layer 2: bbox draw rectangle",
     "          (zIndex = 20)",
     "",
     "OpenLayers Vector features",
])

card(s, Inches(8.9), Inches(1.3), Inches(3.93), Inches(3.4),
     "BBOX Draw Tool", [
     "Click '✏ Draw' button",
     "Drag rectangle on map",
     "Release → coordinates",
     "auto-fill the four bbox",
     "input fields",
     "",
     "ol.interaction.Draw + createBox()",
])

card(s, Inches(0.5), Inches(5.0), Inches(12.33), Inches(1.55),
     "Popup on Marker Click", [
     "Shows: city name, country, observation count loaded, latest temp/humidity/wind/pressure/precip/timestamp",
     "OL Overlay element anchored to marker coordinate with autoPan animation",
])


# ── Slide 16: Table & Charts ──────────────────────────────────────────────────
s = add_slide()
heading(s, "SOS Tab — Data Table & Charts")

card(s, Inches(0.5), Inches(1.3), Inches(5.9), Inches(2.5),
     "Observation Table (up to 500 rows)", [
     "Columns: #, City, Country, Timestamp,",
     "  Temp °C, Humidity %, Wind kph,",
     "  Pressure mb, Precip mm",
     "",
     "Temperature cells rendered as coloured",
     "  badges matching the map legend",
])

card(s, Inches(6.9), Inches(1.3), Inches(5.93), Inches(2.5),
     "XML Response Panel", [
     "Raw XML from the server displayed in full",
     "Shows the actual O&M-structured response",
     "Copy button for clipboard export",
     "",
     "Request URL shown above — copy-pasteable",
     "  directly into curl or Postman",
])

card(s, Inches(0.5), Inches(4.1), Inches(5.9), Inches(2.5),
     "Bar Chart (Chart.js)", [
     "Average temperature by city (top 10)",
     "Bars coloured with same temperature scale",
     "  as map markers",
     "Responsive, dark-mode aware tick colours",
])

card(s, Inches(6.9), Inches(4.1), Inches(5.93), Inches(2.5),
     "Doughnut Chart (Chart.js)", [
     "Observation count by city",
     "Shows which sensors have the most data",
     "  in the current filter result",
     "Legend on the right with city names",
])


# ── Slide 17: Bidirectional Sync ──────────────────────────────────────────────
s = add_slide()
heading(s, "Bidirectional Marker ↔ Table Sync",
        "Click anything — everything else reacts")

card(s, Inches(0.5), Inches(1.3), Inches(5.9), Inches(3.8),
     "Click a table row →", [
     "Row highlights with blue outline",
     "Map pans and zooms to that sensor",
     "Marker enlarges (radius 7 → 11px)",
     "White stroke on selected marker",
     "Popup opens showing latest values",
])

card(s, Inches(6.9), Inches(1.3), Inches(5.93), Inches(3.8),
     "Click a map marker →", [
     "Marker enlarges + white stroke",
     "Popup appears above the dot",
     "Matching table row highlights",
     "Table auto-scrolls to that row",
     "Previous selection deselected",
])

code_box(s, """\
// Table row click → map pan + popup
tr.addEventListener("click", () => {
  _selectSensor(sensorId);
  const coord = markerFeature.getGeometry().getCoordinates();
  sosMap.getView().animate({ center: coord, zoom: 4 });
  _showSensorPopup(sensorId, coord);
});

// Map click → table highlight
sosMap.on("click", (evt) => {
  sosMap.forEachFeatureAtPixel(evt.pixel, (feature) => {
    const sid = feature.get("sensor_id");
    _highlightTableRow(sid);       // finds <tr data-sensor-id="...">
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, { hitTolerance: 8 });
});""",
    Inches(0.5), Inches(5.35), Inches(12.33), Inches(1.75))


# ── Slide 18: Request Lifecycle ───────────────────────────────────────────────
s = add_slide()
heading(s, "Full Request Lifecycle",
        "You click 'Get Observations' — every step that follows")

steps = [
    ("1  Browser reads form",
     "Builds URL: /sos/observations?country=Japan&param=temperature&op=gt&value=25&limit=500"),
    ("2  HTTP GET → FastAPI",
     "Request arrives at main.py · get_observations() · params extracted automatically by FastAPI"),
    ("3  SQL built & executed",
     "SELECT * FROM observations WHERE LOWER(country)=LOWER('Japan') AND temperature>25 LIMIT 500"),
    ("4  rows_to_xml()",
     "Each SQLite row wrapped in <Observation> tags · returned as application/xml"),
    ("5  DOMParser in browser",
     "XML string → tree → JS array of objects · stored in _currentObs[]"),
    ("6  Three parallel renders",
     "_renderObsMarkers() recolours dots · _renderTable() builds rows · _renderCharts() draws charts"),
]

for i, (step, detail) in enumerate(steps):
    y = Inches(1.3 + i * 0.92)
    bx = s.shapes.add_shape(1, Inches(0.5), y, Inches(12.33), Inches(0.78))
    bx.fill.solid()
    bx.fill.fore_color.rgb = RGBColor(0x10, 0x1a, 0x30) if i % 2 == 0 else BG2
    bx.line.color.rgb = BORDER
    txb(s, step,  Inches(0.65), y + Inches(0.05), Inches(3.0), Inches(0.35),
        size=11, bold=True, color=ACCENT)
    txb(s, detail, Inches(3.7), y + Inches(0.12), Inches(8.93), Inches(0.55),
        size=10, color=LIGHT)


# ── Slide 19: Standards Compliance ───────────────────────────────────────────
s = add_slide()
heading(s, "Standards Compliance Summary")

table(s,
    ["Standard", "Concept", "Our Implementation"],
    [
        ["SOS 2.0",     "GetCapabilities",
         "GET /sos/capabilities → Capabilities XML with OperationsMetadata"],
        ["SOS 2.0",     "DescribeSensor",
         "GET /sos/sensor → SensorML 2.0 document (10 sensors)"],
        ["SOS 2.0",     "GetObservation",
         "GET /sos/observations → spatial + temporal + parameter filters"],
        ["O&M",         "Observation model",
         "Each DB row encodes all 5 O&M components (procedure, time, result...)"],
        ["SensorML 2.0","System description",
         "Sensors described with GML location, output list, units"],
        ["WMS 1.1",     "GetCapabilities + GetMap",
         "OGC tab — full WMS client against GeoServer (Project 1)"],
        ["WFS 2.0",     "GetCapabilities + GetFeature",
         "OGC tab — WFS client with BBOX, max features (Project 1)"],
    ],
    Inches(0.5), Inches(1.3), Inches(12.33), Inches(5.3),
    col_widths=[Inches(1.5), Inches(2.5), Inches(7.8)],
)


# ── Slide 20: Summary ─────────────────────────────────────────────────────────
s = add_slide()
heading(s, "Summary & What's Next")

card(s, Inches(0.5), Inches(1.3), Inches(5.9), Inches(3.6),
     "What Was Built", [
     "Unified OGC portal (WMS + WFS + SOS)",
     "25-sensor global weather observatory",
     "SOS 2.0 operations over real data",
     "SensorML + O&M compliant responses",
     "Interactive map, table, charts",
     "Single-command deployment",
])

card(s, Inches(6.9), Inches(1.3), Inches(5.93), Inches(3.6),
     "Stack", [
     "Python 3  ·  FastAPI  ·  SQLite",
     "OpenLayers  ·  Chart.js",
     "OGC SOS 2.0  ·  SensorML 2.0  ·  O&M",
     "",
     "No external dependencies beyond:",
     "  pip install -r requirements.txt",
     "  uvicorn main:app --port 8000",
])

card(s, Inches(0.5), Inches(5.15), Inches(5.9), Inches(1.85),
     "Possible Next Steps", [
     "Migrate to istSOS (OGC-certified server)",
     "Containerise with Docker Compose",
     "Real-time ingestion via InsertObservation",
])

box6 = s.shapes.add_shape(1, Inches(6.9), Inches(5.15), Inches(5.93), Inches(1.85))
box6.fill.solid(); box6.fill.fore_color.rgb = RGBColor(0x07, 0x1e, 0x2a)
box6.line.color.rgb = ACCENT
txb(s, "◈  GeoPulse", Inches(7.1), Inches(5.3), Inches(5.5), Inches(0.5),
    size=18, bold=True, color=ACCENT, align=PP_ALIGN.CENTER)
txb(s, "cd backend", Inches(7.1), Inches(5.78),
    Inches(5.5), Inches(0.3), size=11, color=GREY, align=PP_ALIGN.CENTER)
txb(s, "uvicorn main:app --host 127.0.0.1 --port 8000",
    Inches(7.1), Inches(6.08), Inches(5.5), Inches(0.3),
    size=11, color=ACCENT, align=PP_ALIGN.CENTER)
txb(s, "http://127.0.0.1:8000",
    Inches(7.1), Inches(6.42), Inches(5.5), Inches(0.35),
    size=13, bold=True, color=WHITE, align=PP_ALIGN.CENTER)


# ── Save ──────────────────────────────────────────────────────────────────────
out = "GeoPulse_Presentation.pptx"
prs.save(out)
print(f"✅  Saved: {out}  ({prs.slides.__len__()} slides)")
