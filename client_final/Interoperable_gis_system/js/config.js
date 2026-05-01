// --- CONFIG ---
const CONFIG = {
  DEFAULT_WMS_URL: "http://localhost:8080/geoserver/gnr629/wms",
  DEFAULT_WFS_URL: "http://localhost:8080/geoserver/gnr629/wfs",
  DEFAULT_ZOOM: 4,
  DEFAULT_CENTER: [78, 22],
  // proxy for external servers (they block direct requests from browser)
  // set to "" to disable. example: "https://corsproxy.io/?"
  CORS_PROXY: "",
};

// --- STATUS BAR ---
function setStatus(text, state = "idle") {
  const dot = document.getElementById("statusDot");
  const span = document.getElementById("statusText");
  if (!dot || !span) return;
  dot.className = "status-dot";
  if (state === "loading") dot.classList.add("loading");
  else if (state === "active") dot.classList.add("active");
  else if (state === "error") dot.classList.add("error");
  span.textContent = text;
}

// --- TOAST ---
let _toastTimer = null;
function showNotification(message, type = "info", duration = 3000) {
  const t = document.getElementById("toast");
  if (!t) return;
  clearTimeout(_toastTimer);
  t.textContent = message;
  t.className = `toast ${type} show`;
  _toastTimer = setTimeout(() => {
    t.className = "toast";
  }, duration);
}

// --- FETCH WITH OPTIONAL PROXY ---
// fetching a URL, using CORS proxy if set (skip for localhost)
function ogcFetch(url, options = {}) {
  let finalUrl = url;
  // only proxy if url is not localhost and proxy is set
  if (
    CONFIG.CORS_PROXY &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  ) {
    finalUrl = CONFIG.CORS_PROXY + encodeURIComponent(url);
  }
  return fetch(finalUrl, { mode: "cors", ...options });
}

// --- URL HELPERS ---
function getBaseURL() {
  return document.getElementById("requestURL").value.trim().split("?")[0];
}

function getWMSBaseURL() {
  // If URL already looks like a WFS endpoint, swap it; otherwise use as-is
  return getBaseURL().replace(/\/wfs\b/i, "/wms");
}

function getWFSBaseURL() {
  return getBaseURL().replace(/\/wms\b/i, "/wfs");
}

function updateURLDisplay(url) {
  document.getElementById("requestURL").value = url;
  _updateURLHint(url);
}

function _updateURLHint(url) {
  const hint = document.getElementById("urlHint");
  if (!hint) return;
  const lower = url.toLowerCase();
  if (
    lower.includes("request=getcapabilities") &&
    lower.includes("service=wms")
  ) {
    hint.textContent = "WMS · GetCapabilities";
    hint.style.color = "var(--btn-wms-text)";
  } else if (lower.includes("request=getmap")) {
    hint.textContent = "WMS · GetMap";
    hint.style.color = "var(--btn-getmap-text)";
  } else if (lower.includes("request=getfeatureinfo")) {
    hint.textContent = "WMS · GetFeatureInfo";
    hint.style.color = "var(--btn-wms-text)";
  } else if (
    lower.includes("request=getcapabilities") &&
    lower.includes("service=wfs")
  ) {
    hint.textContent = "WFS · GetCapabilities";
    hint.style.color = "var(--btn-wfs-text)";
  } else if (lower.includes("request=getfeature")) {
    hint.textContent = "WFS · GetFeature";
    hint.style.color = "var(--btn-getfeature-text)";
  } else if (lower.includes("wfs")) {
    hint.textContent = "WFS endpoint";
    hint.style.color = "var(--btn-wfs-text)";
  } else {
    hint.textContent = "WMS endpoint";
    hint.style.color = "var(--accent-teal)";
  }
}
