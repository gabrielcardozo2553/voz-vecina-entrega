// Envío de correos (códigos de confirmación). Usa nodemailer, que se carga solo cuando hace falta.
// Configuración en .env:
//   MAIL_USER y MAIL_PASS  -> cuenta desde la que se envía (con Gmail: contraseña de aplicación)
//   MAIL_HOST y MAIL_PORT  -> opcionales, por defecto smtp.gmail.com y 465
//   MAIL_FROM              -> opcional, nombre que ve quien recibe (por defecto "Voz Vecinal")
// Si no está configurado, el código se muestra en la terminal del servidor (útil para probar en tu PC).
//
// Hosting gratuito (Render y similares): bloquea los puertos SMTP, así que ahí se usa Brevo por HTTPS:
//   BREVO_API_KEY          -> clave de la API de Brevo
//   MAIL_REMITENTE         -> correo remitente ya verificado en Brevo
//   MAIL_FROM              -> nombre que ve quien recibe (por defecto "Voz Vecinal")
// Si BREVO_API_KEY está definida, se usa Brevo; si no, SMTP con MAIL_USER y MAIL_PASS.

const usaBrevo = () => Boolean(process.env.BREVO_API_KEY && process.env.MAIL_REMITENTE);

function correoConfigurado() {
  return usaBrevo() || Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
}

async function enviarPorBrevo({ para, asunto, texto, html }) {
  const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: process.env.MAIL_FROM || 'Voz Vecinal', email: process.env.MAIL_REMITENTE },
      to: [{ email: para }],
      subject: asunto,
      textContent: texto,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Brevo respondió ${respuesta.status}: ${detalle.slice(0, 200)}`);
  }
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

function plantilla(nombre, codigo, recuperar = false) {
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,';
  const texto = `${saludo}\n\n${recuperar ? 'Tu código para crear una contraseña nueva en Voz Vecinal es' : 'Tu código para confirmar tu correo en Voz Vecinal es'}: ${codigo}\n\nVence en 15 minutos. ${recuperar ? 'Si no pediste cambiar tu contraseña, ignora este mensaje: tu cuenta sigue segura.' : 'Si no fuiste tú, puedes ignorar este mensaje.'}`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;padding:24px;color:#14262b">
    <h2 style="color:#0d5c6b;margin:0 0 12px">Voz Vecinal</h2>
    <p style="font-size:16px">${saludo}</p>
    <p style="font-size:16px">${recuperar ? 'Tu código para crear una contraseña nueva es:' : 'Tu código para confirmar tu correo es:'}</p>
    <p style="font-size:34px;font-weight:bold;letter-spacing:8px;background:#dceef0;color:#0b3f4a;padding:14px 18px;border-radius:12px;text-align:center;margin:16px 0">${codigo}</p>
    <p style="font-size:14px;color:#4b5f64">Vence en 15 minutos. ${recuperar ? 'Si no pediste cambiar tu contraseña, ignora este mensaje: tu cuenta sigue segura.' : 'Si no fuiste tú, puedes ignorar este mensaje.'}</p>
  </div>`;
  return { texto, html };
}

// Devuelve { enviado: true } o { enviado: false, simulado: true } si el correo no está configurado.
async function enviarCodigo(para, codigo, nombre = '', { recuperar = false } = {}) {
  if (!correoConfigurado()) {
    console.warn(`[CORREO SIN CONFIGURAR] ${recuperar ? 'Código para cambiar la contraseña de' : 'Código de confirmación para'} ${para}: ${codigo}`);
    return { enviado: false, simulado: true };
  }
  const { texto, html } = plantilla(nombre, codigo, recuperar);
  const asunto = recuperar ? `Código para cambiar tu contraseña: ${codigo}` : `Tu código de Voz Vecinal: ${codigo}`;
  if (usaBrevo()) {
    await enviarPorBrevo({ para, asunto, texto, html });
    return { enviado: true };
  }
  await obtenerTransporte().sendMail({
    from: `"${process.env.MAIL_FROM || 'Voz Vecinal'}" <${process.env.MAIL_USER}>`,
    to: para,
    subject: asunto,
    text: texto,
    html,
  });
  return { enviado: true };
}

module.exports = { enviarCodigo, correoConfigurado };
