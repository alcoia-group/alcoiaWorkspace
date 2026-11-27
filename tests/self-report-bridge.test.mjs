import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSelfReportAt, setSelfReportEnabled, selfReportAvailable, selfReportAt, subscribeSelfReportAvailable, SELF_REPORT_CHOICES } from '../src/detection/selfReportBridge.js';

test('nothing is available until a reading registers a handler', () => {
  assert.equal(selfReportAvailable(), false);
  assert.equal(selfReportAt({}, 'confusion'), false);
});

test('a registered handler gets the node and the answer, and the result is passed back', () => {
  const calls = [];
  const off = registerSelfReportAt((node, subtype) => { calls.push([node, subtype]); return true; });
  assert.equal(selfReportAvailable(), true);
  const node = { id: 'n' };
  assert.equal(selfReportAt(node, 'overload'), true);
  assert.deepEqual(calls, [[node, 'overload']]);
  off();
  assert.equal(selfReportAvailable(), false);
});

test('the reader turning help off hides it and blocks calls; turning it on restores it', () => {
  const off = registerSelfReportAt(() => true);
  setSelfReportEnabled(false);
  assert.equal(selfReportAvailable(), false);
  assert.equal(selfReportAt({}, 'confusion'), false);
  setSelfReportEnabled(true);
  assert.equal(selfReportAvailable(), true);
  off();
});

test('a handler that throws or finds no paragraph reports false, never an error', () => {
  const off1 = registerSelfReportAt(() => { throw new Error('boom'); });
  assert.equal(selfReportAt({}, 'confusion'), false);
  off1();
  const off2 = registerSelfReportAt(() => false);
  assert.equal(selfReportAt({}, 'confusion'), false);
  off2();
});

test('listeners hear availability changes, and the three choices are the three self-report answers', () => {
  const seen = [];
  const un = subscribeSelfReportAvailable((on) => seen.push(on));
  const off = registerSelfReportAt(() => true);
  off();
  un();
  assert.deepEqual(seen, [true, false]);
  assert.deepEqual(SELF_REPORT_CHOICES.map((c) => c.subtype), ['confusion', 'overload', 'disengaged']);
});
