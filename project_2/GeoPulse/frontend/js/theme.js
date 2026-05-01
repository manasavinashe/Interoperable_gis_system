document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("themeToggle");
  const root = document.documentElement;

  function applyTheme(dark) {
    if (dark) {
      root.setAttribute("data-theme", "dark");
      btn.textContent = "☽";
    } else {
      root.removeAttribute("data-theme");
      btn.textContent = "☀";
    }
  }

  const saved = localStorage.getItem("gis-theme");
  applyTheme(saved === "dark");

  btn.addEventListener("click", () => {
    const isDark = root.getAttribute("data-theme") === "dark";
    localStorage.setItem("gis-theme", isDark ? "light" : "dark");
    applyTheme(!isDark);
  });
});
