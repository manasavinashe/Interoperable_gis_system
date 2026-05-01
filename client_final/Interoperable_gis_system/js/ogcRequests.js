// ═══════════════════════════════════════════════════════════════════════════════
// OGCREQUESTS.JS  –  WMS/WFS request logic + layer population
// ═══════════════════════════════════════════════════════════════════════════════

// getting WMS capabilities
function wmsGetCapabilities() {
  const base = getWMSBaseURL();
  const url = base + "?service=WMS&version=1.1.1&request=GetCapabilities";
  updateURLDisplay(url);
  setStatus("Fetching WMS Capabilities…", "loading");
  showNotification("Fetching WMS Capabilities…", "info");
  _showMapLoading(true);

  ogcFetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then((text) => {
      document.getElementById("xmlOutput").textContent = text;
      _populateLayersFromWMS(text);
      setStatus("WMS Capabilities loaded", "active");
      showNotification("WMS Capabilities loaded", "success");
    })
    .catch((err) => {
      setStatus("Error", "error");
      showNotification("WMS Error: " + err.message, "error");
    })
    .finally(() => _showMapLoading(false));
}

// getting WFS capabilities
function wfsGetCapabilities() {
  const base = getWFSBaseURL();
  const url = base + "?service=WFS&version=2.0.0&request=GetCapabilities";
  updateURLDisplay(url);
  setStatus("Fetching WFS Capabilities…", "loading");
  showNotification("Fetching WFS Capabilities…", "info");
  _showMapLoading(true);

  ogcFetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then((text) => {
      document.getElementById("xmlOutput").textContent = text;
      _populateLayersFromWFS(text);
      setStatus("WFS Capabilities loaded", "active");
      showNotification("WFS Capabilities loaded", "success");
    })
    .catch((err) => {
      setStatus("Error", "error");
      showNotification("WFS Error: " + err.message, "error");
    })
    .finally(() => _showMapLoading(false));
}

// getting WMS map
function wmsGetMap() {
  const layerName = document.getElementById("layerSelect").value;
  if (!layerName) {
    showNotification("Select a layer first", "warning");
    return;
  }

  const base = getWMSBaseURL();
  const srs = document.getElementById("srsInput").value.trim() || "EPSG:4326";
  const fmt = document.getElementById("formatSelect").value || "image/png";
  const w = document.getElementById("widthInput").value || 800;
  const h = document.getElementById("heightInput").value || 600;

  // building display URL (for showing the request)
  const displayParams = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layerName,
    SRS: srs,
    FORMAT: fmt,
    WIDTH: w,
    HEIGHT: h,
    STYLES: "",
    TRANSPARENT: "TRUE",
  });
  if (isBBoxExplicitlySet()) {
    const b = getBBOX();
    displayParams.set("BBOX", `${b.minx},${b.miny},${b.maxx},${b.maxy}`);
  }
  updateURLDisplay(base + "?" + displayParams.toString());

  // adding layer to map (GeoServer handles SRS)
  addWMSLayer(layerName, base);
  setStatus("WMS: " + layerName, "active");
}

// getting WFS feature
function wfsGetFeature() {
  const layerName = document.getElementById("layerSelect").value;
  if (!layerName) {
    showNotification("Select a layer first", "warning");
    return;
  }

  const base = getWFSBaseURL();
  const maxFeat =
    parseInt(document.getElementById("maxFeaturesInput").value) || 200;

  if (
    maxFeat > 1000 &&
    !confirm(`Requesting ${maxFeat} features may freeze the browser. Continue?`)
  )
    return;

  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: layerName,
    outputFormat: "application/json",
    maxFeatures: maxFeat,
  });
  if (isBBoxExplicitlySet()) {
    const b = getBBOX();
    params.set("BBOX", `${b.minx},${b.miny},${b.maxx},${b.maxy},EPSG:4326`);
  }

  const url = base + "?" + params.toString();
  updateURLDisplay(url);
  setStatus("Loading WFS…", "loading");
  showNotification(`Fetching up to ${maxFeat} features…`, "info");
  _showMapLoading(true);

  ogcFetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then((text) => {
      document.getElementById("xmlOutput").textContent = text;
      let geojson;
      try {
        geojson = JSON.parse(text);
      } catch (e) {
        showNotification(
          "Response is not JSON — check outputFormat on server",
          "error",
        );
        setStatus("Error", "error");
        return;
      }
      const count = geojson.features ? geojson.features.length : 0;
      resetTableHeader();
      parseGeoJSONTable(geojson);
      if (count > 0) {
        addWFSLayer(layerName, geojson);
        setStatus(`WFS: ${count} features`, "active");
        showNotification(`${count} features loaded`, "success");
        const info = document.getElementById("parsedInfo");
        if (info) info.textContent = count + " features";
      } else {
        showNotification("No features returned", "warning");
        setStatus("No features", "idle");
      }
    })
    .catch((err) => {
      setStatus("Error", "error");
      showNotification("WFS Error: " + err.message, "error");
    })
    .finally(() => _showMapLoading(false));
}

// parsing WMS capabilities XML and populating layer list
// walking up layer nodes to collect all SRS for each layer
function _populateLayersFromWMS(xmlText) {
  const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
  layerExtents = {};
  layerSRS = {};

  const layerSelectEl = document.getElementById("layerSelect");
  const layerPreviewEl = document.getElementById("layerPreview");
  layerSelectEl.innerHTML = '<option value="">— select layer —</option>';
  layerPreviewEl.innerHTML = "";

  // getting direct element children by tag name
  function childrenByTag(el, tag) {
    const out = [];
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && (n.localName || n.tagName) === tag) out.push(n);
    }
    return out;
  }

  // normalizing SRS/CRS URN to EPSG format
  function normSRS(v) {
    return (v || "")
      .trim()
      .replace(/urn:ogc:def:crs:EPSG:[^:]*:(\d+)/i, "EPSG:$1")
      .replace(/urn:x-ogc:def:crs:EPSG:(\d+)/i, "EPSG:$1")
      .replace(/^CRS:84$/i, "EPSG:4326");
  }

  const allLayerEls = xmlDoc.getElementsByTagName("Layer");
  const namedLayers = [];

  for (let i = 0; i < allLayerEls.length; i++) {
    const el = allLayerEls[i];

    // only processing layers with a name
    const nameEls = childrenByTag(el, "Name");
    if (!nameEls.length) continue;
    const name = (nameEls[0].textContent || "").trim();
    if (!name) continue;

    const titleEls = childrenByTag(el, "Title");
    const title = titleEls.length
      ? (titleEls[0].textContent || "").trim()
      : name;

    // collecting SRS by walking up the layer chain
    const srsSet = new Set();
    srsSet.add("EPSG:4326"); // default SRS
    let node = el;
    while (node) {
      const tag = node.localName || node.tagName || "";
      if (tag !== "Layer") break;
      // getting SRS/CRS tags from this node
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        const ctag = c.localName || c.tagName || "";
        if (ctag === "SRS" || ctag === "CRS") {
          // can be space-separated (splitting them)
          (c.textContent || "")
            .trim()
            .split(/\s+/)
            .forEach((v) => {
              const n = normSRS(v);
              if (/^EPSG:\d+$/i.test(n)) srsSet.add(n);
            });
        }
      }
      node = node.parentNode;
    }
    layerSRS[name] = _sortSRS([...srsSet]);

    // getting bbox from LatLonBoundingBox or EX_GeographicBoundingBox
    const bbEls = childrenByTag(el, "LatLonBoundingBox");
    const exEls = childrenByTag(el, "EX_GeographicBoundingBox");
    let ext = null;
    if (bbEls.length) {
      const bb = bbEls[0];
      ext = {
        minx: parseFloat(bb.getAttribute("minx")),
        miny: parseFloat(bb.getAttribute("miny")),
        maxx: parseFloat(bb.getAttribute("maxx")),
        maxy: parseFloat(bb.getAttribute("maxy")),
      };
    } else if (exEls.length) {
      const ex = exEls[0];
      const _g = (t) => {
        const e = ex.getElementsByTagName(t);
        return e.length ? parseFloat(e[0].textContent) : NaN;
      };
      ext = {
        minx: _g("westBoundLongitude"),
        miny: _g("southBoundLatitude"),
        maxx: _g("eastBoundLongitude"),
        maxy: _g("northBoundLatitude"),
      };
    }
    if (ext && Object.values(ext).every(isFinite)) layerExtents[name] = ext;

    namedLayers.push({ name, title });
  }

  if (!namedLayers.length) {
    layerPreviewEl.innerHTML =
      '<div class="layer-preview-empty">No named layers found</div>';
    _updateLayerCountBadge(0);
    return;
  }

  // building layer list in UI
  namedLayers.forEach(({ name, title }) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    layerSelectEl.appendChild(opt);

    const srsList = layerSRS[name] || [];
    const item = document.createElement("div");
    item.className = "layer-preview-item";
    item.dataset.layerName = name;
    item.innerHTML = `
      <span class="lpi-dot"></span>
      <div>
        <div class="lpi-name">${_esc(name)}</div>
        ${title !== name ? `<div class="lpi-title">${_esc(title)}</div>` : ""}
        <div class="lpi-srs">${srsList.slice(0, 4).join(" · ")}${srsList.length > 4 ? " …" : ""}</div>
      </div>`;
    item.onclick = () => _selectLayer(name, item);
    layerPreviewEl.appendChild(item);
  });

  _updateLayerCountBadge(namedLayers.length);
  showNotification(`${namedLayers.length} WMS layers loaded`, "success");
}

// parsing WFS capabilities XML and populating layer list
function _populateLayersFromWFS(xmlText) {
  const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
  layerExtents = {};
  layerSRS = {};

  const layerSelectEl = document.getElementById("layerSelect");
  const layerPreviewEl = document.getElementById("layerPreview");
  layerSelectEl.innerHTML = '<option value="">— select layer —</option>';
  layerPreviewEl.innerHTML = "";

  function normCRS(v) {
    return (v || "")
      .trim()
      .replace(/urn:ogc:def:crs:EPSG:[^:]*:(\d+)/i, "EPSG:$1")
      .replace(/urn:x-ogc:def:crs:EPSG:(\d+)/i, "EPSG:$1");
  }

  const fts = xmlDoc.getElementsByTagName("FeatureType");
  if (!fts.length) {
    layerPreviewEl.innerHTML =
      '<div class="layer-preview-empty">No feature types found</div>';
    _updateLayerCountBadge(0);
    return;
  }

  for (let i = 0; i < fts.length; i++) {
    const ft = fts[i];
    const nameEls = ft.getElementsByTagName("Name");
    const titleEls = ft.getElementsByTagName("Title");
    if (!nameEls.length) continue;
    const name = (nameEls[0].textContent || "").trim();
    if (!name) continue;
    const title = titleEls.length
      ? (titleEls[0].textContent || "").trim()
      : name;

    const srsSet = new Set(["EPSG:4326"]); // default SRS
    ["DefaultCRS", "DefaultSRS", "OtherCRS", "OtherSRS"].forEach((tag) => {
      const els = ft.getElementsByTagName(tag);
      for (let j = 0; j < els.length; j++) {
        const v = normCRS((els[j].textContent || "").trim());
        if (/^EPSG:\d+$/i.test(v)) srsSet.add(v);
      }
    });
    layerSRS[name] = _sortSRS([...srsSet]);

    // getting bbox
    const bb2 = ft.getElementsByTagName("WGS84BoundingBox");
    const lb2 = ft.getElementsByTagName("LatLonBoundingBox");
    if (bb2.length) {
      const lc = bb2[0].getElementsByTagName("LowerCorner");
      const uc = bb2[0].getElementsByTagName("UpperCorner");
      if (lc.length && uc.length) {
        const lo = (lc[0].textContent || "").trim().split(/\s+/);
        const hi = (uc[0].textContent || "").trim().split(/\s+/);
        const ext = { minx: +lo[0], miny: +lo[1], maxx: +hi[0], maxy: +hi[1] };
        if (Object.values(ext).every(isFinite)) layerExtents[name] = ext;
      }
    } else if (lb2.length) {
      const lb = lb2[0];
      const ext = {
        minx: +lb.getAttribute("minx"),
        miny: +lb.getAttribute("miny"),
        maxx: +lb.getAttribute("maxx"),
        maxy: +lb.getAttribute("maxy"),
      };
      if (Object.values(ext).every(isFinite)) layerExtents[name] = ext;
    }

    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    layerSelectEl.appendChild(opt);

    const srsList = layerSRS[name] || [];
    const item = document.createElement("div");
    item.className = "layer-preview-item";
    item.dataset.layerName = name;
    item.innerHTML = `
      <span class="lpi-dot" style="background:var(--btn-wfs-text)"></span>
      <div>
        <div class="lpi-name">${_esc(name)}</div>
        ${title !== name ? `<div class="lpi-title">${_esc(title)}</div>` : ""}
        <div class="lpi-srs">${srsList.slice(0, 4).join(" · ")}${srsList.length > 4 ? " …" : ""}</div>
      </div>`;
    item.onclick = () => _selectLayer(name, item);
    layerPreviewEl.appendChild(item);
  }

  _updateLayerCountBadge(fts.length);
  showNotification(`${fts.length} WFS feature types loaded`, "success");
}

// selecting layer - updating bbox and SRS fields
function _selectLayer(layerName, itemEl) {
  document
    .querySelectorAll(".layer-preview-item")
    .forEach((e) => e.classList.remove("selected"));
  itemEl.classList.add("selected");
  document.getElementById("layerSelect").value = layerName;

  // auto-filling bbox fields
  if (layerExtents[layerName]) {
    const e = layerExtents[layerName];
    document.getElementById("minx").value = e.minx.toFixed(6);
    document.getElementById("miny").value = e.miny.toFixed(6);
    document.getElementById("maxx").value = e.maxx.toFixed(6);
    document.getElementById("maxy").value = e.maxy.toFixed(6);
  }

  // updating SRS input with this layer's default
  const srsList = layerSRS[layerName] || ["EPSG:4326"];
  const srsInput = document.getElementById("srsInput");
  if (srsInput) {
    srsInput.value = srsList[0]; // first = best (sorted: 4326 first)
    // Update the datalist suggestions
    _updateSRSDatalist(srsList);
  }

  showNotification(`"${layerName}" — SRS: ${srsList[0]}`, "info", 2000);
}

function onLayerSelectChange() {
  const val = document.getElementById("layerSelect").value;
  if (!val) return;
  document
    .querySelectorAll(".layer-preview-item")
    .forEach((el) =>
      el.classList.toggle("selected", el.dataset.layerName === val),
    );
  if (layerExtents[val]) {
    const e = layerExtents[val];
    document.getElementById("minx").value = e.minx.toFixed(6);
    document.getElementById("miny").value = e.miny.toFixed(6);
    document.getElementById("maxx").value = e.maxx.toFixed(6);
    document.getElementById("maxy").value = e.maxy.toFixed(6);
  }
  const srsList = layerSRS[val] || ["EPSG:4326"];
  const srsInput = document.getElementById("srsInput");
  if (srsInput) {
    srsInput.value = srsList[0];
    _updateSRSDatalist(srsList);
  }
}

// Update the <datalist> suggestions for the SRS input
function _updateSRSDatalist(srsList) {
  const dl = document.getElementById("srsSuggestions");
  if (!dl) return;
  dl.innerHTML = "";
  srsList.forEach((srs) => {
    const opt = document.createElement("option");
    opt.value = srs;
    dl.appendChild(opt);
  });
}

// helper functions
function _sortSRS(list) {
  return [...new Set(list)].sort((a, b) => {
    if (a === "EPSG:4326") return -1;
    if (b === "EPSG:4326") return 1;
    if (a === "EPSG:3857") return -1;
    if (b === "EPSG:3857") return 1;
    return a < b ? -1 : 1;
  });
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function _updateLayerCountBadge(n) {
  const b = document.getElementById("layerCountBadge");
  if (b) b.textContent = n;
}

function _showMapLoading(show) {
  let el = document.getElementById("mapLoading");
  if (show) {
    if (!el) {
      el = document.createElement("div");
      el.id = "mapLoading";
      el.className = "map-loading";
      el.textContent = "Loading…";
      document.getElementById("map").appendChild(el);
    }
  } else {
    el?.remove();
  }
}
