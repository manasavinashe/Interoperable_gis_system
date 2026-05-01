// map.js — OGC GIS Client map logic
// handles map init, WMS/WFS layers, feature info, drawing tools

const map = new ol.Map({
  target: "map",
  layers: [new ol.layer.Tile({ source: new ol.source.OSM(), zIndex: 0 })],
  view: new ol.View({
    center: ol.proj.fromLonLat([78, 22]),
    zoom: 4,
    projection: "EPSG:3857",
  }),
});

let addedLayers = {}; // layerId → { name, layer, type, url }
let layerCounter = 0;
let layerExtents = {}; // layerName → { minx, miny, maxx, maxy }
let layerSRS = {}; // layerName → ["EPSG:4326", ...]

// canceling pending feature info if user clicks again
let _gfiAbortCtrl = null;

// highlighting + drawing layers (for showing what's selected)
const highlightLayer = new ol.layer.Vector({
  source: new ol.source.Vector(),
  style: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: "#FF6600", width: 3 }),
    fill: new ol.style.Fill({ color: "rgba(255,102,0,0.15)" }),
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({ color: "#FF6600" }),
      stroke: new ol.style.Stroke({ color: "#fff", width: 2 }),
    }),
  }),
  zIndex: 1000,
});
map.addLayer(highlightLayer);

const drawLayer = new ol.layer.Vector({
  source: new ol.source.Vector(),
  style: new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: "#0fd6c2",
      width: 2,
      lineDash: [6, 3],
    }),
    fill: new ol.style.Fill({ color: "rgba(15,214,194,0.08)" }),
  }),
  zIndex: 999,
});
map.addLayer(drawLayer);
let drawInteraction = null;

// popup overlay - NOTE: must be on body, not inside #map for ol.Overlay positioning
const popupEl = document.getElementById("feature-popup");
document.body.appendChild(popupEl);
popupEl.style.cssText += ";display:block;position:absolute;";

const popupOverlay = new ol.Overlay({
  element: popupEl,
  autoPan: { animation: { duration: 200 } },
  positioning: "bottom-center",
  stopEvent: true,
  offset: [0, -12],
});
map.addOverlay(popupOverlay);

function closeFeaturePopup() {
  popupOverlay.setPosition(undefined);
  highlightLayer.getSource().clear();
}

function showFeaturePopup(coordinate, props) {
  const content = document.getElementById("feature-popup-content");
  content.innerHTML = "";

  const keys = Object.keys(props).filter(
    (k) =>
      props[k] != null &&
      props[k] !== "" &&
      !["geometry", "the_geom", "boundedBy"].includes(k),
  );

  if (!keys.length) {
    content.innerHTML =
      '<p style="color:#888;font-size:12px;padding:4px">No attributes found</p>';
  } else {
    keys.forEach((k) => {
      const row = document.createElement("div");
      row.className = "popup-row";
      row.innerHTML =
        `<span class="popup-key">${esc(k)}</span>` +
        `<span class="popup-val">${esc(String(props[k]).slice(0, 300))}</span>`;
      content.appendChild(row);
    });
  }
  popupOverlay.setPosition(coordinate);
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
// keep old name for compatibility
function _esc(s) {
  return esc(s);
}

// drawing bbox tool
function activateBBoxDraw() {
  if (drawInteraction) map.removeInteraction(drawInteraction);
  drawLayer.getSource().clear();

  drawInteraction = new ol.interaction.Draw({
    source: drawLayer.getSource(),
    type: "Circle",
    geometryFunction: ol.interaction.Draw.createBox(),
  });
  map.addInteraction(drawInteraction);
  showNotification("Click and drag to draw BBOX", "info");

  drawInteraction.on("drawend", (e) => {
    const ext = e.feature.getGeometry().getExtent();
    const bbox4326 = ol.proj.transformExtent(ext, "EPSG:3857", "EPSG:4326");
    document.getElementById("minx").value = bbox4326[0].toFixed(4);
    document.getElementById("miny").value = bbox4326[1].toFixed(4);
    document.getElementById("maxx").value = bbox4326[2].toFixed(4);
    document.getElementById("maxy").value = bbox4326[3].toFixed(4);

    map.removeInteraction(drawInteraction);
    drawInteraction = null;
    setTimeout(() => drawLayer.getSource().clear(), 800);
    showNotification("BBOX updated", "success");
  });
}

// adding WMS layer to map
// using ImageWMS (one request per view) to avoid tile-seam issues
// NOTE: no crossOrigin - setting it breaks localhost GeoServer
function addWMSLayer(layerName, wmsUrl, extraParams) {
  const params = Object.assign(
    { LAYERS: layerName, TRANSPARENT: true },
    extraParams || {},
  );

  const id = "layer_" + layerCounter;
  const layer = new ol.layer.Image({
    title: layerName,
    source: new ol.source.ImageWMS({
      url: wmsUrl,
      params: params,
      serverType: "geoserver",
    }),
    visible: true,
    opacity: 1.0,
    zIndex: layerCounter + 10, // higher counter = higher z = renders on top
  });
  layerCounter++;
  addedLayers[id] = { name: layerName, layer, type: "wms", url: wmsUrl };
  map.addLayer(layer);
  addLayerToChecklist(id, layerName, layer, "wms");
  fitMapToLayerExtent(layerName);
  showNotification(`WMS layer "${layerName}" added`, "success");
  return id;
}

// adding WFS layer to map
function addWFSLayer(layerName, geojson) {
  const source = new ol.source.Vector({
    features: new ol.format.GeoJSON().readFeatures(geojson, {
      featureProjection: "EPSG:3857",
    }),
  });

  const id = "layer_" + layerCounter;
  const layer = new ol.layer.Vector({
    title: layerName,
    source: source,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#3399CC", width: 2 }),
      fill: new ol.style.Fill({ color: "rgba(51,153,204,0.2)" }),
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: "#3399CC" }),
        stroke: new ol.style.Stroke({ color: "#fff", width: 2 }),
      }),
    }),
    visible: true,
    opacity: 1.0,
    zIndex: layerCounter + 10,
  });
  layerCounter++;
  addedLayers[id] = { name: layerName, layer, type: "wfs" };
  map.addLayer(layer);
  addLayerToChecklist(id, layerName, layer, "wfs");

  const ext = source.getExtent();
  if (ext && isFinite(ext[0]) && ext[0] !== Infinity) {
    map
      .getView()
      .fit(ext, { padding: [40, 40, 40, 40], maxZoom: 16, duration: 600 });
  }
  return id;
}

// zooming/fitting extent helpers
function fitMapToLayerExtent(layerName) {
  const e = layerExtents[layerName];
  if (!e || !isFinite(e.minx)) return;
  map
    .getView()
    .fit(
      ol.proj.transformExtent(
        [e.minx, e.miny, e.maxx, e.maxy],
        "EPSG:4326",
        "EPSG:3857",
      ),
      { padding: [40, 40, 40, 40], maxZoom: 16, duration: 600 },
    );
}

function fitMapToAllLayers() {
  const layers = Object.values(addedLayers);
  if (!layers.length) {
    showNotification("No layers added yet", "info");
    return;
  }

  let combined = null;
  layers.forEach((info) => {
    let ext = null;
    if (info.type === "wfs") {
      const e = info.layer.getSource().getExtent();
      if (e && isFinite(e[0]) && e[0] !== Infinity) ext = e;
    } else if (layerExtents[info.name]) {
      const le = layerExtents[info.name];
      ext = ol.proj.transformExtent(
        [le.minx, le.miny, le.maxx, le.maxy],
        "EPSG:4326",
        "EPSG:3857",
      );
    }
    if (ext)
      combined = combined ? ol.extent.extend(combined, ext) : ext.slice();
  });

  if (combined)
    map
      .getView()
      .fit(combined, { padding: [40, 40, 40, 40], maxZoom: 16, duration: 600 });
}

// bounding box field helpers
function getBBOX() {
  return {
    minx: parseFloat(document.getElementById("minx").value) || -180,
    miny: parseFloat(document.getElementById("miny").value) || -90,
    maxx: parseFloat(document.getElementById("maxx").value) || 180,
    maxy: parseFloat(document.getElementById("maxy").value) || 90,
  };
}

function isBBoxExplicitlySet() {
  return ["minx", "miny", "maxx", "maxy"].every((id) => {
    const v = document.getElementById(id).value.trim();
    return v !== "" && !isNaN(parseFloat(v));
  });
}

// managing layer checklist (added layers panel)
function addLayerToChecklist(layerId, layerName, layer, type) {
  const checklist = document.getElementById("layerChecklist");
  if (!checklist) return;
  checklist.querySelector(".checklist-empty")?.remove();

  const item = document.createElement("div");
  item.className = "layer-item";
  item.id = "checklist_" + layerId;

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = true;
  cb.onchange = () => layer.setVisible(cb.checked);

  const nameSpan = document.createElement("span");
  nameSpan.className = "layer-item-name";
  nameSpan.textContent = layerName;
  nameSpan.title = layerName;

  const badge = document.createElement("span");
  badge.className = `layer-type-badge layer-type-${type}`;
  badge.textContent = type.toUpperCase();

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = 1;
  slider.step = 0.05;
  slider.value = 1;
  slider.className = "layer-opacity";
  slider.title = "Opacity";
  slider.oninput = () => layer.setOpacity(parseFloat(slider.value));

  const removeBtn = document.createElement("button");
  removeBtn.className = "layer-remove-btn";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove layer";
  removeBtn.onclick = () => {
    map.removeLayer(layer);
    delete addedLayers[layerId];
    item.remove();
    if (!checklist.querySelector(".layer-item")) {
      checklist.innerHTML =
        '<div class="checklist-empty">No layers added yet</div>';
    }
    showNotification("Layer removed", "info", 1500);
  };

  const controls = document.createElement("div");
  controls.className = "layer-item-controls";
  controls.append(badge, slider, removeBtn);

  item.append(cb, nameSpan, controls);

  // adding newest layer at the top
  checklist.insertBefore(item, checklist.firstChild);
}

function clearAllLayers() {
  Object.values(addedLayers).forEach((info) => map.removeLayer(info.layer));
  addedLayers = {};
  document.getElementById("layerChecklist").innerHTML =
    '<div class="checklist-empty">No layers added yet</div>';
  showNotification("All layers cleared", "info");
}

// getting feature info on map click
// query WMS layers from top to bottom
map.on("click", function (evt) {
  if (drawInteraction) return;
  closeFeaturePopup();

  // WFS vector features are checked first — they respond instantly client-side
  let hitVector = false;
  map.forEachFeatureAtPixel(
    evt.pixel,
    (feature, lyr) => {
      if (lyr === drawLayer || lyr === highlightLayer) return;
      if (lyr instanceof ol.layer.Vector) {
        hitVector = true;
        handleVectorClick(feature, evt.coordinate);
        return true;
      }
    },
    { hitTolerance: 6 },
  );
  if (hitVector) return;

  // collect visible WMS layers, sorted highest zIndex first (= topmost on map)
  const wmsLayers = Object.values(addedLayers)
    .filter((i) => i.type === "wms" && i.layer.getVisible())
    .sort((a, b) => b.layer.getZIndex() - a.layer.getZIndex());

  if (!wmsLayers.length) return;

  // cancel any pending request from a previous click
  if (_gfiAbortCtrl) _gfiAbortCtrl.abort();
  _gfiAbortCtrl = new AbortController();

  // viewport dimensions — must match what the server rendered
  const mapSize = map.getSize();
  const viewExt = map.getView().calculateExtent(mapSize);
  const bbox4326 = ol.proj.transformExtent(viewExt, "EPSG:3857", "EPSG:4326");
  const W = mapSize[0];
  const H = mapSize[1];
  const px = Math.round(evt.pixel[0]);
  const py = Math.round(evt.pixel[1]);
  const maxFeat =
    parseInt(document.getElementById("maxFeaturesInput").value) || 5;
  const signal = _gfiAbortCtrl.signal;

  setStatus("Querying feature…", "loading");

  // try each layer in order; stop as soon as one returns features
  queryNextLayer(wmsLayers, 0);

  function queryNextLayer(layers, idx) {
    if (idx >= layers.length) {
      setStatus("Ready", "idle");
      showNotification("No features found at this location", "info", 2000);
      return;
    }

    const info = layers[idx];

    const params = new URLSearchParams({
      service: "WMS",
      version: "1.1.1",
      request: "GetFeatureInfo",
      layers: info.name,
      query_layers: info.name,
      styles: "",
      bbox: `${bbox4326[0]},${bbox4326[1]},${bbox4326[2]},${bbox4326[3]}`,
      width: W,
      height: H,
      srs: "EPSG:4326",
      info_format: "application/json",
      x: px,
      y: py,
      feature_count: maxFeat,
    });

    const url = info.url + "?" + params.toString();

    // show the URL of whichever layer we're currently querying
    updateURLDisplay(url);

    const timeout = setTimeout(() => {
      _gfiAbortCtrl.abort();
      setStatus("Ready", "idle");
      showNotification("Feature query timed out", "warning");
    }, 10000);

    fetch(url, { signal })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        clearTimeout(timeout);

        if (!data.features || !data.features.length) {
          // nothing here — try the layer below
          queryNextLayer(layers, idx + 1);
          return;
        }

        setStatus("Ready", "idle");

        const feat = data.features[0];
        const props = Object.assign({}, feat.properties || {});
        delete props.geometry;

        highlightLayer.getSource().clear();
        if (feat.geometry) {
          try {
            const f = new ol.format.GeoJSON().readFeature(feat, {
              featureProjection: "EPSG:3857",
            });
            highlightLayer.getSource().addFeature(f);
          } catch (e) {}
        }

        resetTableHeader();
        buildTable(Object.entries(props).map(([k, v]) => [k, String(v ?? "")]));
        showFeaturePopup(evt.coordinate, props);
        document.getElementById("xmlOutput").textContent = JSON.stringify(
          data,
          null,
          2,
        );

        const n = data.features.length;
        const layerLabel = idx > 0 ? ` (from "${info.name}")` : "";
        showNotification(
          n + " feature" + (n > 1 ? "s" : "") + " found" + layerLabel,
          "success",
          2500,
        );
      })
      .catch((err) => {
        clearTimeout(timeout);
        if (err.name === "AbortError") return;
        // if this layer errored, try the next one rather than giving up entirely
        queryNextLayer(layers, idx + 1);
      });
  }
});

function handleVectorClick(feature, coordinate) {
  highlightLayer.getSource().clear();
  highlightLayer.getSource().addFeature(feature.clone());

  const props = Object.assign({}, feature.getProperties());
  delete props.geometry;
  delete props.the_geom;
  delete props.boundedBy;

  resetTableHeader();
  buildTable(Object.entries(props).map(([k, v]) => [k, String(v ?? "")]));
  showFeaturePopup(coordinate, props);
  showNotification("Feature selected", "success", 1500);
}

// refreshing WMS layers with new format
function updateWMSLayerParams() {
  const fmt = document.getElementById("formatSelect").value || "image/png";
  Object.values(addedLayers).forEach((info) => {
    if (info.type !== "wms") return;
    info.layer.getSource().updateParams({ FORMAT: fmt });
  });
}

// zooming map to manually entered bbox values
function applyBBoxToMap() {
  if (!isBBoxExplicitlySet()) {
    showNotification("Enter all four BBOX values first", "warning");
    return;
  }

  const b = getBBOX();

  // basic sanity check
  if (b.minx >= b.maxx || b.miny >= b.maxy) {
    showNotification(
      "BBOX is invalid — min values must be less than max",
      "error",
    );
    return;
  }
  if (b.minx < -180 || b.maxx > 180 || b.miny < -90 || b.maxy > 90) {
    showNotification(
      "BBOX out of range — lon must be -180…180, lat -90…90",
      "warning",
    );
    // still try to apply it, just warn
  }

  const ext3857 = ol.proj.transformExtent(
    [b.minx, b.miny, b.maxx, b.maxy],
    "EPSG:4326",
    "EPSG:3857",
  );

  map.getView().fit(ext3857, {
    padding: [30, 30, 30, 30],
    duration: 500,
  });

  showNotification("Map view updated to BBOX", "success", 2000);
}
