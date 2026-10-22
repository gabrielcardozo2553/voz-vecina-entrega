// Envío de correos (códigos de confirmación). Usa nodemailer, que se carga solo cuando hace falta.
// Configuración en .env:
//   MAIL_USER y MAIL_PASS  -> cuenta desde la que se envía (con Gmail: contraseña de aplicación)
//   MAIL_HOST y MAIL_PORT  -> opcionales, por defecto smtp.gmail.com y 465
//   MAIL_FROM              -> opcional, nombre que ve quien recibe (por defecto "Voz Vecinal")
// Si no está configurado, el código se muestra en la terminal del servidor (útil para probar en tu PC).

function correoConfigurado() {
  return Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
}

let transporte = null;

function obtenerTransporte() {
  if (transporte) return transporte;
  const nodemailer = require('nodemailer');
  const puerto = Number(process.env.MAIL_PORT) || 465;
  transporte = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: puerto,
    secure: puerto === 465,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
  return transporte;
}

function plantilla(nombre, codigo) {
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,';
  const texto = `${saludo}\n\nTu código para confirmar tu correo en Voz Vecinal es: ${codigo}\n\nVence en 15 minutos. Si no fuiste tú, puedes ignorar este mensaje.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;padding:24px;color:#14262b">
    <h2 style="color:#0d5c6b;margin:0 0 12px">Voz Vecinal</h2>
    <p style="font-size:16px">${saludo}</p>
    <p style="font-size:16px">Tu código para confirmar tu correo es:</p>
    <p style="font-size:34px;font-weight:bold;letter-spacing:8px;background:#dceef0;color:#0b3f4a;padding:14px 18px;border-radius:12px;text-align:center;margin:16px 0">${codigo}</p>
    <p style="font-size:14px;color:#4b5f64">Vence en 15 minutos. Si no fuiste tú, puedes ignorar este mensaje.</p>
  </div>`;
  return { texto, html };
}

// Devuelve { enviado: true } o { enviado: false, simulado: true } si el correo no está configurado.
async function enviarCodigo(para, codigo, nombre = '') {
  if (!correoConfigurado()) {
    console.warn(`[CORREO SIN CONFIGURAR] Código de confirmación para ${para}: ${codigo}`);
    return { enviado: false, simulado: true };
  }
  const { texto, html } = plantilla(nombre, codigo);
  await obtenerTransporte().sendMail({
    from: `"${process.env.MAIL_FROM || 'Voz Vecinal'}" <${process.env.MAIL_USER}>`,
    to: para,
    subject: `Tu código de Voz Vecinal: ${codigo}`,
    text: texto,
    html,
  });
  return { enviado: true };
}

module.exports = { enviarCodigo, correoConfigurado };
