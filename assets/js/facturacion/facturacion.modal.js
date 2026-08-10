import { FacturacionService } from "./facturacion.service.js";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

function getTienda() {
  return JSON.parse(localStorage.getItem("tamaku_tienda")) || {};
}

function escapar(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const FacturacionModal = {
  modal: null,
  btnGuardar: null,
  citaActual: null,
  servicios: [],

  init() {
    this.modal = document.getElementById("modalNuevaFactura");
    this.btnGuardar = this.modal?.querySelector('button[type="submit"]');
    this.asignarEventos();
    this.revisarCitaPendiente();
  },

  asignarEventos() {
    document.getElementById("btnNuevaFactura")?.addEventListener("click", () =>
      this.abrirManual(),
    );
    document.getElementById("btnCerrarModal")?.addEventListener("click", () =>
      this.cerrar(),
    );
    document.getElementById("btnCancelarFactura")?.addEventListener("click", () =>
      this.cerrar(),
    );
    document.getElementById("btnAgregarDetalle")?.addEventListener("click", () =>
      this.agregarFilaItem(),
    );
    document.getElementById("facturaBarbero")?.addEventListener("change", (event) =>
      this.cambiarProfesional(event.target.value),
    );
    document.getElementById("formFactura")?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.procesarGuardarFactura();
    });

    this.modal?.addEventListener("click", (event) => {
      if (event.target === this.modal) this.cerrar();
    });
  },

  mostrar() {
    this.modal?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  cerrar() {
    this.modal?.classList.add("hidden");
    document.body.style.overflow = "auto";
    this.citaActual = null;
  },

  limpiarFormulario() {
    document.getElementById("formFactura")?.reset();
    document.getElementById("contenedorDetalles")?.replaceChildren();
    document.getElementById("facturaCliente").innerHTML =
      '<option value="">Cliente ocasional</option>';
    document.getElementById("facturaBarbero").innerHTML =
      '<option value="">Seleccione un profesional...</option>';
    document.getElementById("facturaMetodo").innerHTML =
      '<option value="">Seleccione un método...</option>';
    this.servicios = [];
    this.calcularTotales();
  },

  async abrirManual() {
    this.citaActual = null;
    this.limpiarFormulario();
    this.mostrar();

    try {
      const tienda = getTienda();
      const [clientes, profesionales, metodos] = await Promise.all([
        FacturacionService.getClientes(tienda.id),
        FacturacionService.getProfesionales(tienda.id),
        FacturacionService.getMetodosPago(tienda.id),
      ]);
      this.renderClientes(clientes);
      this.renderProfesionales(profesionales);
      this.renderMetodos(metodos);
      this.agregarFilaItem();
    } catch (error) {
      console.error("Error preparando factura:", error);
      alert(`No se pudo preparar la factura: ${error.message}`);
    }
  },

  revisarCitaPendiente() {
    const guardada = localStorage.getItem("facturar_cita");
    if (!guardada) return;

    localStorage.removeItem("facturar_cita");
    try {
      this.cargarDesdeCita(JSON.parse(guardada));
    } catch (error) {
      console.error("La cita pendiente no es válida:", error);
    }
  },

  async cargarDesdeCita(cita) {
    this.citaActual = cita;
    this.limpiarFormulario();
    this.mostrar();

    try {
      const tienda = getTienda();
      const idTienda = tienda.id || cita.id_tienda;
      const [profesionales, servicios, metodos] = await Promise.all([
        FacturacionService.getProfesionales(idTienda),
        FacturacionService.getServicios(idTienda, cita.id_barbero),
        FacturacionService.getMetodosPago(idTienda, cita.id_barbero),
      ]);

      this.renderProfesionales(profesionales, cita.id_barbero);
      this.renderClienteCita(cita);
      this.servicios = servicios;
      this.renderMetodos(metodos);

      const nombreHistorico =
        cita.servicio_nombre || cita.servicio || "Servicio de la cita";
      const servicioEncontrado = servicios.find(
        (servicio) =>
          String(servicio.id_servicio) === String(cita.servicio) ||
          servicio.nombre_servicio.trim().toLowerCase() ===
            String(nombreHistorico).trim().toLowerCase(),
      );

      this.agregarFilaItem({
        idServicio: servicioEncontrado?.id_servicio || "",
        precio: Number(cita.valor_servicio) || Number(servicioEncontrado?.precio) || 0,
        descripcionHistorica: servicioEncontrado ? "" : nombreHistorico,
      });
    } catch (error) {
      console.error("Error cargando la cita:", error);
      alert(`No se pudo cargar la cita: ${error.message}`);
    }
  },

  renderClientes(clientes, seleccionado = "") {
    const select = document.getElementById("facturaCliente");
    select.innerHTML = '<option value="">Cliente ocasional</option>';
    clientes.forEach((cliente) => {
      const option = document.createElement("option");
      option.value = cliente.id;
      option.textContent = cliente.nombre_completo;
      option.selected = String(cliente.id) === String(seleccionado);
      select.appendChild(option);
    });
  },

  renderClienteCita(cita) {
    const select = document.getElementById("facturaCliente");
    const idCliente = cita.id_cliente || cita.user_id || "";
    const nombre = cita.nombre_cliente || "Cliente ocasional";
    select.replaceChildren();
    const option = document.createElement("option");
    option.value = idCliente;
    option.textContent = cita.telefono_cliente
      ? `${nombre} · ${cita.telefono_cliente}`
      : nombre;
    option.selected = true;
    select.appendChild(option);
  },

  renderProfesionales(profesionales, seleccionado = "") {
    const select = document.getElementById("facturaBarbero");
    select.innerHTML = '<option value="">Seleccione un profesional...</option>';
    profesionales.forEach((profesional) => {
      const option = document.createElement("option");
      option.value = profesional.id_barbero;
      option.textContent = profesional.nombre_empleado;
      option.selected = String(profesional.id_barbero) === String(seleccionado);
      select.appendChild(option);
    });
  },

  renderMetodos(metodos) {
    const select = document.getElementById("facturaMetodo");
    select.replaceChildren();

    if (metodos.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Crea una cuenta financiera primero";
      select.appendChild(option);
      return;
    }

    const grupos = [
      ["TIENDA", "MÉTODOS DE LA TIENDA"],
      ["PROFESIONAL", "MÉTODOS DEL PROFESIONAL"],
    ];
    grupos.forEach(([tipo, etiqueta]) => {
      const filtrados = metodos.filter((metodo) => metodo.tipo_destino === tipo);
      if (filtrados.length === 0) return;
      const grupo = document.createElement("optgroup");
      grupo.label = etiqueta;
      filtrados.forEach((metodo) => {
        const option = document.createElement("option");
        option.value = metodo.id_metodo;
        option.textContent = metodo.nombre;
        option.dataset.destino = metodo.tipo_destino;
        option.dataset.cuenta = metodo.id_cuenta || "";
        grupo.appendChild(option);
      });
      select.appendChild(grupo);
    });
  },

  async cambiarProfesional(idBarbero) {
    const tienda = getTienda();
    try {
      const [servicios, metodos] = await Promise.all([
        idBarbero ? FacturacionService.getServicios(tienda.id, idBarbero) : [],
        FacturacionService.getMetodosPago(tienda.id, idBarbero || null),
      ]);
      this.servicios = servicios;
      document.getElementById("contenedorDetalles").replaceChildren();
      this.agregarFilaItem();
      this.renderMetodos(metodos);
    } catch (error) {
      console.error("Error cambiando profesional:", error);
      alert(`No se pudieron cargar sus servicios: ${error.message}`);
    }
  },

  agregarFilaItem({ idServicio = "", precio = 0, descripcionHistorica = "" } = {}) {
    const contenedor = document.getElementById("contenedorDetalles");
    if (!contenedor) return;

    const fila = document.createElement("div");
    fila.className = "fila-detalle-item";
    const opciones = this.servicios
      .map(
        (servicio) =>
          `<option value="${servicio.id_servicio}" data-precio="${servicio.precio}" ${String(servicio.id_servicio) === String(idServicio) ? "selected" : ""}>${escapar(servicio.nombre_servicio)}</option>`,
      )
      .join("");
    const historica = descripcionHistorica
      ? `<option value="" data-historico="true" selected>${escapar(descripcionHistorica)}</option>`
      : '<option value="">Seleccione un servicio...</option>';

    fila.innerHTML = `
      <select class="select-servicio-dinamico">${historica}${opciones}</select>
      <div class="campo-precio">
        <span>$</span>
        <input type="number" class="input-precio-dinamico" min="0" step="1" value="${Number(precio) || 0}" aria-label="Precio del ítem">
      </div>
      <button type="button" class="btn-eliminar-item" aria-label="Eliminar ítem">
        <i class="fa-solid fa-trash"></i>
      </button>`;

    const select = fila.querySelector("select");
    const input = fila.querySelector("input");
    select.addEventListener("change", () => {
      input.value = Number(select.selectedOptions[0]?.dataset.precio) || 0;
      this.calcularTotales();
    });
    input.addEventListener("input", () => this.calcularTotales());
    fila.querySelector("button").addEventListener("click", () => {
      fila.remove();
      this.calcularTotales();
    });

    contenedor.appendChild(fila);
    this.calcularTotales();
  },

  obtenerDetalles() {
    const idBarbero = document.getElementById("facturaBarbero")?.value || null;
    return [...document.querySelectorAll(".fila-detalle-item")]
      .map((fila) => {
        const select = fila.querySelector(".select-servicio-dinamico");
        const opcion = select?.selectedOptions[0];
        return {
          id_servicio: select?.value || null,
          id_barbero: idBarbero,
          descripcion: opcion?.textContent?.trim() || "",
          cantidad: 1,
          precio_unitario: Number(fila.querySelector(".input-precio-dinamico")?.value) || 0,
          descuento: 0,
        };
      })
      .filter((detalle) => detalle.descripcion && detalle.precio_unitario > 0);
  },

  calcularTotales() {
    const total = [...document.querySelectorAll(".input-precio-dinamico")].reduce(
      (suma, input) => suma + (Number(input.value) || 0),
      0,
    );
    document.getElementById("facturaSubtotal").textContent = moneda.format(total);
    document.getElementById("facturaTotal").textContent = moneda.format(total);
    return total;
  },

  async procesarGuardarFactura() {
    const tienda = getTienda();
    const selectProfesional = document.getElementById("facturaBarbero");
    const selectCliente = document.getElementById("facturaCliente");
    const selectMetodo = document.getElementById("facturaMetodo");
    const opcionMetodo = selectMetodo?.selectedOptions[0];
    const detalles = this.obtenerDetalles();
    const total = detalles.reduce(
      (suma, detalle) => suma + detalle.cantidad * detalle.precio_unitario,
      0,
    );

    if (!tienda.id) return alert("No se encontró la tienda activa.");
    if (!selectProfesional?.value) return alert("Selecciona un profesional.");
    if (!opcionMetodo?.value) return alert("Selecciona un método de pago válido.");
    if (detalles.length === 0 || total <= 0)
      return alert("Agrega al menos un servicio con un valor mayor a cero.");

    const idCita = this.citaActual?.id_cita || this.citaActual?.id || null;
    const factura = {
      id_tienda: tienda.id,
      id_barbero: selectProfesional.value,
      id_cita: idCita,
      id_cliente: selectCliente?.value || null,
      metodo_pago: opcionMetodo.textContent.trim(),
      id_metodo_pago: opcionMetodo.value,
      destino_pago: opcionMetodo.dataset.destino || "TIENDA",
      total,
      estado: "PAGADA",
      fecha_emision: new Date().toISOString(),
    };

    try {
      this.btnGuardar.disabled = true;
      this.btnGuardar.textContent = "Guardando...";
      await FacturacionService.crearFactura({ factura, detalles });

      if (idCita) {
        try {
          await FacturacionService.finalizarCita(idCita, tienda.id);
        } catch (errorCita) {
          console.error("Factura creada, pero no se finalizó la cita:", errorCita);
          alert("La factura se creó, pero la cita no pudo marcarse como finalizada.");
        }
      }

      this.cerrar();
      window.dispatchEvent(new CustomEvent("factura-creada"));
      alert("Factura creada correctamente.");
    } catch (error) {
      console.error("Error guardando factura:", error);
      const duplicada = error.code === "23505";
      alert(duplicada ? "Esta cita ya fue facturada." : `No se pudo guardar la factura: ${error.message}`);
    } finally {
      this.btnGuardar.disabled = false;
      this.btnGuardar.textContent = "Guardar Factura";
    }
  },
};
