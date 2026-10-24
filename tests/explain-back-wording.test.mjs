import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVariant, wording, instructorLine } from '../src/lib/explainBackWording.js';

const est = (levels) => levels.map((level, i) => ({ knowledgeUnitId: `u${i}`, level }));

test('asks for the main ideas when there is little or no evidence', () => {
  assert.equal(pickVariant([]), 'guided');
  assert.equal(pickVariant(undefined), 'guided');
  assert.equal(pickVariant(est(['established', 'established'])), 'guided');
  assert.equal(pickVariant(est(['insufficient', 'insufficient', 'insufficient', 'insufficient', 'insufficient', 'insufficient'])), 'guided');
});

test('asks what was understood only when most units look understood and few need help', () => {
  assert.equal(pickVariant(est(['established', 'established', 'progressing', 'established', 'progressing'])), 'open');
  assert.equal(pickVariant(est(['established', 'established', 'established', 'established', 'needs_help'])), 'guided');
  assert.equal(pickVariant(est(['needs_help', 'needs_help', 'progressing', 'progressing', 'progressing'])), 'guided');
});

test('wording follows the kind of material and says nothing about privacy', () => {
  assert.match(wording('open', 'pptx').prompt, /lecture/);
  assert.match(wording('open', 'docx').prompt, /reading/);
  assert.match(wording('guided', 'pdf').prompt, /main ideas/);
  const all = [wording('open', 'pptx'), wording('guided', 'docx'), instructorLine(false)].map((w) => JSON.stringify(w)).join(' ');
  assert.doesNotMatch(all, /discard|private|never kept|never recorded|checked and then/i);
  assert.equal(instructorLine(true), '');
});
