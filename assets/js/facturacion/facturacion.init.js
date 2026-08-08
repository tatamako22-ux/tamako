import { FacturacionModal } from "./facturacion.modal.js";
import { FacturacionCuentas } from "./facturacion.cuentas.js";
import { FacturacionFacturas } from "./facturacion.facturas.js";
import { FacturacionCaja } from "./facturacion.caja.js";
import { FacturacionReportes } from "./facturacion.reportes.js";

export const initFacturacion = async () => {
  console.log("Inicializando módulo de Facturación...");

  try {
    const tiendaInfo = await window.tamakuContextReady;
    if (!tiendaInfo) return;
    FacturacionModal.init();
    iniciarTabs();
    await Promise.all([
      FacturacionCuentas.init(),
      FacturacionFacturas.init(),
      FacturacionCaja.init(),
      FacturacionReportes.init(),
    ]);
  } catch (error) {
    console.error("Error inicializando facturación:", error);
  }
};

function iniciarTabs() {
  const botones = document.querySelectorAll(".tab-btn");
  const paneles = document.querySelectorAll(".tab-content");

  const activarTab = (nombre) => {
    const boton = document.querySelector(`.tab-btn[data-tab="${nombre}"]`);
    const panel = document.getElementById(`tab-${nombre}`);
    if (!boton || !panel) return;

    botones.forEach((item) => item.classList.remove("active"));
    paneles.forEach((item) => item.classList.remove("active"));
    boton.classList.add("active");
    panel.classList.add("active");
  };

  botones.forEach((boton) => {
    boton.addEventListener("click", () => {
      const nombre = boton.dataset.tab;
      activarTab(nombre);
      history.replaceState(null, "", `#${nombre}`);
    });
  });

  const tabInicial = window.location.hash.replace("#", "");
  if (tabInicial) activarTab(tabInicial);
  window.addEventListener("hashchange", () =>
    activarTab(window.location.hash.replace("#", "")),
  );
}
