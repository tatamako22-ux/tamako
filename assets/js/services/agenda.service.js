import { supabase } from "../config/supabaseClient.js";

const cacheCategorias = new Map();
const normalizarTelefono = (valor) => String(valor || "").replace(/\D/g, "");

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
export async function obtenerBarberos(idTienda) {
  const { data, error } = await supabase

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
    intervalo_citas
`,
    )

    .eq("id_tienda", idTienda)

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

    const categorias = await obtenerCategoriasClientes(idTienda);
    return (data || []).map((cita) => {
      const visitas = categorias.get(normalizarTelefono(cita.telefono_cliente)) || 1;
      return {
        ...cita,
        visitas_cliente: visitas,
        categoria_cliente: visitas >= 5 ? "VIP" : visitas === 1 ? "NUEVO" : "FRECUENTE",
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
