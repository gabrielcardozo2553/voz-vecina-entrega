// Notificaciones push (Web Push). Se activan al definir VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT.
// Generar las claves:  node scripts/claves-push.js
const crypto = require('crypto');
const db = require('./db');

let libreria = null;
let preparada = false;

const configurado = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
const clavePublica = () => (configurado() ? process.env.VAPID_PUBLIC_KEY : null);
const huella = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex');

function cargar() {
  if (!configurado()) return null;
  if (!libreria) {
    try {
      libreria = require('web-push');
    } catch {
      console.error('Falta instalar web-push (npm install) para enviar notificaciones push.');
      return null;
    }
  }
  if (!preparada) {
    libreria.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    preparada = true;
  }
  return libreria;
}

async function guardarSuscripcion(usuarioId, suscripcion) {
  const { endpoint, keys } = suscripcion || {};
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000
    || !keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    return false;
  }
  await db.query(
    `INSERT INTO suscripciones_push (usuario_id, endpoint_hash, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), endpoint = VALUES(endpoint),
                             p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [usuarioId, huella(endpoint), endpoint, keys.p256dh.slice(0, 255), keys.auth.slice(0, 255)]
  );
  return true;
}

async function borrarSuscripcion(usuarioId, endpoint) {
  await db.query('DELETE FROM suscripciones_push WHERE endpoint_hash = ? AND usuario_id = ?', [huella(endpoint), usuarioId]);
}

// Envía el aviso a todos los dispositivos de esas personas. Nunca lanza errores: el aviso dentro de la app ya quedó guardado.
async function enviarPush(usuarioIds, { titulo, cuerpo, url, etiqueta }) {
  try {
    const push = cargar();
    const ids = [...new Set((usuarioIds || []).filter(Boolean))];
    if (!push || !ids.length) return;
    const [subs] = await db.query('SELECT id, endpoint, p256dh, auth FROM suscripciones_push WHERE usuario_id IN (?)', [ids]);
    const carga = JSON.stringify({ titulo, cuerpo, url, etiqueta });
    await Promise.all(subs.map(async (s) => {
      try {
        await push.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 60 * 60 * 24 });
      } catch (error) {
        // 404/410: el dispositivo ya no recibe avisos (se desinstaló la app o se quitó el permiso).
        if (error.statusCode === 404 || error.statusCode === 410) {
          await db.query('DELETE FROM suscripciones_push WHERE id = ?', [s.id]).catch(() => {});
        } else {
          console.error('No se pudo enviar la notificación push:', error.statusCode || error.message);
        }
      }
    }));
  } catch (error) {
    console.error('Error en las notificaciones push:', error.message);
  }
}

module.exports = { configurado, clavePublica, guardarSuscripcion, borrarSuscripcion, enviarPush };
