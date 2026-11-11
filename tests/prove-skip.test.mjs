import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stretchFrom, pdfConfig } from '../src/lib/proveSkip.js';

const items = [1, 1, 2, 3].map((page, i) => ({ id: `i${i}`, page }));
const cfg = pdfConfig(10);

test('a section the prior check showed is known offers a skip with no questions', () => {
  const seen = { i0: 'h', i1: 'h', i2: 'h', i3: 'h' };
  const o = stretchFrom(items, 1, cfg, seen);
  assert.equal(o.held, true);
  assert.deepEqual(o.fresh, []);
  assert.equal(o.target, 4);
});

test('a right but unsure answer is asked again and never counts toward a skip', () => {
  const o = stretchFrom(items, 1, cfg, { i0: 'u', i1: 'c' });
  assert.equal(o.held, undefined);
  assert.deepEqual(o.fresh.map((it) => it.id), ['i0', 'i2', 'i3']);
  assert.equal(o.proved, 1);
});

test('without check results the offer is unchanged', () => {
  const o = stretchFrom(items, 1, cfg, {});
  assert.equal(o.fresh.length, 4);
});
