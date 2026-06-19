// ============================================================
// [MEJORADO] Utilidades de tiempo para agenda
// Funciones puras, sin efectos secundarios
// ============================================================

// ⏱️ CONVERTIR HORA → MINUTOS
// [MEJORADO] Soporta formatos "HH:MM" o "H:MM", y valores no numéricos
export function horaToMin(hora = "00:00") {
  if (typeof hora !== "string") {
    console.warn("[horaToMin] Se esperaba string, recibido:", hora);
    return 0;
  }
  const partes = hora.split(":");
  if (partes.length !== 2) {
    console.warn("[horaToMin] Formato inválido, se usará 00:00", hora);
    return 0;
  }
  const [h, m] = partes.map(Number);
  if (isNaN(h) || isNaN(m)) {
    console.warn("[horaToMin] Horas o minutos no numéricos", hora);
    return 0;
  }
  return h * 60 + m;
}

// ⏱️ CONVERTIR MINUTOS → HH:mm
// [MEJORADO] Redondeo y límites (0-1440)
export function minToHora(minutos = 0) {
  let mins = Math.max(0, Math.min(1440, minutos)); // Entre 0 y 24h
  const horas = Math.floor(mins / 60);
  const restoMinutos = mins % 60;
  return `${horas.toString().padStart(2, "0")}:${restoMinutos.toString().padStart(2, "0")}`;
}

// 🚫 VALIDAR CRUCE ENTRE BLOQUES
// [MEJORADO] Normaliza bloques con inicio/fin y los ordena por inicio (opcional)
export function hayCruce({ inicio, fin, bloques = [] }) {
  if (!Array.isArray(bloques)) return false;
  // [MEJORADO] Filtramos bloques que tengan inicio y fin válidos
  return bloques.some((b) => {
    const bInicio = b.inicio ?? b.start ?? 0;
    const bFin = b.fin ?? b.end ?? 0;
    return inicio < bFin && fin > bInicio;
  });
}

// 🕒 VALIDAR SI ESTÁ DENTRO DE JORNADA
export function dentroDeJornada({
  inicio,
  fin,
  jornadaInicio = 0,
  jornadaFin = 1440,
}) {
  return inicio >= jornadaInicio && fin <= jornadaFin;
}

// 📏 VALIDAR INTERVALOS FIJOS (múltiplo)
// [MEJORADO] Si intervalo es 0 o null, se considera siempre válido
export function validarIntervalo({ inicio, intervalo }) {
  if (!intervalo || intervalo <= 0) return true;
  return inicio % intervalo === 0;
}

// 🧠 CALCULAR CITA (función principal)
// [MEJORADO] Añadido manejo de duración mínima, y logs opcionales
export function calcularCita({
  inicioDeseado,
  duracion,
  modo = "auto",
  bloques = [],
  jornadaInicio = 0,
  jornadaFin = 1440,
  intervaloProfesional = null,
  intervaloTienda = 60,
}) {
  // [CORREGIDO] Asegurar duración positiva y mínima de 15 min
  const duracionValida = Math.max(15, duracion);
  const intervalo =
    parseInt(intervaloProfesional) || parseInt(intervaloTienda) || 60;

  const inicio = inicioDeseado;
  const fin = inicio + duracionValida;

  // Validar dentro de jornada
  if (!dentroDeJornada({ inicio, fin, jornadaInicio, jornadaFin })) {
    return null;
  }

  // Validar cruce con bloques ocupados
  if (hayCruce({ inicio, fin, bloques })) {
    return null;
  }

  // Validar intervalo fijo si aplica
  if (modo === "fijo" && !validarIntervalo({ inicio, intervalo })) {
    return null;
  }

  return {
    inicio,
    fin,
    duracion: duracionValida,
    intervalo,
    horaInicio: minToHora(inicio),
    horaFin: minToHora(fin),
  };
}

// 📋 GENERAR SLOTS DISPONIBLES
// [MEJORADO] Añadido límite máximo de slots para evitar bucles infinitos
export function generarSlots({
  jornadaInicio = 480,
  jornadaFin = 1200,
  intervalo = 60,
  duracion = 60,
  bloques = [],
  modo = "auto",
}) {
  const slots = [];
  const maxSlots = 500; // [MEJORADO] Seguridad

  for (
    let inicio = jornadaInicio, count = 0;
    inicio + duracion <= jornadaFin && count < maxSlots;
    inicio += intervalo, count++
  ) {
    const resultado = calcularCita({
      inicioDeseado: inicio,
      duracion,
      modo,
      bloques,
      jornadaInicio,
      jornadaFin,
      intervaloTienda: intervalo,
    });
    if (resultado) {
      slots.push(resultado);
    }
  }

  return slots;
}
