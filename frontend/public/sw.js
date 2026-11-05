// Service worker de Voz Vecinal: permite instalar la app y acelera la carga.
// No guarda datos de la API ni fotos: lo que ve la persona siempre viene del servidor.
const CACHE = 'voz-vecinal-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Archivos del programa (nombre con huella, nunca cambian): primero la copia guardada.
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(pedido).then((guardado) => guardado || fetch(pedido).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return respuesta;
      }))
    );
    return;
  }

  // Páginas: primero internet, para ver siempre la versión más nueva. Sin conexión, se usa la última guardada.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((cache) => cache.put('/', copia));
          }
          return respuesta;
        })
        .catch(() => caches.match('/'))
    );
  }
});

// Avisos push: llegan aunque la app esté cerrada.
self.addEventListener('push', (evento) => {
  let datos = {};
  try { datos = evento.data ? evento.data.json() : {}; } catch { /* sin contenido legible */ }
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'Voz Vecinal', {
      body: datos.cuerpo || 'Tienes una novedad',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: datos.etiqueta || undefined,
      data: { url: datos.url || '/' },
    })
  );
});

// Al tocar el aviso: se enfoca la app si ya está abierta, o se abre en la pantalla del reporte.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || '/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.location.origin) && 'focus' in v) {
          return v.focus().then(() => ('navigate' in v ? v.navigate(destino) : undefined));
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
