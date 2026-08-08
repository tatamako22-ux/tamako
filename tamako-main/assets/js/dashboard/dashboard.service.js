import { supabase } from "../config/supabaseClient.js";

function fechaLocal(fecha = new Date()) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inicioDia(fecha = new Date()) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function finDia(fecha = new Date()) {
  const copia = new Date(fecha);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

export async function obtenerCitasDelDia(idTienda) {
  const { data, error } = await supabase
    .from("citas")
    .select(`
      *,
      profesionales (nombre_empleado),
      facturas (id_factura, total, estado)
    `)
    .eq("id_tienda", idTienda)
    .eq("fecha", fechaLocal())
    .order("hora_inicio", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function obtenerDatosDashboard(tiendaInfo) {
  const idTienda = tiendaInfo?.id;
  if (!idTienda) throw new Error("No se encontró la tienda activa.");

  const sesion = tiendaInfo.sesion || {};
  const esPropietario = Boolean(sesion.es_propietario);
  const idProfesional = sesion.id_profesional || null;
  const permisos = sesion.permisos || {};
  const puedeVerCaja = esPropietario || permisos.caja_gestionar || permisos.reportes_ver;

  const hoy = new Date();
  const desde = inicioDia(hoy);
  desde.setDate(desde.getDate() - 13);

  let citasQuery = supabase
        .from("citas")
        .select(`
          id_cita, nombre_cliente, telefono_cliente, servicio,
          servicio_nombre, fecha, hora_inicio, estado, valor_servicio,
          profesionales (nombre_empleado),
          facturas (id_factura, total, estado)
        `)
        .eq("id_tienda", idTienda)
        .eq("fecha", fechaLocal())
        .order("hora_inicio", { ascending: true });

  let facturasQuery = supabase
        .from("facturas")
        .select(`
          id_factura, id_cita, fecha_emision, total, estado,
          metodo_pago, id_barbero,
          profesionales (nombre_empleado),
          factura_detalles (id_servicio, descripcion, cantidad, precio_unitario, total_linea)
        `)
        .eq("id_tienda", idTienda)
        .gte("fecha_emision", desde.toISOString())
        .lte("fecha_emision", finDia(hoy).toISOString())
        .order("fecha_emision", { ascending: true });

  if (!esPropietario && idProfesional) {
    citasQuery = citasQuery.eq("id_barbero", idProfesional);
    facturasQuery = facturasQuery.eq("id_barbero", idProfesional);
  }

  const cajaQuery = puedeVerCaja
    ? supabase
        .from("cajas_sesiones")
        .select(`
          *,
          cuentas_financieras (id, nombre, tipo)
        `)
        .eq("id_tienda", idTienda)
        .eq("estado", "ABIERTA")
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const cierresQuery = puedeVerCaja
    ? supabase
        .from("cajas_sesiones")
        .select("id_caja, fecha_cierre, diferencia, total_ingresos, total_egresos, estado")
        .eq("id_tienda", idTienda)
        .eq("estado", "CERRADA")
        .order("fecha_cierre", { ascending: false })
        .limit(5)
    : Promise.resolve({ data: [], error: null });

  const reglasQuery = !esPropietario && idProfesional
    ? supabase
        .from("reglas_comision")
        .select("id_barbero, id_servicio, tipo_comision, porcentaje, valor_fijo, activo")
        .eq("id_tienda", idTienda)
        .eq("activo", true)
        .or(`id_barbero.is.null,id_barbero.eq.${idProfesional}`)
    : Promise.resolve({ data: [], error: null });

  const [citasResult, facturasResult, cajaResult, cierresResult, reglasResult] =
    await Promise.all([
      citasQuery,
      facturasQuery,
      cajaQuery,
      cierresQuery,
      reglasQuery,
    ]);

  const error =
    citasResult.error ||
    facturasResult.error ||
    cajaResult.error ||
    cierresResult.error ||
    reglasResult.error;

  if (error) throw error;

  let movimientosCaja = [];
  if (cajaResult.data) {
    const { data, error: movimientosError } = await supabase
      .from("movimientos_financieros")
      .select("id_movimiento, tipo, monto, concepto, created_at")
      .eq("id_tienda", idTienda)
      .eq("id_cuenta", cajaResult.data.id_cuenta)
      .eq("estado", "ACTIVO")
      .gte("created_at", cajaResult.data.fecha_apertura);

    if (movimientosError) throw movimientosError;
    movimientosCaja = data || [];
  }

  return {
    citas: citasResult.data || [],
    facturas: facturasResult.data || [],
    cajaAbierta: cajaResult.data || null,
    ultimosCierres: cierresResult.data || [],
    movimientosCaja,
    reglasComision: reglasResult.data || [],
    sesion,
    comisionGeneral: Number(tiendaInfo.comision || 0),
    hoy: fechaLocal(hoy),
  };
}

export function suscribirDashboard(idTienda, onCambio) {
  const canal = supabase
    .channel(`dashboard-${idTienda}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "citas", filter: `id_tienda=eq.${idTienda}` },
      onCambio,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "facturas", filter: `id_tienda=eq.${idTienda}` },
      onCambio,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cajas_sesiones", filter: `id_tienda=eq.${idTienda}` },
      onCambio,
    )
    .subscribe();

  return () => supabase.removeChannel(canal);
}

export { fechaLocal };
