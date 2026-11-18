const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const pushRoutes = require('./routes/push');
const { prepararBaseDeDatos } = require('./config/migraciones');
const { asegurarBaseDeDatos } = require('./config/crearBase');
const db = require('./config/db');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16 || process.env.JWT_SECRET === 'tu_clave_secreta_aqui') {
  console.error('Falta JWT_SECRET en el archivo .env (usa una clave larga y aleatoria). El servidor no arranca sin ella.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
// En Render siempre hay un proxy delante: sin esto, todos los visitantes compartirían la misma IP en los límites de intentos.
else if (process.env.RENDER) app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()',
  });
  // Con https, el navegador recuerda usar siempre https en este sitio (si entras por http, no se aplica).
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.set('Strict-Transport-Security', 'max-age=15552000');
  }
  next();
});

// Política de contenido de la página: solo se permiten los servicios que la app usa
// (Google, Facebook, Cloudflare Turnstile, tipografías y mapas de OpenStreetMap).
const POLITICA_PAGINA = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com https://connect.facebook.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://res.cloudinary.com https://*.googleusercontent.com https://*.fbcdn.net https://www.facebook.com",
  "connect-src 'self' https://accounts.google.com https://graph.facebook.com https://www.facebook.com https://connect.facebook.net",
  "frame-src https://accounts.google.com https://www.facebook.com https://web.facebook.com https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const ENCABEZADO_POLITICA = process.env.CSP_SOLO_REPORTE ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
// Si defines CORS_ORIGIN en .env (por ejemplo https://miweb.com) solo ese sitio puede usar la API.
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/push', pushRoutes);

// Las fotos se sirven como simples imágenes: la política impide que cualquier otro contenido se ejecute.
app.use('/uploads', (req, res, next) => {
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
  next();
}, express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false, maxAge: '30d', immutable: true }));

// Comprobación de que el servidor y la base responden. Sirve también para los avisos de "¿sigue vivo?" de los hostings.
app.get('/api/salud', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.set('Cache-Control', 'no-store').json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Si existe el build del frontend (npm run build), el mismo servidor lo entrega: así basta con un solo puerto.
const carpetaFront = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(carpetaFront, 'index.html'))) {
  app.use('/assets', express.static(path.join(carpetaFront, 'assets'), { maxAge: '1y', immutable: true }));
  // Un archivo de /assets que ya no existe (por una versión anterior) debe dar 404, no la página de inicio.
  app.use('/assets', (req, res) => res.status(404).end());
  app.use(express.static(carpetaFront, {
    index: false,
    maxAge: '1h',
    // El service worker y el manifiesto deben revisarse siempre, para que las actualizaciones lleguen.
    setHeaders: (res, archivo) => {
      if (/(sw\.js|manifest\.webmanifest)$/.test(archivo)) res.set('Cache-Control', 'no-cache');
    },
  }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.set(ENCABEZADO_POLITICA, POLITICA_PAGINA);
    res.sendFile(path.join(carpetaFront, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API de Reportes Vecinales funcionando');
  });
}

// Respuesta JSON uniforme para errores inesperados (por ejemplo, un JSON mal formado).
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const estado = err.status && err.status < 500 ? err.status : 500;
  if (estado === 500) console.error(err);
  res.status(estado).json({ error: estado === 500 ? 'Error interno del servidor' : 'Solicitud inválida' });
});

const PORT = process.env.PORT || 3000;
// Si defines ADMIN_EMAIL en .env y esa cuenta ya existe con el correo confirmado, pasa a ser administradora.
async function promoverAdministrador() {
  const correo = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!correo) return;
  const [res] = await db.query(
    "UPDATE usuarios SET rol = 'admin' WHERE email = ? AND email_verificado = 1 AND rol <> 'admin'",
    [correo]
  );
  if (res.affectedRows > 0) console.log(`La cuenta ${correo} ahora es administradora`);
}

asegurarBaseDeDatos()
  .then(prepararBaseDeDatos)
  .then(promoverAdministrador)
  .catch(() => {})
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  });
