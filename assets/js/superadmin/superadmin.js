import { supabase } from "../config/supabaseClient.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const dinero = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const escapar = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fecha = (v) => v ? new Date(v).toLocaleDateString("es-CO") : "—";
let suscripciones = [], pagos = [], notificaciones = [], seleccionada = null, agendaCotizaciones = [];

async function cargarAgendaCotizaciones() {
  const { data, error } = await supabase
    .from("tamaku_agenda_cotizaciones")
    .select("id,nombre_tienda,contacto,email,telefono,direccion,fecha_agenda,valor_cotizacion,estado,notas,created_at")
    .order("fecha_agenda", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  agendaCotizaciones = data || [];
  renderAgendaCotizaciones();
}

function emitAgendaCotizacion(raw) {
  return {
    nombre_tienda: String(raw.nombre_tienda || "").trim(),
    contacto: String(raw.contacto || "").trim(),
    email: String(raw.email || "").trim(),
    telefono: String(raw.telefono || "").trim(),
    direccion: String(raw.direccion || "").trim(),
    fecha_agenda: raw.fecha_agenda || null,
    valor_cotizacion: Number(raw.valor_cotizacion || 0),
    estado: raw.estado || "Pendiente",
    notas: String(raw.notas || "").trim(),
  };
}

function renderAgendaCotizaciones() {
  const q = $("#buscarAgendaCotizacion")?.value?.toLowerCase() || "";
  const filtradas = agendaCotizaciones.filter((item) => `${item.nombre_tienda} ${item.contacto} ${item.email} ${item.telefono} ${item.direccion} ${item.notas}`.toLowerCase().includes(q));
  const contenedor = $("#tablaAgendaCotizacion");
  if (!contenedor) return;
  contenedor.innerHTML = filtradas.length
    ? filtradas.map((item) => `
        <article>
          <div><strong>${escapar(item.nombre_tienda)}</strong><small>${escapar(item.contacto || "Sin contacto")}</small></div>
          <div><span>${escapar(item.email || "Sin email")}</span><small>${escapar(item.telefono || "Sin teléfono")}</small></div>
          <div><span>${escapar(item.direccion || "Sin dirección")}</span><small>${fecha(item.fecha_agenda)}</small></div>
          <div><span>${dinero.format(Number(item.valor_cotizacion || 0))}</span><small>${escapar(item.estado || "Pendiente")}</small></div>
          <div><em>${escapar(item.estado || "Pendiente")}</em><small>${escapar(item.notas || "Sin notas")}</small></div>
        </article>
      `).join("")
    : `<div class="vacio">Aún no hay registros en agenda y cotización.</div>`;
}

function exportarAgendaCotizacionCsv() {
  const filas = [["nombre_tienda", "contacto", "email", "telefono", "direccion", "fecha_agenda", "valor_cotizacion", "estado", "notas"], ...agendaCotizaciones.map((item) => [item.nombre_tienda, item.contacto, item.email, item.telefono, item.direccion, item.fecha_agenda, Number(item.valor_cotizacion || 0), item.estado, item.notas])];
  const csv = filas.map((fila) => fila.map((valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `agenda-cotizacion-tamaku-${hoyISO()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function descargarPlantillaAgendaCotizacion() {
  const csv = [
    "nombre_tienda,contacto,email,telefono,direccion,fecha_agenda,valor_cotizacion,estado,notas",
    "Barbería Demo,Juan Pérez,juan@ejemplo.com,3000000000,Calle 20 #15-40,2026-10-05,180000,Cotizado,Cliente solicita agenda para 3 personas",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "plantilla-agenda-cotizacion.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function parsearCsv(contenido) {
  const filas = [];
  let fila = [], valor = "", entreComillas = false;
  for (let i = 0; i < contenido.length; i += 1) {
    const caracter = contenido[i];
    if (caracter === '"') {
      if (entreComillas && contenido[i + 1] === '"') {
        valor += '"';
        i += 1;
      } else entreComillas = !entreComillas;
    } else if (caracter === "," && !entreComillas) {
      fila.push(valor.trim());
      valor = "";
    } else if ((caracter === "\n" || caracter === "\r") && !entreComillas) {
      if (caracter === "\r" && contenido[i + 1] === "\n") i += 1;
      fila.push(valor.trim());
      if (fila.some((celda) => celda)) filas.push(fila);
      fila = [];
      valor = "";
    } else valor += caracter;
  }
  fila.push(valor.trim());
  if (fila.some((celda) => celda)) filas.push(fila);
  return filas;
}

function procesarCsvAgendaCotizacion(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    const contenido = String(event.target.result || "");
    const filasCsv = parsearCsv(contenido.replace(/^\uFEFF/, ""));
    if (filasCsv.length < 2) {
      mostrarAviso("error", "CSV vacío", "El archivo no tiene registros válidos.");
      return;
    }
    const encabezados = filasCsv[0].map((h) => h.trim().toLowerCase());
    const registros = filasCsv.slice(1).map((celdas) => {
      const fila = {};
      encabezados.forEach((campo, i) => { fila[campo] = celdas[i] || ""; });
      const registro = emitAgendaCotizacion({
        nombre_tienda: fila.nombre_tienda,
        contacto: fila.contacto,
        email: fila.email,
        telefono: fila.telefono,
        direccion: fila.direccion,
        fecha_agenda: fila.fecha_agenda,
        valor_cotizacion: fila.valor_cotizacion,
        estado: fila.estado || "Pendiente",
        notas: fila.notas,
      });
      return registro.nombre_tienda ? registro : null;
    }).filter(Boolean);

    if (!registros.length) {
      mostrarAviso("error", "Sin registros", "No se detectaron barberías válidas en el CSV.");
      return;
    }

    const { error } = await supabase.from("tamaku_agenda_cotizaciones").insert(registros);
    if (error) {
      mostrarAviso("error", "No se pudo importar el CSV", error.message);
      return;
    }
    await cargarAgendaCotizaciones();
    mostrarAviso("success", "Carga masiva completada", `${registros.length} registros agregados a agenda y cotización.`);
  };
  reader.readAsText(file, "utf-8");
}
function mostrarAviso(tipo, titulo, mensaje) {
  return window.TamakuUI.notify(mensaje, tipo, { titulo });
}
function finAcceso(s) { return s.estado === "PRUEBA" ? s.fin_prueba : s.fin_periodo; }
function diferenciaDias(v) { return v ? Math.ceil((new Date(v) - new Date()) / 86400000) : null; }
function estadoEfectivo(s) {
  if (["SUSPENDIDA", "CANCELADA"].includes(s.estado)) return s.estado;
  const fin = finAcceso(s); if (!fin) return "VENCIDA";
  const limite = new Date(fin); limite.setDate(limite.getDate() + Number(s.dias_gracia || 0));
  return limite > new Date() ? s.estado : "VENCIDA";
}
function textoDias(s) {
  if (["SUSPENDIDA", "CANCELADA"].includes(s.estado)) return "Acceso bloqueado manualmente";
  const d = diferenciaDias(finAcceso(s));
  if (d === null) return "Sin fecha de vencimiento";
  if (d > 0) return `${d} día${d === 1 ? "" : "s"} restante${d === 1 ? "" : "s"}`;
  if (d === 0) return "Vence hoy";
  return `${Math.abs(d)} día${d === -1 ? "" : "s"} vencido${d === -1 ? "" : "s"}`;
}
function nombreTienda(id) { return suscripciones.find((s) => s.id_tienda === id)?.tiendas?.nombre || "Tienda"; }
function codigoPlan(s) { return s.estado === "PRUEBA" ? "PRUEBA" : (s.tamaku_planes?.codigo || s.plan_solicitado || "SIN PLAN"); }
function textoPlan(s) { return s.estado === "PRUEBA" ? `PRUEBA → ${s.plan_solicitado && s.plan_solicitado !== "PRUEBA" ? s.plan_solicitado : "POR ELEGIR"}` : codigoPlan(s); }

function cambiarVista(nombre) {
  $$(".vista").forEach((v) => v.classList.toggle("active", v.dataset.seccion === nombre));
  $$("#navAdmin [data-vista]").forEach((b) => b.classList.toggle("active", b.dataset.vista === nombre));
  $("#tituloVista").textContent = { resumen: "Centro de control", tiendas: "Gestión de tiendas", pagos: "Pagos e ingresos", "agenda-cotizacion": "Agenda y cotización", alertas: "Alertas y actividad" }[nombre];
  history.replaceState(null, "", `#${nombre}`);
}

function renderResumen() {
  const estados = suscripciones.map(estadoEfectivo), ahora = new Date();
  $("#totalTiendas").textContent = suscripciones.length;
  $("#totalPruebas").textContent = estados.filter((e) => e === "PRUEBA").length;
  $("#totalActivas").textContent = estados.filter((e) => e === "ACTIVA").length;
  $("#totalVencidas").textContent = estados.filter((e) => ["VENCIDA", "SUSPENDIDA", "CANCELADA"].includes(e)).length;
  $("#ingresosMes").textContent = dinero.format(pagos.filter((p) => { const f = new Date(p.fecha_pago); return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear(); }).reduce((a, p) => a + Number(p.monto), 0));
  $("#ingresoProyectado").textContent = dinero.format(suscripciones.filter((s) => estadoEfectivo(s) === "ACTIVA").reduce((total, s) => total + Number(s.tamaku_planes?.precio_mensual || 0), 0));
  $("#notifBadge").textContent = notificaciones.filter((n) => !n.leida).length;
  renderAnalitica();
}

function renderAnalitica() {
  const proximas = suscripciones.filter((s) => finAcceso(s) && !["SUSPENDIDA", "CANCELADA"].includes(s.estado)).sort((a, b) => new Date(finAcceso(a)) - new Date(finAcceso(b))).slice(0, 6);
  $("#proximosVencimientos").innerHTML = proximas.map((s) => `<button data-abrir-tienda="${s.id_tienda}"><span><strong>${escapar(s.tiendas?.nombre || "Tienda")}</strong><small>${escapar(textoDias(s))}</small></span><time>${fecha(finAcceso(s))}</time></button>`).join("") || `<div class="vacio">No hay vencimientos programados.</div>`;
  const conteos = ["PRUEBA", "BASICO", "PRO", "PREMIUM"].map((plan) => ({ plan, total: suscripciones.filter((s) => codigoPlan(s) === plan).length }));
  const max = Math.max(1, ...conteos.map((x) => x.total));
  $("#distribucionPlanes").innerHTML = conteos.map((x) => `<div><label><span>${x.plan}</span><b>${x.total}</b></label><i><em style="width:${x.total / max * 100}%"></em></i></div>`).join("");
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d; });
  const puntos = meses.map((m) => ({ etiqueta: m.toLocaleDateString("es-CO", { month: "short" }), total: pagos.filter((p) => { const f = new Date(p.fecha_pago); return f.getMonth() === m.getMonth() && f.getFullYear() === m.getFullYear(); }).reduce((a, p) => a + Number(p.monto), 0) }));
  const mayor = Math.max(1, ...puntos.map((p) => p.total));
  $("#graficoIngresos").innerHTML = puntos.map((p) => `<div title="${dinero.format(p.total)}"><b>${p.total ? dinero.format(p.total) : "$0"}</b><i style="height:${Math.max(4, p.total / mayor * 100)}%"></i><span>${p.etiqueta}</span></div>`).join("");
}

function renderTiendas() {
  const q = $("#buscarTienda").value.toLowerCase(), filtro = $("#filtroEstado").value;
  const lista = suscripciones.filter((s) => `${s.tiendas?.nombre} ${s.tiendas?.email} ${s.tiendas?.telefono}`.toLowerCase().includes(q)).filter((s) => filtro === "TODAS" || (filtro === "PROBLEMAS" ? ["VENCIDA", "SUSPENDIDA", "CANCELADA"].includes(estadoEfectivo(s)) : estadoEfectivo(s) === filtro));
  $("#tablaTiendas").innerHTML = lista.map((s) => { const estado = estadoEfectivo(s); return `<button class="tienda-row" data-abrir-tienda="${s.id_tienda}"><span><strong>${escapar(s.tiendas?.nombre || "Tienda")}</strong><small>${escapar(s.tiendas?.email || "")} · ${escapar(s.tiendas?.telefono || "")}</small></span><b>${escapar(textoPlan(s))}</b><em class="estado ${estado.toLowerCase()}">${estado}</em><time>${fecha(finAcceso(s))}<small>${escapar(textoDias(s))}</small></time><i class="fa-solid fa-chevron-right"></i></button>`; }).join("") || `<div class="vacio">No hay tiendas con este filtro.</div>`;
}

function pagosFiltrados() {
  const mes = $("#filtroMesPago").value;
  return pagos.filter((p) => !mes || new Date(p.fecha_pago).toISOString().slice(0, 7) === mes);
}
function renderPagos() {
  $("#tablaPagos").innerHTML = pagosFiltrados().map((p) => `<article><strong>${escapar(nombreTienda(p.id_tienda))}</strong><span>${escapar(p.tamaku_planes?.nombre || "Plan")}<small>${escapar(p.referencia || "Sin referencia")}</small></span><span>${fecha(p.periodo_desde)}<small>hasta ${fecha(p.periodo_hasta)}</small></span><time>${fecha(p.fecha_pago)}</time><b>${dinero.format(p.monto)}</b></article>`).join("") || `<div class="vacio">No hay pagos en el periodo seleccionado.</div>`;
}
function renderNotificaciones() {
  $("#listaNotificaciones").innerHTML = notificaciones.map((n) => `<article class="notificacion ${n.leida ? "" : "nueva"}" data-notif="${n.id}"><i class="fa-solid fa-bell"></i><div><strong>${escapar(n.titulo)}</strong><p>${escapar(n.mensaje)}</p><small>${new Date(n.created_at).toLocaleString("es-CO")}</small></div><em>${n.leida ? "Leída" : "Nueva"}</em></article>`).join("") || `<div class="vacio">Sin notificaciones.</div>`;
}
function renderHistorial(id) {
  const lista = pagos.filter((p) => p.id_tienda === id);
  $("#historialPagos").innerHTML = lista.map((p) => `<article><div><strong>${dinero.format(p.monto)}</strong><small>${escapar(p.referencia || "Sin referencia")} · ${escapar(p.tamaku_planes?.nombre || "Plan")}</small></div><time>${fecha(p.fecha_pago)}<small>${fecha(p.periodo_desde)} → ${fecha(p.periodo_hasta)}</small></time></article>`).join("") || `<div class="vacio">Esta tienda aún no tiene pagos.</div>`;
}
function abrirDetalle(id) {
  seleccionada = suscripciones.find((s) => s.id_tienda === id); if (!seleccionada) return;
  $("#detalleNombre").textContent = seleccionada.tiendas?.nombre || "Tienda"; $("#detalleContacto").textContent = `${seleccionada.tiendas?.email || ""} · ${seleccionada.tiendas?.telefono || ""}`;
  $("#detalleEstado").textContent = `${estadoEfectivo(seleccionada)} · ${textoPlan(seleccionada)}`; $("#detalleDias").textContent = textoDias(seleccionada); $("#diasGracia").value = seleccionada.dias_gracia || 0; $("#mensajeBloqueo").value = seleccionada.mensaje_bloqueo || "";
  $("#pagoPlan").value = ["BASICO", "PRO", "PREMIUM"].includes(seleccionada.plan_solicitado) ? seleccionada.plan_solicitado : "BASICO"; $("#pagoMonto").value = { BASICO: 29900, PRO: 59900, PREMIUM: 99900 }[$("#pagoPlan").value];
  $("#pagoFecha").value = hoyISO(); $("#periodoInicio").value = diferenciaDias(seleccionada.fin_periodo) >= 0 ? new Date(seleccionada.fin_periodo).toISOString().slice(0, 10) : hoyISO(); renderHistorial(id);
  $("#reactivarTienda").hidden = !["SUSPENDIDA", "CANCELADA"].includes(seleccionada.estado); $("#detallePanel").classList.add("open");
}

async function cargar() {
  const [s, p, n] = await Promise.all([supabase.from("tamaku_suscripciones").select("*,tiendas(id,nombre,email,telefono,direccion),tamaku_planes(codigo,nombre,precio_mensual)").order("created_at", { ascending: false }), supabase.from("tamaku_pagos_suscripcion").select("*,tamaku_planes(nombre,codigo)").order("fecha_pago", { ascending: false }), supabase.from("tamaku_notificaciones_admin").select("*").order("created_at", { ascending: false }).limit(100)]);
  if (s.error) throw s.error; if (p.error) throw p.error; if (n.error) throw n.error;
  suscripciones = s.data || []; pagos = p.data || []; notificaciones = n.data || []; renderResumen(); renderTiendas(); renderPagos(); renderNotificaciones();
}
async function verificar() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return location.replace("../index.html?login=true"); const { data } = await supabase.from("tamaku_superadmins").select("user_id,nombre").eq("user_id", user.id).eq("activo", true).maybeSingle(); if (!data) { await supabase.auth.signOut(); return location.replace("../index.html?login=true"); } $("#adminNombre").textContent = data.nombre; await cargar(); await cargarAgendaCotizaciones(); }

$("#navAdmin").onclick = (e) => { const b = e.target.closest("[data-vista]"); if (b) cambiarVista(b.dataset.vista); };
document.addEventListener("click", (e) => { const tienda = e.target.closest("[data-abrir-tienda]"); if (tienda) abrirDetalle(tienda.dataset.abrirTienda); const ir = e.target.closest("[data-ir]"); if (ir) cambiarVista(ir.dataset.ir); });
$("#buscarTienda").addEventListener("input", renderTiendas); $("#filtroEstado").addEventListener("change", renderTiendas); $("#filtroMesPago").addEventListener("change", renderPagos);
$$('[data-filtro]').forEach((kpi) => kpi.onclick = () => { cambiarVista("tiendas"); $("#filtroEstado").value = kpi.dataset.filtro; renderTiendas(); });
$("#cerrarDetalle").onclick = () => $("#detallePanel").classList.remove("open"); $("#pagoPlan").onchange = (e) => $("#pagoMonto").value = { BASICO: 29900, PRO: 59900, PREMIUM: 99900 }[e.target.value];
$("#pagoForm").onsubmit = async (e) => {
  e.preventDefault();
  const formulario = e.currentTarget, boton = formulario.querySelector('button[type="submit"], button:not([type])');
  const d = Object.fromEntries(new FormData(formulario));
  const idTienda = seleccionada.id_tienda, tienda = seleccionada.tiendas?.nombre || "La tienda";
  const textoOriginal = boton.textContent;
  boton.disabled = true; boton.textContent = "Registrando pago...";
  const { error } = await supabase.rpc("registrar_pago_manual_tamaku", { p_tienda: idTienda, p_plan: d.plan, p_monto: Number(d.monto), p_fecha_pago: d.fecha_pago, p_fecha_inicio: d.fecha_inicio, p_dias: Number(d.dias), p_referencia: d.referencia, p_notas: d.notas || null });
  boton.disabled = false; boton.textContent = textoOriginal;
  if (error) return mostrarAviso("error", "No se pudo registrar el pago", error.message);
  formulario.elements.referencia.value = ""; formulario.elements.notas.value = "";
  await cargar(); abrirDetalle(idTienda);
  const actualizada = suscripciones.find((s) => s.id_tienda === idTienda);
  mostrarAviso("success", "Pago registrado correctamente", `${tienda} quedó activa en el plan ${d.plan}. Nuevo vencimiento: ${fecha(finAcceso(actualizada))}.`);
};
$("#guardarControl").onclick = async () => { const { error } = await supabase.rpc("configurar_acceso_tamaku", { p_tienda: seleccionada.id_tienda, p_dias_gracia: Number($("#diasGracia").value), p_mensaje: $("#mensajeBloqueo").value || null }); if (error) return window.TamakuUI.notify(error.message); window.TamakuUI.notify("Configuración guardada."); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#extenderPrueba").onclick = async () => { const dias = Number((await window.TamakuUI.prompt({ titulo: "Extender prueba gratuita", mensaje: "Indica cuántos días deseas agregar al periodo de prueba.", etiqueta: "Días adicionales", valorInicial: "7", tipo: "number", min: 1, paso: 1, requerido: true, textoConfirmar: "Agregar días" }))); if (!dias) return; const { error } = await supabase.rpc("extender_prueba_tamaku", { p_tienda: seleccionada.id_tienda, p_dias: dias }); if (error) return window.TamakuUI.notify(error.message); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#suspenderTienda").onclick = async () => { if (!(await window.TamakuUI.confirm("¿Apagar esta tienda inmediatamente?"))) return; const motivo = (await window.TamakuUI.prompt("Mensaje que verá la tienda:", $("#mensajeBloqueo").value || "Tu acceso fue suspendido. Comunícate con TAMAKU.")); if (motivo === null) return; const { error } = await supabase.rpc("cambiar_estado_suscripcion_tamaku", { p_tienda: seleccionada.id_tienda, p_estado: "SUSPENDIDA", p_observacion: motivo }); if (error) return window.TamakuUI.notify(error.message); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#reactivarTienda").onclick = async () => { const estado = seleccionada.fin_periodo ? "ACTIVA" : "PRUEBA"; const { error } = await supabase.rpc("cambiar_estado_suscripcion_tamaku", { p_tienda: seleccionada.id_tienda, p_estado: estado, p_observacion: null }); if (error) return window.TamakuUI.notify(error.message); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#listaNotificaciones").onclick = async (e) => { const n = e.target.closest("[data-notif]"); if (!n) return; await supabase.from("tamaku_notificaciones_admin").update({ leida: true }).eq("id", n.dataset.notif); await cargar(); };
$("#marcarTodas").onclick = async () => { const ids = notificaciones.filter((n) => !n.leida).map((n) => n.id); if (!ids.length) return; const { error } = await supabase.from("tamaku_notificaciones_admin").update({ leida: true }).in("id", ids); if (error) return window.TamakuUI.notify(error.message); await cargar(); };
$("#exportarPagos").onclick = () => { const filas = [["Tienda", "Plan", "Monto", "Fecha pago", "Periodo desde", "Periodo hasta", "Referencia"], ...pagosFiltrados().map((p) => [nombreTienda(p.id_tienda), p.tamaku_planes?.codigo || "", p.monto, fecha(p.fecha_pago), fecha(p.periodo_desde), fecha(p.periodo_hasta), p.referencia || ""])]; const csv = filas.map((f) => f.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); a.download = `pagos-tamaku-${hoyISO()}.csv`; a.click(); URL.revokeObjectURL(a.href); };
async function cerrarSesionAdmin() {
  const botones = [$("#cerrarSesionAdmin"), $("#cerrarSesionAdminMovil")].filter(Boolean);
  botones.forEach((boton) => { boton.disabled = true; });
  const { error } = await supabase.auth.signOut();
  if (error) {
    botones.forEach((boton) => { boton.disabled = false; });
    return mostrarAviso("error", "No se pudo cerrar la sesión", error.message);
  }
  location.replace("../index.html");
}
$("#cerrarSesionAdmin").onclick = cerrarSesionAdmin;
$("#cerrarSesionAdminMovil").onclick = cerrarSesionAdmin;

renderAgendaCotizaciones();
$("#buscarAgendaCotizacion")?.addEventListener("input", renderAgendaCotizaciones);
$("#exportarAgendaCotizacion")?.addEventListener("click", exportarAgendaCotizacionCsv);
$("#plantillaAgendaCotizacion")?.addEventListener("click", descargarPlantillaAgendaCotizacion);
$("#csvAgendaCotizacion")?.addEventListener("change", (e) => {
  const archivo = e.target.files?.[0];
  if (archivo) procesarCsvAgendaCotizacion(archivo);
  e.target.value = "";
});
$("#agendaCotizacionForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const boton = event.currentTarget.querySelector('button[type="submit"]');
  boton.disabled = true;
  const formulario = new FormData(event.currentTarget);
  const dato = emitAgendaCotizacion(Object.fromEntries(formulario.entries()));
  if (!dato.nombre_tienda) {
    boton.disabled = false;
    mostrarAviso("error", "Registro incompleto", "Debes indicar al menos el nombre de la barbería.");
    return;
  }
  const { error } = await supabase.from("tamaku_agenda_cotizaciones").insert(dato);
  boton.disabled = false;
  if (error) {
    mostrarAviso("error", "No se pudo guardar el registro", error.message);
    return;
  }
  await cargarAgendaCotizaciones();
  event.currentTarget.reset();
  mostrarAviso("success", "Registro guardado", `${dato.nombre_tienda} quedó agregado a agenda y cotización.`);
});

const inicial = location.hash.slice(1); if (["resumen", "tiendas", "pagos", "agenda-cotizacion", "alertas"].includes(inicial)) cambiarVista(inicial);
verificar().catch((e) => {
  const mensaje = escapar(e.message);
  $("#proximosVencimientos").innerHTML = `<div class="vacio">No se pudo cargar el panel: ${mensaje}</div>`;
  $("#tablaAgendaCotizacion").innerHTML = `<div class="vacio">No se pudieron cargar los registros desde Supabase: ${mensaje}</div>`;
});
