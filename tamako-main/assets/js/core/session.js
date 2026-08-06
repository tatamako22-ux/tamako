import { supabase } from "../config/supabaseClient.js";

const STORAGE_KEY = "tamaku_tienda";
const LOGIN_URL = new URL("../../../index.html", import.meta.url).href;

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
};

async function obtenerContextoUsuario() {
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

export async function requireTiendaInfo({ redirect = true } = {}) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw authError || new Error("Sesión no válida");

    const contexto = await obtenerContextoUsuario();
    const tiendaBase = await buscarTiendaDelContexto(contexto);
    const permisos = contexto?.es_propietario
      ? PERMISOS_PROPIETARIO
      : { ...(contexto?.permisos || {}) };
    const tienda = tiendaBase
      ? {
          ...tiendaBase,
          sesion: {
            user_id: user.id,
            rol: contexto.rol,
            id_profesional: contexto.id_profesional || null,
            es_propietario: Boolean(contexto.es_propietario),
            permisos,
          },
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
