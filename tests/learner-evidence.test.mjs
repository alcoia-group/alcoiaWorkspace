import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceLine, CARD_LEAN, STYLE_LEAN, STYLE_WORDS, MODE_WORDS } from '../src/lib/subjects.js';

test('an evidence line states the learner\'s own answer and nothing inferred', () => {
  const line = evidenceLine({ reading: 'Neural nets', paragraph: 5, result: 'wrong', sure: 'sure', kind: 'recall', at: '2026-10-01T10:00:00.000Z' });
  assert.match(line, /^Neural nets, paragraph 5: a question you answered in your own words, answered incorrectly, and you were sure/);
  assert.ok(!/misconception|weak|bad|fail/i.test(line));
  const plain = evidenceLine({ reading: 'A reading', paragraph: null, result: 'right', sure: null, kind: 'recognition', at: null });
  assert.equal(plain, 'A reading: a multiple-choice question, answered correctly.');
});

test('help-worked words exist for every value the server can send, with no em dash', () => {
  for (const k of ['usually_answered', 'usually_turned_away', 'mixed']) assert.ok(CARD_LEAN[k]);
  for (const k of ['helped', 'did_not_help', 'mixed']) assert.ok(STYLE_LEAN[k]);
  for (const k of ['example_first', 'analogy', 'step_by_step', 'scenario', 'plain_definition', 'contrast']) assert.ok(STYLE_WORDS[k]);
  for (const k of ['explain_more', 'simplify', 'repair']) assert.ok(MODE_WORDS[k]);
  const all = JSON.stringify([CARD_LEAN, STYLE_LEAN, STYLE_WORDS, MODE_WORDS]);
  assert.ok(!all.includes(String.fromCharCode(8212)));
});
