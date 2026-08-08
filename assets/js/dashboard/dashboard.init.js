import { initQR } from "./dashboard.qr.js?v=4";
import { initOverview } from "./dashboard.overview.js?v=2";

export function initDashboard(tiendaInfo) {
  const nombre = tiendaInfo.nombre || tiendaInfo.nombre_tienda || "MASTER";
  const bienvenida = document.getElementById("nombreBienvenida");
  if (bienvenida) bienvenida.textContent = nombre.toUpperCase();

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
