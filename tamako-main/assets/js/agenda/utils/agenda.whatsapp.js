// 📱 Crear mensaje de confirmación de reserva
export function crearMensajeReserva({
  cliente,
  profesional,
  tienda,
  fecha,
  hora,
  url,
}) {
  const fechaBonita = new Date(fecha + "T00:00:00").toLocaleDateString(
    "es-CO",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  const horaBonita = new Date(`2000-01-01T${hora}:00`).toLocaleTimeString(
    "es-CO",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  );

  return `💈 *${tienda.toUpperCase()}*

¡Hola *${cliente}*! 👋

Tu cita ha sido *confirmada exitosamente* ✅

━━━━━━━━━━━━━━

👨‍💼 *Profesional*
${profesional}

📅 *Fecha*
${fechaBonita}

🕒 *Hora*
${horaBonita}

━━━━━━━━━━━━━━

✨ Gracias por confiar en nosotros.

Si deseas reservar nuevamente o modificar tu cita puedes hacerlo aquí:

${url}

¡Te esperamos! 🔥`;
}
