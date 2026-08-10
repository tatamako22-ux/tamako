import { supabase } from "../config/supabaseClient.js";

export async function cargarCatalogo(incluirInactivos = false) {
  let query = supabase.from("marketplace_productos").select("*, marketplace_categorias(id,nombre)").order("destacado", { ascending: false }).order("nombre");
  if (!incluirInactivos) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function cargarCategorias() {
  const { data, error } = await supabase.from("marketplace_categorias").select("id,nombre,activo,orden").order("orden").order("nombre");
  if (error) throw error;
  return data || [];
}

export async function cargarPedidos(idTienda, esAdmin = false) {
  let query = supabase.from("marketplace_pedidos").select("*, marketplace_pedido_items(*)").order("created_at", { ascending: false });
  if (!esAdmin) query = query.eq("id_tienda", idTienda);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function verificarAdmin(userId) {
  const { data, error } = await supabase.from("marketplace_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function crearPedido(tienda, datos, items) {
  const { data, error } = await supabase.rpc("crear_pedido_marketplace", {
    p_id_tienda: tienda.id,
    p_metodo_pago: datos.metodo_pago,
    p_nombre_recibe: datos.nombre_recibe,
    p_telefono: datos.telefono,
    p_direccion: datos.direccion,
    p_ciudad: datos.ciudad,
    p_notas: datos.notas || "",
    p_items: items.map((item) => ({ producto_id: item.id, cantidad: item.cantidad })),
  });
  if (error) throw error;
  return data;
}

export async function guardarProducto(producto) {
  const payload = {
    categoria_id: producto.categoria_id || null,
    nombre: producto.nombre,
    descripcion: producto.descripcion || null,
    imagen_url: producto.imagen_url || null,
    sku: producto.sku || null,
    precio: Number(producto.precio),
    stock: Number(producto.stock),
    activo: producto.activo,
    destacado: producto.destacado,
    updated_at: new Date().toISOString(),
  };
  const query = producto.id
    ? supabase.from("marketplace_productos").update(payload).eq("id", producto.id)
    : supabase.from("marketplace_productos").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function actualizarPedido(id, estado, estadoPago) {
  const { error } = await supabase.rpc("actualizar_pedido_marketplace_admin", {
    p_pedido: id,
    p_estado: estado,
    p_estado_pago: estadoPago,
  });
  if (error) throw error;
}

export function suscribirPedidos(idTienda, esAdmin, callback) {
  const filtro = esAdmin ? {} : { filter: `id_tienda=eq.${idTienda}` };
  const canal = supabase.channel(`marketplace-${idTienda}-${esAdmin ? "admin" : "tienda"}`).on("postgres_changes", { event: "*", schema: "public", table: "marketplace_pedidos", ...filtro }, callback).subscribe();
  return () => supabase.removeChannel(canal);
}
