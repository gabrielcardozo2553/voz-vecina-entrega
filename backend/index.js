require('dotenv').config();
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
app.use('/uploads', express.static('uploads', { dotfiles: 'deny', index: false, maxAge: '30d', immutable: true }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Respuesta JSON uniforme para errores inesperados (por ejemplo, un JSON mal formado).
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const estado = err.status && err.status < 500 ? err.status : 500;
  if (estado === 500) console.error(err);
  res.status(estado).json({ error: estado === 500 ? 'Error interno del servidor' : 'Solicitud inválida' });
});

app.get('/', (req, res) => {
  res.send('API de Reportes Vecinales funcionando');
});

const PORT = process.env.PORT || 2000;
prepararBaseDeDatos()
  .catch(() => {})
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  });
