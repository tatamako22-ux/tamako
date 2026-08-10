import { FacturacionService } from "./facturacion.service.js";

const moneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });
const $ = (id) => document.getElementById(id);
function getTienda() { return JSON.parse(localStorage.getItem("tamaku_tienda")) || {}; }

export const FacturacionInsumos = {
  insumos: [],
  insumoPago: null,
  puedeGestionar: false,

  async init() {
    const tienda = getTienda();
    this.puedeGestionar = Boolean(tienda.sesion?.es_propietario || tienda.sesion?.permisos?.cuentas_gestionar);
    $("btnNuevoInsumo")?.classList.toggle("hidden", !this.puedeGestionar);
    this.eventos();
    await this.cargar();
  },

  eventos() {
    $("btnNuevoInsumo")?.addEventListener("click", () => this.abrir("modalNuevoInsumo"));
    ["cerrarNuevoInsumo", "cancelarNuevoInsumo"].forEach((id) => $(id)?.addEventListener("click", () => this.cerrar("modalNuevoInsumo")));
    ["cerrarPagarInsumo", "cancelarPagarInsumo"].forEach((id) => $(id)?.addEventListener("click", () => this.cerrar("modalPagarInsumo")));
    $("formInsumo")?.addEventListener("submit", (e) => { e.preventDefault(); this.guardar(); });
    $("confirmarPagarInsumo")?.addEventListener("click", () => this.pagar());
    $("buscarInsumo")?.addEventListener("input", () => this.render());
    $("filtrarEstadoInsumo")?.addEventListener("change", () => this.render());
    $("listaInsumos")?.addEventListener("click", (e) => {
      const pagar = e.target.closest("[data-pagar-insumo]");
      const eliminar = e.target.closest("[data-eliminar-insumo]");
      if (pagar) this.abrirPago(pagar.dataset.pagarInsumo);
      if (eliminar) this.eliminar(eliminar.dataset.eliminarInsumo);
    });
    window.addEventListener("cuenta-financiera-actualizada", () => this.cargar());
  },

  abrir(id) { $(id)?.classList.remove("hidden"); document.body.style.overflow = "hidden"; },
  cerrar(id) { $(id)?.classList.add("hidden"); document.body.style.overflow = "auto"; },

  async cargar() {
    const contenedor = $("listaInsumos");
    if (!contenedor) return;
    try {
      this.insumos = await FacturacionService.getInsumos(getTienda().id);
      this.indicadores(); this.render();
    } catch (error) {
      contenedor.innerHTML = `<div class="facturas-estado facturas-error">No se pudieron cargar los insumos: ${error.message}</div>`;
    }
  },

  indicadores() {
    const ahora = new Date();
    const pendiente = this.insumos.filter((i) => i.estado === "PENDIENTE").reduce((a, i) => a + Number(i.costo_total), 0);
    const pagado = this.insumos.filter((i) => i.estado === "PAGADO" && i.fecha_pago && new Date(i.fecha_pago).getMonth() === ahora.getMonth() && new Date(i.fecha_pago).getFullYear() === ahora.getFullYear()).reduce((a, i) => a + Number(i.costo_total), 0);
    $("insumosPendiente").textContent = moneda.format(pendiente); $("insumosPagadoMes").textContent = moneda.format(pagado); $("insumosCantidad").textContent = this.insumos.length;
  },

  render() {
    const q = $("buscarInsumo")?.value.trim().toLowerCase() || "";
    const estado = $("filtrarEstadoInsumo")?.value || "";
    const lista = this.insumos.filter((i) => !q || `${i.nombre} ${i.proveedor || ""}`.toLowerCase().includes(q)).filter((i) => !estado || i.estado === estado);
    $("listaInsumos").innerHTML = lista.map((i) => `<article class="insumo-row"><div><strong>${this.escapar(i.nombre)}</strong><small>${fecha.format(new Date(i.fecha_registro))}</small></div><span>${Number(i.cantidad)} ${this.escapar(i.unidad)}</span><span>${this.escapar(i.proveedor || "Sin proveedor")}</span><em class="insumo-estado ${i.estado.toLowerCase()}">${i.estado}</em><b>${moneda.format(i.costo_total)}</b><div class="insumo-acciones">${i.estado === "PENDIENTE" && this.puedeGestionar ? `<button data-pagar-insumo="${i.id}" title="Registrar pago"><i class="fa-solid fa-credit-card"></i></button><button data-eliminar-insumo="${i.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : i.estado === "PAGADO" ? `<small>${this.escapar(i.cuentas_financieras?.nombre || "Cuenta")}</small>` : ""}</div></article>`).join("") || '<div class="facturas-estado"><i class="fa-solid fa-box-open"></i><strong>Sin insumos</strong><span>Registra la primera compra para comenzar.</span></div>';
  },

  escapar(v = "") { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); },

  async guardar() {
    const costo = Number($("insumoCosto").value), cantidad = Number($("insumoCantidad").value);
    if (!$("insumoNombre").value.trim() || costo <= 0 || cantidad <= 0) return alert("Completa nombre, cantidad y costo correctamente.");
    try {
      await FacturacionService.crearInsumo({ id_tienda: getTienda().id, nombre: $("insumoNombre").value.trim(), proveedor: $("insumoProveedor").value.trim() || null, cantidad, unidad: $("insumoUnidad").value, costo_total: costo, notas: $("insumoNotas").value.trim() || null });
      $("formInsumo").reset(); $("insumoCantidad").value = 1; this.cerrar("modalNuevoInsumo"); await this.cargar();
    } catch (error) { alert(`No se pudo registrar el insumo: ${error.message}`); }
  },

  async abrirPago(id) {
    this.insumoPago = this.insumos.find((i) => i.id === id); if (!this.insumoPago) return;
    $("pagarInsumoNombre").textContent = this.insumoPago.nombre; $("pagarInsumoValor").textContent = moneda.format(this.insumoPago.costo_total);
    const select = $("pagarInsumoCuenta"); select.innerHTML = '<option value="">Cargando cuentas...</option>'; this.abrir("modalPagarInsumo");
    try {
      const cuentas = await FacturacionService.getCuentasFinancieras(getTienda().id); select.replaceChildren();
      cuentas.forEach((c) => { const o = document.createElement("option"); o.value = c.id; o.textContent = `${c.nombre} · Disponible ${moneda.format(c.saldo_actual)}`; o.disabled = Number(c.saldo_actual) < Number(this.insumoPago.costo_total); select.appendChild(o); });
      if (!cuentas.length) select.innerHTML = '<option value="">No hay cuentas activas</option>';
    } catch (error) { alert(`No se pudieron cargar las cuentas: ${error.message}`); this.cerrar("modalPagarInsumo"); }
  },

  async pagar() {
    const cuenta = $("pagarInsumoCuenta").value, boton = $("confirmarPagarInsumo");
    if (!this.insumoPago || !cuenta) return alert("Selecciona una cuenta con saldo suficiente.");
    if (!confirm(`¿Registrar el pago de ${moneda.format(this.insumoPago.costo_total)}?`)) return;
    try { boton.disabled = true; boton.textContent = "Pagando..."; await FacturacionService.pagarInsumo({ idInsumo: this.insumoPago.id, idCuenta: cuenta }); this.cerrar("modalPagarInsumo"); this.insumoPago = null; await this.cargar(); window.dispatchEvent(new CustomEvent("movimiento-financiero")); alert("Insumo pagado y egreso registrado."); } catch (error) { alert(`No se pudo pagar: ${error.message}`); } finally { boton.disabled = false; boton.textContent = "Confirmar pago"; }
  },

  async eliminar(id) {
    if (!confirm("¿Eliminar este insumo pendiente?")) return;
    try { await FacturacionService.eliminarInsumo(getTienda().id, id); await this.cargar(); } catch (error) { alert(`No se pudo eliminar: ${error.message}`); }
  },
};
