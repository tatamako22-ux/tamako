// ⏱️ CONVERTIR HORA → MINUTOS
export function horaToMin(hora = "00:00") {
  const [h, m] = hora.split(":").map(Number);

  return h * 60 + m;
}

// ⏱️ CONVERTIR MINUTOS → HH:mm
export function minToHora(minutos = 0) {
  const horas = Math.floor(minutos / 60)
    .toString()
    .padStart(2, "0");

  const mins = (minutos % 60).toString().padStart(2, "0");

  return `${horas}:${mins}`;
}

// 🚫 VALIDAR CRUCE ENTRE BLOQUES
export function hayCruce({ inicio, fin, bloques = [] }) {
  return bloques.some((bloque) => inicio < bloque.fin && fin > bloque.inicio);
}

// 🕒 VALIDAR SI ESTÁ DENTRO DE JORNADA
export function dentroDeJornada({ inicio, fin, jornadaInicio, jornadaFin }) {
  return inicio >= jornadaInicio && fin <= jornadaFin;
}

// 📏 VALIDAR INTERVALOS FIJOS
export function validarIntervalo({ inicio, intervalo }) {
  return inicio % intervalo === 0;
}

// 🧠 CALCULAR CITA
export function calcularCita({
  inicioDeseado,

  duracion,

  modo = "auto",

  bloques = [],

  jornadaInicio = 0,

  jornadaFin = 1440,

  profesional = null,

  intervaloProfesional = null,

  intervaloTienda = 60,
}) {
  const intervalo =
    parseInt(intervaloProfesional) || parseInt(intervaloTienda) || 60;

  const inicio = inicioDeseado;

  const fin = inicio + duracion;

  // 🚫 FUERA DE JORNADA
  if (
    !dentroDeJornada({
      inicio,
      fin,

      jornadaInicio,
      jornadaFin,
    })
  ) {
    return null;
  }

  // 🚫 CRUCE DE HORARIOS
  if (
    hayCruce({
      inicio,
      fin,
      bloques,
    })
  ) {
    return null;
  }

  // 📏 MODO FIJO
  if (
    modo === "fijo" &&
    !validarIntervalo({
      inicio,
      intervalo,
    })
  ) {
    return null;
  }

  return {
    inicio,
    fin,
    duracion,
    intervalo,

    horaInicio: minToHora(inicio),
    horaFin: minToHora(fin),
  };
}

// 📋 GENERAR SLOTS DISPONIBLES
export function generarSlots({
  jornadaInicio = 480, // 8AM

  jornadaFin = 1200, // 8PM

  intervalo = 60,

  duracion = 60,

  bloques = [],

  modo = "auto",
}) {
  const slots = [];

  for (
    let inicio = jornadaInicio;
    inicio + duracion <= jornadaFin;
    inicio += intervalo
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
