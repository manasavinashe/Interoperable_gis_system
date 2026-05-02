# GeoPulse — OGC Web Services Portal

**GNR629 · Project 2 · CSRE, IIT Bombay**

A unified web portal combining an OGC WMS/WFS client (Project 1) and a custom OGC SOS 2.0 service (Project 2) for global weather sensor observations.

---

## What's Inside

```
GeoPulse/
├── backend/
│   ├── main.py            ← FastAPI server (SOS API + serves frontend)
│   ├── weather.db         ← SQLite database (25 sensors, ~17,775 readings)
│   ├── sensorml.xml       ← SensorML 2.0 sensor metadata
│   ├── db_setup.py        ← one-time script to rebuild the DB from CSV
│   └── requirements.txt   ← Python dependencies
├── data/
│   ├── cleaned_weather.csv       ← processed dataset (25 cities, ~17k rows)
│   └── process_data.py           ← cleans GlobalWeatherRepository.csv
└── frontend/
    ├── index.html         ← main UI (OGC tab + SOS tab)
    ├── css/style.css
    └── js/
        ├── sos.js         ← SOS tab logic (map, filters, charts)
        ├── map.js         ← OGC tab map (OpenLayers)
        ├── ogcRequests.js ← WMS/WFS request builders
        └── ...
```

---

## Prerequisites

- **Python 3.10+**
- **GeoServer** (only needed for the OGC/WMS/WFS tab — runs on port 8080)

---

## Setup & Run

### Step 1 — Clone the repo

```bash
git clone https://github.com/manasavinashe/Interoperable_gis_system.git
cd Interoperable_gis_system/project_2/GeoPulse
```

### Step 2 — Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 3 — Start the server

```bash
# from inside the backend/ folder
uvicorn main:app --host 127.0.0.1 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### Step 4 — Open the portal

```
http://127.0.0.1:8000
```

The portal has two tabs:
- **OGC** — WMS/WFS client (needs GeoServer on port 8080)
- **SOS** — Sensor Observation Service (works standalone, no GeoServer needed)

---

## The SOS Tab — Quick Test

1. Click the **SOS** tab
2. Click **GetCapabilities** → see the service description XML
3. Click **DescribeSensor** → see the SensorML sensor metadata
4. Set **Country = Japan**, click **↓ Get Observations**
5. Coloured markers appear on the map, table fills, charts render
6. Click any table row → map pans to that sensor
7. Click any map marker → matching table row highlights

---

## Data (weather.db)

`weather.db` is already included in the repository. **You do not need to rebuild it.**

25 global cities, ~710 readings each, 5 parameters, timestamps 2024-05-16 to 2026-04-30.

| Region | Cities |
|--------|--------|
| Asia | Tokyo, New Delhi, Beijing, Bangkok, Singapore, Tehran |
| Europe | Berlin, Rome, Warsaw, Moscow, London |
| Africa | Cairo, Nairobi, Dakar, Accra, Pretoria |
| Americas | Ottawa, Mexico City, Lima, Buenos Aires, Montevideo |
| Middle East | Riyadh, Muscat |
| Oceania | Canberra, Wellington |

---

## Rebuilding the Database (only if needed)

If `weather.db` is missing or corrupted:

```bash
# 1. Download GlobalWeatherRepository.csv from Kaggle and place it at:
#    data/GlobalWeatherRepository.csv

# 2. Generate the cleaned CSV
cd data
python process_data.py

# 3. Rebuild the SQLite database
cd ../backend
python db_setup.py
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Redirects to the frontend |
| `GET /sos/capabilities` | SOS GetCapabilities (XML) |
| `GET /sos/sensor` | SOS DescribeSensor — returns SensorML |
| `GET /sos/sensors` | All 25 sensor locations (JSON) |
| `GET /sos/observations` | Filtered observations (XML or JSON) |

### `/sos/observations` Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| `country` | `Japan` | Filter by country (case-insensitive) |
| `bbox` | `60,10,140,50` | minLon,minLat,maxLon,maxLat |
| `after` | `2025-01-01 00:00:00` | Observations after this time |
| `start` | `2025-01-01 00:00:00` | Start of time window |
| `end` | `2025-03-31 23:59:59` | End of time window |
| `param` | `temperature` | Property: `temperature` `humidity` `wind_speed` `pressure` `precipitation` |
| `op` | `gt` | Operator: `eq` `neq` `lt` `lte` `gt` `gte` `between` |
| `value` | `30` | Comparison value |
| `value2` | `40` | Upper bound (only for `between`) |
| `limit` | `500` | Max rows (1–5000, default 500) |
| `fmt` | `json` | `xml` (default) or `json` |

**Examples:**

```bash
# Tokyo observations in January 2025
curl "http://127.0.0.1:8000/sos/observations?country=Japan&start=2025-01-01&end=2025-01-31"

# Temperature between 30°C and 40°C, all sensors
curl "http://127.0.0.1:8000/sos/observations?param=temperature&op=between&value=30&value2=40"

# South Asia bounding box, JSON format
curl "http://127.0.0.1:8000/sos/observations?bbox=60,5,100,40&fmt=json"
```

---

## Troubleshooting

**Blank SOS map / "Failed to fetch" error**

You must run uvicorn from inside the `backend/` folder:
```bash
cd project_2/GeoPulse/backend   # ← this is important
uvicorn main:app --host 127.0.0.1 --port 8000
```

**Port 8000 already in use**
```bash
uvicorn main:app --host 127.0.0.1 --port 8001
# then open http://127.0.0.1:8001
```

**WMS/WFS tab shows no layers**

GeoServer must be running separately on `http://localhost:8080/geoserver`.

**pip install fails**
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**`weather.db` missing after cloning**

Git LFS may not have pulled it. Run:
```bash
git lfs pull
# or just re-clone:
git clone https://github.com/manasavinashe/Interoperable_gis_system.git
```
