const express = require('express');
const router = express.Router();
const { prepararBaseDeDatos } = require('../config/migraciones');
const { verificarToken } = require('../middleware/auth');
const { clavePublica, guardarSuscripcion, borrarSuscripcion } = require('../config/push');

// Clave pública para que el navegador pueda suscribirse (null si los avisos push no están configurados).
router.get('/clave', (req, res) => {
  res.json({ clave: clavePublica() });
});

router.post('/suscribir', verificarToken, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    if (!clavePublica()) return res.status(503).json({ error: 'Los avisos push no están disponibles' });
    const ok = await guardarSuscripcion(req.usuario.id, req.body.suscripcion);
    if (!ok) return res.status(400).json({ error: 'La suscripción no es válida' });
    res.status(201).json({ mensaje: 'Avisos activados' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron activar los avisos' });
  }
});

router.post('/baja', verificarToken, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    if (typeof req.body.endpoint === 'string') await borrarSuscripcion(req.usuario.id, req.body.endpoint);
    res.json({ mensaje: 'Avisos desactivados' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron desactivar los avisos' });
  }
});

module.exports = router;
