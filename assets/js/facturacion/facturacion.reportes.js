import { FacturacionService } from "./facturacion.service.js";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const fechaCorta = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
});

const fechaHora = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getTienda() {
  return JSON.parse(localStorage.getItem("tamaku_tienda")) || {};
}

function fechaInput(fecha) {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function inicioDia(valor) {
  return new Date(`${valor}T00:00:00`).toISOString();
}

function finDia(valor) {
  return new Date(`${valor}T23:59:59.999`).toISOString();
}

function escapar(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function agrupar(registros, obtenerClave, obtenerValor) {
  return registros.reduce((resultado, registro) => {
    const clave = obtenerClave(registro) || "Sin especificar";
    resultado[clave] = (resultado[clave] || 0) + obtenerValor(registro);
    return resultado;
  }, {});
}

export const FacturacionReportes = {
  datos: { facturas: [], movimientos: [], cuentas: [] },
  desde: "",
  hasta: "",

  async init() {
    const ahora = new Date();
    this.desde = fechaInput(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
    this.hasta = fechaInput(ahora);
    document.getElementById("reporteDesde").value = this.desde;
    document.getElementById("reporteHasta").value = this.hasta;
    this.asignarEventos();
    await this.cargar();
  },

  asignarEventos() {
    document.querySelectorAll(".reporte-atajo").forEach((boton) => {
      boton.addEventListener("click", () => this.aplicarAtajo(boton));
    });
    document.getElementById("aplicarReporte")?.addEventListener("click", () => {
      this.desde = document.getElementById("reporteDesde").value;
      this.hasta = document.getElementById("reporteHasta").value;
      document.querySelectorAll(".reporte-atajo").forEach((boton) =>
        boton.classList.remove("active"),
      );
      this.cargar();
    });
    document.getElementById("exportarReporte")?.addEventListener("click", () =>
      this.exportarCSV(),
    );
    document.querySelector('[data-tab="reportes"]')?.addEventListener("click", () =>
      this.cargar(),
    );
    ["factura-creada", "movimiento-financiero", "cuenta-financiera-actualizada"].forEach((evento) =>
      window.addEventListener(evento, () => this.cargar()),
    );
  },

  aplicarAtajo(boton) {
    const ahora = new Date();
    const periodo = boton.dataset.periodo;
    let inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    if (periodo === "mes") inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    if (periodo === "7" || periodo === "30")
      inicio.setDate(inicio.getDate() - Number(periodo) + 1);

    this.desde = fechaInput(inicio);
    this.hasta = fechaInput(ahora);
    document.getElementById("reporteDesde").value = this.desde;
    document.getElementById("reporteHasta").value = this.hasta;
    document.querySelectorAll(".reporte-atajo").forEach((item) =>
      item.classList.toggle("active", item === boton),
    );
    this.cargar();
  },

  async cargar() {
    const tienda = getTienda();
    const estado = document.getElementById("reporteEstado");
    const contenido = document.getElementById("reporteContenido");
    if (!tienda.id || !estado || !this.desde || !this.hasta) return;
    if (this.desde > this.hasta) {
      estado.textContent = "La fecha inicial no puede ser posterior a la fecha final.";
      estado.classList.add("error");
      contenido.classList.add("hidden");
      return;
    }

    estado.textContent = "Actualizando indicadores financieros...";
    estado.classList.remove("hidden", "error");
    contenido.classList.add("hidden");

    try {
      this.datos = await FacturacionService.getDatosReporte(
        tienda.id,
        inicioDia(this.desde),
        finDia(this.hasta),
      );
      this.renderizar();
      estado.classList.add("hidden");
      contenido.classList.remove("hidden");
    } catch (error) {
      console.error("Error cargando reporte financiero:", error);
      estado.textContent = `No se pudo preparar el reporte: ${error.message}`;
      estado.classList.add("error");
    }
  },

  renderizar() {
    const pagadas = this.datos.facturas.filter(
      (factura) => String(factura.estado).toUpperCase() === "PAGADA",
    );
    const ventas = pagadas.reduce((suma, factura) => suma + Number(factura.total || 0), 0);
    const ingresos = this.datos.movimientos
      .filter((movimiento) => movimiento.tipo === "INGRESO")
      .reduce((suma, movimiento) => suma + Number(movimiento.monto || 0), 0);
    const egresos = this.datos.movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((suma, movimiento) => suma + Number(movimiento.monto || 0), 0);

    document.getElementById("reporteVentas").textContent = moneda.format(ventas);
    document.getElementById("reporteFacturas").textContent =
      `${pagadas.length} ${pagadas.length === 1 ? "factura pagada" : "facturas pagadas"}`;
    document.getElementById("reporteFlujo").textContent = moneda.format(ingresos - egresos);
    document.getElementById("reporteEgresos").textContent = moneda.format(egresos);
    document.getElementById("reporteTicket").textContent =
      moneda.format(pagadas.length ? ventas / pagadas.length : 0);
    document.getElementById("reportePeriodoTexto").textContent =
      `${fechaCorta.format(new Date(`${this.desde}T00:00:00`))} — ${fechaCorta.format(new Date(`${this.hasta}T00:00:00`))}`;

    this.renderTendencia(pagadas);
    this.renderRanking("reporteMetodos", agrupar(
      pagadas,
      (factura) => factura.metodo_pago || "Sin método",
      (factura) => Number(factura.total || 0),
    ));
    this.renderRanking("reporteProfesionales", agrupar(
      pagadas,
      (factura) => factura.profesionales?.nombre_empleado || "Sin asignar",
      (factura) => Number(factura.total || 0),
    ));
    this.renderCuentas();
    this.renderMovimientos();
  },

  renderTendencia(facturas) {
    const valores = agrupar(
      facturas,
      (factura) => fechaInput(new Date(factura.fecha_emision)),
      (factura) => Number(factura.total || 0),
    );
    const dias = [];
    const cursor = new Date(`${this.desde}T00:00:00`);
    const fin = new Date(`${this.hasta}T00:00:00`);
    while (cursor <= fin) {
      const clave = fechaInput(cursor);
      dias.push({ fecha: new Date(cursor), valor: valores[clave] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const activos = dias.filter((dia) => dia.valor > 0).length;
    document.getElementById("reporteDiasActivos").textContent =
      `${activos} ${activos === 1 ? "día con ventas" : "días con ventas"}`;
    const contenedor = document.getElementById("reporteTendencia");
    if (!dias.some((dia) => dia.valor > 0)) {
      contenedor.innerHTML = '<div class="reporte-vacio">No hay ventas pagadas en este periodo.</div>';
      return;
    }
    const maximo = Math.max(...dias.map((dia) => dia.valor), 1);
    contenedor.innerHTML = dias.map((dia) => `
      <div class="tendencia-columna" title="${escapar(fechaCorta.format(dia.fecha))}: ${escapar(moneda.format(dia.valor))}">
        <span>${dia.valor ? escapar(moneda.format(dia.valor)) : ""}</span>
        <div class="tendencia-barra"><i style="height:${Math.max((dia.valor / maximo) * 100, dia.valor ? 5 : 0)}%"></i></div>
        <small>${escapar(fechaCorta.format(dia.fecha))}</small>
      </div>`).join("");
  },

  renderRanking(id, grupos) {
    const contenedor = document.getElementById(id);
    const filas = Object.entries(grupos).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!filas.length) {
      contenedor.innerHTML = '<div class="reporte-vacio">Sin información para mostrar.</div>';
      return;
    }
    const maximo = filas[0][1] || 1;
    contenedor.innerHTML = filas.map(([nombre, valor], indice) => `
      <div class="ranking-fila">
        <span class="ranking-posicion">${indice + 1}</span>
        <div class="ranking-info"><div><strong>${escapar(nombre)}</strong><span>${escapar(moneda.format(valor))}</span></div><div class="ranking-barra"><i style="width:${(valor / maximo) * 100}%"></i></div></div>
      </div>`).join("");
  },

  renderCuentas() {
    const cuentas = this.datos.cuentas;
    const total = cuentas.reduce((suma, cuenta) => suma + Number(cuenta.saldo_actual || 0), 0);
    document.getElementById("reporteSaldoTotal").textContent = moneda.format(total);
    const contenedor = document.getElementById("reporteCuentas");
    if (!cuentas.length) {
      contenedor.innerHTML = '<div class="reporte-vacio">No hay cuentas activas.</div>';
      return;
    }
    contenedor.innerHTML = cuentas.map((cuenta) => `
      <div class="reporte-cuenta"><div><i class="fa-solid fa-wallet"></i><span><strong>${escapar(cuenta.nombre)}</strong><small>${escapar(cuenta.tipo)}</small></span></div><strong>${escapar(moneda.format(cuenta.saldo_actual || 0))}</strong></div>`).join("");
  },

  renderMovimientos() {
    const contenedor = document.getElementById("reporteMovimientos");
    const movimientos = this.datos.movimientos.slice(0, 8);
    const nombresCuentas = new Map(
      this.datos.cuentas.map((cuenta) => [String(cuenta.id), cuenta.nombre]),
    );
    if (!movimientos.length) {
      contenedor.innerHTML = '<div class="reporte-vacio">No hay movimientos en este periodo.</div>';
      return;
    }
    contenedor.innerHTML = movimientos.map((movimiento) => {
      const ingreso = movimiento.tipo === "INGRESO";
      const cuenta = nombresCuentas.get(String(movimiento.id_cuenta)) || "Cuenta";
      return `<div class="reporte-movimiento"><i class="fa-solid ${ingreso ? "fa-arrow-down" : "fa-arrow-up"} ${ingreso ? "ingreso" : "egreso"}"></i><div><strong>${escapar(movimiento.concepto)}</strong><span>${escapar(cuenta)} · ${escapar(fechaHora.format(new Date(movimiento.created_at)))}</span></div><strong class="${ingreso ? "valor-ingreso" : "valor-egreso"}">${ingreso ? "+" : "−"}${escapar(moneda.format(movimiento.monto || 0))}</strong></div>`;
    }).join("");
  },

  exportarCSV() {
    if (!this.datos.movimientos.length && !this.datos.facturas.length)
      return alert("No hay datos para exportar en este periodo.");

    const filas = [["TIPO", "FECHA", "CONCEPTO", "CUENTA / METODO", "VALOR", "ESTADO"]];
    this.datos.facturas.forEach((factura) => filas.push([
      "FACTURA", factura.fecha_emision, `Factura ${factura.id_factura}`,
      factura.metodo_pago || "", Number(factura.total || 0), factura.estado || "",
    ]));
    const nombresCuentas = new Map(
      this.datos.cuentas.map((cuenta) => [String(cuenta.id), cuenta.nombre]),
    );
    this.datos.movimientos.forEach((movimiento) => filas.push([
      movimiento.tipo, movimiento.created_at, movimiento.concepto,
      nombresCuentas.get(String(movimiento.id_cuenta)) || "", Number(movimiento.monto || 0), movimiento.estado || "",
    ]));
    const csv = filas.map((fila) => fila.map((valor) =>
      `"${String(valor ?? "").replaceAll('"', '""')}"`,
    ).join(";")).join("\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    enlace.download = `tamaku-reporte-${this.desde}-${this.hasta}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  },
};
