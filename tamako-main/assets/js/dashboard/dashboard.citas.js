import { obtenerCitasDelDia } from "./dashboard.service.js";
import { actualizarEstadisticas } from "./dashboard.stats.js";
import { renderModalCitas } from "./dashboard.modal.js";

let tiendaInfo = null;

/* =========================
   INIT DEL MÓDULO
========================= */
export function initCitas(tienda) {
  tiendaInfo = tienda;
  cargarCitasDelDia();
}

/* =========================
   CARGAR CITAS DEL DÍA
========================= */
export async function cargarCitasDelDia() {
  if (!tiendaInfo) {
    console.error("❌ No hay información de tienda");
    return;
  }

  try {
    const citas = await obtenerCitasDelDia(tiendaInfo.id);

    console.log(`✅ ${citas.length} citas cargadas`);

    actualizarEstadisticas(citas);
    renderModalCitas(citas);
  } catch (err) {
    console.error("❌ Error cargando citas:", err);
  }
}

/* =========================
   RECARGAR CITAS
========================= */
export async function recargarCitas() {
  await cargarCitasDelDia();
}
