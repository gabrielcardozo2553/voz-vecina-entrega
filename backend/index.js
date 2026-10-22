const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const { prepararBaseDeDatos } = require('./config/migraciones');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16 || process.env.JWT_SECRET === 'tu_clave_secreta_aqui') {
  console.error('Falta JWT_SECRET en el archivo .env (usa una clave larga y aleatoria). El servidor no arranca sin ella.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});
// Si defines CORS_ORIGIN en .env (por ejemplo https://miweb.com) solo ese sitio puede usar la API.
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);

// Las fotos se sirven como simples imágenes: la política impide que cualquier otro contenido se ejecute.
app.use('/uploads', (req, res, next) => {
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
  next();
}, express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false, maxAge: '30d', immutable: true }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Si existe el build del frontend (npm run build), el mismo servidor lo entrega: así basta con un solo puerto.
const carpetaFront = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(carpetaFront, 'index.html'))) {
  app.use('/assets', express.static(path.join(carpetaFront, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(carpetaFront, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
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

const PORT = process.env.PORT || 2000;
prepararBaseDeDatos()
  .catch(() => {})
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  });
