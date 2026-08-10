const escapar = (valor = "") =>
  String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function renderModalCitas(citas) {
  const contenedor = document.getElementById("contenedorTodasCitas");
  if (!contenedor) return;

  const citasValidas = citas.filter(
    (cita) => String(cita.estado).toUpperCase() !== "CANCELADA",
  );

  if (!citasValidas.length) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-calendar-check"></i>
        <p>No hay citas programadas para hoy.</p>
      </div>`;
    return;
  }

  contenedor.innerHTML = citasValidas
    .map((cita) => {
      const facturas = Array.isArray(cita.facturas)
        ? cita.facturas
        : cita.facturas
          ? [cita.facturas]
          : [];
      const facturada = facturas.some(
        (factura) => String(factura.estado).toUpperCase() === "PAGADA",
      );
      const telefono = String(cita.telefono_cliente || "").replace(/\D/g, "");
      const telefonoColombia = telefono.startsWith("57") ? telefono : `57${telefono}`;

      return `
        <article class="modal-appointment-card">
          <div class="modal-time"><i class="fa-regular fa-clock"></i>${escapar(cita.hora_inicio?.slice(0, 5) || "--:--")}</div>
          <div class="modal-client">
            <strong>${escapar(cita.nombre_cliente || "Cliente ocasional")}</strong>
            <span>${escapar(cita.servicio_nombre || cita.servicio || "Servicio")} · ${escapar(cita.profesionales?.nombre_empleado || "Sin asignar")}</span>
          </div>
          <span class="mini-status ${facturada ? "is-paid" : "is-pending"}">${facturada ? "Facturada" : escapar(cita.estado || "Pendiente")}</span>
          ${telefono ? `<div class="modal-contact"><a href="tel:+${telefonoColombia}" aria-label="Llamar"><i class="fa-solid fa-phone"></i></a><a href="https://wa.me/${telefonoColombia}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a></div>` : ""}
        </article>`;
    })
    .join("");
}
