function showTab(tab) {
  const ogc = document.getElementById("ogcTab");
  const sos = document.getElementById("sosTab");

  if (tab === "ogc") {
    ogc.style.display = "flex";
    sos.style.display = "none";
    setTimeout(() => { if (window.map) map.updateSize(); }, 100);
  } else {
    ogc.style.display = "none";
    sos.style.display = "flex";
    // initialise SOS map the first time the tab opens
    setTimeout(() => {
      initSOSMap();
      if (window.sosMap) sosMap.updateSize();
    }, 80);
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");
}
