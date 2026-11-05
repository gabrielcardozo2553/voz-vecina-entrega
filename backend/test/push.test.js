const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

process.env.VAPID_PUBLIC_KEY = 'publica';
process.env.VAPID_PRIVATE_KEY = 'privada';

const consultas = [];
let suscripciones = [];
const rutaDb = path.join(__dirname, '..', 'config', 'db.js');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: {
    query: async (sql, params) => {
      consultas.push({ sql, params });
      return /^SELECT/i.test(sql.trim()) ? [suscripciones] : [{}];
    },
  },
};

const enviados = [];
let fallo = null;
const falsaLibreria = {
  setVapidDetails() {},
  sendNotification: async (sus, carga) => {
    if (fallo && sus.endpoint.endsWith('/muerto')) throw Object.assign(new Error('gone'), { statusCode: fallo });
    enviados.push({ endpoint: sus.endpoint, carga: JSON.parse(carga) });
  },
};
const cargarOriginal = Module._load;
Module._load = function cargar(pedido, ...resto) {
  return pedido === 'web-push' ? falsaLibreria : cargarOriginal.call(this, pedido, ...resto);
};

const { enviarPush, guardarSuscripcion } = require('../config/push');

test('envía el aviso a todos los dispositivos de la persona', async () => {
  suscripciones = [
    { id: 1, endpoint: 'https://push.ejemplo/a', p256dh: 'x', auth: 'y' },
    { id: 2, endpoint: 'https://push.ejemplo/b', p256dh: 'x', auth: 'y' },
  ];
  await enviarPush([7], { titulo: 'Voz Vecinal', cuerpo: 'Tu reporte fue resuelto', url: '/mis-reportes?reporte=3' });
  assert.equal(enviados.length, 2);
  assert.equal(enviados[0].carga.url, '/mis-reportes?reporte=3');
});

test('si un dispositivo ya no existe (410), se borra su suscripción', async () => {
  suscripciones = [{ id: 9, endpoint: 'https://push.ejemplo/muerto', p256dh: 'x', auth: 'y' }];
  fallo = 410;
  consultas.length = 0;
  await enviarPush([7], { titulo: 't', cuerpo: 'c', url: '/' });
  assert.ok(consultas.some((c) => /^DELETE FROM suscripciones_push WHERE id/i.test(c.sql) && c.params[0] === 9));
  fallo = null;
});

test('rechaza suscripciones mal formadas', async () => {
  assert.equal(await guardarSuscripcion(1, null), false);
  assert.equal(await guardarSuscripcion(1, { endpoint: 'http://inseguro', keys: { p256dh: 'a', auth: 'b' } }), false);
  assert.equal(await guardarSuscripcion(1, { endpoint: 'https://ok.com/x', keys: {} }), false);
  assert.equal(await guardarSuscripcion(1, { endpoint: 'https://ok.com/x', keys: { p256dh: 'a', auth: 'b' } }), true);
});
