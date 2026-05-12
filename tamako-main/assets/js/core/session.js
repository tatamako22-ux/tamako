// 🧠 SESSION MANAGER

const STORAGE_KEY = "tamaku_tienda";

// 🔍 OBTENER SESIÓN
export function getTiendaInfo() {
  try {
    const tienda = localStorage.getItem(STORAGE_KEY);

    if (!tienda) {
      return null;
    }

    return JSON.parse(tienda);
  } catch (error) {
    console.error("❌ Error obteniendo sesión:", error);

    return null;
  }
}

// 💾 GUARDAR SESIÓN
export function setTiendaInfo(data) {
  if (!data) return;

  localStorage.setItem(
    STORAGE_KEY,

    JSON.stringify(data),
  );
}

// 🧹 LIMPIAR SESIÓN
export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// 🚪 CERRAR SESIÓN
export function cerrarSesion() {
  clearSession();

  window.location.href = "../index.html";
}

// 🌍 GLOBAL PARA HTML
window.cerrarSesion = cerrarSesion;
