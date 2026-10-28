import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paceFor, helpIsOn, estimateMinutes, minutesLeft, lengthLine, basisNote, formatMinutes, HELP_ALLOWANCE } from '../src/lib/readingTime.js';
import { fractionLeft } from '../src/lib/resume.js';

test('pace is the reader\'s own when there is one, else typical, and a silly stored figure is not used', () => {
  assert.deepEqual(paceFor({ globalWpm: 300, byLanguage: {} }), { wpm: 300, basis: 'yours' });
  assert.deepEqual(paceFor({ globalWpm: 300, byLanguage: { fr: 240 } }, 'fr'), { wpm: 240, basis: 'yours' });
  assert.deepEqual(paceFor(null), { wpm: 200, basis: 'typical' });
  assert.deepEqual(paceFor({ globalWpm: 5, byLanguage: {} }), { wpm: 200, basis: 'typical' });
  assert.deepEqual(paceFor({ globalWpm: 5000, byLanguage: {} }), { wpm: 200, basis: 'typical' });
});

test('help cards count only while reading help and the cards are on; unknown means on', () => {
  assert.equal(helpIsOn({ enabled: true, show_interventions: true }), true);
  assert.equal(helpIsOn({ enabled: false, show_interventions: true }), false);
  assert.equal(helpIsOn({ enabled: true, show_interventions: false }), false);
  assert.equal(helpIsOn(null), true);
});

test('the estimate follows the reader\'s pace and adds the help allowance only when help is on', () => {
  const plain = estimateMinutes({ wordCount: 6000, baseline: { globalWpm: 300 }, help: false });
  assert.equal(plain.minutes, 20);
  const withHelp = estimateMinutes({ wordCount: 6000, baseline: { globalWpm: 300 }, help: true });
  assert.equal(withHelp.minutes, Math.round(20 * (1 + HELP_ALLOWANCE)));
  assert.ok(withHelp.minutes > plain.minutes);
  assert.equal(estimateMinutes({ wordCount: null }), null);
  assert.equal(estimateMinutes({ wordCount: 0 }), null);
  assert.equal(estimateMinutes({ wordCount: 10, baseline: null, help: false }).minutes, 1);
});

test('time left follows the share still ahead and never goes below zero or above the whole', () => {
  assert.equal(minutesLeft(50, 0.46), 23);
  assert.equal(minutesLeft(50, 2), 50);
  assert.equal(minutesLeft(50, -1), 0);
  assert.equal(minutesLeft(null, 0.5), null);
  assert.equal(fractionLeft(0, 10), 1);
  assert.equal(fractionLeft(9, 10), 0.1);
});

test('the lines say what they rest on and use no em dash', () => {
  const est = estimateMinutes({ wordCount: 10000, baseline: { globalWpm: 250 }, help: true });
  assert.equal(lengthLine(est, null), `~${formatMinutes(est.minutes)} read`);
  assert.equal(lengthLine(est, 23), '23 min left');
  assert.equal(lengthLine(est, 0), 'Nearly done');
  assert.equal(basisNote(est), 'at your pace, with help cards');
  assert.equal(basisNote(estimateMinutes({ wordCount: 1000, help: false })), 'at a typical pace');
  assert.equal(formatMinutes(95), '1 h 35 min');
  const all = [lengthLine(est, null), basisNote(est)].join('');
  assert.ok(!all.includes(String.fromCharCode(8212)));
});
