from fastapi import FastAPI, Query
from fastapi.responses import Response, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sqlite3
import xml.etree.ElementTree as ET
import os
from typing import Optional

app = FastAPI(title="GeoPulse SOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "weather.db")
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def rows_to_xml(rows):
    root = ET.Element("Observations")
    root.set("count", str(len(rows)))
    for row in rows:
        obs = ET.SubElement(root, "Observation")
        for key in row.keys():
            child = ET.SubElement(obs, key)
            child.text = str(row[key]) if row[key] is not None else ""
    return ET.tostring(root, encoding="unicode", xml_declaration=False)


# ── Home — redirect to frontend ──────────────────────────────────────────────
@app.get("/")
def home():
    return RedirectResponse(url="/app/index.html")


# ── GetCapabilities ──────────────────────────────────────────────────────────
@app.get("/sos/capabilities")
def get_capabilities():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<Capabilities version="2.0.0" xmlns:sos="http://www.opengis.net/sos/2.0">
  <ServiceIdentification>
    <Title>GeoPulse Sensor Observation Service</Title>
    <Abstract>Global weather observations: temperature, humidity, wind speed, pressure</Abstract>
    <ServiceType>OGC:SOS</ServiceType>
    <ServiceTypeVersion>2.0.0</ServiceTypeVersion>
  </ServiceIdentification>
  <OperationsMetadata>
    <Operation name="GetCapabilities">
      <DCP><HTTP><Get href="/sos/capabilities"/></HTTP></DCP>
    </Operation>
    <Operation name="DescribeSensor">
      <DCP><HTTP><Get href="/sos/sensor"/></HTTP></DCP>
    </Operation>
    <Operation name="GetObservation">
      <DCP><HTTP><Get href="/sos/observations"/></HTTP></DCP>
      <Parameter name="bbox"><AllowedValues><AnyValue/></AllowedValues></Parameter>
      <Parameter name="country"><AllowedValues><AnyValue/></AllowedValues></Parameter>
      <Parameter name="after"><AllowedValues><AnyValue/></AllowedValues></Parameter>
      <Parameter name="start"><AllowedValues><AnyValue/></AllowedValues></Parameter>
      <Parameter name="end"><AllowedValues><AnyValue/></AllowedValues></Parameter>
      <Parameter name="param">
        <AllowedValues>
          <Value>temperature</Value>
          <Value>humidity</Value>
          <Value>wind_speed</Value>
          <Value>pressure</Value>
        </AllowedValues>
      </Parameter>
      <Parameter name="op">
        <AllowedValues>
          <Value>eq</Value><Value>neq</Value>
          <Value>lt</Value><Value>lte</Value>
          <Value>gt</Value><Value>gte</Value>
          <Value>between</Value>
        </AllowedValues>
      </Parameter>
    </Operation>
  </OperationsMetadata>
  <ObservationOfferingList>
    <ObservationOffering>
      <identifier>weather_global</identifier>
      <observedProperty>temperature</observedProperty>
      <observedProperty>humidity</observedProperty>
      <observedProperty>wind_speed</observedProperty>
      <observedProperty>pressure</observedProperty>
      <observedProperty>precipitation</observedProperty>
      <featureOfInterest>GlobalWeatherStations</featureOfInterest>
      <responseFormat>application/xml</responseFormat>
      <responseFormat>application/json</responseFormat>
    </ObservationOffering>
  </ObservationOfferingList>
</Capabilities>"""
    return Response(content=xml, media_type="application/xml")


# ── DescribeSensor ───────────────────────────────────────────────────────────
@app.get("/sos/sensor")
def describe_sensor():
    path = os.path.join(BASE_DIR, "sensorml.xml")
    with open(path, "r") as f:
        data = f.read()
    return Response(content=data, media_type="application/xml")


# ── GetSensors ───────────────────────────────────────────────────────────────
@app.get("/sos/sensors")
def get_sensors():
    conn = get_conn()
    rows = conn.execute("""
        SELECT sensor_id, location_name, country,
               ROUND(AVG(latitude), 4)  AS latitude,
               ROUND(AVG(longitude), 4) AS longitude,
               COUNT(*) AS reading_count
        FROM observations
        GROUP BY sensor_id, location_name, country
        ORDER BY country, location_name
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── GetObservation — all filters combinable ──────────────────────────────────
@app.get("/sos/observations")
def get_observations(
    # Spatial subsetting
    bbox: Optional[str] = Query(
        None,
        description="Bounding box: minLon,minLat,maxLon,maxLat (EPSG:4326)"
    ),
    country: Optional[str] = Query(
        None,
        description="Filter by country name (case-insensitive exact match)"
    ),
    # Temporal subsetting
    after: Optional[str] = Query(
        None,
        description="Return observations after this datetime (ISO 8601)"
    ),
    start: Optional[str] = Query(
        None,
        description="Start of time window (inclusive)"
    ),
    end: Optional[str] = Query(
        None,
        description="End of time window (inclusive)"
    ),
    # Parameter filtering
    param: Optional[str] = Query(
        None,
        description="Observed property: temperature | humidity | wind_speed | pressure"
    ),
    op: Optional[str] = Query(
        None,
        description="Comparison operator: eq | neq | lt | lte | gt | gte | between"
    ),
    value: Optional[float] = Query(None, description="Comparison value"),
    value2: Optional[float] = Query(None, description="Upper bound for 'between'"),
    # Output
    limit: int = Query(500, ge=1, le=5000, description="Max rows returned"),
    fmt: str = Query("xml", description="Response format: xml | json"),
):
    conditions = []
    bind_params = []

    # ── Spatial: bounding box ────────────────────────────────────────────────
    if bbox:
        parts = [p.strip() for p in bbox.split(",")]
        if len(parts) == 4:
            try:
                min_lon, min_lat, max_lon, max_lat = map(float, parts)
                conditions.append("longitude BETWEEN ? AND ?")
                conditions.append("latitude BETWEEN ? AND ?")
                bind_params += [min_lon, max_lon, min_lat, max_lat]
            except ValueError:
                pass

    # ── Spatial: country containment ─────────────────────────────────────────
    if country:
        conditions.append("LOWER(country) = LOWER(?)")
        bind_params.append(country.strip())

    # ── Temporal: after a time instant ───────────────────────────────────────
    if after and not (start or end):
        conditions.append("timestamp > ?")
        bind_params.append(after.strip())

    # ── Temporal: during a time window ───────────────────────────────────────
    if start:
        conditions.append("timestamp >= ?")
        bind_params.append(start.strip())
    if end:
        conditions.append("timestamp <= ?")
        bind_params.append(end.strip())

    # ── Parameter filtering ───────────────────────────────────────────────────
    ALLOWED_PARAMS = {"temperature", "humidity", "wind_speed", "pressure", "precipitation"}
    ALLOWED_OPS = {"eq", "neq", "lt", "lte", "gt", "gte", "between"}

    if param and param in ALLOWED_PARAMS and op and op in ALLOWED_OPS:
        col = param  # safe: validated against allowlist above

        if op == "eq" and value is not None:
            conditions.append(f"{col} = ?")
            bind_params.append(value)

        elif op == "neq" and value is not None:
            conditions.append(f"{col} != ?")
            bind_params.append(value)

        elif op == "lt" and value is not None:
            conditions.append(f"{col} < ?")
            bind_params.append(value)

        elif op == "lte" and value is not None:
            conditions.append(f"{col} <= ?")
            bind_params.append(value)

        elif op == "gt" and value is not None:
            conditions.append(f"{col} > ?")
            bind_params.append(value)

        elif op == "gte" and value is not None:
            conditions.append(f"{col} >= ?")
            bind_params.append(value)

        elif op == "between" and value is not None and value2 is not None:
            conditions.append(f"{col} BETWEEN ? AND ?")
            bind_params += [value, value2]

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = f"SELECT * FROM observations {where_clause} LIMIT ?"
    bind_params.append(limit)

    conn = get_conn()
    rows = conn.execute(sql, bind_params).fetchall()
    conn.close()

    if fmt == "json":
        return [dict(r) for r in rows]

    return Response(content=rows_to_xml(rows), media_type="application/xml")


# ── Serve frontend static files at /app ──────────────────────────────────────
# Must be mounted after all API routes so /sos/* paths are not shadowed.
app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
