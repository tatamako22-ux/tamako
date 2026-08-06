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

// 🚫 VALIDAR CRUCE ENTRE BLOQUES - [CORREGIDO]
// [FIX] Ahora solo verifica SUPERPOSICIÓN REAL, no bloques futuros
export function hayCruce({ inicio, fin, bloques = [], debug = false }) {
  if (!Array.isArray(bloques)) return false;
  if (bloques.length === 0) return false;

  // [CRITICAL] Filtrar bloques que realmente se cruzan con el horario
  return bloques.some((b) => {
    const bInicio = b.inicio ?? b.start ?? 0;
    const bFin = b.fin ?? b.end ?? 0;

    // Verifica SUPERPOSICIÓN REAL (no solo comparación)
    const haySuperposicion = inicio < bFin && fin > bInicio;

    if (debug && haySuperposicion) {
      console.log(
        `[DEBUG] 🔴 Bloque ${minToHora(bInicio)}-${minToHora(bFin)} se cruza con ${minToHora(inicio)}-${minToHora(fin)}`,
      );
    }

    return haySuperposicion;
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

// 🧠 CALCULAR CITA (función principal) - [MEJORADO]
// [FIX] Añadido filtro de bloques que solo se cruzan
export function calcularCita({
  inicioDeseado,
  duracion,
  modo = "auto",
  bloques = [],
  jornadaInicio = 0,
  jornadaFin = 1440,
  intervaloProfesional = null,
  intervaloTienda = 60,
  debug = false,
}) {
  console.log("===== ENTRÓ A calcularCita =====");
  console.log({
    inicioDeseado,
    duracion,
    modo,
    jornadaInicio,
    jornadaFin,
    bloques,
  });

  // Asegurar duración positiva y mínima de 15 min
  const duracionValida = Math.max(15, duracion);
  const intervalo =
    parseInt(intervaloProfesional) || parseInt(intervaloTienda) || 60;

  const inicio = inicioDeseado;
  const fin = inicio + duracionValida;

  if (debug) {
    console.log(
      `[DEBUG] 📍 Verificando: ${minToHora(inicio)} - ${minToHora(fin)}`,
    );
  }

  // Validar dentro de jornada
  if (!dentroDeJornada({ inicio, fin, jornadaInicio, jornadaFin })) {
    if (debug) console.log(`[DEBUG] ❌ Fuera de jornada`);
    return null;
  }

  // [CRITICAL] Validar cruce con bloques ocupados
  if (hayCruce({ inicio, fin, bloques, debug })) {
    if (debug) console.log(`[DEBUG] ❌ Se cruza con bloque ocupado`);
    return null;
  }

  // Validar intervalo fijo si aplica
  if (modo === "fijo" && !validarIntervalo({ inicio, intervalo })) {
    if (debug) console.log(`[DEBUG] ❌ No cumple intervalo fijo`);
    return null;
  }

  if (debug) console.log(`[DEBUG] ✅ Disponible!`);

  return {
    inicio,
    fin,
    duracion: duracionValida,
    intervalo,
    horaInicio: minToHora(inicio),
    horaFin: minToHora(fin),
  };
}

// 📋 GENERAR SLOTS DISPONIBLES - [MEJORADO]
// [FIX] Ahora filtra correctamente los bloques
export function generarSlots({
  jornadaInicio = 480,
  jornadaFin = 1200,
  intervalo = 60,
  duracion = 60,
  bloques = [],
  modo = "auto",
  debug = false,
}) {
  const slots = [];
  const maxSlots = 500;

  if (debug) {
    console.log(
      `[DEBUG] 🔍 Generando slots desde ${minToHora(jornadaInicio)} hasta ${minToHora(jornadaFin)}`,
    );
    console.log(
      `[DEBUG] 📊 Bloques existentes:`,
      bloques.map((b) => `${minToHora(b.inicio)}-${minToHora(b.fin)}`),
    );
  }

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
      debug,
    });
    if (resultado) {
      slots.push(resultado);
      if (debug)
        console.log(
          `[DEBUG] ✅ Slot disponible: ${resultado.horaInicio} - ${resultado.horaFin}`,
        );
    }
  }

  if (debug) console.log(`[DEBUG] 📋 Total slots disponibles: ${slots.length}`);
  return slots;
}

// 🔍 [NUEVO] VERIFICAR DISPONIBILIDAD DE UN HORARIO ESPECÍFICO
export function verificarDisponibilidad({
  horaInicio,
  duracion = 60,
  bloques = [],
  jornadaInicio = 480,
  jornadaFin = 1200,
  debug = false,
}) {
  const inicio =
    typeof horaInicio === "string" ? horaToMin(horaInicio) : horaInicio;

  const resultado = calcularCita({
    inicioDeseado: inicio,
    duracion,
    modo: "auto",
    bloques,
    jornadaInicio,
    jornadaFin,
    debug,
  });

  return resultado !== null;
}

// ⚡ [NUEVO] OBTENER BLOQUES OCUPADOS PARA UN RANGO ESPECÍFICO
export function obtenerBloquesOcupados({ inicio, fin, bloques = [] }) {
  if (!Array.isArray(bloques)) return [];

  return bloques.filter((b) => {
    const bInicio = b.inicio ?? b.start ?? 0;
    const bFin = b.fin ?? b.end ?? 0;
    return inicio < bFin && fin > bInicio;
  });
}
