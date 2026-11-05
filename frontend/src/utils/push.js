import axios from 'axios';

// Avisos push: el celular o la computadora avisan aunque la app esté cerrada.
const esIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalada = () => (
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
);

export const pushSoportado = () => (
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
);

// En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio.
export const requiereInstalar = () => esIos() && !instalada();

function aBytes(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function suscripcionActual() {
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

// 'no-disponible' | 'bloqueado' | 'activo' | 'inactivo'
export async function estadoAvisos() {
  try {
    if (!pushSoportado()) return 'no-disponible';
    const { data } = await axios.get('/api/push/clave');
    if (!data.clave) return 'no-disponible';
    if (Notification.permission === 'denied') return 'bloqueado';
    return (await suscripcionActual()) ? 'activo' : 'inactivo';
  } catch {
    return 'no-disponible';
  }
}

export async function activarAvisos() {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'bloqueado';
  const { data } = await axios.get('/api/push/clave');
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = (await registro.pushManager.getSubscription())
    || (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(data.clave) }));
  await axios.post('/api/push/suscribir', { suscripcion: suscripcion.toJSON() });
  return 'activo';
}

// Quita los avisos de este dispositivo (en el servidor y en el navegador). Nunca lanza errores.
export async function desactivarAvisos() {
  try {
    if (!pushSoportado()) return;
    const suscripcion = await suscripcionActual();
    if (!suscripcion) return;
    await axios.post('/api/push/baja', { endpoint: suscripcion.endpoint }).catch(() => {});
    await suscripcion.unsubscribe();
  } catch {
    /* sin avisos que quitar */
  }
}
