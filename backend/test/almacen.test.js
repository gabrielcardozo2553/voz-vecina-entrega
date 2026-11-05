const test = require('node:test');
const assert = require('node:assert/strict');
const { firmar } = require('../config/almacen');

test('la firma de Cloudinary coincide con el ejemplo de su documentación', () => {
  const parametros = {
    eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
    public_id: 'sample_image',
    timestamp: 1315060510,
  };
  assert.equal(firmar(parametros, 'abcd'), 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('el orden de los parámetros no cambia la firma', () => {
  assert.equal(firmar({ b: 2, a: 1 }, 's'), firmar({ a: 1, b: 2 }, 's'));
});
