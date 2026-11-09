import { initQR } from "./dashboard.qr.js?v=4";
import { initOverview } from "./dashboard.overview.js?v=5";

export function initDashboard(tiendaInfo) {
  const nombre = tiendaInfo.nombre || tiendaInfo.nombre_tienda || "MASTER";
  const bienvenida = document.getElementById("nombreBienvenida");
  if (bienvenida) bienvenida.textContent = nombre.toUpperCase();

  if (tiendaInfo.suscripcion?.funcionalidades?.facturacion === false) {
    document.querySelectorAll('a[href^="facturacion.html"], a[href^="liquidaciones.html"], #kpiVentas, #estadoCajaKpi, #resumenComisionEmpleado').forEach(el => el.style.setProperty('display','none','important'));
    ['valPorCobrar','valTicket','metodosPagoHoy','topProfesional','chartVentas','graficaVentas','ultimosCierres','movimientosCaja'].forEach(id => {
      const el = document.getElementById(id);
      const panel = el?.closest('.kpi-card, .dashboard-panel');
      if (panel) panel.style.setProperty('display','none','important');
    });
  }
  initQR(tiendaInfo);
  initOverview(tiendaInfo);

  document.querySelectorAll(".dashboard-modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.remove("is-visible");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll(".dashboard-modal.is-visible").forEach((modal) =>
        modal.classList.remove("is-visible"),
      );
    }
  });
}
