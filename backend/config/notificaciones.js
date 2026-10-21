const db = require('./db');

const MAX_TEXTO = 250;

// Guarda avisos para uno o varios usuarios. Si falla, solo se registra el error: nunca rompe la acción principal.
async function notificar(usuarioIds, { tipo, reporteId = null, texto }) {
  const ids = [...new Set((usuarioIds || []).filter(Boolean))];
  if (!ids.length) return;
  try {
    await db.query(
      'INSERT INTO notificaciones (usuario_id, tipo, reporte_id, texto) VALUES ?',
      [ids.map((id) => [id, tipo, reporteId, String(texto).slice(0, MAX_TEXTO)])]
    );
  } catch (error) {
    console.error('No se pudo guardar la notificación:', error.message);
  }
}

// Avisa a todos los administradores, menos a quien hizo la acción.
async function notificarAdmins(datos, exceptoId = null) {
  try {
    const [admins] = await db.query("SELECT id FROM usuarios WHERE rol = 'admin'");
    await notificar(admins.map((a) => a.id).filter((id) => id !== exceptoId), datos);
  } catch (error) {
    console.error('No se pudo avisar a los administradores:', error.message);
  }
}

module.exports = { notificar, notificarAdmins };
