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

export const FacturacionCaja = {
  cajaActual: null,
  movimientos: [],
  esperado: 0,
  saldoCuentaActual: 0,
  tipoMovimiento: "INGRESO",

  async init() {
    this.asignarEventos();
    window.addEventListener("factura-creada", () => this.cargar());
    await this.cargar();
  },

  asignarEventos() {
    document.getElementById("btnAbrirCaja")?.addEventListener("click", () =>
      this.abrirModalApertura(),
    );
    document.getElementById("btnCerrarCaja")?.addEventListener("click", () =>
      this.abrirModalCierre(),
    );
    document.getElementById("cerrarModalAbrirCaja")?.addEventListener("click", () =>
      this.cerrarModal("modalAbrirCaja"),
    );
    document.getElementById("cancelarAbrirCaja")?.addEventListener("click", () =>
      this.cerrarModal("modalAbrirCaja"),
    );
    document.getElementById("confirmarAbrirCaja")?.addEventListener("click", () =>
      this.confirmarApertura(),
    );
    document.getElementById("cerrarModalCerrarCaja")?.addEventListener("click", () =>
      this.cerrarModal("modalCerrarCaja"),
    );
    document.getElementById("cancelarCerrarCaja")?.addEventListener("click", () =>
      this.cerrarModal("modalCerrarCaja"),
    );
    document.getElementById("confirmarCerrarCaja")?.addEventListener("click", () =>
      this.confirmarCierre(),
    );
    document.getElementById("cajaSaldoContado")?.addEventListener("input", () =>
      this.actualizarDiferencia(),
    );
    document.querySelectorAll(".btn-movimiento").forEach((boton) => {
      boton.addEventListener("click", () => this.abrirModalMovimiento(boton.dataset.tipo));
    });
    document.getElementById("cerrarModalMovimientoCaja")?.addEventListener("click", () =>
      this.cerrarModal("modalMovimientoCaja"),
    );
    document.getElementById("cancelarMovimientoCaja")?.addEventListener("click", () =>
      this.cerrarModal("modalMovimientoCaja"),
    );
    document.getElementById("confirmarMovimientoCaja")?.addEventListener("click", () =>
      this.confirmarMovimiento(),
    );
    document.getElementById("movimientoMonto")?.addEventListener("input", () =>
      this.actualizarImpactoMovimiento(),
    );

    ["modalAbrirCaja", "modalCerrarCaja", "modalMovimientoCaja"].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", (event) => {
        if (event.target.id === id) this.cerrarModal(id);
      });
    });
  },

  async cargar() {
    const tienda = getTienda();
    if (!tienda.id) return;

    try {
      const [caja, historial] = await Promise.all([
        FacturacionService.getCajaAbierta(tienda.id),
        FacturacionService.getHistorialCajas(tienda.id),
      ]);
      this.cajaActual = caja;
      await this.renderCaja(caja);
      this.renderHistorial(historial);
    } catch (error) {
      console.error("Error cargando caja:", error);
      document.getElementById("cajaEstadoTexto").textContent =
        "No se pudo cargar el estado de caja.";
    }
  },

  async renderCaja(caja) {
    const vacia = document.getElementById("cajaSinAbrir");
    const contenido = document.getElementById("cajaAbiertaContenido");
    const btnAbrir = document.getElementById("btnAbrirCaja");
    const btnCerrar = document.getElementById("btnCerrarCaja");

    if (!caja) {
      vacia.classList.remove("hidden");
      contenido.classList.add("hidden");
      btnAbrir.classList.remove("hidden");
      btnCerrar.classList.add("hidden");
      document.getElementById("cajaEstadoTexto").textContent =
        "Inicia un turno para controlar el efectivo.";
      return;
    }

    vacia.classList.add("hidden");
    contenido.classList.remove("hidden");
    btnAbrir.classList.add("hidden");
    btnCerrar.classList.remove("hidden");

    this.movimientos = await FacturacionService.getMovimientosTurno(caja);
    const ingresos = this.movimientos
      .filter((movimiento) => movimiento.tipo === "INGRESO")
      .reduce((suma, movimiento) => suma + Number(movimiento.monto || 0), 0);
    const egresos = this.movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((suma, movimiento) => suma + Number(movimiento.monto || 0), 0);
    this.esperado = Number(caja.base_inicial) + ingresos - egresos;
    this.saldoCuentaActual = Number(caja.saldo_cuenta_apertura) + ingresos - egresos;

    document.getElementById("cajaEstadoTexto").textContent =
      `Turno abierto en ${caja.cuentas_financieras?.nombre || "Caja"}`;
    document.getElementById("cajaBaseInicial").textContent = moneda.format(caja.base_inicial);
    document.getElementById("cajaCuentaNombre").textContent =
      caja.cuentas_financieras?.nombre || "Caja";
    document.getElementById("cajaIngresos").textContent = moneda.format(ingresos);
    document.getElementById("cajaEgresos").textContent = moneda.format(egresos);
    document.getElementById("cajaEsperado").textContent = moneda.format(this.esperado);
    document.getElementById("cajaHoraApertura").textContent =
      `Abierta ${fechaHora.format(new Date(caja.fecha_apertura))}`;
    this.renderMovimientos();
  },

  abrirModalMovimiento(tipo) {
    if (!this.cajaActual) return alert("Primero debes abrir una caja.");
    this.tipoMovimiento = tipo === "EGRESO" ? "EGRESO" : "INGRESO";
    const esIngreso = this.tipoMovimiento === "INGRESO";
    const visual = document.getElementById("movimientoTipoVisual");
    const concepto = document.getElementById("movimientoConcepto");

    document.getElementById("movimientoCajaTitulo").textContent =
      esIngreso ? "Registrar ingreso" : "Registrar egreso";
    visual.className = `movimiento-tipo-visual ${esIngreso ? "ingreso" : "egreso"}`;
    visual.querySelector("i").className = `fa-solid ${esIngreso ? "fa-arrow-down" : "fa-arrow-up"}`;
    visual.querySelector("strong").textContent = this.tipoMovimiento;
    concepto.value = "";
    concepto.placeholder = esIngreso
      ? "Ej. Abono o ingreso adicional"
      : "Ej. Compra de insumos o retiro";
    document.getElementById("movimientoMonto").value = "0";
    document.getElementById("movimientoSaldoActual").textContent =
      moneda.format(this.saldoCuentaActual);
    this.actualizarImpactoMovimiento();
    this.mostrarModal("modalMovimientoCaja");
    setTimeout(() => concepto.focus(), 80);
  },

  actualizarImpactoMovimiento() {
    const monto = Number(document.getElementById("movimientoMonto")?.value) || 0;
    const resultado =
      this.tipoMovimiento === "INGRESO"
        ? this.saldoCuentaActual + monto
        : this.saldoCuentaActual - monto;
    const texto = document.getElementById("movimientoResultadoTexto");
    texto.textContent = `Nuevo saldo: ${moneda.format(resultado)}`;
    texto.className = resultado < 0 ? "impacto-negativo" : "";
  },

  async confirmarMovimiento() {
    if (!this.cajaActual) return;
    const concepto = document.getElementById("movimientoConcepto").value.trim();
    const monto = Number(document.getElementById("movimientoMonto").value);
    const boton = document.getElementById("confirmarMovimientoCaja");

    if (!concepto) return alert("Escribe el concepto del movimiento.");
    if (!Number.isFinite(monto) || monto <= 0)
      return alert("El monto debe ser mayor a cero.");

    try {
      boton.disabled = true;
      boton.textContent = "Registrando...";
      await FacturacionService.registrarMovimientoCaja({
        idTienda: this.cajaActual.id_tienda,
        idCaja: this.cajaActual.id_caja,
        tipo: this.tipoMovimiento,
        concepto,
        monto,
      });
      this.cerrarModal("modalMovimientoCaja");
      await this.cargar();
      window.dispatchEvent(new CustomEvent("movimiento-financiero"));
      alert(`${this.tipoMovimiento === "INGRESO" ? "Ingreso" : "Egreso"} registrado correctamente.`);
    } catch (error) {
      console.error("Error registrando movimiento:", error);
      alert(`No se pudo registrar el movimiento: ${error.message}`);
    } finally {
      boton.disabled = false;
      boton.textContent = "Registrar movimiento";
    }
  },

  renderMovimientos() {
    const contenedor = document.getElementById("listaMovimientosCaja");
    contenedor.replaceChildren();

    if (this.movimientos.length === 0) {
      contenedor.innerHTML =
        '<div class="movimientos-vacio">Aún no hay movimientos en este turno.</div>';
      return;
    }

    this.movimientos.forEach((movimiento) => {
      const ingreso = movimiento.tipo === "INGRESO";
      const fila = document.createElement("div");
      fila.className = "movimiento-row";
      fila.innerHTML = `
        <div class="movimiento-icono ${ingreso ? "ingreso" : "egreso"}">
          <i class="fa-solid ${ingreso ? "fa-arrow-down" : "fa-arrow-up"}"></i>
        </div>
        <div class="movimiento-info"><strong></strong><span>${fechaHora.format(new Date(movimiento.created_at))}</span></div>
        <div class="movimiento-valores"><strong class="${ingreso ? "valor-ingreso" : "valor-egreso"}">${ingreso ? "+" : "-"}${moneda.format(movimiento.monto)}</strong><span>Saldo: ${moneda.format(movimiento.saldo_resultante)}</span></div>`;
      fila.querySelector(".movimiento-info strong").textContent = movimiento.concepto;
      contenedor.appendChild(fila);
    });
  },

  async abrirModalApertura() {
    const tienda = getTienda();
    const select = document.getElementById("cajaCuenta");

    try {
      const cuentas = await FacturacionService.getCuentasEfectivo(tienda.id);
      select.replaceChildren();
      if (cuentas.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Crea primero una cuenta de tipo Efectivo";
        select.appendChild(option);
      } else {
        cuentas.forEach((cuenta) => {
          const option = document.createElement("option");
          option.value = cuenta.id;
          option.textContent = `${cuenta.nombre} · ${moneda.format(cuenta.saldo_actual)}`;
          select.appendChild(option);
        });
      }
      this.mostrarModal("modalAbrirCaja");
    } catch (error) {
      alert(`No se pudieron cargar las cuentas: ${error.message}`);
    }
  },

  async confirmarApertura() {
    const tienda = getTienda();
    const boton = document.getElementById("confirmarAbrirCaja");
    const idCuenta = document.getElementById("cajaCuenta").value;
    const baseInicial = Number(document.getElementById("cajaBase").value);
    const notas = document.getElementById("cajaNotasApertura").value;

    if (!idCuenta) return alert("Crea o selecciona una cuenta de efectivo.");

    try {
      boton.disabled = true;
      boton.textContent = "Abriendo...";
      await FacturacionService.abrirCaja({ idTienda: tienda.id, idCuenta, baseInicial, notas });
      this.cerrarModal("modalAbrirCaja");
      await this.cargar();
      alert("Caja abierta correctamente.");
    } catch (error) {
      console.error("Error abriendo caja:", error);
      alert(error.code === "23505" ? "Esta cuenta ya tiene una caja abierta." : `No se pudo abrir la caja: ${error.message}`);
    } finally {
      boton.disabled = false;
      boton.textContent = "Confirmar apertura";
    }
  },

  abrirModalCierre() {
    if (!this.cajaActual) return;
    document.getElementById("cierreEsperado").textContent = moneda.format(this.esperado);
    document.getElementById("cajaSaldoContado").value = this.esperado;
    document.getElementById("cajaNotasCierre").value = "";
    this.actualizarDiferencia();
    this.mostrarModal("modalCerrarCaja");
  },

  actualizarDiferencia() {
    const contado = Number(document.getElementById("cajaSaldoContado")?.value) || 0;
    const diferencia = contado - this.esperado;
    const elemento = document.getElementById("cierreDiferencia");
    document.getElementById("cierreContadoVista").textContent = moneda.format(contado);
    elemento.textContent = moneda.format(diferencia);
    elemento.className = diferencia === 0 ? "diferencia-ok" : diferencia > 0 ? "diferencia-sobra" : "diferencia-falta";
  },

  async confirmarCierre() {
    if (!this.cajaActual) return;
    const boton = document.getElementById("confirmarCerrarCaja");
    const saldoContado = Number(document.getElementById("cajaSaldoContado").value);
    const notas = document.getElementById("cajaNotasCierre").value;

    if (!Number.isFinite(saldoContado) || saldoContado < 0)
      return alert("Ingresa un efectivo contado válido.");

    try {
      boton.disabled = true;
      boton.textContent = "Cerrando...";
      await FacturacionService.cerrarCaja({ caja: this.cajaActual, saldoContado, notas });
      this.cerrarModal("modalCerrarCaja");
      this.cajaActual = null;
      await this.cargar();
      alert("Caja cerrada correctamente.");
    } catch (error) {
      console.error("Error cerrando caja:", error);
      alert(`No se pudo cerrar la caja: ${error.message}`);
    } finally {
      boton.disabled = false;
      boton.textContent = "Cerrar turno";
    }
  },

  renderHistorial(cajas) {
    const contenedor = document.getElementById("historialCajas");
    contenedor.replaceChildren();
    if (cajas.length === 0) {
      contenedor.innerHTML = '<div class="movimientos-vacio">Todavía no hay cierres registrados.</div>';
      return;
    }

    cajas.forEach((caja) => {
      const diferencia = Number(caja.diferencia) || 0;
      const fila = document.createElement("article");
      fila.className = "cierre-row";
      fila.innerHTML = `
        <div class="cierre-fecha"><strong>${fechaHora.format(new Date(caja.fecha_cierre))}</strong><span></span></div>
        <div><span>Ingresos</span><strong class="valor-ingreso">${moneda.format(caja.total_ingresos)}</strong></div>
        <div><span>Esperado</span><strong>${moneda.format(caja.saldo_esperado)}</strong></div>
        <div><span>Contado</span><strong>${moneda.format(caja.saldo_contado)}</strong></div>
        <div><span>Diferencia</span><strong class="${diferencia === 0 ? "diferencia-ok" : diferencia > 0 ? "diferencia-sobra" : "diferencia-falta"}">${moneda.format(diferencia)}</strong></div>`;
      fila.querySelector(".cierre-fecha span").textContent =
        caja.cuentas_financieras?.nombre || "Caja";
      contenedor.appendChild(fila);
    });
  },

  mostrarModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  cerrarModal(id) {
    document.getElementById(id)?.classList.add("hidden");
    document.body.style.overflow = "auto";
  },
};
