import {
  obtenerDatosDashboard,
  suscribirDashboard,
  fechaLocal,
} from "./dashboard.service.js?v=2";
import { renderModalCitas } from "./dashboard.modal.js";

const dinero = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const hora = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
});

const escapar = (valor = "") =>
  String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const facturaPagada = (factura) =>
  String(factura.estado || "").toUpperCase() === "PAGADA";

const facturasDeCita = (cita) => {
  if (!cita.facturas) return [];
  return Array.isArray(cita.facturas) ? cita.facturas : [cita.facturas];
};

function fechaFactura(factura) {
  return fechaLocal(new Date(factura.fecha_emision));
}

function suma(lista, campo = "total") {
  return lista.reduce((total, item) => total + Number(item[campo] || 0), 0);
}

function reglaParaLinea(reglas, idProfesional, idServicio) {
  return reglas
    .filter((regla) => !regla.id_barbero || String(regla.id_barbero) === String(idProfesional))
    .filter((regla) => !regla.id_servicio || String(regla.id_servicio) === String(idServicio))
    .sort((a, b) =>
      Number(Boolean(b.id_barbero)) + Number(Boolean(b.id_servicio)) -
      Number(Boolean(a.id_barbero)) - Number(Boolean(a.id_servicio)),
    )[0] || null;
}

function calcularComisionFactura(factura, datos) {
  const calcular = (base, regla) => {
    if (!regla) return base * (datos.comisionGeneral / 100);
    const tipo = String(regla.tipo_comision || "").toUpperCase();
    if (tipo.includes("FIJO")) return Math.min(base, Number(regla.valor_fijo || 0));
    return base * (Number(regla.porcentaje || 0) / 100);
  };
  const detalles = factura.factura_detalles || [];
  if (!detalles.length) {
    return calcular(
      Number(factura.total || 0),
      reglaParaLinea(datos.reglasComision, factura.id_barbero, null),
    );
  }
  return detalles.reduce((total, detalle) => {
    const base = Number(
      detalle.total_linea ??
      Number(detalle.precio_unitario || 0) * Number(detalle.cantidad || 1),
    );
    const regla = reglaParaLinea(
      datos.reglasComision,
      factura.id_barbero,
      detalle.id_servicio,
    );
    return total + calcular(base, regla);
  }, 0);
}

function ponerTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = valor;
}

function construirResumen(datos) {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  const pagadas = datos.facturas.filter(facturaPagada);
  const facturasHoy = pagadas.filter((factura) => fechaFactura(factura) === datos.hoy);
  const facturasAyer = pagadas.filter(
    (factura) => fechaFactura(factura) === fechaLocal(ayer),
  );
  const citasValidas = datos.citas.filter(
    (cita) => String(cita.estado).toUpperCase() !== "CANCELADA",
  );
  const porCobrar = citasValidas.filter(
    (cita) => !facturasDeCita(cita).some(facturaPagada),
  );
  const ventasHoy = suma(facturasHoy);
  const ventasAyer = suma(facturasAyer);

  return {
    facturasHoy,
    citasValidas,
    porCobrar,
    ventasHoy,
    ventasAyer,
    ticket: facturasHoy.length ? ventasHoy / facturasHoy.length : 0,
  };
}

function renderKPIs(datos, resumen) {
  ponerTexto("valIngresos", dinero.format(resumen.ventasHoy));
  ponerTexto("valCitas", resumen.citasValidas.length);
  ponerTexto("valPorCobrar", resumen.porCobrar.length);
  ponerTexto("valTicket", dinero.format(resumen.ticket));

  const diferencia = resumen.ventasHoy - resumen.ventasAyer;
  let comparacion = "Sin ventas ayer";
  if (resumen.ventasAyer > 0) {
    const porcentaje = (diferencia / resumen.ventasAyer) * 100;
    comparacion = `${porcentaje >= 0 ? "+" : ""}${porcentaje.toFixed(0)}% vs. ayer`;
  }
  ponerTexto("comparacionVentas", comparacion);

  const kpiVentas = document.getElementById("kpiVentas");
  kpiVentas?.classList.toggle("is-down", diferencia < 0);

  const esEmpleado = !datos.sesion?.es_propietario;
  document.body.classList.toggle("employee-dashboard", esEmpleado);
  const panelEmpleado = document.getElementById("resumenComisionEmpleado");
  if (panelEmpleado) {
    panelEmpleado.hidden = !esEmpleado;
    if (esEmpleado) {
      const esMensual = datos.profesional?.modalidad_pago === "MENSUALIDAD";
      const comisionProfesional = esMensual ? Number(datos.profesional?.mensualidad || 0) : resumen.facturasHoy.reduce(
        (total, factura) => total + calcularComisionFactura(factura, datos),
        0,
      );
      ponerTexto("valProduccionEmpleado", dinero.format(resumen.ventasHoy));
      ponerTexto("valComisionEmpleado", dinero.format(comisionProfesional));
      ponerTexto("labelComisionEmpleado", esMensual ? "Mi mensualidad" : "Mi comisión de hoy");
      ponerTexto("porcentajeComisionEmpleado", esMensual ? "Valor mensual acordado" : `${Number(datos.profesional?.porcentaje_comision ?? datos.comisionGeneral)}% base`);
    }
  }

  const caja = datos.cajaAbierta;
  const estadoCaja = document.getElementById("estadoCajaKpi");
  if (!caja) {
    ponerTexto("valCaja", "Cerrada");
    ponerTexto("detalleCaja", "Abre el turno para controlar efectivo");
    estadoCaja?.classList.remove("is-open");
    return;
  }

  const ingresos = suma(
    datos.movimientosCaja.filter((movimiento) => movimiento.tipo === "INGRESO"),
    "monto",
  );
  const egresos = suma(
    datos.movimientosCaja.filter((movimiento) => movimiento.tipo === "EGRESO"),
    "monto",
  );
  const esperado = Number(caja.base_inicial || 0) + ingresos - egresos;
  ponerTexto("valCaja", dinero.format(esperado));
  ponerTexto(
    "detalleCaja",
    `${caja.cuentas_financieras?.nombre || "Caja"} · abierta ${hora.format(new Date(caja.fecha_apertura))}`,
  );
  estadoCaja?.classList.add("is-open");
}

function renderTendencia(datos) {
  const contenedor = document.getElementById("graficaVentas");
  if (!contenedor) return;

  const dias = [];
  for (let indice = 13; indice >= 0; indice -= 1) {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    fecha.setDate(fecha.getDate() - indice);
    const key = fechaLocal(fecha);
    const valor = suma(
      datos.facturas.filter(
        (factura) => facturaPagada(factura) && fechaFactura(factura) === key,
      ),
    );
    dias.push({ fecha, key, valor });
  }

  const maximo = Math.max(...dias.map((dia) => dia.valor), 1);
  contenedor.innerHTML = dias
    .map((dia) => {
      const altura = dia.valor ? Math.max((dia.valor / maximo) * 100, 8) : 2;
      const esHoy = dia.key === fechaLocal();
      const etiqueta = dia.fecha
        .toLocaleDateString("es-CO", { weekday: "short" })
        .replace(".", "")
        .slice(0, 2);
      return `
        <div class="trend-column ${esHoy ? "is-today" : ""}" title="${dinero.format(dia.valor)}">
          <span class="trend-value">${dia.valor ? dinero.format(dia.valor) : "$0"}</span>
          <div class="trend-track"><span style="height:${altura}%"></span></div>
          <small>${escapar(etiqueta)}</small>
        </div>`;
    })
    .join("");

  ponerTexto("totalPeriodo", dinero.format(suma(datos.facturas.filter(facturaPagada))));
}

function renderProximasCitas(datos) {
  const contenedor = document.getElementById("listaProximasCitas");
  if (!contenedor) return;

  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  let proximas = datos.citas
    .filter((cita) => String(cita.estado).toUpperCase() !== "CANCELADA")
    .filter((cita) => {
      if (!cita.hora_inicio) return true;
      const [h, m] = cita.hora_inicio.split(":").map(Number);
      return h * 60 + m >= minutosAhora;
    })
    .slice(0, 5);

  if (!proximas.length) {
    proximas = datos.citas
      .filter((cita) => String(cita.estado).toUpperCase() !== "CANCELADA")
      .slice(-3);
  }

  if (!proximas.length) {
    contenedor.innerHTML = `<div class="empty-state"><i class="fa-regular fa-calendar-check"></i><p>No hay citas para hoy.</p></div>`;
    return;
  }

  contenedor.innerHTML = proximas
    .map((cita) => {
      const facturada = facturasDeCita(cita).some(facturaPagada);
      return `
        <article class="appointment-row">
          <div class="appointment-time">${escapar(cita.hora_inicio?.slice(0, 5) || "--:--")}</div>
          <div class="appointment-main">
            <strong>${escapar(cita.nombre_cliente || "Cliente ocasional")}</strong>
            <span>${escapar(cita.servicio_nombre || cita.servicio || "Servicio")} · ${escapar(cita.profesionales?.nombre_empleado || "Sin asignar")}</span>
          </div>
          <span class="mini-status ${facturada ? "is-paid" : "is-pending"}">${facturada ? "Facturada" : "Por cobrar"}</span>
        </article>`;
    })
    .join("");
}

function renderMetodos(resumen) {
  const contenedor = document.getElementById("metodosPagoHoy");
  if (!contenedor) return;
  const agrupados = resumen.facturasHoy.reduce((resultado, factura) => {
    const metodo = String(factura.metodo_pago || "Sin método").toUpperCase();
    resultado[metodo] = (resultado[metodo] || 0) + Number(factura.total || 0);
    return resultado;
  }, {});
  const filas = Object.entries(agrupados).sort((a, b) => b[1] - a[1]);

  if (!filas.length) {
    contenedor.innerHTML = `<div class="empty-state compact"><i class="fa-regular fa-credit-card"></i><p>Aún no hay pagos hoy.</p></div>`;
    return;
  }

  contenedor.innerHTML = filas
    .map(([nombre, valor]) => {
      const porcentaje = resumen.ventasHoy ? (valor / resumen.ventasHoy) * 100 : 0;
      return `
        <div class="method-row">
          <div><strong>${escapar(nombre)}</strong><span>${dinero.format(valor)}</span></div>
          <div class="method-track"><span style="width:${porcentaje}%"></span></div>
          <small>${porcentaje.toFixed(0)}%</small>
        </div>`;
    })
    .join("");
}

function obtenerRanking(facturas, selector) {
  const mapa = new Map();
  facturas.forEach((factura) => {
    const items = selector(factura);
    items.forEach(({ nombre, valor }) => {
      if (!nombre) return;
      mapa.set(nombre, (mapa.get(nombre) || 0) + Number(valor || 0));
    });
  });
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

function renderRendimiento(resumen) {
  const profesional = obtenerRanking(resumen.facturasHoy, (factura) => [
    {
      nombre: factura.profesionales?.nombre_empleado || "Sin asignar",
      valor: factura.total,
    },
  ])[0];
  const servicio = obtenerRanking(resumen.facturasHoy, (factura) =>
    (factura.factura_detalles || []).map((detalle) => ({
      nombre: detalle.descripcion,
      valor: Number(detalle.precio_unitario || 0) * Number(detalle.cantidad || 1),
    })),
  )[0];

  ponerTexto("topProfesional", profesional?.[0] || "Sin datos todavía");
  ponerTexto("valorTopProfesional", profesional ? dinero.format(profesional[1]) : "$0");
  ponerTexto("topServicio", servicio?.[0] || "Sin datos todavía");
  ponerTexto("valorTopServicio", servicio ? dinero.format(servicio[1]) : "$0");
}

function renderAlertas(datos, resumen) {
  const contenedor = document.getElementById("alertasOperacion");
  if (!contenedor) return;
  const alertas = [];

  if (!datos.cajaAbierta) {
    alertas.push({
      tipo: "warning",
      icono: "fa-cash-register",
      titulo: "Caja sin abrir",
      texto: "Abre la caja antes de registrar movimientos en efectivo.",
      enlace: "facturacion.html#caja",
      accion: "Ir a caja",
    });
  }
  if (resumen.porCobrar.length) {
    alertas.push({
      tipo: "info",
      icono: "fa-file-invoice-dollar",
      titulo: `${resumen.porCobrar.length} cita${resumen.porCobrar.length === 1 ? "" : "s"} por cobrar`,
      texto: "Revisa las citas de hoy que todavía no tienen factura pagada.",
      enlace: "agenda.html",
      accion: "Ver agenda",
    });
  }
  const cierreConDiferencia = datos.ultimosCierres.find(
    (cierre) => Math.abs(Number(cierre.diferencia || 0)) > 0,
  );
  if (cierreConDiferencia) {
    alertas.push({
      tipo: "danger",
      icono: "fa-scale-balanced",
      titulo: "Diferencia en un cierre reciente",
      texto: `La diferencia registrada fue ${dinero.format(cierreConDiferencia.diferencia)}.`,
      enlace: "facturacion.html#caja",
      accion: "Revisar",
    });
  }

  if (!alertas.length) {
    alertas.push({
      tipo: "success",
      icono: "fa-circle-check",
      titulo: "Todo bajo control",
      texto: "No hay alertas operativas pendientes en este momento.",
    });
  }

  contenedor.innerHTML = alertas
    .slice(0, 3)
    .map(
      (alerta) => `
        <article class="operation-alert ${alerta.tipo}">
          <i class="fa-solid ${alerta.icono}"></i>
          <div><strong>${escapar(alerta.titulo)}</strong><span>${escapar(alerta.texto)}</span></div>
          ${alerta.enlace ? `<a href="${alerta.enlace}">${alerta.accion}<i class="fa-solid fa-arrow-right"></i></a>` : ""}
        </article>`,
    )
    .join("");
}

function renderDashboard(datos) {
  const resumen = construirResumen(datos);
  renderKPIs(datos, resumen);
  renderTendencia(datos);
  renderProximasCitas(datos);
  renderMetodos(resumen);
  renderRendimiento(resumen);
  renderAlertas(datos, resumen);
  renderModalCitas(datos.citas);
  ponerTexto("ultimaActualizacion", `Actualizado ${hora.format(new Date())}`);
}

function mostrarError(error) {
  console.error("Error cargando dashboard:", error);
  window.TamakuUI?.toast?.("No pudimos actualizar el panel. Intenta nuevamente.", "error");
  document.getElementById("dashboardLoading")?.classList.add("is-hidden");
}

export function initOverview(tiendaInfo) {
  let cargando = false;
  let refrescoPendiente;
  let refrescoPeriodico;

  const cargar = async ({ silencioso = false } = {}) => {
    if (cargando) return;
    cargando = true;
    if (!silencioso) document.getElementById("dashboardLoading")?.classList.remove("is-hidden");
    try {
      const datos = await obtenerDatosDashboard(tiendaInfo);
      renderDashboard(datos);
    } catch (error) {
      mostrarError(error);
    } finally {
      cargando = false;
      document.getElementById("dashboardLoading")?.classList.add("is-hidden");
    }
  };

  const programarRefresco = () => {
    clearTimeout(refrescoPendiente);
    refrescoPendiente = setTimeout(() => cargar({ silencioso: true }), 500);
  };

  document.getElementById("btnRefrescarDashboard")?.addEventListener("click", () => cargar());
  window.addEventListener("focus", () => cargar({ silencioso: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") programarRefresco();
  });
  const desuscribir = suscribirDashboard(tiendaInfo.id, programarRefresco);
  refrescoPeriodico = setInterval(() => {
    if (document.visibilityState === "visible") cargar({ silencioso: true });
  }, 12000);
  window.addEventListener("pagehide", () => {
    clearTimeout(refrescoPendiente);
    clearInterval(refrescoPeriodico);
    desuscribir();
  }, { once: true });
  cargar();
}
