import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveColor, colorToken, isCustomColor, registerColor, highlightNames, rememberColor, COLORS } from '../src/lib/annotations.js';

test('presets are unchanged and old marks keep their colour', () => {
  assert.equal(resolveColor('green'), COLORS.green);
  assert.equal(colorToken('green'), 'green');
});

test('a custom hex gets a translucent fill and a darker line colour', () => {
  const c = resolveColor('#ff8000');
  assert.equal(c.fill, 'rgba(255, 128, 0, 0.40)');
  assert.equal(c.solid, '#c76400');
  assert.equal(c.name, '#FF8000');
  assert.equal(colorToken('#FF8000'), 'xff8000');
});

test('anything that is not a preset or a six digit hex falls back to yellow', () => {
  for (const bad of [undefined, null, '', 'red', '#fff', '#gggggg', 'url(x)', '#ff8000; x', 42]) {
    assert.equal(isCustomColor(bad), false);
    assert.equal(resolveColor(bad), COLORS.yellow);
    assert.equal(colorToken(bad), 'yellow');
  }
});

test('custom colours get highlight names once registered', () => {
  assert.equal(registerColor('#123456'), 'x123456');
  registerColor('#123456');
  assert.equal(highlightNames().filter((n) => n === 'alc-hl-x123456').length, 1);
  assert.ok(highlightNames().includes('alc-st-yellow'));
});

test('recent colours keep the newest first, without repeats, at most six', () => {
  let list = [];
  for (const h of ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007']) list = rememberColor(list, h);
  assert.equal(list.length, 6);
  assert.equal(list[0], '#000007');
  list = rememberColor(list, '#000004');
  assert.equal(list[0], '#000004');
  assert.equal(new Set(list).size, list.length);
});
