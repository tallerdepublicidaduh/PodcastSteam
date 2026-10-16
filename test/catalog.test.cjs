const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ids } = require('../src/catalog.js');

test('mapea categorías RSS en inglés y español con acentos', () => {
  assert.deepEqual(ids({ categories: ['Science', 'Astronomy', 'History'] }), ['science', 'history']);
  assert.deepEqual(ids({ categories: ['Tecnología', 'True Crime', 'Humor'] }), ['technology', 'crime', 'comedy']);
});
test('conserva podcasts antiguos sin inventar categorías desde el título', () => {
  assert.deepEqual(ids({ title: 'Ciencia de ejemplo' }), []);
  assert.deepEqual(ids({ categories: ['Business'] }), []);
});
