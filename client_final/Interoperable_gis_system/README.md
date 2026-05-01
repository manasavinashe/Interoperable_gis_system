# GNR629 Project 1: Interoperable GIS System

**Project Objective:** Develop an integrated Client-Server based Interoperable GIS system using OGC web services (WMS/WFS).

---

## Project Overview

This project implements a web-based GIS client that communicates with OGC-compliant web services to retrieve and visualize geospatial data. The system demonstrates understanding of interoperable GIS standards, spatial databases, and client-server architecture through a practical implementation using OpenLayers, GeoServer, and PostgreSQL/PostGIS.

### Application Domain: Soil Moisture Monitoring – Maharashtra

To demonstrate the interoperable GIS workflow in a practical context, the system is applied to the domain of Soil Moisture Monitoring in the state of Maharashtra, India.

Soil moisture is a critical environmental parameter influencing agricultural productivity, drought assessment, irrigation planning, and water resource management. Monitoring spatial variations in soil moisture helps decision-makers understand land conditions and manage agricultural resources effectively.

In this project, geospatial layers related to soil moisture are served through OGC-compliant web services and visualized through the web-based GIS client. The system enables users to explore these datasets interactively using standard OGC requests such as GetCapabilities, GetMap, GetFeature, and GetFeatureInfo.

The interoperable design allows the client application to connect not only to the local GeoServer instance but also to external WMS/WFS services, demonstrating how standardized geospatial services support seamless integration of environmental datasets from multiple sources.

### Key Features

- **WMS/WFS Service Access:** Connect to any WMS or WFS server (GeoServer, MapServer, QGIS Server, etc.)
- **GetCapabilities Request:** Browse available layers from server capabilities
- **Map Visualization:** Display WMS layers and WFS features on an interactive map
- **XML Response Handling:** View raw XML responses and parse them into readable format
- **Feature Info:** Click on map features to retrieve attribute information
- **Multiple Layers:** Stack multiple WMS/WFS layers with adjustable z-index
- **Bounding Box Control:** Define area of interest via coordinates or manual input
- **SRS/CRS Selection:** Support for multiple coordinate reference systems
- **Responsive UI:** Light/dark theme support with resizable interface panels

---

## Technology Stack

### Server-Side

- **Apache Tomcat** - Application server
- **GeoServer** - OGC WMS/WFS server
- **PostgreSQL + PostGIS** - Spatial database

### Client-Side

- **HTML5, CSS3, Vanilla JavaScript** - Frontend implementation
- **OpenLayers** - Interactive mapping library
- **DOM Parser** - XML parsing and processing

---

## Project Structure

```
Interoperable_gis_system/
├── index.html              # Main page - web client interface
├── README.md               # Project documentation
├── css/
│   └── style.css           # Styling and theme management
└── js/
    ├── config.js           # Global configuration and fetch wrapper
    ├── map.js              # OpenLayers map initialization and layer management
    ├── ogcRequests.js      # WMS/WFS request building and processing
    └── xmlParser.js        # XML parsing and response data display
```

Scripts are loaded in order: `config.js` → `xmlParser.js` → `map.js` → `ogcRequests.js`.

---

## How It Works

### 1. Connecting to a WMS/WFS Server

The client accepts a service URL (endpoint) in the input field. Users click either **GetCapabilities (WMS)** or **GetCapabilities (WFS)** to retrieve the server's capabilities document. The raw XML response appears in the response panel, showing available layers, supported CRS, and bounding information.

### 2. Parsing GetCapabilities Response

The capabilities XML is parsed using JavaScript `DOMParser` to extract:

- Layer names and titles
- Supported SRS/CRS codes
- Bounding boxes (LatLonBoundingBox for WMS, WGS84BoundingBox for WFS)
- Layer hierarchy

This information populates the layer selection interface and autofills the BBOX and SRS fields when a layer is selected.

### 3. WMS GetMap Request

After selecting a layer and clicking **GetMap**, the client sends a GetMap request to the GeoServer with the specified parameters (layer name, CRS, bounding box, format, size). The returned map image is rendered as an overlay on the base map using OpenLayers. Multiple WMS layers can be stacked with proper z-index ordering.

### 4. WFS GetFeature Request

Selecting a layer and clicking **GetFeature** retrieves vector data in GeoJSON format. The features are displayed on the map as vector overlays and their attributes are shown in the parsed data table. Max Features parameter controls the number of returned features.

### 5. Feature Information (GetFeatureInfo / Click Query)

Clicking on a map feature triggers:

- **Vector Layer Click:** Attributes of WFS features are immediately displayed
- **WMS Layer Click:** A GetFeatureInfo request is sent to the server, with results shown in the response panel

The system automatically queries layers from top to bottom based on z-index if no vector feature is found.

The `AbortController` on each new click cancels any in-flight request from a previous click — so rapid clicking doesn't pile up requests.

---

### 6. Bounding Box Selection

The client provides three ways to set the area of interest:

1. **Auto-fill on layer select** — Clicking a layer automatically populates the BBOX fields with the layer's extent
2. **Draw on Map** — Activates a drawing tool to select a rectangular area; coordinates are auto-converted to EPSG:4326
3. **Manual Entry** — Type coordinate values directly, then click **Apply to Map** to zoom to that area

Input validation ensures coordinates are within valid ranges (±180° longitude, ±90° latitude).

### 7. Layer Management

The "Added Layers" panel displays all layers currently loaded on the map. For each layer, users can:

- Toggle visibility on/off
- Adjust opacity/transparency
- View layer type (WMS or WFS badge)
- Remove the layer from the map

Layers are stacked in order, with the most recently added layer appearing on top.

### 8. User Interface Features

- **Resizable Panels:** Drag the divider between map and response areas to adjust layout
- **Collapsible Sections:** Minimize the map or response panes to focus on one view
- **Light/Dark Theme:** Toggle between themes; choice is saved in browser

---

## Installation and Setup

### Prerequisites

- Apache Tomcat and GeoServer installed and running
- PostgreSQL with PostGIS extension
- Modern web browser (Chrome, Firefox, Edge, Safari)
- OpenLayers library (loaded via CDN)

### Local Testing

Simply open `index.html` in a web browser. No build process or dependencies to install.

**For Local GeoServer:**
Update the Service URL field to point to your local GeoServer instance (default: `http://localhost:8080/geoserver/wms`).

**For Public Servers (Testing):**
These public OGC services can be used for testing:

| Service                      | URL                                                         |
| ---------------------------- | ----------------------------------------------------------- |
| GeoSolutions GeoServer (WMS) | `https://gs-stable.geo-solutions.it/geoserver/wms`          |
| GeoSolutions GeoServer (WFS) | `https://gs-stable.geo-solutions.it/geoserver/wfs`          |
| NASA GIBS (WMS)              | `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi` |
| NOAA Weather (WMS)           | `https://opengeo.ncep.noaa.gov/geoserver/wms`               |

---

## Project Requirements Met

✓ Send GetCapabilities, GetMap, and GetFeatureInfo requests to OGC servers  
✓ Display raw XML response documents  
✓ Parse XML and display values in readable tables  
✓ Support multiple layers with layering control  
✓ Base layer included (OpenStreetMap)  
✓ Query external WMS/WFS servers  
✓ Layer selection with customizable SRS  
✓ Bounding box coordinate input and visualization  
✓ Format and size selection for requests  
✓ Professional and user-friendly GUI design

---

## Dependencies

- [OpenLayers](https://openlayers.org/) — mapping library (loaded from CDN)
- [Google Fonts](https://fonts.google.com/) — IBM Plex Mono and DM Sans typefaces
- Vanilla JavaScript and DOM APIs

No build tools, frameworks, or npm packages required.
