// api/send-email.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const {
    email,
    nombre,
    tiendaNombre,
    servicio,
    profesional,
    fecha,
    hora,
    valor,
    citaId,
  } = req.body;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    return res.status(500).json({ error: "El servicio de correo no está configurado." });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "El correo del destinatario no es válido." });
  }
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

  const mailOptions = {
    from: `"TAMAKU" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `✨ ${tiendaNombre} - Tu reserva ha sido confirmada ✨`,
    html: `
<!DOCTYPE html>
<html lang="es">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reserva Confirmada</title>
</head>

<body style="
margin:0;
padding:40px;
background:#0d0d0d;
background-image:linear-gradient(180deg,#0d0d0d 0%,#181818 100%);
font-family:Arial,Helvetica,sans-serif;
">

<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center">

<table width="620" cellpadding="0" cellspacing="0"
style="
background:#181818;
border:1px solid #BF953F;
border-radius:24px;
overflow:hidden;
box-shadow:
0 0 40px rgba(191,149,63,.15),
0 20px 50px rgba(0,0,0,.45);
">

<tr>

<td
style="
background:linear-gradient(135deg,#8a6a1f,#BF953F,#d8b86b);
padding:45px;
text-align:center;
">

<h1
style="
margin:0;
font-size:40px;
font-weight:700;
letter-spacing:8px;
color:#111;
text-transform:uppercase;
">
TAMAKÚ
</h1>

<p
style="
margin:8px 0 0;
font-size:14px;
font-weight:bold;
letter-spacing:4px;
color:#111;
">
EXPERIENCIA ÉLITE
</p>

</td>

</tr>

<tr>

<td style="padding:40px;">

<h2
style="
text-align:center;
color:#BF953F;
margin-top:0;
">
✨ RESERVA CONFIRMADA ✨
</h2>

<p
style="
text-align:center;
color:#cccccc;
font-size:16px;
line-height:28px;
">
Hola <strong>${nombre}</strong>.

<br><br>

Tu experiencia ha sido reservada exitosamente.

</p>

<div style="margin-top:35px;">

<div style="
background:#111;
border:1px solid #2a2a2a;
border-left:4px solid #BF953F;
border-radius:16px;
padding:18px 22px;
margin-bottom:14px;
">

<div style="font-size:12px;color:#888;letter-spacing:2px;">
CLIENTE
</div>

<div style="font-size:20px;color:#fff;font-weight:bold;margin-top:6px;">
${nombre}
</div>

</div>

<div style="
background:#111;
border:1px solid #2a2a2a;
border-left:4px solid #BF953F;
border-radius:16px;
padding:18px 22px;
margin-bottom:14px;
">

<div style="font-size:12px;color:#888;letter-spacing:2px;">
SERVICIO
</div>

<div style="font-size:20px;color:#fff;font-weight:bold;margin-top:6px;">
${servicio}
</div>

</div>

<div style="
background:#111;
border:1px solid #2a2a2a;
border-left:4px solid #BF953F;
border-radius:16px;
padding:18px 22px;
margin-bottom:14px;
">

<div style="font-size:12px;color:#888;letter-spacing:2px;">
PROFESIONAL
</div>

<div style="font-size:20px;color:#fff;font-weight:bold;margin-top:6px;">
${profesional}
</div>

</div>

<div style="
background:#111;
border:1px solid #2a2a2a;
border-left:4px solid #BF953F;
border-radius:16px;
padding:18px 22px;
margin-bottom:14px;
">

<div style="font-size:12px;color:#888;letter-spacing:2px;">
FECHA Y HORA
</div>

<div style="font-size:20px;color:#fff;font-weight:bold;margin-top:6px;">
${fecha}
</div>

<div style="color:#BF953F;font-size:16px;margin-top:4px;">
${hora}
</div>

</div>

<div style="
background:linear-gradient(135deg,#2b220f,#111);
border:1px solid #BF953F;
border-radius:18px;
padding:28px;
text-align:center;
margin-top:20px;
">

<div style="
font-size:13px;
letter-spacing:3px;
color:#999;
">
VALOR DE TU EXPERIENCIA
</div>

<div style="
font-size:38px;
font-weight:bold;
color:#BF953F;
margin-top:12px;
">
${valor}
</div>

</div>

</div>

<div
style="
margin-top:35px;
background:#181818;
padding:25px;
border-left:5px solid #BF953F;
">

<h3
style="
margin-top:0;
color:#BF953F;
">
Información importante
</h3>

<p
style="
color:#CCCCCC;
line-height:28px;
margin-bottom:0;
">

✔ Llega 10 minutos antes.

<br>

✔ Presenta este correo al llegar.

<br>

✔ Si necesitas ayuda puedes escribirnos por WhatsApp.

</p>

</div>

<div
style="
text-align:center;
margin-top:40px;
">

<a
href="https://wa.me/573145038202"
style="
display:inline-block;
padding:18px 42px;
background:#25D366;
color:#fff;
text-decoration:none;
border-radius:60px;
font-weight:bold;
font-size:17px;
letter-spacing:1px;
box-shadow:0 8px 20px rgba(37,211,102,.35);
">

Hablar por WhatsApp

</a>

</div>

<hr
style="
margin:45px 0;
border:none;
border-top:1px solid #333;
">

<p
style="
text-align:center;
color:#888;
font-size:13px;
line-height:24px;
">

<strong style="color:#BF953F;">
${tiendaNombre}
</strong>

<br>

Gracias por confiar en TAMAKÚ.

<br>

Te esperamos.

</p>

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
