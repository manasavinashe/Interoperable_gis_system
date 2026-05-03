// sos.js — SOS tab: map, markers, filters, table, charts

// Empty string = relative URLs, so the app works whether opened via file:// or served by FastAPI
const SOS_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "";

// State
let sosMap = null;
let sosMarkerSource = null;
let sosMarkerLayer = null;
let sosDrawLayer = null;
let sosDrawInteraction = null;
let sosPopupOverlay = null;
let _sosMapInited = false;
let _currentObs = [];
let _sensorMeta = {};  // sensor_id → { lat, lon, location_name, country }
let _barChart = null;
let _pieChart = null;
let _selectedSensor = null;

// Init SOS map (called once when SOS tab first opens)
function initSOSMap() {
  if (_sosMapInited) return;
  _sosMapInited = true;

  sosMarkerSource = new ol.source.Vector();
  sosMarkerLayer = new ol.layer.Vector({ source: sosMarkerSource, zIndex: 10 });

  sosDrawLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#0fd6c2", width: 2, lineDash: [6, 3] }),
      fill: new ol.style.Fill({ color: "rgba(15,214,194,0.08)" }),
    }),
    zIndex: 20,
  });

  sosMap = new ol.Map({
    target: "sosMap",
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM(), zIndex: 0 }),
      sosMarkerLayer,
      sosDrawLayer,
    ],
    view: new ol.View({ center: ol.proj.fromLonLat([20, 15]), zoom: 2 }),
  });

  // Popup overlay — move to body so OL absolute positioning works
  const popupEl = document.getElementById("sosPopup");
  document.body.appendChild(popupEl);
  popupEl.style.cssText += ";display:block;position:absolute;";
  sosPopupOverlay = new ol.Overlay({
    element: popupEl,
    autoPan: { animation: { duration: 200 } },
    positioning: "bottom-center",
    stopEvent: true,
    offset: [0, -14],
  });
  sosMap.addOverlay(sosPopupOverlay);

  // Map click: hit-test markers
  sosMap.on("click", (evt) => {
    if (sosDrawInteraction) return;
    let hit = false;
    sosMap.forEachFeatureAtPixel(
      evt.pixel,
      (feature) => {
        const sid = feature.get("sensor_id");
        if (!sid) return;
        hit = true;
        _selectSensor(sid);
        _showSensorPopup(sid, evt.coordinate);
        return true;
      },
      { hitTolerance: 8 },
    );
    if (!hit) closeSosPopup();
  });

  // Cursor change on hover
  sosMap.on("pointermove", (evt) => {
    const hit = sosMap.hasFeatureAtPixel(evt.pixel, { hitTolerance: 6 });
    sosMap.getTargetElement().style.cursor = hit ? "pointer" : "";
  });

  _loadSensorMeta();
}

// Load all 25 sensor positions from backend
function _loadSensorMeta() {
  fetch(SOS_BASE + "/sos/sensors")
    .then((r) => r.json())
    .then((sensors) => {
      sensors.forEach((s) => { _sensorMeta[s.sensor_id] = s; });
      _renderAllSensorMarkers();
    })
    .catch(() => {});
}

function _renderAllSensorMarkers() {
  sosMarkerSource.clear();
  Object.values(_sensorMeta).forEach((s) => {
    const f = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([s.longitude, s.latitude])),
      sensor_id: s.sensor_id,
      location_name: s.location_name,
      country: s.country,
    });
    f.setStyle(_markerStyle(null, false));
    sosMarkerSource.addFeature(f);
  });
}

// Marker style (colour = temperature)
function _tempColor(temp) {
  if (temp === null || temp === undefined || isNaN(temp)) return "#9ca3af";
  if (temp < 0)  return "#60a5fa";  // blue — freezing
  if (temp < 15) return "#34d399";  // teal — cool
  if (temp < 25) return "#4ade80";  // green — mild
  if (temp < 35) return "#fb923c";  // orange — warm
  return "#ef4444";                 // red — hot
}

function _markerStyle(avgTemp, selected) {
  const color = _tempColor(avgTemp);
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: selected ? 11 : 7,
      fill: new ol.style.Fill({ color }),
      stroke: new ol.style.Stroke({
        color: selected ? "#ffffff" : "rgba(255,255,255,0.65)",
        width: selected ? 3 : 1.5,
      }),
    }),
    zIndex: selected ? 200 : 1,
  });
}

// Select / deselect a sensor marker
function _selectSensor(sensorId) {
  // deselect previous
  if (_selectedSensor && _selectedSensor !== sensorId) {
    _styleMarkerForSensor(_selectedSensor, false);
  }
  _selectedSensor = sensorId;
  _styleMarkerForSensor(sensorId, true);
  _highlightTableRow(sensorId);
}

function _styleMarkerForSensor(sensorId, selected) {
  const f = sosMarkerSource.getFeatures().find((f) => f.get("sensor_id") === sensorId);
  if (!f) return;
  const obs = _currentObs.filter((o) => o.sensor_id === sensorId);
  const avg = obs.length
    ? obs.reduce((s, o) => s + o.temperature, 0) / obs.length
    : null;
  f.setStyle(_markerStyle(avg, selected));
}

// Sensor popup
function _showSensorPopup(sensorId, coordinate) {
  const meta = _sensorMeta[sensorId] || {};
  const obs = _currentObs.filter((o) => o.sensor_id === sensorId);
  const latest = obs.length ? obs[obs.length - 1] : null;
  const content = document.getElementById("sosPopupContent");

  let html = `<div class="sos-popup-name">${_esc(meta.location_name || sensorId)}</div>`;
  html += `<div class="sos-popup-sub">${_esc(meta.country || "")} &nbsp;·&nbsp; ${obs.length} obs loaded</div>`;

  if (latest) {
    html += `<div class="sos-popup-grid">
      <span>Temp</span>     <span>${latest.temperature.toFixed(1)} °C</span>
      <span>Humidity</span> <span>${latest.humidity} %</span>
      <span>Wind</span>     <span>${latest.wind_speed.toFixed(1)} kph</span>
      <span>Pressure</span> <span>${latest.pressure.toFixed(1)} mb</span>
      <span>Precip</span>   <span>${latest.precipitation.toFixed(2)} mm</span>
      <span>Time</span>     <span style="font-family:var(--font-mono);font-size:10px">${latest.timestamp.slice(0, 16)}</span>
    </div>`;
  } else {
    html += `<p style="font-size:11px;color:var(--text-muted);padding:6px 4px">
      No observations loaded for this sensor.<br>Fetch data with filters to see values.
    </p>`;
  }

  content.innerHTML = html;
  sosPopupOverlay.setPosition(coordinate);
}

function closeSosPopup() {
  sosPopupOverlay.setPosition(undefined);
  if (_selectedSensor) {
    _styleMarkerForSensor(_selectedSensor, false);
    _selectedSensor = null;
  }
  document
    .querySelectorAll("#sosDataTable tbody tr.sos-row-selected")
    .forEach((r) => r.classList.remove("sos-row-selected"));
}

// GetCapabilities / DescribeSensor
function sosGetCapabilities() {
  const url = SOS_BASE + "/sos/capabilities";
  _setSOSURL(url);
  setStatus("Fetching SOS Capabilities…", "loading");

  fetch(url)
    .then((r) => r.text())
    .then((text) => {
      document.getElementById("sosXmlOutput").textContent = text;
      setStatus("SOS Capabilities loaded", "active");
      showNotification("SOS Capabilities loaded", "success");
    })
    .catch((err) => {
      setStatus("Error", "error");
      showNotification("SOS Error: " + err.message, "error");
    });
}

function sosDescribeSensor() {
  const url = SOS_BASE + "/sos/sensor";
  _setSOSURL(url);
  setStatus("Fetching SensorML…", "loading");

  fetch(url)
    .then((r) => r.text())
    .then((text) => {
      document.getElementById("sosXmlOutput").textContent = text;
      setStatus("SensorML loaded", "active");
      showNotification("SensorML (DescribeSensor) loaded", "success");
    })
    .catch((err) => {
      setStatus("Error", "error");
      showNotification("SOS Error: " + err.message, "error");
    });
}

// Fetch observations with all filters
function fetchObservations() {
  const params = new URLSearchParams();

  // Spatial: bbox
  const bbox = _getSosBBOX();
  if (bbox) params.set("bbox", bbox);

  // Spatial: country
  const country = document.getElementById("sosCountry").value.trim();
  if (country) params.set("country", country);

  // Temporal: after
  const after = document.getElementById("sosAfter").value;
  const start = document.getElementById("sosStart").value;
  const end   = document.getElementById("sosEnd").value;
  if (after && !start && !end) params.set("after", after.replace("T", " "));
  if (start) params.set("start", start.replace("T", " "));
  if (end)   params.set("end",   end.replace("T", " "));

  // Parameter filter
  const param = document.getElementById("sosParam").value;
  const op    = document.getElementById("sosOp").value;
  const val   = document.getElementById("sosVal").value.trim();
  const val2  = document.getElementById("sosVal2").value.trim();
  if (param && op && val) {
    params.set("param", param);
    params.set("op", op);
    params.set("value", val);
    if (op === "between" && val2) params.set("value2", val2);
  }

  const limit = document.getElementById("sosLimit").value || 500;
  params.set("limit", limit);

  const url = SOS_BASE + "/sos/observations?" + params.toString();
  _setSOSURL(url);
  setStatus("Fetching SOS observations…", "loading");
  showNotification("Fetching observations…", "info");

  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then((text) => {
      document.getElementById("sosXmlOutput").textContent = text;
      const obs = _parseObsXML(text);
      _currentObs = obs;
      _renderObsMarkers(obs);
      _renderTable(obs);
      _renderCharts(obs);
      const sensorCount = new Set(obs.map((o) => o.sensor_id)).size;
      setStatus(`SOS: ${obs.length} obs · ${sensorCount} sensors`, "active");
      showNotification(`${obs.length} observations from ${sensorCount} sensors`, "success");
    })
    .catch((err) => {
      setStatus("SOS Error", "error");
      showNotification("SOS Error: " + err.message, "error");
    });
}

function clearSOSFilters() {
  [
    "sosCountry", "sosAfter", "sosStart", "sosEnd",
    "sosVal", "sosVal2", "sosMinLon", "sosMinLat", "sosMaxLon", "sosMaxLat",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("sosParam").value = "";
  document.getElementById("sosOp").value = "eq";
  document.getElementById("sosVal2Field").style.display = "none";
  showNotification("Filters cleared", "info", 1500);
}

// show/hide second value field for "between"
function updateSOSValFields() {
  const op = document.getElementById("sosOp").value;
  document.getElementById("sosVal2Field").style.display =
    op === "between" ? "" : "none";
}

// Parse XML response into JS objects
function _parseObsXML(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const obsEls = doc.getElementsByTagName("Observation");
  const results = [];

  const _t = (el, tag) => {
    const c = el.getElementsByTagName(tag);
    return c.length ? c[0].textContent.trim() : "";
  };

  for (let i = 0; i < obsEls.length; i++) {
    const el = obsEls[i];
    results.push({
      location_name: _t(el, "location_name"),
      country:       _t(el, "country"),
      sensor_id:     _t(el, "sensor_id"),
      timestamp:     _t(el, "timestamp"),
      latitude:      parseFloat(_t(el, "latitude")),
      longitude:     parseFloat(_t(el, "longitude")),
      temperature:   parseFloat(_t(el, "temperature")),
      humidity:      parseFloat(_t(el, "humidity")),
      wind_speed:    parseFloat(_t(el, "wind_speed")),
      pressure:      parseFloat(_t(el, "pressure")),
      precipitation: parseFloat(_t(el, "precipitation")),
    });
  }
  return results;
}

// Update marker colours with fetched observation averages
function _renderObsMarkers(obs) {
  // avg temperature per sensor from fetched data
  const sensorTemps = {};
  obs.forEach((o) => {
    if (!sensorTemps[o.sensor_id]) sensorTemps[o.sensor_id] = [];
    sensorTemps[o.sensor_id].push(o.temperature);
  });

  // reset all existing markers to neutral if they're not in the results
  sosMarkerSource.getFeatures().forEach((f) => {
    const sid = f.get("sensor_id");
    const temps = sensorTemps[sid];
    const avg = temps ? temps.reduce((s, v) => s + v, 0) / temps.length : null;
    const selected = sid === _selectedSensor;
    f.setStyle(_markerStyle(avg, selected));
  });

  // add markers for sensors that appear in obs but weren't pre-loaded (edge case)
  const existing = new Set(sosMarkerSource.getFeatures().map((f) => f.get("sensor_id")));
  const seen = new Set();
  obs.forEach((o) => {
    if (seen.has(o.sensor_id) || existing.has(o.sensor_id)) { seen.add(o.sensor_id); return; }
    seen.add(o.sensor_id);
    if (!isFinite(o.latitude) || !isFinite(o.longitude)) return;
    const f = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([o.longitude, o.latitude])),
      sensor_id: o.sensor_id,
      location_name: o.location_name,
      country: o.country,
    });
    const temps = sensorTemps[o.sensor_id];
    const avg = temps ? temps.reduce((s, v) => s + v, 0) / temps.length : null;
    f.setStyle(_markerStyle(avg, false));
    sosMarkerSource.addFeature(f);
  });
}

// Render observation table
function _renderTable(obs) {
  const table = document.getElementById("sosDataTable");
  if (!table) return;

  // rebuild thead
  let thead = table.querySelector("thead");
  if (thead) thead.remove();
  thead = document.createElement("thead");
  thead.innerHTML = `<tr>
    <th>#</th><th>City</th><th>Country</th><th>Timestamp</th>
    <th>Temp °C</th><th>Humidity %</th><th>Wind kph</th><th>Pressure mb</th><th>Precip mm</th>
  </tr>`;
  table.appendChild(thead);

  // rebuild tbody
  let tbody = table.querySelector("tbody");
  if (tbody) tbody.remove();
  tbody = document.createElement("tbody");

  if (!obs.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">No observations returned — adjust filters and fetch.</td></tr>`;
    table.appendChild(tbody);
    const info = document.getElementById("sosTableInfo");
    if (info) info.textContent = "";
    return;
  }

  obs.slice(0, 500).forEach((o, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.sensorId = o.sensor_id;
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${_esc(o.location_name)}</td>
      <td>${_esc(o.country)}</td>
      <td class="mono-cell">${o.timestamp.slice(0, 16)}</td>
      <td><span class="temp-badge" style="background:${_tempColor(o.temperature)}">${o.temperature.toFixed(1)}</span></td>
      <td>${o.humidity}</td>
      <td>${o.wind_speed.toFixed(1)}</td>
      <td>${o.pressure.toFixed(1)}</td>
      <td>${o.precipitation.toFixed(2)}</td>
    `;
    tr.addEventListener("click", () => _onTableRowClick(o.sensor_id, tr));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  const info = document.getElementById("sosTableInfo");
  const sensorCount = new Set(obs.map((o) => o.sensor_id)).size;
  if (info) info.textContent = `${obs.length} obs · ${sensorCount} sensors`;
}

function _onTableRowClick(sensorId, rowEl) {
  // deselect previous row
  document
    .querySelectorAll("#sosDataTable tbody tr.sos-row-selected")
    .forEach((r) => r.classList.remove("sos-row-selected"));
  rowEl.classList.add("sos-row-selected");

  _selectSensor(sensorId);

  // pan map to marker and open popup
  const f = sosMarkerSource.getFeatures().find((f) => f.get("sensor_id") === sensorId);
  if (f) {
    const coord = f.getGeometry().getCoordinates();
    sosMap.getView().animate({ center: coord, zoom: Math.max(sosMap.getView().getZoom(), 4), duration: 500 });
    _showSensorPopup(sensorId, coord);
  }
}

function _highlightTableRow(sensorId) {
  document
    .querySelectorAll("#sosDataTable tbody tr.sos-row-selected")
    .forEach((r) => r.classList.remove("sos-row-selected"));
  const row = document.querySelector(
    `#sosDataTable tbody tr[data-sensor-id="${CSS.escape(sensorId)}"]`,
  );
  if (row) {
    row.classList.add("sos-row-selected");
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Charts (Chart.js)
function _renderCharts(obs) {
  if (!obs.length) return;

  // Aggregate by city
  const byCity = {};
  obs.forEach((o) => {
    if (!byCity[o.location_name]) byCity[o.location_name] = { temps: [], count: 0 };
    byCity[o.location_name].temps.push(o.temperature);
    byCity[o.location_name].count++;
  });

  const cities = Object.keys(byCity)
    .map((c) => ({
      city: c,
      avg: byCity[c].temps.reduce((s, v) => s + v, 0) / byCity[c].temps.length,
      count: byCity[c].count,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const tickColor = isDark ? "#9aa5be" : "#6b7280";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // Bar chart — avg temperature by city
  const barCtx = document.getElementById("sosBarChart");
  if (_barChart) { _barChart.destroy(); _barChart = null; }
  if (barCtx) {
    _barChart = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: cities.map((c) => c.city),
        datasets: [{
          label: "Avg Temp (°C)",
          data: cities.map((c) => +c.avg.toFixed(1)),
          backgroundColor: cities.map((c) => _tempColor(c.avg)),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Avg Temperature by City (top 10)",
            color: tickColor,
            font: { size: 11, weight: "600" },
          },
        },
        scales: {
          y: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor, font: { size: 9 }, maxRotation: 40 }, grid: { display: false } },
        },
      },
    });
  }

  // Doughnut chart — observation count per city
  const pieCtx = document.getElementById("sosPieChart");
  if (_pieChart) { _pieChart.destroy(); _pieChart = null; }
  if (pieCtx) {
    const COLORS = ["#4f6ef7","#10b981","#f59e0b","#ef4444","#8b5cf6","#0fd6c2","#f43f5e","#fb923c","#34d399","#60a5fa"];
    const top = cities.slice(0, 8);
    _pieChart = new Chart(pieCtx, {
      type: "doughnut",
      data: {
        labels: top.map((c) => c.city),
        datasets: [{
          data: top.map((c) => c.count),
          backgroundColor: COLORS.slice(0, top.length),
          borderWidth: 2,
          borderColor: isDark ? "#181c27" : "#ffffff",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: tickColor, font: { size: 9 }, boxWidth: 11, padding: 6 },
          },
          title: {
            display: true,
            text: "Observation Count by City",
            color: tickColor,
            font: { size: 11, weight: "600" },
          },
        },
      },
    });
  }
}

// BBOX draw on SOS map
function activateSosBBoxDraw() {
  if (!sosMap) return;
  if (sosDrawInteraction) sosMap.removeInteraction(sosDrawInteraction);
  sosDrawLayer.getSource().clear();

  sosDrawInteraction = new ol.interaction.Draw({
    source: sosDrawLayer.getSource(),
    type: "Circle",
    geometryFunction: ol.interaction.Draw.createBox(),
  });
  sosMap.addInteraction(sosDrawInteraction);
  showNotification("Click and drag to draw BBOX on SOS map", "info");

  sosDrawInteraction.on("drawend", (e) => {
    const ext = e.feature.getGeometry().getExtent();
    const b = ol.proj.transformExtent(ext, "EPSG:3857", "EPSG:4326");
    document.getElementById("sosMinLon").value = b[0].toFixed(4);
    document.getElementById("sosMinLat").value = b[1].toFixed(4);
    document.getElementById("sosMaxLon").value = b[2].toFixed(4);
    document.getElementById("sosMaxLat").value = b[3].toFixed(4);
    sosMap.removeInteraction(sosDrawInteraction);
    sosDrawInteraction = null;
    setTimeout(() => sosDrawLayer.getSource().clear(), 800);
    showNotification("SOS BBOX updated", "success");
  });
}

function _getSosBBOX() {
  const minLon = document.getElementById("sosMinLon").value.trim();
  const minLat = document.getElementById("sosMinLat").value.trim();
  const maxLon = document.getElementById("sosMaxLon").value.trim();
  const maxLat = document.getElementById("sosMaxLat").value.trim();
  if (minLon && minLat && maxLon && maxLat) return `${minLon},${minLat},${maxLon},${maxLat}`;
  return null;
}

// Utilities
function _setSOSURL(url) {
  const el = document.getElementById("sosRequestURL");
  if (el) el.textContent = url;
}

function copySOSXML() {
  const pre = document.getElementById("sosXmlOutput");
  if (!pre || !pre.textContent.trim()) return;
  navigator.clipboard.writeText(pre.textContent).then(() =>
    showNotification("XML copied to clipboard", "success", 2000),
  );
}

function _esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
