import { supabase } from "../config/supabaseClient.js";

const STORAGE_KEY = "tamaku_tienda";
const LOGIN_URL = new URL("../../../index.html", import.meta.url).href;

const FUNCIONES_PAGINA = {
  "dashboard.html": "dashboard", "agenda.html": "agenda", "clientes.html": "clientes",
  "profesionales.html": "profesionales", "galeria.html": "profesionales",
  "facturacion.html": "facturacion", "usuarios.html": "usuarios", "tienda.html": "tienda",
  "ajustes.html": "ajustes", "comunicados.html": "ajustes",
};

export function getTiendaInfo() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (error) {
    console.error("Error leyendo la tienda activa:", error);
    return null;
  }
}

export function setTiendaInfo(tienda) {
  if (tienda?.id) localStorage.setItem(STORAGE_KEY, JSON.stringify(tienda));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem("tamaku_sede_activa");
}

const PERMISOS_PROPIETARIO = {
  dashboard_ver: true,
  agenda_ver: true,
  agenda_gestionar: true,
  agenda_solo_propias: false,
  clientes_ver: true,
  clientes_gestionar: true,
  profesionales_ver: true,
  profesionales_gestionar: true,
  facturacion_ver: true,
  facturas_crear: true,
  cuentas_gestionar: true,
  caja_gestionar: true,
  reportes_ver: true,
  ajustes_ver: true,
  usuarios_gestionar: true,
  tienda_ver: true,
};

async function obtenerContextoUsuario() {
  const seleccionada = sessionStorage.getItem("tamaku_sede_activa");
  const sede = await supabase.rpc("contexto_sede_tamaku", { p_tienda: seleccionada || null });
  if (sede.error && !/function|schema cache|could not find/i.test(sede.error.message || "")) throw sede.error;
  if (!sede.error && sede.data) return sede.data;
  if (seleccionada) sessionStorage.removeItem("tamaku_sede_activa");
  const { data, error } = await supabase.rpc("obtener_contexto_usuario");
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

async function buscarTiendaDelContexto(contexto) {
  if (!contexto?.id_tienda) return null;
  const { data, error } = await supabase
    .from("tiendas")
    .select("*")
    .eq("id", contexto.id_tienda)
    .single();
  if (error) throw error;
  return data || null;
}

async function validarSuscripcion(idTienda) {
  const { data, error } = await supabase.rpc("obtener_estado_suscripcion", {
    p_id_tienda: idTienda,
  });
  // Permite preproducción antes de ejecutar el módulo SQL de suscripciones.
  if (error && /function|schema cache|could not find/i.test(error.message || "")) return null;
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

const validacionesPendientes = new Map();
export function requireTiendaInfo({ redirect = true } = {}) {
  // Menu y pantalla arrancan a la vez: comparten solo la validacion en curso.
  // No se cachea la autorizacion resuelta ni se omiten revisiones posteriores.
  if (!validacionesPendientes.has(redirect)) {
    const tarea = validarTiendaInfo({ redirect }).finally(() => validacionesPendientes.delete(redirect));
    validacionesPendientes.set(redirect, tarea);
  }
  return validacionesPendientes.get(redirect);
}

async function validarTiendaInfo({ redirect = true } = {}) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw authError || new Error("Sesión no válida");

    const contexto = await obtenerContextoUsuario();
    const tiendaBase = await buscarTiendaDelContexto(contexto);
    const suscripcion = tiendaBase ? await validarSuscripcion(tiendaBase.id) : null;
    if (suscripcion && !suscripcion.acceso) {
      if (contexto?.es_propietario && contexto.tienda_principal && contexto.tienda_principal !== tiendaBase.id) {
        sessionStorage.setItem("tamaku_sede_activa", contexto.tienda_principal);
        window.location.replace(new URL("../../../pages/dashboard.html", import.meta.url).href);
        return null;
      }
      sessionStorage.setItem("tamaku_suscripcion", JSON.stringify(suscripcion));
      window.location.replace(new URL("../../../pages/suscripcion.html", import.meta.url).href);
      return null;
    }
    const funcionPagina = FUNCIONES_PAGINA[window.location.pathname.split("/").pop()];
    if (suscripcion?.funcionalidades && funcionPagina && suscripcion.funcionalidades[funcionPagina] !== true) {
      if (redirect) window.location.replace(new URL("../../../pages/mi-plan.html", import.meta.url).href);
      return null;
    }
    const permisos = contexto?.es_propietario
      ? PERMISOS_PROPIETARIO
      : { ...(contexto?.permisos || {}) };
    const tienda = tiendaBase
      ? {
          ...tiendaBase,
          tienda_principal: contexto.tienda_principal || tiendaBase.id,
          sesion: {
            user_id: user.id,
            rol: contexto.rol,
            id_profesional: contexto.id_profesional || null,
            es_propietario: Boolean(contexto.es_propietario),
            permisos,
          },
          suscripcion,
        }
      : null;
    if (!tienda) throw new Error("El usuario no tiene una tienda asociada");

    setTiendaInfo(tienda);
    return tienda;
  } catch (error) {
    console.error("No se pudo validar la tienda activa:", error);
    clearSession();
    if (redirect) window.location.replace(LOGIN_URL);
    return null;
  }
}

export async function cambiarSede(id) {
  const { data, error } = await supabase.rpc("contexto_sede_tamaku", { p_tienda: id });
  if (error) throw error;
  if (data?.id_tienda !== id || !data.es_propietario) throw new Error("No tienes acceso a esta sede.");
  const estado = await validarSuscripcion(id);
  if (!estado?.acceso) throw new Error(estado?.mensaje || "La sede no tiene acceso vigente.");
  sessionStorage.setItem("tamaku_sede_activa", id);
  localStorage.removeItem(STORAGE_KEY);
  window.location.assign(new URL("../../../pages/dashboard.html", import.meta.url).href);
}

export function getSesionInfo() {
  return getTiendaInfo()?.sesion || null;
}

export function tienePermiso(nombrePermiso) {
  const sesion = getSesionInfo();
  return Boolean(sesion?.es_propietario || sesion?.permisos?.[nombrePermiso]);
}

export async function cerrarSesion() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Error cerrando la sesión remota:", error);
  } finally {
    clearSession();
    window.location.replace(LOGIN_URL);
  }
}

window.cerrarSesion = cerrarSesion;
