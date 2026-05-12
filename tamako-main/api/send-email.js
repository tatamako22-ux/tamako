// api/send-email.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    const { email, nombre, tiendaNombre, servicio, profesional, fecha, hora, valor } = req.body;
    
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASS
        }
    });
    
    const mailOptions = {
        from: `${tiendaNombre} <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `✨ ${tiendaNombre} - Tu reserva ha sido confirmada ✨`,
        html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; background: #121212; padding: 40px;">
                <div style="max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 20px; padding: 30px; border: 1px solid #bf953f;">
                    <h1 style="color: #bf953f; text-align: center;">${tiendaNombre}</h1>
                    <h2 style="color: white; text-align: center;">✨ ¡Reserva Confirmada! ✨</h2>
                    
                    <div style="background: #0a0a0a; border-radius: 15px; padding: 20px; margin: 20px 0;">
                        <p style="color: #bf953f;"><strong>Cliente:</strong></p>
                        <p style="color: white;">${nombre}</p>
                        
                        <p style="color: #bf953f; margin-top: 15px;"><strong>Servicio:</strong></p>
                        <p style="color: white;">${servicio}</p>
                        
                        <p style="color: #bf953f; margin-top: 15px;"><strong>Profesional:</strong></p>
                        <p style="color: white;">${profesional}</p>
                        
                        <p style="color: #bf953f; margin-top: 15px;"><strong>Fecha y Hora:</strong></p>
                        <p style="color: white;">${fecha} - ${hora}</p>
                        
                        <p style="color: #bf953f; margin-top: 15px;"><strong>Valor:</strong></p>
                        <p style="color: #bf953f; font-size: 1.3rem;">${valor}</p>
                    </div>
                    
                    <div style="text-align: center; border-top: 1px solid #bf953f; padding-top: 20px;">
                        <p style="color: #888; font-size: 12px;">${tiendaNombre} - Experiencia Élite</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}