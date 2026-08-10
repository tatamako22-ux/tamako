const HEX = /^#[0-9a-f]{6}$/i;
function rgb(hex) { return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16) }; }
export function aplicarMarcaTienda(tienda) {
  if (!tienda) return;
  const principal = HEX.test(tienda.color_primario || "") ? tienda.color_primario : "#D1A13A";
  const secundario = HEX.test(tienda.color_secundario || "") ? tienda.color_secundario : "#F0CF79";
  const { r, g, b } = rgb(principal);
  const estilos = document.body.style;
  estilos.setProperty("--gold", principal);
  estilos.setProperty("--gold-light", secundario);
  estilos.setProperty("--accent", principal);
  estilos.setProperty("--accent-soft", `rgba(${r},${g},${b},.12)`);
  estilos.setProperty("--gold-border", `rgba(${r},${g},${b},.34)`);
  const claro = (tienda.tema_panel || tienda.tema_base) === "claro";
  document.body.dataset.brandTheme = claro ? "claro" : "oscuro";
  document.body.classList.toggle("tamaku-brand-light", claro);
  estilos.setProperty("--bg", claro ? "#f4f3ef" : "#050505");
  estilos.setProperty("--panel", claro ? "#ffffff" : "#101010");
  estilos.setProperty("--surface", claro ? "#ffffff" : "#121212");
  estilos.setProperty("--surface-2", claro ? "#ecebe7" : "#1b1b1b");
  estilos.setProperty("--card-bg", claro ? "#ffffff" : "rgba(255,255,255,.03)");
  estilos.setProperty("--text", claro ? "#171717" : "#f5f5f2");
  estilos.setProperty("--muted", claro ? "#656565" : "#818181");
  estilos.setProperty("--line", claro ? "rgba(0,0,0,.13)" : "rgba(255,255,255,.1)");
  estilos.setProperty("--dash-bg", claro ? "#f4f3ef" : "#050505");
  estilos.setProperty("--dash-panel", claro ? "#ffffff" : "#0c0c0c");
  estilos.setProperty("--dash-card", claro ? "#ffffff" : "#111111");
  estilos.setProperty("--dash-text", claro ? "#171717" : "#f7f7f7");
  estilos.setProperty("--dash-muted", claro ? "#666666" : "#858585");
  estilos.setProperty("--dash-border", `rgba(${r},${g},${b},${claro ? ".28" : ".2"})`);
  estilos.setProperty("--dash-gold", principal);
  estilos.setProperty("--dash-gold-light", secundario);
  document.documentElement.style.colorScheme = claro ? "light" : "dark";

  if (!document.getElementById("tamakuBrandThemeCss")) {
    const link = document.createElement("link");
    link.id = "tamakuBrandThemeCss";
    link.rel = "stylesheet";
    link.href = new URL("../../css/brand-theme.css?v=3", import.meta.url).href;
    document.head.appendChild(link);
  }
}
