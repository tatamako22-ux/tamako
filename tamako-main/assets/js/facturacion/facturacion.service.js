import { supabase } from "../config/supabaseClient.js";

function exigirTienda(idTienda) {
  if (!idTienda) throw new Error("No se encontró la tienda activa.");
}

export const FacturacionService = {
  async getClientes(idTienda) {
    exigirTienda(idTienda);

    const { data: citas, error: errorCitas } = await supabase
      .from("citas")
      .select("user_id")
      .eq("id_tienda", idTienda)
      .not("user_id", "is", null);

    if (errorCitas) throw errorCitas;

    const ids = [...new Set((citas || []).map((cita) => cita.user_id))];
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("perfiles_clientes")
      .select("id, nombre_completo, whatsapp")
      .in("id", ids)
      .order("nombre_completo", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getProfesionales(idTienda) {
    exigirTienda(idTienda);

    const { data, error } = await supabase
      .from("profesionales")
      .select("id_barbero, nombre_empleado")
      .eq("id_tienda", idTienda)
      .order("nombre_empleado", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getServicios(idTienda, idBarbero = null) {
    exigirTienda(idTienda);

    let query = supabase
      .from("servicios")
      .select("id_servicio, nombre_servicio, precio, id_barbero")
      .eq("id_tienda", idTienda)
      .order("nombre_servicio", { ascending: true });

    if (idBarbero) query = query.eq("id_barbero", idBarbero);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getMetodosPago(idTienda, idBarbero = null) {
    exigirTienda(idTienda);

    const { data, error } = await supabase
      .from("metodos_pago")
      .select("id_metodo, id_cuenta, id_barbero, nombre, tipo_destino")
      .eq("id_tienda", idTienda)
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) throw error;

    return (data || []).filter(
      (metodo) =>
        !metodo.id_barbero ||
        String(metodo.id_barbero) === String(idBarbero),
    );
  },

  async getCuentasFinancieras(idTienda) {
    exigirTienda(idTienda);

    const { data, error } = await supabase
      .from("cuentas_financieras")
      .select("*")
      .eq("id_tienda", idTienda)
      .eq("activa", true)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async crearCuenta({
    idTienda,
    nombre,
    tipo,
    saldoInicial = 0,
    idBarbero = null,
  }) {
    exigirTienda(idTienda);

    const nombreLimpio = nombre?.trim();
    const saldo = Number(saldoInicial) || 0;

    if (!nombreLimpio) throw new Error("El nombre de la cuenta es obligatorio.");
    if (saldo < 0) throw new Error("El saldo inicial no puede ser negativo.");

    const cuentas = await this.getCuentasFinancieras(idTienda);
    const repetida = cuentas.some(
      (cuenta) => cuenta.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase(),
    );

    if (repetida) throw new Error("Ya existe una cuenta con ese nombre.");

    const { data, error } = await supabase
      .from("cuentas_financieras")
      .insert([
        {
          id_tienda: idTienda,
          id_barbero: idBarbero,
          nombre: nombreLimpio,
          tipo,
          saldo_inicial: saldo,
          saldo_actual: saldo,
          activa: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async actualizarCuenta({ idTienda, idCuenta, nombre, tipo, activa = true }) {
    exigirTienda(idTienda);
    const nombreLimpio = nombre?.trim();
    if (!idCuenta) throw new Error("La cuenta no es válida.");
    if (!nombreLimpio) throw new Error("El nombre es obligatorio.");

    const cuentas = await this.getCuentasFinancieras(idTienda);
    const repetida = cuentas.some(
      (cuenta) =>
        cuenta.id !== idCuenta &&
        cuenta.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase(),
    );
    if (repetida) throw new Error("Ya existe otra cuenta con ese nombre.");

    const { data, error } = await supabase
      .from("cuentas_financieras")
      .update({ nombre: nombreLimpio, tipo, activa })
      .eq("id", idCuenta)
      .eq("id_tienda", idTienda)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async editarCuentaAdministrativa({ idTienda, idCuenta, nombre, tipo }) {
    exigirTienda(idTienda);
    const nombreLimpio = nombre?.trim();
    if (!idCuenta || !nombreLimpio) throw new Error("Completa los datos de la cuenta.");
    const { data, error } = await supabase.rpc("editar_cuenta_financiera_tienda", {
      p_id_tienda: idTienda,
      p_id_cuenta: idCuenta,
      p_nombre: nombreLimpio,
      p_tipo: tipo,
    });
    if (error) throw error;
    return data;
  },

  async eliminarCuentaAdministrativa({ idTienda, idCuenta }) {
    exigirTienda(idTienda);
    if (!idCuenta) throw new Error("La cuenta no es válida.");
    const { data, error } = await supabase.rpc("eliminar_cuenta_financiera_tienda", {
      p_id_tienda: idTienda,
      p_id_cuenta: idCuenta,
    });
    if (error) throw error;
    return data;
  },

  async getMovimientosCuenta(idTienda, idCuenta, limite = 30) {
    exigirTienda(idTienda);

    const { data, error } = await supabase
      .from("movimientos_financieros")
      .select("id_movimiento, tipo, concepto, monto, saldo_resultante, estado, created_at")
      .eq("id_tienda", idTienda)
      .eq("id_cuenta", idCuenta)
      .order("created_at", { ascending: false })
      .limit(limite);

    if (error) throw error;
    return data || [];
  },

  async getCuentasEfectivo(idTienda) {
    const cuentas = await this.getCuentasFinancieras(idTienda);
    return cuentas.filter(
      (cuenta) => String(cuenta.tipo).toUpperCase() === "EFECTIVO",
    );
  },

  async getCajaAbierta(idTienda) {
    exigirTienda(idTienda);

    const { data, error } = await supabase
      .from("cajas_sesiones")
      .select("*, cuentas_financieras(nombre, tipo)")
      .eq("id_tienda", idTienda)
      .eq("estado", "ABIERTA")
      .order("fecha_apertura", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async abrirCaja({ idTienda, idCuenta, baseInicial, notas = null }) {
    exigirTienda(idTienda);
    const base = Number(baseInicial) || 0;
    if (!idCuenta) throw new Error("Selecciona una cuenta de efectivo.");
    if (base < 0) throw new Error("La base inicial no puede ser negativa.");

    const { data: cuenta, error: errorCuenta } = await supabase
      .from("cuentas_financieras")
      .select("id, saldo_actual, tipo")
      .eq("id", idCuenta)
      .eq("id_tienda", idTienda)
      .eq("activa", true)
      .single();

    if (errorCuenta) throw errorCuenta;
    if (String(cuenta.tipo).toUpperCase() !== "EFECTIVO")
      throw new Error("La cuenta seleccionada no es de tipo efectivo.");

    const { data, error } = await supabase
      .from("cajas_sesiones")
      .insert([
        {
          id_tienda: idTienda,
          id_cuenta: idCuenta,
          base_inicial: base,
          saldo_cuenta_apertura: Number(cuenta.saldo_actual) || 0,
          notas_apertura: notas?.trim() || null,
          estado: "ABIERTA",
        },
      ])
      .select("*, cuentas_financieras(nombre, tipo)")
      .single();

    if (error) throw error;
    return data;
  },

  async getMovimientosTurno(caja) {
    const { data, error } = await supabase
      .from("movimientos_financieros")
      .select("id_movimiento, tipo, concepto, monto, saldo_resultante, estado, created_at")
      .eq("id_tienda", caja.id_tienda)
      .eq("id_cuenta", caja.id_cuenta)
      .eq("estado", "ACTIVO")
      .gte("created_at", caja.fecha_apertura)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async registrarMovimientoCaja({ idTienda, idCaja, tipo, concepto, monto }) {
    exigirTienda(idTienda);

    const { data, error } = await supabase.rpc("registrar_movimiento_caja", {
      p_id_tienda: idTienda,
      p_id_caja: idCaja,
      p_tipo: tipo,
      p_concepto: concepto,
      p_monto: Number(monto),
    });

    if (error) throw error;
    return data;
  },

  async cerrarCaja({ caja, saldoContado, notas = null }) {
    const movimientos = await this.getMovimientosTurno(caja);
    const ingresos = movimientos
      .filter((movimiento) => movimiento.tipo === "INGRESO")
      .reduce((suma, movimiento) => suma + Number(movimiento.monto || 0), 0);
    const egresos = movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((suma, movimiento) => suma + Number(movimiento.monto || 0), 0);
    const esperado = Number(caja.base_inicial) + ingresos - egresos;
    const contado = Number(saldoContado);

    if (!Number.isFinite(contado) || contado < 0)
      throw new Error("El efectivo contado no es válido.");

    const { data, error } = await supabase
      .from("cajas_sesiones")
      .update({
        cerrada_por: (await supabase.auth.getUser()).data.user?.id || null,
        fecha_cierre: new Date().toISOString(),
        total_ingresos: ingresos,
        total_egresos: egresos,
        saldo_esperado: esperado,
        saldo_contado: contado,
        diferencia: contado - esperado,
        notas_cierre: notas?.trim() || null,
        estado: "CERRADA",
      })
      .eq("id_caja", caja.id_caja)
      .eq("id_tienda", caja.id_tienda)
      .eq("estado", "ABIERTA")
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getHistorialCajas(idTienda, limite = 20) {
    exigirTienda(idTienda);

    const { data, error } = await supabase
      .from("cajas_sesiones")
      .select("*, cuentas_financieras(nombre)")
      .eq("id_tienda", idTienda)
      .eq("estado", "CERRADA")
      .order("fecha_cierre", { ascending: false })
      .limit(limite);

    if (error) throw error;
    return data || [];
  },

  async getFacturas(idTienda) {
    exigirTienda(idTienda);

    const { data, error } = await supabase
      .from("facturas")
      .select(`
        id_factura,
        id_cita,
        id_barbero,
        id_metodo_pago,
        fecha_emision,
        metodo_pago,
        destino_pago,
        estado,
        total,
        notas,
        profesionales(nombre_empleado),
        perfiles_clientes(nombre_completo)
      `)
      .eq("id_tienda", idTienda)
      .order("fecha_emision", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getInsumos(idTienda) {
    exigirTienda(idTienda);
    const { data, error } = await supabase.from("insumos")
      .select("*, cuentas_financieras:id_cuenta(nombre,tipo)")
      .eq("id_tienda", idTienda).order("fecha_registro", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async crearInsumo(insumo) {
    exigirTienda(insumo?.id_tienda);
    const { data, error } = await supabase.from("insumos").insert([insumo]).select().single();
    if (error) throw error;
    return data;
  },

  async pagarInsumo({ idInsumo, idCuenta }) {
    const { data, error } = await supabase.rpc("pagar_insumo", { p_insumo: idInsumo, p_cuenta: idCuenta });
    if (error) throw error;
    return data;
  },

  async eliminarInsumo(idTienda, idInsumo) {
    exigirTienda(idTienda);
    const { error } = await supabase.from("insumos").delete().eq("id", idInsumo).eq("id_tienda", idTienda).eq("estado", "PENDIENTE");
    if (error) throw error;
  },

  async corregirMetodoPago({ idTienda, idFactura, idMetodoNuevo }) {
    exigirTienda(idTienda);
    if (!idFactura || !idMetodoNuevo)
      throw new Error("Selecciona una factura y un método de pago válido.");

    const { error } = await supabase.rpc("corregir_metodo_pago_factura", {
      p_factura: idFactura,
      p_metodo_nuevo: idMetodoNuevo,
    });

    if (error) throw error;
  },

  async getDatosReporte(idTienda, desde, hasta) {
    exigirTienda(idTienda);
    if (!desde || !hasta) throw new Error("Selecciona un periodo válido.");

    const [facturasResultado, movimientosResultado, cuentasResultado] =
      await Promise.all([
        supabase
          .from("facturas")
          .select(`
            id_factura,
            fecha_emision,
            metodo_pago,
            estado,
            total,
            profesionales(nombre_empleado)
          `)
          .eq("id_tienda", idTienda)
          .gte("fecha_emision", desde)
          .lte("fecha_emision", hasta)
          .order("fecha_emision", { ascending: true }),
        supabase
          .from("movimientos_financieros")
          .select(`
            id_movimiento,
            id_cuenta,
            tipo,
            concepto,
            monto,
            saldo_resultante,
            estado,
            created_at
          `)
          .eq("id_tienda", idTienda)
          .eq("estado", "ACTIVO")
          .gte("created_at", desde)
          .lte("created_at", hasta)
          .order("created_at", { ascending: false }),
        supabase
          .from("cuentas_financieras")
          .select("id, nombre, tipo, saldo_actual, activa")
          .eq("id_tienda", idTienda)
          .eq("activa", true)
          .order("saldo_actual", { ascending: false }),
      ]);

    if (facturasResultado.error) throw facturasResultado.error;
    if (movimientosResultado.error) throw movimientosResultado.error;
    if (cuentasResultado.error) throw cuentasResultado.error;

    return {
      facturas: facturasResultado.data || [],
      movimientos: movimientosResultado.data || [],
      cuentas: cuentasResultado.data || [],
    };
  },

  async crearFactura({ factura, detalles }) {
    exigirTienda(factura?.id_tienda);
    const { data: creada, error: errorFactura } = await supabase
      .from("facturas")
      .insert([factura])
      .select()
      .single();

    if (errorFactura) throw errorFactura;

    const filas = detalles.map((detalle) => ({
      ...detalle,
      id_factura: creada.id_factura,
    }));

    const { error: errorDetalles } = await supabase
      .from("factura_detalles")
      .insert(filas);

    if (errorDetalles) {
      await supabase
        .from("facturas")
        .update({ estado: "ERROR", notas: `Error en detalles: ${errorDetalles.message}` })
        .eq("id_factura", creada.id_factura)
        .eq("id_tienda", factura.id_tienda);
      throw errorDetalles;
    }

    return creada;
  },

  async finalizarCita(idCita, idTienda) {
    if (!idCita) return;
    exigirTienda(idTienda);

    const { error } = await supabase
      .from("citas")
      .update({ estado: "FINALIZADA" })
      .eq("id_cita", idCita)
      .eq("id_tienda", idTienda);

    if (error) throw error;
  },
};
