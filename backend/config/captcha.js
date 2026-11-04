// Verificación anti-bots con Cloudflare Turnstile (gratis). Se activa al definir en .env:
//   TURNSTILE_SITE_KEY y TURNSTILE_SECRET
// Si no están definidas, el registro funciona igual que antes (solo con límite de intentos).

function captchaConfigurado() {
  return Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET);
}

async function verificarCaptcha(token, ip) {
  if (!captchaConfigurado()) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const cuerpo = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token });
    if (ip) cuerpo.set('remoteip', ip);
    const respuesta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: cuerpo,
      signal: AbortSignal.timeout(8000),
    });
    const datos = await respuesta.json();
    return datos.success === true;
  } catch (error) {
    console.error('No se pudo verificar el captcha:', error.message);
    return false;
  }
}

module.exports = { captchaConfigurado, verificarCaptcha };
