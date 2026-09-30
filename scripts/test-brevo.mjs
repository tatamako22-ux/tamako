// Prueba aislada: reutiliza el HTML actual sin cambiar el envio de produccion.
import nodemailer from 'nodemailer';
import handler from '../api/send-email.js';

// Nombre historico de Brevo incluido en el certificado del relay regional.
// Se conserva la validacion TLS completa del nombre y de la cadena de confianza.
const smtpHost = 'smtp-relay.sendinblue.com';

export async function buildTestMessage(to) {
  const originalTransport = nodemailer.createTransport;
  const originalUser = process.env.GMAIL_USER;
  const originalPass = process.env.GMAIL_APP_PASS;
  let message;
  try {
    process.env.GMAIL_USER = 'notificaciones@tamaku.co';
    process.env.GMAIL_APP_PASS = 'local-template-only';
    nodemailer.createTransport = () => ({ sendMail: async (mail) => { message = mail; } });
    await handler({ method: 'POST', body: {
      email: to, nombre: 'PRUEBA INTERNA', tiendaNombre: 'TAMAKU - PRUEBA',
      servicio: 'Prueba de correo, no es una cita real', profesional: 'Equipo Tamaku',
      fecha: '2026-09-30', hora: '10:00', valor: 0, citaId: 'PRUEBA-SIN-RESERVA'
    } }, { status() { return this; }, json() {} });
  } finally {
    nodemailer.createTransport = originalTransport;
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalPass === undefined) delete process.env.GMAIL_APP_PASS;
    else process.env.GMAIL_APP_PASS = originalPass;
  }
  if (!message) throw new Error('No se pudo preparar el correo.');
  message.subject = '[PRUEBA] TAMAKU - revision del diseno de correo';
  return message;
}

if (process.argv.includes('--check')) {
  // Sin credenciales ni envio: comprueba DNS, conexion SMTP y certificado TLS.
  await Promise.all([587, 465].map(async (port) => {
    const transport = nodemailer.createTransport({
      host: smtpHost, port, secure: port === 465, requireTLS: true,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
      dnsTimeout: 10000
    });
    try {
      await transport.verify();
      console.log(`${smtpHost} puerto ${port}: conexion TLS correcta. No se envio correo.`);
    } catch (error) {
      console.log(`Puerto ${port}: ${error.code || 'ERROR'}; etapa: ${error.command || 'conexion'}; detalle: ${error.message}`);
      process.exitCode = 1;
    } finally { transport.close(); }
  }));
}

if (process.argv.includes('--send')) {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const { user, password, to } = JSON.parse(input);
    if (!user || !password || !/^[^\s@,;<>\[\]()]+@[^\s@,;<>\[\]()]+\.[^\s@,;<>\[\]()]+$/.test(to) || /[\s<>\[\]()]/.test(user)) {
      console.error('Escribe las direcciones como texto simple, sin corchetes ni mailto:.');
      throw new Error('Datos incompletos');
    }
    const message = await buildTestMessage(to);
    const transport = nodemailer.createTransport({
      host: smtpHost, port: 587, secure: false, requireTLS: true,
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
      auth: { user, pass: password }
    });
    try {
      const result = await transport.sendMail(message);
      if (!result.accepted?.length) throw new Error('Destinatario rechazado');
      console.log('Brevo acepto el correo. Revisa entrada y spam, incluido el pie del mensaje.');
    } finally { transport.close(); }
  } catch (error) {
    console.error('La prueba fallo. Codigo:', error.code || 'PRUEBA_FALLIDA', 'SMTP:', error.responseCode || 'no disponible');
    process.exitCode = 1;
  }
}
