// Pruebas de la comprobación de sesión. No usan la base real: se reemplaza por una respuesta controlada.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.JWT_SECRET = 'clave-de-prueba-bastante-larga-123456';

let cuenta = null;
const rutaDb = path.join(__dirname, '..', 'config', 'db.js');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: { query: async () => [cuenta ? [cuenta] : []] },
};

const jwt = require('jsonwebtoken');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

async function ejecutar(token) {
  const salida = {};
  const res = { status(c) { salida.codigo = c; return this; }, json(b) { salida.cuerpo = b; return this; } };
  const req = { headers: { authorization: `Bearer ${token}` } };
  await verificarToken(req, res, () => { salida.paso = true; });
  return { ...salida, usuario: req.usuario };
}

const token = () => jwt.sign({ id: 1, rol: 'vecino' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
const ahora = () => Math.floor(Date.now() / 1000);

test('una sesión válida pasa y toma el rol actual de la base', async () => {
  cuenta = { nombre: 'Ana', rol: 'admin', sesion_desde: null };
  const r = await ejecutar(token());
  assert.equal(r.paso, true);
  assert.equal(r.usuario.rol, 'admin');
});

test('una sesión iniciada en el mismo segundo del cambio de contraseña sigue valiendo', async () => {
  cuenta = { nombre: 'Ana', rol: 'vecino', sesion_desde: ahora() };
  assert.equal((await ejecutar(token())).paso, true);
});

test('una sesión anterior al cambio de contraseña se rechaza', async () => {
  cuenta = { nombre: 'Ana', rol: 'vecino', sesion_desde: ahora() + 10 };
  assert.equal((await ejecutar(token())).codigo, 401);
});

test('una cuenta borrada se rechaza', async () => {
  cuenta = null;
  assert.equal((await ejecutar(token())).codigo, 401);
});

test('un token con otra firma se rechaza', async () => {
  cuenta = { nombre: 'Ana', rol: 'admin', sesion_desde: null };
  const falso = jwt.sign({ id: 1, rol: 'admin' }, 'otra-clave-distinta-1234567890', { algorithm: 'HS256' });
  assert.equal((await ejecutar(falso)).codigo, 401);
});

test('solo los administradores pasan el control de administrador', () => {
  const llamar = (rol) => {
    const salida = {};
    const res = { status(c) { salida.codigo = c; return this; }, json() { return this; } };
    verificarAdmin({ usuario: { rol } }, res, () => { salida.paso = true; });
    return salida;
  };
  assert.equal(llamar('admin').paso, true);
  assert.equal(llamar('vecino').codigo, 403);
});

// ── Sesión en cookie ──
async function ejecutarConCookie(cabeceras, metodo = 'GET') {
  const salida = {};
  const res = { status(c) { salida.codigo = c; return this; }, json(b) { salida.cuerpo = b; return this; } };
  const req = { method: metodo, headers: cabeceras };
  await verificarToken(req, res, () => { salida.paso = true; });
  return salida;
}

test('la sesión también se acepta desde la cookie', async () => {
  cuenta = { nombre: 'Ana', rol: 'vecino', sesion_desde: null };
  const r = await ejecutarConCookie({ cookie: `otra=1; vv_sesion=${token()}; mas=2`, host: 'sitio.com' });
  assert.equal(r.paso, true);
});

test('con cookie, una acción que viene de otro sitio se rechaza', async () => {
  cuenta = { nombre: 'Ana', rol: 'vecino', sesion_desde: null };
  const r = await ejecutarConCookie({ cookie: `vv_sesion=${token()}`, host: 'sitio.com', origin: 'https://malo.com' }, 'POST');
  assert.equal(r.codigo, 403);
});

test('con cookie, una acción del mismo sitio pasa', async () => {
  cuenta = { nombre: 'Ana', rol: 'vecino', sesion_desde: null };
  const r = await ejecutarConCookie({ cookie: `vv_sesion=${token()}`, host: 'sitio.com', origin: 'https://sitio.com' }, 'POST');
  assert.equal(r.paso, true);
});

test('sin cookie ni encabezado se rechaza', async () => {
  assert.equal((await ejecutarConCookie({ host: 'sitio.com' })).codigo, 401);
});
