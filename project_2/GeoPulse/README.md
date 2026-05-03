# GeoPulse - OGC Web Services Portal

GNR629 Project 2 | CSRE, IIT Bombay | Manas Avinashe

This project builds on Project 1 (WMS/WFS client) by adding a full SOS 2.0 service for global weather observations. Both are accessible from the same portal.

## Folder Structure

```
GeoPulse/
├── backend/
│   ├── main.py            - FastAPI server, all SOS endpoints
│   ├── weather.db         - SQLite database (25 sensors, ~17k readings)
│   ├── sensorml.xml       - SensorML 2.0 description of all 25 sensors
│   ├── db_setup.py        - script to rebuild the DB from CSV if needed
│   └── requirements.txt
├── data/
│   ├── cleaned_weather.csv
│   └── process_data.py    - filters the raw Kaggle CSV down to 25 cities
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── sos.js          - SOS tab: map, filters, table, charts
        ├── map.js          - OGC tab map (OpenLayers)
        ├── ogcRequests.js  - WMS/WFS request builders
        └── ...
```

## Requirements

- Python 3.10+
- GeoServer running on port 8080 (only needed for the OGC/WMS tab)

## Running the project

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000` in the browser.

- **OGC tab** - WMS/WFS client, needs GeoServer on port 8080
- **SOS tab** - weather sensor observations, works without GeoServer

## Testing the SOS tab

1. Click the SOS tab
2. Click GetCapabilities to see the service XML
3. Click DescribeSensor to see the SensorML document
4. Set Country = Japan and click Get Observations
5. Markers appear on the map, table populates, charts render
6. Click a table row to pan the map to that sensor
7. Click a map marker to highlight the matching row

## Data

`weather.db` is included in the repo, no need to rebuild it.

25 cities, roughly 710 readings each, 5 observed parameters (temperature, humidity, wind speed, pressure, precipitation), timestamps from 2024-05-16 to 2026-04-30.

| Region | Cities |
|--------|--------|
| Asia | Tokyo, New Delhi, Beijing, Bangkok, Singapore, Tehran |
| Europe | Berlin, Rome, Warsaw, Moscow, London |
| Africa | Cairo, Nairobi, Dakar, Accra, Pretoria |
| Americas | Ottawa, Mexico City, Lima, Buenos Aires, Montevideo |
| Middle East | Riyadh, Muscat |
| Oceania | Canberra, Wellington |

## Rebuilding the database

Only needed if weather.db is missing. Download GlobalWeatherRepository.csv from Kaggle, put it in `data/`, then:

```bash
cd data
python process_data.py

cd ../backend
python db_setup.py
```

## API endpoints

| Endpoint | What it does |
|----------|--------------|
| GET / | redirects to frontend |
| GET /sos/capabilities | SOS GetCapabilities (XML) |
| GET /sos/sensor | DescribeSensor - returns sensorml.xml |
| GET /sos/sensors | list of all 25 sensor locations (JSON) |
| GET /sos/observations | filtered observations (XML by default, or JSON with fmt=json) |

### Observation filter parameters

| param | example | notes |
|-------|---------|-------|
| country | Japan | case insensitive |
| bbox | 60,10,140,50 | minLon,minLat,maxLon,maxLat |
| after | 2025-01-01 00:00:00 | observations after this time |
| start | 2025-01-01 00:00:00 | start of time window |
| end | 2025-03-31 23:59:59 | end of time window |
| param | temperature | temperature, humidity, wind_speed, pressure, precipitation |
| op | gt | eq, neq, lt, lte, gt, gte, between |
| value | 30 | comparison value |
| value2 | 40 | only used with between |
| limit | 500 | max rows, default 500 |
| fmt | json | xml (default) or json |

## Common issues

**SOS map blank / fetch error** - make sure you run uvicorn from inside the `backend/` folder, not from the project root.

**Port 8000 already in use** - use a different port: `uvicorn main:app --port 8001` and open `http://127.0.0.1:8001`

**WMS/WFS tab shows nothing** - GeoServer needs to be running on `http://localhost:8080/geoserver`
