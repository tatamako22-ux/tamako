import { supabase } from "./config/supabaseClient.js";

const dinero = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fecha = (valor) => valor ? new Date(valor).toLocaleDateString("es-CO", { dateStyle: "medium" }) : "Sin fecha";
const escapar = (valor = "") => String(valor).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

async function cargarPlan() {
  const tienda = await window.tamakuContextReady;
  if (!tienda) return;
  if (!tienda.sesion?.es_propietario) {
    window.location.replace("dashboard.html");
    return;
  }
  const plan = tienda.suscripcion || {};
  const { data: suscripcionDirecta } = await supabase
    .from("tamaku_suscripciones")
    .select("plan_solicitado,tamaku_planes(codigo,nombre,precio_mensual)")
    .eq("id_tienda", tienda.id)
    .maybeSingle();
  const codigo = plan.plan_efectivo || (plan.estado === "PRUEBA" ? "PREMIUM" : plan.plan) || "—";
  const nombres = { BASICO: "Plan Básico", PRO: "Plan Pro", PREMIUM: "Plan Premium" };
  document.getElementById("planNombre").textContent = plan.estado === "PRUEBA" ? `${nombres[codigo] || codigo} · Prueba` : nombres[codigo] || codigo;
  document.getElementById("planPrecio").textContent = plan.estado === "PRUEBA" ? "Gratis por 7 días" : `${dinero.format(suscripcionDirecta?.tamaku_planes?.precio_mensual || 0)} / mes`;
  document.getElementById("planDescripcion").textContent = plan.estado === "PRUEBA" ? `Tienes acceso Premium completo. Plan solicitado al finalizar: ${suscripcionDirecta?.plan_solicitado || "por elegir"}.` : "Tu suscripción está activa con las capacidades correspondientes a este plan.";
  const estado = plan.estado_efectivo || plan.estado || "SIN DATOS";
  const estadoEl = document.getElementById("planEstado"); estadoEl.textContent = estado; estadoEl.className = `plan-status ${estado.toLowerCase()}`;
  document.getElementById("planVence").textContent = fecha(plan.vence);
  document.getElementById("planDias").textContent = `${Number(plan.dias_restantes || 0)} días`;
  document.getElementById("planProfesionales").textContent = plan.limite_profesionales ?? "—";
  document.getElementById("planUsuarios").textContent = plan.limite_usuarios ?? "—";

  const { data: pagos, error } = await supabase.from("tamaku_pagos_suscripcion").select("monto,fecha_pago,periodo_desde,periodo_hasta,referencia,tamaku_planes(nombre,codigo)").eq("id_tienda", tienda.id).order("fecha_pago", { ascending: false });
  if (error) throw error;
  const lista = pagos || [];
  document.getElementById("totalPagado").textContent = dinero.format(lista.reduce((total, pago) => total + Number(pago.monto || 0), 0));
  document.getElementById("listaPagos").innerHTML = lista.length ? lista.map((pago) => `<article><span>${fecha(pago.fecha_pago)}</span><span>${escapar(pago.tamaku_planes?.nombre || "Plan")}</span><span>${fecha(pago.periodo_desde)}<small>hasta ${fecha(pago.periodo_hasta)}</small></span><span>${escapar(pago.referencia || "Sin referencia")}</span><strong>${dinero.format(pago.monto)}</strong></article>`).join("") : "<p>Aún no hay pagos registrados.</p>";
}

cargarPlan().catch((error) => { console.error(error); document.getElementById("listaPagos").innerHTML = `<p>No fue posible cargar los pagos: ${escapar(error.message)}</p>`; });
