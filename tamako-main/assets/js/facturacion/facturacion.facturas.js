import { FacturacionService } from "./facturacion.service.js";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const fechaHora = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getTienda() {
  return JSON.parse(localStorage.getItem("tamaku_tienda")) || {};
}

export const FacturacionFacturas = {
  facturas: [],

  async init() {
    window.addEventListener("factura-creada", () => this.cargar());
    this.asignarFiltros();
    await this.cargar();
  },

  asignarFiltros() {
    const panel = document.getElementById("filtrosFacturas");
    const boton = document.getElementById("btnFiltrosFacturas");
    boton?.addEventListener("click", () => {
      const abrir = panel.classList.contains("hidden");
      panel.classList.toggle("hidden", !abrir);
      boton.setAttribute("aria-expanded", String(abrir));
    });
    ["buscarFactura", "filtrarEstadoFactura", "filtrarMetodoFactura"].forEach((id) =>
      document.getElementById(id)?.addEventListener("input", () => this.aplicarFiltros()),
    );
    document.getElementById("limpiarFiltrosFacturas")?.addEventListener("click", () => {
      document.getElementById("buscarFactura").value = "";
      document.getElementById("filtrarEstadoFactura").value = "";
      document.getElementById("filtrarMetodoFactura").value = "";
      this.aplicarFiltros();
    });
  },

  async cargar() {
    const contenedor = document.getElementById("listaFacturas");
    const tienda = getTienda();
    if (!contenedor || !tienda.id) return;

    contenedor.innerHTML = '<div class="facturas-estado">Cargando facturas...</div>';

    try {
      const facturas = await FacturacionService.getFacturas(tienda.id);
      this.facturas = facturas;
      this.actualizarIndicadores(facturas);
      this.actualizarMetodos(facturas);
      this.aplicarFiltros();
    } catch (error) {
      console.error("Error cargando facturas:", error);
      contenedor.innerHTML =
        '<div class="facturas-estado facturas-error">No se pudieron cargar las facturas.</div>';
    }
  },

  actualizarMetodos(facturas) {
    const select = document.getElementById("filtrarMetodoFactura");
    const seleccionado = select.value;
    const metodos = [...new Set(facturas.map((factura) => factura.metodo_pago).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    select.innerHTML = '<option value="">Todos los métodos</option>';
    metodos.forEach((metodo) => {
      const opcion = document.createElement("option");
      opcion.value = metodo;
      opcion.textContent = metodo;
      select.appendChild(opcion);
    });
    if (metodos.includes(seleccionado)) select.value = seleccionado;
  },

  aplicarFiltros() {
    const contenedor = document.getElementById("listaFacturas");
    if (!contenedor) return;
    const texto = document.getElementById("buscarFactura")?.value.trim().toLowerCase() || "";
    const estado = document.getElementById("filtrarEstadoFactura")?.value || "";
    const metodo = document.getElementById("filtrarMetodoFactura")?.value || "";
    const filtradas = this.facturas.filter((factura) => {
      const contenido = [factura.perfiles_clientes?.nombre_completo, factura.profesionales?.nombre_empleado, factura.metodo_pago].filter(Boolean).join(" ").toLowerCase();
      return (!texto || contenido.includes(texto)) &&
        (!estado || String(factura.estado).toUpperCase() === estado) &&
        (!metodo || factura.metodo_pago === metodo);
    });
    this.renderizar(contenedor, filtradas, this.facturas.length > 0);
  },

  actualizarIndicadores(facturas) {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const pagadas = facturas.filter(
      (factura) => String(factura.estado).toUpperCase() === "PAGADA",
    );
    const ventasHoy = pagadas
      .filter((factura) => new Date(factura.fecha_emision) >= inicioHoy)
      .reduce((suma, factura) => suma + Number(factura.total || 0), 0);
    const totalMes = pagadas
      .filter((factura) => new Date(factura.fecha_emision) >= inicioMes)
      .reduce((suma, factura) => suma + Number(factura.total || 0), 0);
    const pendientes = facturas.filter(
      (factura) => String(factura.estado).toUpperCase() === "PENDIENTE",
    ).length;

    document.getElementById("ventasHoy").textContent = moneda.format(ventasHoy);
    document.getElementById("cantidadFacturas").textContent = facturas.length;
    document.getElementById("facturasPendientes").textContent = pendientes;
    document.getElementById("totalMes").textContent = moneda.format(totalMes);
  },

  renderizar(contenedor, facturas, hayFacturas = false) {
    contenedor.replaceChildren();

    if (facturas.length === 0) {
      contenedor.innerHTML = `
        <div class="facturas-estado">
          <i class="fa-solid fa-file-invoice-dollar"></i>
          <strong>${hayFacturas ? "Sin coincidencias" : "Aún no hay facturas"}</strong>
          <span>${hayFacturas ? "Prueba cambiando o limpiando los filtros." : "Las ventas aparecerán aquí cuando emitas la primera."}</span>
        </div>`;
      return;
    }

    facturas.forEach((factura) => {
      const tarjeta = document.createElement("article");
      const estado = String(factura.estado || "PENDIENTE").toUpperCase();
      tarjeta.className = "factura-row";
      tarjeta.innerHTML = `
        <div class="factura-icono"><i class="fa-solid fa-receipt"></i></div>
        <div class="factura-info">
          <strong class="factura-cliente"></strong>
          <span>${fechaHora.format(new Date(factura.fecha_emision))}</span>
        </div>
        <div class="factura-profesional">
          <span>Profesional</span>
          <strong></strong>
        </div>
        <div class="factura-metodo">
          <span>${factura.metodo_pago || "Sin método"}</span>
        </div>
        <span class="factura-badge estado-${estado.toLowerCase()}">${estado}</span>
        <strong class="factura-valor">${moneda.format(Number(factura.total) || 0)}</strong>`;
      tarjeta.querySelector(".factura-cliente").textContent =
        factura.perfiles_clientes?.nombre_completo || "Cliente ocasional";
      tarjeta.querySelector(".factura-profesional strong").textContent =
        factura.profesionales?.nombre_empleado || "Sin asignar";
      contenedor.appendChild(tarjeta);
    });
  },
};
