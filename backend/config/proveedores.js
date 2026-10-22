// Verificación de identidad con Google y Facebook. Nunca se confía en lo que manda el navegador:
// cada credencial se comprueba directamente con el proveedor.

async function pedirJson(url) {
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error('El proveedor rechazó la credencial');
    error.rechazada = true;
    throw error;
  }
  return datos;
}

function googleConfigurado() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

function facebookConfigurado() {
  return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

// Recibe el "credential" (ID token) que entrega el botón de Google.
async function verificarGoogle(idToken) {
  if (!googleConfigurado()) throw new Error('Google no está configurado');
  const datos = await pedirJson(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);

  const emisorValido = ['accounts.google.com', 'https://accounts.google.com'].includes(datos.iss);
  const paraEstaApp = datos.aud === process.env.GOOGLE_CLIENT_ID;
  const emailVerificado = datos.email_verified === true || datos.email_verified === 'true';
  if (!emisorValido || !paraEstaApp || !emailVerificado || !datos.sub || !datos.email) {
    const error = new Error('Credencial de Google no válida');
    error.rechazada = true;
    throw error;
  }

  return {
    proveedor: 'google',
    id: String(datos.sub),
    email: String(datos.email).toLowerCase(),
    nombre: datos.given_name || '',
    apellido: datos.family_name || '',
    emailVerificado: true,
  };
}

// Recibe el "accessToken" que entrega el inicio de sesión de Facebook.
async function verificarFacebook(accessToken) {
  if (!facebookConfigurado()) throw new Error('Facebook no está configurado');
  const appId = process.env.FACEBOOK_APP_ID;
  const tokenApp = `${appId}|${process.env.FACEBOOK_APP_SECRET}`;

  const control = await pedirJson(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(tokenApp)}`
  );
  if (!control.data || !control.data.is_valid || String(control.data.app_id) !== String(appId)) {
    const error = new Error('Credencial de Facebook no válida');
    error.rechazada = true;
    throw error;
  }

  const perfil = await pedirJson(
    `https://graph.facebook.com/me?fields=id,first_name,last_name,email&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!perfil.id || String(perfil.id) !== String(control.data.user_id)) {
    const error = new Error('Credencial de Facebook no válida');
    error.rechazada = true;
    throw error;
  }

  return {
    proveedor: 'facebook',
    id: String(perfil.id),
    // Facebook puede no entregar email (cuentas creadas con teléfono) y no se considera confirmado.
    email: perfil.email ? String(perfil.email).toLowerCase() : null,
    nombre: perfil.first_name || '',
    apellido: perfil.last_name || '',
    emailVerificado: false,
  };
}

module.exports = { verificarGoogle, verificarFacebook, googleConfigurado, facebookConfigurado };
