const test = require('node:test');
const assert = require('node:assert/strict');
const { limitarReportes } = require('../middleware/limitador');

function pedir(usuarioId) {
  const salida = { cabeceras: {} };
  const res = {
    set(k, v) { salida.cabeceras[k] = v; return this; },
    status(c) { salida.codigo = c; return this; },
    json() { return this; },
  };
  limitarReportes({ usuario: { id: usuarioId }, ip: '1.1.1.1' }, res, () => { salida.paso = true; });
  return salida;
}

test('permite 20 reportes por hora y frena el siguiente', () => {
  for (let i = 0; i < 20; i += 1) assert.equal(pedir(101).paso, true);
  const bloqueado = pedir(101);
  assert.equal(bloqueado.codigo, 429);
  assert.ok(Number(bloqueado.cabeceras['Retry-After']) > 0);
});

test('el límite es por persona: otra cuenta no se ve afectada', () => {
  assert.equal(pedir(202).paso, true);
});
