import { supabase } from "../config/supabaseClient.js";
import { requireTiendaInfo, tienePermiso } from "../core/session.js";

const DEFINICIONES = [
  ["dashboard_ver", "Dashboard", "Ver resumen e indicadores"],
  ["agenda_ver", "Ver agenda", "Consultar citas de la tienda"],
  ["agenda_gestionar", "Gestionar agenda", "Crear, editar y cancelar citas"],
  ["agenda_solo_propias", "Solo citas propias", "Limitar la agenda al profesional vinculado"],
  ["clientes_ver", "Ver clientes", "Consultar clientes e historial"],
  ["clientes_gestionar", "Gestionar clientes", "Editar, bloquear y eliminar"],
  ["profesionales_ver", "Ver profesionales", "Consultar equipo y servicios"],
  ["profesionales_gestionar", "Gestionar profesionales", "Crear y modificar el equipo"],
  ["facturacion_ver", "Ver facturación", "Consultar facturas y ventas"],
  ["facturas_crear", "Crear facturas", "Registrar nuevos cobros"],
  ["cuentas_gestionar", "Cuentas financieras", "Crear y modificar cuentas"],
  ["caja_gestionar", "Gestionar caja", "Abrir, mover y cerrar caja"],
  ["reportes_ver", "Ver reportes", "Consultar resultados financieros"],
  ["ajustes_ver", "Ver ajustes", "Consultar configuración del negocio"],
  ["usuarios_gestionar", "Gestionar usuarios", "Crear accesos y cambiar permisos"],
  ["tienda_ver", "Acceso a Tienda", "Comprar productos y consultar pedidos"],
];

let tienda;
let perfiles = [];
let profesionales = [];

const $ = (selector) => document.querySelector(selector);
const escapar = (valor = "") => String(valor).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const avisar = (mensaje, tipo = "success") => window.TamakuUI?.notify?.(mensaje, tipo);

function renderPermisos() {
  $("#permissionsGrid").innerHTML = DEFINICIONES.map(([clave, titulo, detalle]) => `
    <label class="permission-item"><input type="checkbox" name="permiso" value="${clave}"><span><strong>${titulo}</strong><small>${detalle}</small></span></label>`).join("");
}

function obtenerPermisos() {
  return Object.fromEntries(DEFINICIONES.map(([clave]) => [clave, $(`input[name="permiso"][value="${clave}"]`)?.checked || false]));
}

function establecerPermisos(permisos = {}) {
  DEFINICIONES.forEach(([clave]) => {
    const input = $(`input[name="permiso"][value="${clave}"]`);
    if (input) input.checked = Boolean(permisos[clave]);
  });
}

function opcionesProfesionales(seleccionado = "") {
  $("#userProfessional").innerHTML = `<option value="">Sin vincular</option>` + profesionales.map((profesional) =>
    `<option value="${profesional.id_barbero}" ${String(seleccionado) === String(profesional.id_barbero) ? "selected" : ""}>${escapar(profesional.nombre_empleado)}</option>`,
  ).join("");
}

function abrirModal(perfil = null) {
  $("#userForm").reset();
  $("#profileId").value = perfil?.id || "";
  $("#userModalTitle").textContent = perfil ? "Editar acceso" : "Nuevo usuario";
  $("#userName").value = perfil?.nombre || perfil?.profesionales?.nombre_empleado || "";
  $("#userEmail").value = perfil?.email || "";
  $("#userEmail").disabled = Boolean(perfil);
  $("#userRole").value = perfil?.rol || "EMPLEADO";
  opcionesProfesionales(perfil?.id_profesional);
  $("#passwordGroup").style.display = perfil ? "none" : "block";
  $("#userPassword").required = !perfil;
  establecerPermisos(perfil?.permisos || { dashboard_ver: true, agenda_ver: true, agenda_solo_propias: true });
  $("#userModal").classList.add("open");
  $("#userModal").setAttribute("aria-hidden", "false");
}

function cerrarModal() {
  $("#userModal").classList.remove("open");
  $("#userModal").setAttribute("aria-hidden", "true");
}

function renderUsuarios() {
  const filtro = $("#usersSearch").value.trim().toLowerCase();
  const lista = perfiles.filter((perfil) => [perfil.nombre, perfil.email, perfil.rol, perfil.profesionales?.nombre_empleado].filter(Boolean).join(" ").toLowerCase().includes(filtro));
  $("#usersCount").textContent = perfiles.length;
  $("#usersDetail").textContent = perfiles.length ? `${perfiles.filter((p) => p.activo).length} accesos activos` : "Sin accesos creados";
  if (!lista.length) {
    $("#usersList").innerHTML = `<div class="users-empty"><i class="fa-solid fa-user-shield"></i><p>${filtro ? "No encontramos coincidencias." : "Aún no has creado accesos para tu equipo."}</p></div>`;
    return;
  }
  $("#usersList").innerHTML = lista.map((perfil) => `
    <article class="user-card" data-id="${perfil.id}">
      <div class="user-identity"><span class="user-avatar">${escapar((perfil.nombre || "U").slice(0, 1).toUpperCase())}</span><div><strong>${escapar(perfil.nombre || "Usuario")}</strong><span>${escapar(perfil.email || "Sin correo")}</span></div></div>
      <div class="user-meta"><strong>${escapar(perfil.rol)}</strong><span>${escapar(perfil.profesionales?.nombre_empleado || "Sin profesional vinculado")}</span></div>
      <div class="user-state ${perfil.activo ? "active" : ""}"><span class="state-dot"></span>${perfil.activo ? "Activo" : "Inactivo"}</div>
      <div class="user-actions"><button class="icon-button edit-user" type="button" title="Editar permisos"><i class="fa-solid fa-sliders"></i></button><button class="icon-button toggle-user" type="button" title="${perfil.activo ? "Desactivar" : "Activar"}"><i class="fa-solid ${perfil.activo ? "fa-user-lock" : "fa-user-check"}"></i></button></div>
    </article>`).join("");
}

async function cargarDatos() {
  const [resultadoPerfiles, resultadoProfesionales] = await Promise.all([
    supabase.from("perfiles").select("id, user_id, tienda_id, rol, id_profesional, nombre, email, activo, permisos, profesionales:id_profesional(id_barbero,nombre_empleado)").eq("tienda_id", tienda.id).order("created_at"),
    supabase.from("profesionales").select("id_barbero,nombre_empleado").eq("id_tienda", tienda.id).order("nombre_empleado"),
  ]);
  if (resultadoPerfiles.error) throw resultadoPerfiles.error;
  if (resultadoProfesionales.error) throw resultadoProfesionales.error;
  perfiles = resultadoPerfiles.data || [];
  profesionales = resultadoProfesionales.data || [];
  renderUsuarios();
}

async function crearUsuario(payload) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("La sesión expiró.");
  const response = await fetch("/api/create-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const resultado = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(resultado.error || "No fue posible crear el usuario.");
  return resultado;
}

async function guardar(event) {
  event.preventDefault();
  const id = $("#profileId").value;
  const datos = { nombre: $("#userName").value.trim(), email: $("#userEmail").value.trim().toLowerCase(), rol: $("#userRole").value, id_profesional: $("#userProfessional").value || null, permisos: obtenerPermisos() };
  const boton = $("#saveUser");
  boton.disabled = true;
  try {
    if (id) {
      const { error } = await supabase.from("perfiles").update({ nombre: datos.nombre, rol: datos.rol, id_profesional: datos.id_profesional, permisos: datos.permisos }).eq("id", id).eq("tienda_id", tienda.id);
      if (error) throw error;
      avisar("Permisos actualizados correctamente.");
    } else {
      await crearUsuario({ ...datos, password: $("#userPassword").value, tienda_id: tienda.id });
      avisar("Usuario creado correctamente.");
    }
    cerrarModal();
    await cargarDatos();
  } catch (error) {
    console.error(error);
    avisar(error.message || "No pudimos guardar el acceso.", "error");
  } finally { boton.disabled = false; }
}

async function alternar(perfil) {
  const accion = perfil.activo ? "desactivar" : "activar";
  const confirmado = await window.TamakuUI?.confirm?.({ titulo: `¿${accion[0].toUpperCase() + accion.slice(1)} usuario?`, mensaje: `${perfil.nombre} ${perfil.activo ? "dejará de poder iniciar sesión" : "recuperará el acceso"}.`, textoConfirmar: accion[0].toUpperCase() + accion.slice(1) });
  if (!confirmado) return;
  const { error } = await supabase.from("perfiles").update({ activo: !perfil.activo }).eq("id", perfil.id).eq("tienda_id", tienda.id);
  if (error) return avisar(error.message, "error");
  await cargarDatos();
}

async function iniciar() {
  tienda = await requireTiendaInfo();
  if (!tienda || !tienePermiso("usuarios_gestionar")) return;
  $("#ownerName").textContent = tienda.propietario || tienda.nombre || "Propietario";
  renderPermisos();
  $("#btnNuevoUsuario").onclick = () => abrirModal();
  $("#closeUserModal").onclick = cerrarModal;
  $("#cancelUser").onclick = cerrarModal;
  $("#usersSearch").oninput = renderUsuarios;
  $("#userForm").onsubmit = guardar;
  $("#toggleAllPermissions").onclick = () => {
    const inputs = [...document.querySelectorAll('input[name="permiso"]')];
    const marcar = inputs.some((input) => !input.checked);
    inputs.forEach((input) => { input.checked = marcar; });
  };
  $("#usersList").onclick = (event) => {
    const card = event.target.closest(".user-card");
    const perfil = perfiles.find((item) => item.id === card?.dataset.id);
    if (!perfil) return;
    if (event.target.closest(".edit-user")) abrirModal(perfil);
    if (event.target.closest(".toggle-user")) alternar(perfil);
  };
  $("#userModal").onclick = (event) => { if (event.target.id === "userModal") cerrarModal(); };
  await cargarDatos();
}

iniciar().catch((error) => {
  console.error("Error inicializando usuarios:", error);
  avisar("No pudimos cargar los usuarios de esta tienda.", "error");
});
