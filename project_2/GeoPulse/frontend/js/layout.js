document.addEventListener("DOMContentLoaded", () => {
  const rightPanel = document.querySelector(".right-panel");
  const mapPane = document.getElementById("mapPane");
  const responsePane = document.getElementById("responsePane");
  const divider = document.getElementById("paneDivider");
  const mapBtn = document.getElementById("mapCollapseBtn");
  const respBtn = document.getElementById("responseCollapseBtn");

  let mapCollapsed = false;
  let respCollapsed = false;

  const MIN_MAP = 80;
  const MIN_RESP = 60;

  let dragging = false;
  let startY, startMapH;

  divider.addEventListener("mousedown", (e) => {
    if (mapCollapsed || respCollapsed) return;
    dragging = true;
    startY = e.clientY;
    startMapH = mapPane.getBoundingClientRect().height;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const totalH = rightPanel.getBoundingClientRect().height;
    const divH = divider.getBoundingClientRect().height;

    const delta = e.clientY - startY;
    let newMapH = startMapH + delta;

    newMapH = Math.max(
      MIN_MAP,
      Math.min(newMapH, totalH - divH - MIN_RESP)
    );

    const respH = totalH - divH - newMapH;

    mapPane.style.flex = "none";
    mapPane.style.height = newMapH + "px";

    responsePane.style.flex = "none";
    responsePane.style.height = respH + "px";

    map.updateSize();
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  window.togglePane = function (which) {
    if (which === "map") {
      mapCollapsed = !mapCollapsed;

      if (mapCollapsed) {
        mapPane.style.flex = "none";
        mapPane.style.height = "32px";
        responsePane.style.flex = "1";
        responsePane.style.height = "";

        mapBtn.querySelector("span").textContent = "Map ▴";
      } else {
        mapPane.style.flex = "3";
        mapPane.style.height = "";
        responsePane.style.flex = "1";
        responsePane.style.height = "";

        mapBtn.querySelector("span").textContent = "Map ▾";
        setTimeout(() => map.updateSize(), 10);
      }

      respCollapsed = false;
      respBtn.querySelector("span").textContent = "Response ▴";

    } else {
      respCollapsed = !respCollapsed;

      if (respCollapsed) {
        responsePane.style.flex = "none";
        responsePane.style.height = "26px";
        mapPane.style.flex = "1";
        mapPane.style.height = "";

        respBtn.querySelector("span").textContent = "Response ▴";
      } else {
        responsePane.style.flex = "1";
        responsePane.style.height = "";
        mapPane.style.flex = "3";
        mapPane.style.height = "";

        respBtn.querySelector("span").textContent = "Response ▾";
      }

      mapCollapsed = false;
      mapBtn.querySelector("span").textContent = "Map ▾";
      setTimeout(() => map.updateSize(), 10);
    }
  };
});