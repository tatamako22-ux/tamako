import { supabase } from "../config/supabaseClient.js";

const cacheCategorias = new Map();
const normalizarTelefono = (valor) => String(valor || "").replace(/\D/g, "").slice(-10);

async function obtenerCategoriasClientes(idTienda) {
  const guardada = cacheCategorias.get(idTienda);
  if (guardada && Date.now() - guardada.creada < 120000) return guardada.datos;

  const { data, error } = await supabase
    .from("citas")
    .select("telefono_cliente")
    .eq("id_tienda", idTienda);
  if (error) throw error;

  const visitas = new Map();
  (data || []).forEach((cita) => {
    const telefono = normalizarTelefono(cita.telefono_cliente);
    if (telefono) visitas.set(telefono, (visitas.get(telefono) || 0) + 1);
  });
  cacheCategorias.set(idTienda, { creada: Date.now(), datos: visitas });
  return visitas;
}

// 👨‍💼 OBTENER PROFESIONALES
export async function obtenerBarberos(idTienda, idProfesional = null) {
  let query = supabase

    .from("profesionales")

    .select(
      `
    id_barbero,
    id_tienda,
    nombre_empleado,
    foto_url,
    horario_inicio,
    horario_fin,
    horario_semanal,
    modo_agenda,
    intervalo_citas,
    dia_descanso,
    vacaciones_inicio,
    vacaciones_fin,
    almuerzo_inicio,
    almuerzo_minutos,
    break_inicio,
    break_minutos
`,
    )

    .eq("id_tienda", idTienda);

  if (idProfesional) query = query.eq("id_barbero", idProfesional);

  const { data, error } = await query

    .order("nombre_empleado", {
      ascending: true,
    });

  if (error) {
    console.error("❌ Error obteniendo profesionales:", error);

    return [];
  }

  return data || [];
}

// 📅 OBTENER CITAS
export async function obtenerCitas({ idTienda, fecha, idBarbero }) {
  try {
    let query = supabase

      .from("citas")

      .select(
        `
                id_cita,
                id_barbero,
                nombre_cliente,
                telefono_cliente,
                email_cliente,
                hora_inicio,
                hora_fin,
                estado,
                servicio,
                servicio_id,
                servicio_nombre,
                valor_servicio,
                user_id,
                id_tienda,
                facturas (
                  id_factura,
                  estado,
                  total,
                  fecha_emision,
                  metodo_pago
                )
            `,
      )

      .eq("id_tienda", idTienda)

      .eq("fecha", fecha)

      .neq("estado", "CANCELADA");

    // 👨‍💼 FILTRAR BARBERO
    if (idBarbero) {
      query = query.eq("id_barbero", idBarbero);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const [categorias, resultadoBloqueos] = await Promise.all([
      obtenerCategoriasClientes(idTienda),
      supabase.from("clientes_bloqueados").select("telefono_cliente,tipo_bloqueo,id_barbero").eq("id_tienda", idTienda),
    ]);
    if (resultadoBloqueos.error) console.warn("No se pudieron consultar los bloqueos de clientes:", resultadoBloqueos.error);
    const bloqueosPorTelefono = new Map();
    (resultadoBloqueos.data || []).forEach((bloqueo) => {
      const telefono = normalizarTelefono(bloqueo.telefono_cliente);
      if (!telefono) return;
      const lista = bloqueosPorTelefono.get(telefono) || [];
      lista.push(bloqueo);
      bloqueosPorTelefono.set(telefono, lista);
    });
    return (data || []).map((cita) => {
      const telefono = normalizarTelefono(cita.telefono_cliente);
      const visitas = categorias.get(telefono) || 1;
      const bloqueos = bloqueosPorTelefono.get(telefono) || [];
      const bloqueoAplicable = bloqueos.find((bloqueo) => {
        const tipo = String(bloqueo.tipo_bloqueo || "").toLowerCase();
        return ["global", "total"].includes(tipo) || (["profesional", "parcial"].includes(tipo) && String(bloqueo.id_barbero) === String(cita.id_barbero));
      });
      return {
        ...cita,
        visitas_cliente: visitas,
        categoria_cliente: visitas >= 5 ? "VIP" : visitas === 1 ? "NUEVO" : "FRECUENTE",
        cliente_bloqueado: Boolean(bloqueoAplicable),
        bloqueo_cliente_alcance: ["global", "total"].includes(String(bloqueoAplicable?.tipo_bloqueo || "").toLowerCase()) ? "Toda la tienda" : "Este profesional",
      };
    });
  } catch (error) {
    console.error("❌ Error obteniendo citas:", error);

    return [];
  }
}

export async function obtenerConteoCitasRango({ idTienda, desde, hasta, idBarbero }) {
  try {
    let query = supabase.from("citas").select("fecha")
      .eq("id_tienda", idTienda).gte("fecha", desde).lte("fecha", hasta)
      .neq("estado", "CANCELADA");
    if (idBarbero) query = query.eq("id_barbero", idBarbero);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).reduce((conteo, cita) => {
      conteo[cita.fecha] = (conteo[cita.fecha] || 0) + 1;
      return conteo;
    }, {});
  } catch (error) {
    console.error("Error obteniendo conteo semanal:", error);
    return {};
  }
}

// ❌ CANCELAR CITA
export async function cancelarCita(idCita, idTienda) {
  try {
    const { error } = await supabase

      .from("citas")

      .update({
        estado: "CANCELADA",
      })

      .eq("id_cita", idCita)
      .eq("id_tienda", idTienda);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("❌ Error cancelando cita:", error);

    return false;
  }
}

// Marca una cita atendible como inasistencia. Se conserva el cliente y el
// servicio para que la tienda pueda medir el ingreso que dejó de percibir.
export async function marcarCitaNoAsistida(idCita, idTienda) {
  try {
    const { error } = await supabase
      .from("citas")
      .update({ estado: "NO_ASISTIO" })
      .eq("id_cita", idCita)
      .eq("id_tienda", idTienda)
      .neq("estado", "CANCELADA");

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error marcando la inasistencia:", error);
    return false;
  }
}
