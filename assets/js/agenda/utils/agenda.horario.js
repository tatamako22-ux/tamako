// La grilla y la confirmacion deben usar la misma jornada y origen de intervalos.
export function obtenerHorarioDelDia(profesional, fecha = new Date()) {
  if (!profesional) return { inicio: "00:00", fin: "24:00" };

  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const horario = profesional.horario_semanal?.[dias[fecha.getDay()]];
  if (horario?.activo) {
    return { inicio: horario.inicio, fin: horario.fin };
  }

  return {
    inicio: profesional.horario_inicio || "08:00",
    fin: profesional.horario_fin || "20:00",
  };
}
