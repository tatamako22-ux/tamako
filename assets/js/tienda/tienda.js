import { requireTiendaInfo } from "../core/session.js";
import { cargarCatalogo, cargarCategorias, cargarPedidos, verificarAdmin, crearPedido, guardarProducto, actualizarPedido, suscribirPedidos } from "./tienda.service.js";

const $ = (s) => document.querySelector(s);
const dinero = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const escapar = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const avisar = (m, t = "success", o) => window.TamakuUI?.notify?.(m, t, o);
const ESTADOS = ["RECIBIDO", "CONFIRMADO", "PREPARANDO", "ENVIADO", "ENTREGADO", "CANCELADO"];
const PAGOS = ["PENDIENTE", "VERIFICANDO", "PAGADO", "RECHAZADO"];
let tienda, esAdmin = false, productos = [], categorias = [], pedidos = [], carrito = new Map();

function guardarCarrito() { localStorage.setItem(`tamaku_carrito_${tienda.id}`, JSON.stringify([...carrito.entries()])); }
function restaurarCarrito() { try { carrito = new Map(JSON.parse(localStorage.getItem(`tamaku_carrito_${tienda.id}`) || "[]")); } catch { carrito = new Map(); } }
function itemsCarrito() { return [...carrito.entries()].map(([id, cantidad]) => ({ ...productos.find((p) => p.id === id), cantidad })).filter((p) => p.id); }
function totalCarrito() { return itemsCarrito().reduce((s, p) => s + Number(p.precio) * p.cantidad, 0); }

function renderCategorias() {
  $("#filtrosCategorias").innerHTML = `<button class="chip active" data-cat="">Todos</button>` + categorias.filter((c) => c.activo).map((c) => `<button class="chip" data-cat="${c.id}">${escapar(c.nombre)}</button>`).join("");
}

function renderProductos() {
  const texto = $("#buscarProducto").value.trim().toLowerCase();
  const categoria = $("#filtrosCategorias .active")?.dataset.cat || "";
  const lista = productos.filter((p) => p.activo).filter((p) => !categoria || p.categoria_id === categoria).filter((p) => `${p.nombre} ${p.descripcion || ""}`.toLowerCase().includes(texto));
  $("#catalogoProductos").innerHTML = lista.length ? lista.map((p) => `
    <article class="producto-card ${p.stock < 1 ? "agotado" : ""}">
      <div class="producto-imagen">${p.imagen_url ? `<img src="${escapar(p.imagen_url)}" alt="${escapar(p.nombre)}" loading="lazy" decoding="async">` : `<i class="fa-solid fa-box-open"></i>`}${p.destacado ? `<span>Destacado</span>` : ""}</div>
      <div class="producto-info"><small>${escapar(p.marketplace_categorias?.nombre || "Productos")}</small><h3>${escapar(p.nombre)}</h3><p>${escapar(p.descripcion || "Producto profesional para tu negocio.")}</p><div><strong>${dinero.format(p.precio)}</strong><em>${p.stock > 0 ? `${p.stock} disponibles` : "Agotado"}</em></div><button type="button" class="agregar-producto" data-id="${p.id}" ${p.stock < 1 ? "disabled" : ""}><i class="fa-solid fa-cart-plus"></i> Agregar</button></div>
    </article>`).join("") : `<div class="tienda-vacio"><i class="fa-solid fa-magnifying-glass"></i><h3>No encontramos productos</h3><p>Prueba con otra categoría o búsqueda.</p></div>`;
}

function renderCarrito() {
  const items = itemsCarrito();
  $("#carritoLista").innerHTML = items.length ? items.map((p) => `<div class="carrito-item"><div><strong>${escapar(p.nombre)}</strong><span>${dinero.format(p.precio)} c/u</span></div><div class="cantidad"><button data-cart="menos" data-id="${p.id}">−</button><b>${p.cantidad}</b><button data-cart="mas" data-id="${p.id}">+</button></div></div>`).join("") : `<div class="tienda-vacio compact"><i class="fa-solid fa-basket-shopping"></i><p>Tu carrito está vacío.</p></div>`;
  $("#carritoTotal").textContent = dinero.format(totalCarrito());
  $("#carritoCantidad").textContent = items.reduce((s, p) => s + p.cantidad, 0);
  $("#continuarPedido").disabled = !items.length;
  guardarCarrito();
}

function cambiarCantidad(id, delta) {
  const producto = productos.find((p) => p.id === id); if (!producto) return;
  const nueva = Math.max(0, Math.min(Number(producto.stock), (carrito.get(id) || 0) + delta));
  nueva ? carrito.set(id, nueva) : carrito.delete(id); renderCarrito();
}

function renderPedidos() {
  $("#listaPedidos").innerHTML = pedidos.length ? pedidos.map((p) => `<article class="pedido-card"><header><div><small>PEDIDO #${p.numero}</small><strong>${new Date(p.created_at).toLocaleDateString("es-CO", { dateStyle: "medium" })}</strong></div><span class="estado estado-${p.estado.toLowerCase()}">${p.estado}</span></header><div class="pedido-items">${(p.marketplace_pedido_items || []).map((i) => `<span>${i.cantidad} × ${escapar(i.nombre_producto)}</span>`).join("")}</div><footer><div><small>${p.metodo_pago === "CONTRAENTREGA" ? "Contraentrega" : "Transferencia"} · ${p.estado_pago}</small><b>${dinero.format(p.total)}</b></div><p><i class="fa-solid fa-location-dot"></i> ${escapar(p.direccion)}, ${escapar(p.ciudad)}</p></footer>${esAdmin ? `<div class="pedido-admin"><select data-pedido-estado="${p.id}">${ESTADOS.map((e) => `<option ${e === p.estado ? "selected" : ""}>${e}</option>`)}</select><select data-pedido-pago="${p.id}">${PAGOS.map((e) => `<option ${e === p.estado_pago ? "selected" : ""}>${e}</option>`)}</select><button data-guardar-pedido="${p.id}">Guardar</button></div>` : ""}</article>`).join("") : `<div class="tienda-vacio"><i class="fa-solid fa-truck-fast"></i><h3>Aún no hay pedidos</h3><p>Tu primera compra aparecerá aquí.</p></div>`;
}

function renderAdminProductos() {
  if (!esAdmin) return;
  $("#adminProductosLista").innerHTML = productos.map((p) => `<div class="admin-producto"><div><strong>${escapar(p.nombre)}</strong><span>${dinero.format(p.precio)} · Stock ${p.stock} · ${p.activo ? "Activo" : "Oculto"}</span></div><button data-editar-producto="${p.id}"><i class="fa-solid fa-pen"></i></button></div>`).join("");
}

async function recargar() {
  [productos, categorias, pedidos] = await Promise.all([cargarCatalogo(esAdmin), cargarCategorias(), cargarPedidos(tienda.id, esAdmin)]);
  for (const [id, cantidad] of carrito) { const p = productos.find((x) => x.id === id); if (!p || !p.activo) carrito.delete(id); else carrito.set(id, Math.min(cantidad, p.stock)); }
  renderCategorias(); renderProductos(); renderCarrito(); renderPedidos(); renderAdminProductos();
}

function abrirCheckout() { $("#checkoutTotal").textContent = dinero.format(totalCarrito()); $("#checkoutModal").classList.add("open"); }
function cerrarCheckout() { $("#checkoutModal").classList.remove("open"); }

async function enviarPedido(event) {
  event.preventDefault(); const boton = $("#confirmarPedido"); boton.disabled = true;
  try {
    const datos = Object.fromEntries(new FormData(event.currentTarget));
    await crearPedido(tienda, datos, itemsCarrito()); carrito.clear(); guardarCarrito(); cerrarCheckout();
    avisar("Recibimos tu compra y comenzaremos a prepararla.", "success", { titulo: "¡Pedido creado!" }); await recargar(); activarTab("pedidos");
  } catch (error) { console.error(error); avisar(error.message || "No pudimos crear el pedido.", "error"); }
  finally { boton.disabled = false; }
}

function abrirProducto(producto = {}) {
  $("#productoForm").reset(); $("#productoId").value = producto.id || ""; $("#productoNombre").value = producto.nombre || ""; $("#productoCategoria").innerHTML = `<option value="">Sin categoría</option>` + categorias.map((c) => `<option value="${c.id}" ${c.id === producto.categoria_id ? "selected" : ""}>${escapar(c.nombre)}</option>`).join(""); $("#productoDescripcion").value = producto.descripcion || ""; $("#productoImagen").value = producto.imagen_url || ""; $("#productoSku").value = producto.sku || ""; $("#productoPrecio").value = producto.precio || ""; $("#productoStock").value = producto.stock ?? 0; $("#productoActivo").checked = producto.activo ?? true; $("#productoDestacado").checked = producto.destacado || false; $("#productoModal").classList.add("open");
}

async function enviarProducto(event) {
  event.preventDefault(); const f = event.currentTarget; const d = Object.fromEntries(new FormData(f));
  try { await guardarProducto({ ...d, activo: $("#productoActivo").checked, destacado: $("#productoDestacado").checked }); $("#productoModal").classList.remove("open"); avisar("Producto guardado correctamente."); await recargar(); }
  catch (error) { avisar(error.message, "error"); }
}

function activarTab(tab) { document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab)); document.querySelectorAll(".tienda-vista").forEach((v) => v.classList.toggle("active", v.id === `vista-${tab}`)); }

function eventos() {
  document.addEventListener("click", async (e) => {
    const agregar = e.target.closest("[data-id].agregar-producto"); if (agregar) cambiarCantidad(agregar.dataset.id, 1);
    const cart = e.target.closest("[data-cart]"); if (cart) cambiarCantidad(cart.dataset.id, cart.dataset.cart === "mas" ? 1 : -1);
    const tab = e.target.closest("[data-tab]"); if (tab) activarTab(tab.dataset.tab);
    const editar = e.target.closest("[data-editar-producto]"); if (editar) abrirProducto(productos.find((p) => p.id === editar.dataset.editarProducto));
    const guardar = e.target.closest("[data-guardar-pedido]"); if (guardar) { const id = guardar.dataset.guardarPedido; try { await actualizarPedido(id, document.querySelector(`[data-pedido-estado="${id}"]`).value, document.querySelector(`[data-pedido-pago="${id}"]`).value); avisar("Pedido actualizado."); await recargar(); } catch (error) { avisar(error.message, "error"); } }
  });
  $("#buscarProducto").addEventListener("input", renderProductos);
  $("#filtrosCategorias").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; document.querySelectorAll(".chip").forEach((x) => x.classList.remove("active")); b.classList.add("active"); renderProductos(); });
  $("#abrirCarrito").onclick = () => $("#carritoPanel").classList.add("open"); $("#cerrarCarrito").onclick = () => $("#carritoPanel").classList.remove("open");
  $("#continuarPedido").onclick = abrirCheckout; $("#cerrarCheckout").onclick = cerrarCheckout; $("#checkoutForm").addEventListener("submit", enviarPedido);
  $("#nuevoProducto").onclick = () => abrirProducto(); $("#cerrarProducto").onclick = () => $("#productoModal").classList.remove("open"); $("#productoForm").addEventListener("submit", enviarProducto);
}

async function iniciar() {
  try {
    tienda = await requireTiendaInfo(); if (!tienda) return; restaurarCarrito(); esAdmin = await verificarAdmin(tienda.sesion.user_id);
    document.body.classList.toggle("marketplace-admin", esAdmin); $("#adminTab").hidden = !esAdmin; $("#tiendaNombre").textContent = tienda.nombre || tienda.nombre_tienda || "tu negocio";
    eventos(); await recargar();
    const desuscribir = suscribirPedidos(tienda.id, esAdmin, () => setTimeout(recargar, 350)); window.addEventListener("pagehide", desuscribir, { once: true });
  } catch (error) { console.error(error); $("#catalogoProductos").innerHTML = `<div class="tienda-vacio"><i class="fa-solid fa-store-slash"></i><h3>Marketplace pendiente de configuración</h3><p>Ejecuta el archivo supabase/marketplace.sql en Supabase para activar la tienda.</p></div>`; }
}

iniciar();
