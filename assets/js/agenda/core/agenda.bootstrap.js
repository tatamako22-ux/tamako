import { supabase } from "../../config/supabaseClient.js";

import { requireTiendaInfo } from "../../core/session.js";

import { calcularCita } from "./agenda.engine.js";

import { renderSkeleton, renderizarAgenda } from "../ui/agenda.renderer.js?v=6";

import { iniciarAgenda } from "./agenda.controller.js?v=6";

// 🚀 BOOTSTRAP APP
export async function iniciarAppAgenda() {
  // 🔐 VALIDAR SESIÓN
  const tiendaInfo = await requireTiendaInfo();

  console.log("🏪 TIENDA:", tiendaInfo);

  if (!tiendaInfo) {
    return;
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
