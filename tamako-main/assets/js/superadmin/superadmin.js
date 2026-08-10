import { supabase } from "../config/supabaseClient.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const dinero = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const escapar = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fecha = (v) => v ? new Date(v).toLocaleDateString("es-CO") : "—";
let suscripciones = [], pagos = [], notificaciones = [], seleccionada = null;

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

function cambiarVista(nombre) {
  $$(".vista").forEach((v) => v.classList.toggle("active", v.dataset.seccion === nombre));
  $$("#navAdmin [data-vista]").forEach((b) => b.classList.toggle("active", b.dataset.vista === nombre));
  $("#tituloVista").textContent = { resumen: "Centro de control", tiendas: "Gestión de tiendas", pagos: "Pagos e ingresos", alertas: "Alertas y actividad" }[nombre];
  history.replaceState(null, "", `#${nombre}`);
}

function renderResumen() {
  const estados = suscripciones.map(estadoEfectivo), ahora = new Date();
  $("#totalTiendas").textContent = suscripciones.length;
  $("#totalPruebas").textContent = estados.filter((e) => e === "PRUEBA").length;
  $("#totalActivas").textContent = estados.filter((e) => e === "ACTIVA").length;
  $("#totalVencidas").textContent = estados.filter((e) => ["VENCIDA", "SUSPENDIDA", "CANCELADA"].includes(e)).length;
  $("#ingresosMes").textContent = dinero.format(pagos.filter((p) => { const f = new Date(p.fecha_pago); return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear(); }).reduce((a, p) => a + Number(p.monto), 0));
  $("#notifBadge").textContent = notificaciones.filter((n) => !n.leida).length;
  renderAnalitica();
}

function renderAnalitica() {
  const proximas = suscripciones.filter((s) => finAcceso(s) && !["SUSPENDIDA", "CANCELADA"].includes(s.estado)).sort((a, b) => new Date(finAcceso(a)) - new Date(finAcceso(b))).slice(0, 6);
  $("#proximosVencimientos").innerHTML = proximas.map((s) => `<button data-abrir-tienda="${s.id_tienda}"><span><strong>${escapar(s.tiendas?.nombre || "Tienda")}</strong><small>${escapar(textoDias(s))}</small></span><time>${fecha(finAcceso(s))}</time></button>`).join("") || `<div class="vacio">No hay vencimientos programados.</div>`;
  const conteos = ["PRUEBA", "BASICO", "PRO", "PREMIUM"].map((plan) => ({ plan, total: suscripciones.filter((s) => (s.plan_solicitado || s.tamaku_planes?.codigo) === plan).length }));
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
  $("#tablaTiendas").innerHTML = lista.map((s) => { const estado = estadoEfectivo(s); return `<button class="tienda-row" data-abrir-tienda="${s.id_tienda}"><span><strong>${escapar(s.tiendas?.nombre || "Tienda")}</strong><small>${escapar(s.tiendas?.email || "")} · ${escapar(s.tiendas?.telefono || "")}</small></span><b>${escapar(s.plan_solicitado || s.tamaku_planes?.nombre || "PRUEBA")}</b><em class="estado ${estado.toLowerCase()}">${estado}</em><time>${fecha(finAcceso(s))}<small>${escapar(textoDias(s))}</small></time><i class="fa-solid fa-chevron-right"></i></button>`; }).join("") || `<div class="vacio">No hay tiendas con este filtro.</div>`;
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
  $("#detalleEstado").textContent = estadoEfectivo(seleccionada); $("#detalleDias").textContent = textoDias(seleccionada); $("#diasGracia").value = seleccionada.dias_gracia || 0; $("#mensajeBloqueo").value = seleccionada.mensaje_bloqueo || "";
  $("#pagoPlan").value = ["BASICO", "PRO", "PREMIUM"].includes(seleccionada.plan_solicitado) ? seleccionada.plan_solicitado : "BASICO"; $("#pagoMonto").value = { BASICO: 29900, PRO: 59900, PREMIUM: 99900 }[$("#pagoPlan").value];
  $("#pagoFecha").value = hoyISO(); $("#periodoInicio").value = diferenciaDias(seleccionada.fin_periodo) >= 0 ? new Date(seleccionada.fin_periodo).toISOString().slice(0, 10) : hoyISO(); renderHistorial(id);
  $("#reactivarTienda").hidden = !["SUSPENDIDA", "CANCELADA"].includes(seleccionada.estado); $("#detallePanel").classList.add("open");
}

async function cargar() {
  const [s, p, n] = await Promise.all([supabase.from("tamaku_suscripciones").select("*,tiendas(id,nombre,email,telefono,direccion),tamaku_planes(codigo,nombre,precio_mensual)").order("created_at", { ascending: false }), supabase.from("tamaku_pagos_suscripcion").select("*,tamaku_planes(nombre,codigo)").order("fecha_pago", { ascending: false }), supabase.from("tamaku_notificaciones_admin").select("*").order("created_at", { ascending: false }).limit(100)]);
  if (s.error) throw s.error; if (p.error) throw p.error; if (n.error) throw n.error;
  suscripciones = s.data || []; pagos = p.data || []; notificaciones = n.data || []; renderResumen(); renderTiendas(); renderPagos(); renderNotificaciones();
}
async function verificar() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return location.replace("../index.html?login=true"); const { data } = await supabase.from("tamaku_superadmins").select("user_id,nombre").eq("user_id", user.id).eq("activo", true).maybeSingle(); if (!data) { await supabase.auth.signOut(); return location.replace("../index.html?login=true"); } $("#adminNombre").textContent = data.nombre; await cargar(); }

$("#navAdmin").onclick = (e) => { const b = e.target.closest("[data-vista]"); if (b) cambiarVista(b.dataset.vista); };
document.addEventListener("click", (e) => { const tienda = e.target.closest("[data-abrir-tienda]"); if (tienda) abrirDetalle(tienda.dataset.abrirTienda); const ir = e.target.closest("[data-ir]"); if (ir) cambiarVista(ir.dataset.ir); });
$("#buscarTienda").addEventListener("input", renderTiendas); $("#filtroEstado").addEventListener("change", renderTiendas); $("#filtroMesPago").addEventListener("change", renderPagos);
$$('[data-filtro]').forEach((kpi) => kpi.onclick = () => { cambiarVista("tiendas"); $("#filtroEstado").value = kpi.dataset.filtro; renderTiendas(); });
$("#cerrarDetalle").onclick = () => $("#detallePanel").classList.remove("open"); $("#pagoPlan").onchange = (e) => $("#pagoMonto").value = { BASICO: 29900, PRO: 59900, PREMIUM: 99900 }[e.target.value];
$("#pagoForm").onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); const { error } = await supabase.rpc("registrar_pago_manual_tamaku", { p_tienda: seleccionada.id_tienda, p_plan: d.plan, p_monto: Number(d.monto), p_fecha_pago: d.fecha_pago, p_fecha_inicio: d.fecha_inicio, p_dias: Number(d.dias), p_referencia: d.referencia, p_notas: d.notas || null }); if (error) return alert(error.message); alert("Pago registrado y tienda activada."); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#guardarControl").onclick = async () => { const { error } = await supabase.rpc("configurar_acceso_tamaku", { p_tienda: seleccionada.id_tienda, p_dias_gracia: Number($("#diasGracia").value), p_mensaje: $("#mensajeBloqueo").value || null }); if (error) return alert(error.message); alert("Configuración guardada."); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#extenderPrueba").onclick = async () => { const dias = Number(prompt("¿Cuántos días deseas agregar?", "7")); if (!dias) return; const { error } = await supabase.rpc("extender_prueba_tamaku", { p_tienda: seleccionada.id_tienda, p_dias: dias }); if (error) return alert(error.message); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#suspenderTienda").onclick = async () => { if (!confirm("¿Apagar esta tienda inmediatamente?")) return; const motivo = prompt("Mensaje que verá la tienda:", $("#mensajeBloqueo").value || "Tu acceso fue suspendido. Comunícate con TAMAKU."); if (motivo === null) return; const { error } = await supabase.rpc("cambiar_estado_suscripcion_tamaku", { p_tienda: seleccionada.id_tienda, p_estado: "SUSPENDIDA", p_observacion: motivo }); if (error) return alert(error.message); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#reactivarTienda").onclick = async () => { const estado = seleccionada.fin_periodo ? "ACTIVA" : "PRUEBA"; const { error } = await supabase.rpc("cambiar_estado_suscripcion_tamaku", { p_tienda: seleccionada.id_tienda, p_estado: estado, p_observacion: null }); if (error) return alert(error.message); await cargar(); abrirDetalle(seleccionada.id_tienda); };
$("#listaNotificaciones").onclick = async (e) => { const n = e.target.closest("[data-notif]"); if (!n) return; await supabase.from("tamaku_notificaciones_admin").update({ leida: true }).eq("id", n.dataset.notif); await cargar(); };
$("#marcarTodas").onclick = async () => { const ids = notificaciones.filter((n) => !n.leida).map((n) => n.id); if (!ids.length) return; const { error } = await supabase.from("tamaku_notificaciones_admin").update({ leida: true }).in("id", ids); if (error) return alert(error.message); await cargar(); };
$("#exportarPagos").onclick = () => { const filas = [["Tienda", "Plan", "Monto", "Fecha pago", "Periodo desde", "Periodo hasta", "Referencia"], ...pagosFiltrados().map((p) => [nombreTienda(p.id_tienda), p.tamaku_planes?.codigo || "", p.monto, fecha(p.fecha_pago), fecha(p.periodo_desde), fecha(p.periodo_hasta), p.referencia || ""])]; const csv = filas.map((f) => f.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); a.download = `pagos-tamaku-${hoyISO()}.csv`; a.click(); URL.revokeObjectURL(a.href); };
$("#cerrarSesionAdmin").onclick = async () => { await supabase.auth.signOut(); location.replace("../index.html"); };

const inicial = location.hash.slice(1); if (["resumen", "tiendas", "pagos", "alertas"].includes(inicial)) cambiarVista(inicial);
verificar().catch((e) => { $("#proximosVencimientos").innerHTML = `<div class="vacio">No se pudo cargar el panel: ${escapar(e.message)}</div>`; });
