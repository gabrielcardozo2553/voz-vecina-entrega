const test = require('node:test');
const assert = require('node:assert/strict');
const { NOMBRE_VALIDO } = require('../config/crearBase');

test('acepta nombres de base normales', () => {
  for (const n of ['reportes_vecinales', 'defaultdb', 'Voz2026']) assert.ok(NOMBRE_VALIDO.test(n), n);
});

test('rechaza nombres con caracteres peligrosos o demasiado largos', () => {
  for (const n of ['a`; DROP DATABASE x; --', 'mi base', 'base-con-guion', '', 'x'.repeat(65)]) {
    assert.ok(!NOMBRE_VALIDO.test(n), n);
  }
});
