/* =========================
   ACTUALIZAR KPIs
========================= */
export function actualizarEstadisticas(citas) {
  const total = citas.length;

  const pendientes = citas.filter(
    (c) => (c.estado || "").toUpperCase() === "PENDIENTE",
  ).length;

  const valCitas = document.getElementById("valCitas");
  const valEspera = document.getElementById("valEspera");

  if (valCitas) {
    valCitas.innerText = total;
  }

  if (valEspera) {
    valEspera.innerText = pendientes;
  }
}
