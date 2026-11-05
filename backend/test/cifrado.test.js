const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DNI_KEY = 'clave-de-prueba-para-el-dni-123456';
const { cifrarDni, descifrarDni, huellaDni, estaCifrado } = require('../config/cifrado');

test('el DNI cifrado no se lee y se recupera igual', () => {
  const c = cifrarDni('12345678');
  assert.ok(estaCifrado(c));
  assert.ok(!c.includes('12345678'));
  assert.equal(descifrarDni(c), '12345678');
});

test('cada cifrado es distinto, pero la huella es siempre la misma', () => {
  assert.notEqual(cifrarDni('12345678'), cifrarDni('12345678'));
  assert.equal(huellaDni('12345678'), huellaDni('12345678'));
  assert.notEqual(huellaDni('12345678'), huellaDni('12345679'));
});

test('un DNI guardado sin cifrar se sigue leyendo', () => {
  assert.equal(descifrarDni('12345678'), '12345678');
});

test('un valor alterado no se descifra', () => {
  const c = cifrarDni('12345678');
  const roto = c.slice(0, -2) + (c.endsWith('A') ? 'BB' : 'AA');
  assert.equal(descifrarDni(roto), null);
});

test('no vuelve a cifrar lo ya cifrado', () => {
  const c = cifrarDni('12345678');
  assert.equal(cifrarDni(c), c);
});
