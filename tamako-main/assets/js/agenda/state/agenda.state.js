// 🧠 ESTADO CENTRAL DE AGENDA

export const agendaState = {
  // 📅 Fecha actual seleccionada
  fechaSeleccionada: new Date(),

  // 👨‍💼 Profesionales/barberos
  listaBarberos: [],

  // 📋 Reservas/citas del día
  citasDelDia: [],

  // ❌ Reserva a cancelar
  citaACancelar: null,

  // ➕ Datos nueva reserva
  datosNuevaReserva: {},

  // 👤 Profesional seleccionado móvil
  barberoActivo: null,
};

// 🔄 ACTUALIZAR STATE
export function setState(key, value) {
  if (!(key in agendaState)) {
    console.warn(`⚠️ Estado inexistente: ${key}`);

    return;
  }

  agendaState[key] = value;
}

// 📦 OBTENER STATE
export function getState(key) {
  return agendaState[key];
}

// ♻️ RESET PARCIAL
export function resetReserva() {
  agendaState.datosNuevaReserva = {};

  agendaState.citaACancelar = null;
}
