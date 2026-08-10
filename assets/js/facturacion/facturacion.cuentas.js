import { FacturacionService } from "./facturacion.service.js?v=2";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

function getTienda() {
  return JSON.parse(localStorage.getItem("tamaku_tienda")) || {};
}

export const FacturacionCuentas = {
  modal: null,
  modalGestion: null,
  btnGuardar: null,
  cuentaActual: null,
  cuentas: [],
  puedeGestionar: false,

  async init() {
    const tienda = getTienda();
    this.puedeGestionar = Boolean(
      tienda.sesion?.es_propietario || tienda.sesion?.permisos?.cuentas_gestionar,
    );
    this.modal = document.getElementById("modalCuenta");
    this.modalGestion = document.getElementById("modalGestionCuenta");
    this.btnGuardar = document.getElementById("guardarCuenta");
    document.getElementById("btnNuevaCuenta")?.toggleAttribute("hidden", !this.puedeGestionar);
    this.inicializarEventos();
    window.addEventListener("factura-creada", () => this.cargarCuentas());
    window.addEventListener("movimiento-financiero", () => this.cargarCuentas());
    await this.cargarCuentas();
  },

  inicializarEventos() {
    document.getElementById("btnNuevaCuenta")?.addEventListener("click", () =>
      this.abrirModal(),
    );
    document.getElementById("cerrarModalCuenta")?.addEventListener("click", () =>
      this.cerrarModal(),
    );
    document.getElementById("cancelarCuenta")?.addEventListener("click", () =>
      this.cerrarModal(),
    );
    this.btnGuardar?.addEventListener("click", () => this.guardarCuenta());
    document.getElementById("cerrarGestionCuenta")?.addEventListener("click", () =>
      this.cerrarGestion(),
    );
    document.getElementById("guardarCambiosCuenta")?.addEventListener("click", () =>
      this.guardarCambiosCuenta(),
    );
    document.getElementById("desactivarCuenta")?.addEventListener("click", () =>
      this.desactivarCuenta(),
    );
    document.getElementById("listaCuentas")?.addEventListener("click", (event) => {
      const boton = event.target.closest(".btn-cuenta-opciones");
      if (boton) this.abrirGestion(boton.dataset.id);
    });

    this.modal?.addEventListener("click", (event) => {
      if (event.target === this.modal) this.cerrarModal();
    });
    this.modalGestion?.addEventListener("click", (event) => {
      if (event.target === this.modalGestion) this.cerrarGestion();
    });
  },

  abrirModal() {
    if (!this.puedeGestionar) return;
    this.modal?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("cuentaNombre")?.focus(), 50);
  },

  cerrarModal() {
    this.modal?.classList.add("hidden");
    document.body.style.overflow = "auto";
  },

  async guardarCuenta() {
    const nombreInput = document.getElementById("cuentaNombre");
    const tipoInput = document.getElementById("cuentaTipo");
    const saldoInput = document.getElementById("cuentaSaldo");
    const tienda = getTienda();

    const nombre = nombreInput?.value.trim() || "";
    const tipo = tipoInput?.value || "OTRO";
    const saldoInicial = Number(saldoInput?.value) || 0;

    if (!tienda.id) return alert("No se encontró la tienda activa.");
    if (!nombre) {
      nombreInput?.focus();
      return alert("Escribe el nombre de la cuenta.");
    }
    if (saldoInicial < 0) {
      saldoInput?.focus();
      return alert("El saldo inicial no puede ser negativo.");
    }

    try {
      this.btnGuardar.disabled = true;
      this.btnGuardar.textContent = "Creando...";

      await FacturacionService.crearCuenta({
        idTienda: tienda.id,
        nombre,
        tipo,
        saldoInicial,
      });

      nombreInput.value = "";
      tipoInput.value = "EFECTIVO";
      saldoInput.value = "0";
      this.cerrarModal();
      await this.cargarCuentas();
      window.dispatchEvent(new CustomEvent("cuenta-financiera-actualizada"));
      alert("Cuenta creada correctamente.");
    } catch (error) {
      console.error("Error creando cuenta:", error);
      alert(`No se pudo crear la cuenta: ${error.message}`);
    } finally {
      this.btnGuardar.disabled = false;
      this.btnGuardar.textContent = "Crear Cuenta";
    }
  },

  async cargarCuentas() {
    const contenedor = document.getElementById("listaCuentas");
    const tienda = getTienda();
    if (!contenedor) return;

    if (!tienda.id) {
      contenedor.innerHTML = '<p class="cuentas-vacio">No se encontró la tienda activa.</p>';
      return;
    }

    contenedor.innerHTML = '<p class="cuentas-vacio">Cargando cuentas...</p>';

    try {
      const cuentas = await FacturacionService.getCuentasFinancieras(tienda.id);
      this.cuentas = cuentas;
      contenedor.replaceChildren();

      if (cuentas.length === 0) {
        contenedor.innerHTML = `
          <div class="cuentas-vacio">
            <i class="fa-solid fa-wallet"></i>
            <p>Todavía no tienes cuentas financieras.</p>
            <span>Crea una cuenta para comenzar a controlar tus ingresos.</span>
          </div>`;
        return;
      }

      cuentas.forEach((cuenta) => contenedor.appendChild(this.crearTarjeta(cuenta)));
    } catch (error) {
      console.error("Error cargando cuentas:", error);
      contenedor.innerHTML =
        '<p class="cuentas-vacio cuentas-error">No se pudieron cargar las cuentas.</p>';
    }
  },

  crearTarjeta(cuenta) {
    const iconos = {
      EFECTIVO: "fa-money-bill-wave",
      DIGITAL: "fa-mobile-screen-button",
      BANCO: "fa-building-columns",
      TARJETA: "fa-credit-card",
      OTRO: "fa-wallet",
    };
    const tipo = String(cuenta.tipo || "OTRO").toUpperCase();
    const tarjeta = document.createElement("article");
    tarjeta.className = "cuenta-card";
    tarjeta.dataset.id = cuenta.id;
    tarjeta.innerHTML = `
      <div class="cuenta-card-header">
        <div class="cuenta-icono"><i class="fa-solid ${iconos[tipo] || iconos.OTRO}"></i></div>
        <div class="cuenta-identidad"><h3></h3><span>${tipo}</span></div>
        <span class="cuenta-estado">ACTIVA</span>
      </div>
      <div class="cuenta-saldo">
        <span>Saldo actual</span>
        <strong>${formatoMoneda.format(Number(cuenta.saldo_actual) || 0)}</strong>
      </div>
      <div class="cuenta-card-footer">
        <span>Saldo inicial: ${formatoMoneda.format(Number(cuenta.saldo_inicial) || 0)}</span>
        ${this.puedeGestionar ? `<button type="button" class="btn-cuenta-opciones" data-id="${cuenta.id}" aria-label="Opciones de la cuenta" title="Gestionar cuenta">
          <i class="fa-solid fa-ellipsis"></i>
        </button>` : ""}
      </div>`;
    tarjeta.querySelector("h3").textContent = cuenta.nombre;
    return tarjeta;
  },

  async abrirGestion(idCuenta) {
    const cuenta = this.cuentas.find((item) => item.id === idCuenta);
    if (!cuenta) return;

    this.cuentaActual = cuenta;
    document.getElementById("gestionCuentaTitulo").textContent = cuenta.nombre;
    document.getElementById("gestionCuentaNombre").value = cuenta.nombre;
    document.getElementById("gestionCuentaTipo").value =
      String(cuenta.tipo || "OTRO").toUpperCase();
    document.getElementById("gestionCuentaSaldo").textContent =
      formatoMoneda.format(Number(cuenta.saldo_actual) || 0);

    this.modalGestion?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    await this.cargarMovimientos(cuenta.id);
  },

  cerrarGestion() {
    this.modalGestion?.classList.add("hidden");
    document.body.style.overflow = "auto";
    this.cuentaActual = null;
  },

  async cargarMovimientos(idCuenta) {
    const contenedor = document.getElementById("listaMovimientosCuenta");
    const cantidad = document.getElementById("gestionCuentaCantidad");
    const tienda = getTienda();
    contenedor.innerHTML = '<div class="movimientos-vacio">Cargando movimientos...</div>';

    try {
      const movimientos = await FacturacionService.getMovimientosCuenta(
        tienda.id,
        idCuenta,
      );
      cantidad.textContent = `${movimientos.length} ${movimientos.length === 1 ? "movimiento" : "movimientos"}`;
      contenedor.replaceChildren();

      if (movimientos.length === 0) {
        contenedor.innerHTML =
          '<div class="movimientos-vacio">Esta cuenta todavía no tiene movimientos.</div>';
        return;
      }

      const formatoFecha = new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      movimientos.forEach((movimiento) => {
        const fila = document.createElement("div");
        const esIngreso = movimiento.tipo === "INGRESO";
        fila.className = "movimiento-row";
        fila.innerHTML = `
          <div class="movimiento-icono ${esIngreso ? "ingreso" : "egreso"}">
            <i class="fa-solid ${esIngreso ? "fa-arrow-down" : "fa-arrow-up"}"></i>
          </div>
          <div class="movimiento-info">
            <strong></strong>
            <span>${formatoFecha.format(new Date(movimiento.created_at))}</span>
          </div>
          <div class="movimiento-valores">
            <strong class="${esIngreso ? "valor-ingreso" : "valor-egreso"}">
              ${esIngreso ? "+" : "-"}${formatoMoneda.format(Number(movimiento.monto) || 0)}
            </strong>
            <span>Saldo: ${formatoMoneda.format(Number(movimiento.saldo_resultante) || 0)}</span>
          </div>`;
        fila.querySelector(".movimiento-info strong").textContent = movimiento.concepto;
        contenedor.appendChild(fila);
      });
    } catch (error) {
      console.error("Error cargando movimientos:", error);
      contenedor.innerHTML =
        '<div class="movimientos-vacio movimientos-error">No se pudieron cargar los movimientos.</div>';
    }
  },

  async guardarCambiosCuenta() {
    if (!this.cuentaActual || !this.puedeGestionar) return;
    const tienda = getTienda();
    const boton = document.getElementById("guardarCambiosCuenta");
    const nombre = document.getElementById("gestionCuentaNombre").value.trim();
    const tipo = document.getElementById("gestionCuentaTipo").value;

    try {
      boton.disabled = true;
      boton.textContent = "Guardando...";
      await FacturacionService.editarCuentaAdministrativa({
        idTienda: tienda.id,
        idCuenta: this.cuentaActual.id,
        nombre,
        tipo,
      });
      this.cerrarGestion();
      await this.cargarCuentas();
      window.dispatchEvent(new CustomEvent("cuenta-financiera-actualizada"));
      alert("Cuenta actualizada correctamente.");
    } catch (error) {
      console.error("Error actualizando cuenta:", error);
      alert(`No se pudo actualizar la cuenta: ${error.message}`);
    } finally {
      boton.disabled = false;
      boton.textContent = "Guardar cambios";
    }
  },

  async desactivarCuenta() {
    if (!this.cuentaActual || !this.puedeGestionar) return;
    const confirmar = await window.TamakuUI.confirm({
      titulo: "¿Eliminar cuenta?",
      mensaje: `${this.cuentaActual.nombre} dejará de aparecer en nuevas facturas. Las facturas y movimientos anteriores se conservarán para proteger el historial contable.`,
      textoConfirmar: "Eliminar cuenta",
      peligro: true,
    });
    if (!confirmar) return;

    const tienda = getTienda();
    const boton = document.getElementById("desactivarCuenta");
    try {
      boton.disabled = true;
      await FacturacionService.eliminarCuentaAdministrativa({
        idTienda: tienda.id,
        idCuenta: this.cuentaActual.id,
      });
      this.cerrarGestion();
      await this.cargarCuentas();
      window.dispatchEvent(new CustomEvent("cuenta-financiera-actualizada"));
      alert("Cuenta eliminada de los métodos de pago activos.");
    } catch (error) {
      console.error("Error eliminando cuenta:", error);
      alert(`No se pudo eliminar la cuenta: ${error.message}`);
    } finally {
      boton.disabled = false;
    }
  },
};
