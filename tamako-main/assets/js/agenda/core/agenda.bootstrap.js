import { supabase } from "../../config/supabaseClient.js";

import { getTiendaInfo } from "../../core/session.js";

import { calcularCita } from "./agenda.engine.js";

import { renderSkeleton, renderizarAgenda } from "../ui/agenda.renderer.js";

import { iniciarAgenda } from "./agenda.controller.js";

// 🚀 BOOTSTRAP APP
export function iniciarAppAgenda() {
  // 🔐 VALIDAR SESIÓN
  const tiendaInfo = getTiendaInfo();

  console.log("🏪 TIENDA:", tiendaInfo);

  if (!tiendaInfo) {
    throw new Error("❌ Sesión no válida");
  }

  console.log("🚀 Tamaku Engine iniciado para:", tiendaInfo.nombre_tienda);

  // 🚀 INICIAR AGENDA
  iniciarAgenda({
    supabase,

    tiendaInfo,

    calcularCita,

    renderSkeleton,

    renderizarAgenda,
  });
}
