import { initQR } from "./dashboard.qr.js";
import { initCitas } from "./dashboard.citas.js";

export function initDashboard(tiendaInfo) {
  console.log("🚀 Dashboard iniciado");

  console.log("🏪 Tienda:", tiendaInfo);

  // QR
  initQR(tiendaInfo);

  // Citas
  initCitas(tiendaInfo);
}
