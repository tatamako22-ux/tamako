// assets/js/reserva/reserva.email.js

const EMAILJS_CONFIG = {
  PUBLIC_KEY: "TU_PUBLIC_KEY",

  SERVICE_ID: "TU_SERVICE_ID",

  TEMPLATE_ID: "TU_TEMPLATE_ID",
};

emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);

export async function enviarCorreoConfirmacion(datos) {
  try {
    const templateParams = {
      to_email: datos.email,

      email: datos.email,

      nombre: datos.nombre,

      tienda: datos.tiendaNombre,

      servicio: datos.servicio,

      profesional: datos.profesional,

      fecha: datos.fecha,

      hora: datos.hora,

      valor: datos.valor,
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,

      EMAILJS_CONFIG.TEMPLATE_ID,

      templateParams,
    );

    console.log("✅ Correo enviado", response);

    return true;
  } catch (error) {
    console.error("❌ Error EmailJS:", error);

    return false;
  }
}
