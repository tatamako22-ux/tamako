import { supabase } from "../config/supabaseClient.js";

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
                hora_inicio,
                hora_fin,
                estado,
                servicio_nombre
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

    return data || [];
  } catch (error) {
    console.error("❌ Error obteniendo citas:", error);

    return [];
  }
}

// ❌ CANCELAR CITA
export async function cancelarCita(idCita) {
  try {
    const { error } = await supabase

      .from("citas")

      .update({
        estado: "CANCELADA",
      })

      .eq("id_cita", idCita);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("❌ Error cancelando cita:", error);

    return false;
  }
}
