// --- XML PARSER ---

// displaying raw XML text, formatted nicely
function displayXMLResponse(rawText, label = "") {
  const pre = document.getElementById("xmlOutput");
  if (!pre) return;
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(rawText, "text/xml");
    const xs = new XMLSerializer();
    // just formatting as indented string
    pre.textContent = formatXML(rawText);
  } catch (e) {
    pre.textContent = rawText;
  }
}

// indenting XML string
function formatXML(xml) {
  let formatted = "";
  let indent = 0;
  const lines = xml.replace(/>\s*</g, ">\n<").split("\n");
  lines.forEach((line) => {
    line = line.trim();
    if (!line) return;
    if (line.startsWith("</")) indent = Math.max(0, indent - 1);
    formatted += "  ".repeat(indent) + line + "\n";
    if (
      !line.startsWith("</") &&
      !line.endsWith("/>") &&
      !line.startsWith("<?") &&
      !line.startsWith("<!")
    ) {
      if (line.includes("<") && !line.includes("</")) indent++;
    }
  });
  return formatted.trim();
}

// copying XML to clipboard
function copyXML() {
  const pre = document.getElementById("xmlOutput");
  if (!pre || !pre.textContent.trim()) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    showNotification("XML copied to clipboard", "success");
  });
}

// --- PARSED TABLE HELPERS ---

// clearing and rebuilding table with rows
function buildTable(rows) {
  const table = document.getElementById("parsedTable");
  if (!table) return;

  // removing old rows
  let tbody = table.querySelector("tbody");
  if (tbody) table.removeChild(tbody);
  tbody = document.createElement("tbody");

  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.className = "table-empty";
    td.textContent = "No data to display";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach(([key, value]) => {
      const tr = document.createElement("tr");
      const tdKey = document.createElement("td");
      const tdVal = document.createElement("td");
      tdKey.textContent = key;
      tdVal.textContent = String(value ?? "").substring(0, 400);
      if (String(value ?? "").length > 400) tdVal.title = String(value);
      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
}

// parsing capabilities XML and populating table
function parseCapabilitiesXML(rawText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rawText, "text/xml");
  const root = xmlDoc.documentElement;
  const rows = [];

  // getting text from first matching tag
  const getText = (parent, tag) => {
    const el = parent.querySelector(tag);
    return el ? el.textContent.trim() : null;
  };

  const tagName = root.tagName || "";

  // checking WMS capabilities
  if (
    tagName.includes("WMS_Capabilities") ||
    tagName.includes("WMT_MS_Capabilities")
  ) {
    const service = root.querySelector("Service");
    if (service) {
      rows.push(["Service Name", getText(service, "Name") || "—"]);
      rows.push(["Service Title", getText(service, "Title") || "—"]);
      rows.push(["Service Abstract", getText(service, "Abstract") || "—"]);
      const onlineRes = service.querySelector("OnlineResource");
      if (onlineRes)
        rows.push([
          "Online Resource",
          onlineRes.getAttribute("xlink:href") || "—",
        ]);
    }

    // counting layers
    const layerNodes = xmlDoc.querySelectorAll("Layer > Name");
    rows.push(["Total Named Layers", layerNodes.length]);

    // getting supported SRS/CRS
    const srsSet = new Set();
    xmlDoc
      .querySelectorAll("SRS, CRS")
      .forEach((el) => srsSet.add(el.textContent.trim()));
    if (srsSet.size)
      rows.push(["Supported SRS/CRS", [...srsSet].slice(0, 8).join(", ")]);

    // getting supported formats for GetMap
    const fmtEls = xmlDoc.querySelectorAll(
      "GetMap Format, GetCapabilities Format",
    );
    const fmts = [...new Set([...fmtEls].map((e) => e.textContent.trim()))];
    if (fmts.length) rows.push(["GetMap Formats", fmts.join(", ")]);

    // getting supported formats for GetFeatureInfo
    const gfiFmts = [...xmlDoc.querySelectorAll("GetFeatureInfo Format")].map(
      (e) => e.textContent.trim(),
    );
    if (gfiFmts.length)
      rows.push(["GetFeatureInfo Formats", gfiFmts.join(", ")]);

    // getting WMS version
    rows.push(["WMS Version", root.getAttribute("version") || "—"]);

    // listing individual layers
    const allLayers = xmlDoc.querySelectorAll("Layer[queryable], Layer");
    const shown = [];
    allLayers.forEach((l) => {
      const n = l.querySelector(":scope > Name");
      const t = l.querySelector(":scope > Title");
      if (n && n.textContent.trim()) {
        shown.push([
          `Layer: ${n.textContent.trim()}`,
          t ? t.textContent.trim() : "—",
        ]);
      }
    });
    shown.slice(0, 40).forEach((r) => rows.push(r));

    // checking WFS capabilities
  } else if (
    tagName.includes("WFS_Capabilities") ||
    root.getAttribute("xmlns:wfs")
  ) {
    const svcIdent = root.querySelector(
      "ServiceIdentification, ServiceProvider",
    );
    if (svcIdent) {
      rows.push(["Service Title", getText(svcIdent, "Title") || "—"]);
      rows.push(["Service Abstract", getText(svcIdent, "Abstract") || "—"]);
    }

    const ops = [...xmlDoc.querySelectorAll("Operation")]
      .map((el) => el.getAttribute("name"))
      .filter(Boolean);
    if (ops.length) rows.push(["Supported Operations", ops.join(", ")]); // getting operations

    const featureTypes = xmlDoc.querySelectorAll("FeatureType");
    rows.push(["Total Feature Types", featureTypes.length]);

    featureTypes.forEach((ft) => {
      const n = getText(ft, "Name");
      const t = getText(ft, "Title");
      const crs = getText(ft, "DefaultCRS, DefaultSRS");
      if (n)
        rows.push([`Feature: ${n}`, t ? `${t} — ${crs || ""}` : crs || "—"]);
    });

    rows.push(["WFS Version", root.getAttribute("version") || "—"]);
  } else {
    // fallback - extracting all tags
    const tags = xmlDoc.getElementsByTagName("*");
    const seen = new Set();
    for (let i = 0; i < Math.min(tags.length, 200); i++) {
      const name = tags[i].nodeName;
      const val = tags[i].textContent.trim();
      if (val && val.length < 300 && !seen.has(name + val)) {
        seen.add(name + val);
        rows.push([name, val.substring(0, 200)]);
      }
    }
  }

  buildTable(rows);
}

// parsing GeoJSON and showing features in table
function parseGeoJSONTable(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    buildTable([]);
    return;
  }

  const features = geojson.features;

  // collecting all keys from features
  const allKeys = new Set();
  features.forEach((f) => {
    if (f.properties) Object.keys(f.properties).forEach((k) => allKeys.add(k));
  });
  const keys = [...allKeys].filter((k) => k !== "geometry");

  if (keys.length === 0) {
    buildTable([["Feature Count", features.length]]);
    return;
  }

  // building rows from feature properties
  const table = document.getElementById("parsedTable");
  if (!table) return;

  // creating header row with features
  let thead = table.querySelector("thead");
  if (thead) table.removeChild(thead);
  thead = document.createElement("thead");
  const tr = document.createElement("tr");

  const thIdx = document.createElement("th");
  thIdx.textContent = "#";
  tr.appendChild(thIdx);

  keys.forEach((k) => {
    const th = document.createElement("th");
    th.textContent = k;
    th.style.whiteSpace = "nowrap";
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);

  let tbody = table.querySelector("tbody");
  if (tbody) table.removeChild(tbody);
  tbody = document.createElement("tbody");

  features.slice(0, 200).forEach((f, idx) => {
    const row = document.createElement("tr");
    const tdIdx = document.createElement("td");
    tdIdx.textContent = idx + 1;
    row.appendChild(tdIdx);
    keys.forEach((k) => {
      const td = document.createElement("td");
      const val = f.properties ? (f.properties[k] ?? "") : "";
      td.textContent = String(val).substring(0, 200);
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
}

/**
 * Reset the parsed table to two-column header state.
 */
function resetTableHeader() {
  const table = document.getElementById("parsedTable");
  if (!table) return;
  let thead = table.querySelector("thead");
  if (thead) table.removeChild(thead);
  thead = document.createElement("thead");
  const tr = document.createElement("tr");
  ["Property", "Value"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);
}
