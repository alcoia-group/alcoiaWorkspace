import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startSession, createMemoryStore, exportPayload, FLAG_KEY, isRecording, setRecording, MAX_EVENTS } from '../src/diagnostics/scrollRecorder.js';
import { summarize, dynamicsSubtypes } from '../src/diagnostics/scrollSummary.js';

function fakeEnv() {
  let clockNow = 0;
  const win = new EventTarget();
  Object.assign(win, { scrollY: 0, innerHeight: 800, innerWidth: 400, devicePixelRatio: 3, screen: { width: 400, height: 800 }, matchMedia: (q) => ({ matches: q === '(pointer: coarse)' || q === '(hover: none)' || q === '(orientation: portrait)' }), visualViewport: null, CustomEvent, setInterval: () => 1, clearInterval() {} });
  const doc = new EventTarget();
  Object.assign(doc, { visibilityState: 'visible', documentElement: { scrollHeight: 5000 } });
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const counts = { add: 0, remove: 0 };
  for (const t of [win, doc]) {
    const add = t.addEventListener.bind(t); const rm = t.removeEventListener.bind(t);
    t.addEventListener = (...a) => { if (String(a[1]?.name).startsWith('trace')) counts.add++; return add(...a); };
    t.removeEventListener = (...a) => { if (String(a[1]?.name).startsWith('trace')) counts.remove++; return rm(...a); };
  }
  return { env: { window: win, document: doc, storage, store: createMemoryStore(), now: () => clockNow, clock: () => 1700000000000 + clockNow }, win, doc, counts, tick: (ms) => { clockNow += ms; } };
}

test('the recorder makes no network calls and keeps no identifying data', async () => {
  const calls = [];
  const saved = { fetch: globalThis.fetch, xhr: globalThis.XMLHttpRequest, nav: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  globalThis.fetch = () => { calls.push('fetch'); throw new Error('network'); };
  globalThis.XMLHttpRequest = function () { calls.push('xhr'); throw new Error('network'); };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon() { calls.push('beacon'); return false; }, userAgent: 'SECRET-UA' } });
  try {
    const f = fakeEnv();
    const { stop, session } = startSession(f.env);
    f.win.scrollY = 100; f.tick(50); f.win.dispatchEvent(new Event('scroll'));
    f.tick(20); f.doc.dispatchEvent(new Event('touchstart'));
    f.doc.visibilityState = 'hidden'; f.tick(5000); f.doc.dispatchEvent(new Event('visibilitychange'));
    f.win.innerHeight = 700; f.tick(10); f.win.dispatchEvent(new Event('resize'));
    f.doc.dispatchEvent(new Event('keydown'));
    stop();
    const text = JSON.stringify(exportPayload(await f.env.store.all()));
    assert.deepEqual(calls, []);
    assert.ok(session.events.length >= 5);
    assert.ok(!text.includes('SECRET-UA'));
    assert.ok(!/https?:|href|title|userAgent/i.test(text));
  } finally {
    globalThis.fetch = saved.fetch; globalThis.XMLHttpRequest = saved.xhr;
    if (saved.nav) Object.defineProperty(globalThis, 'navigator', saved.nav); else delete globalThis.navigator;
  }
});

test('the recorder source does not contain any network API', () => {
  const src = readFileSync(new URL('../src/diagnostics/scrollRecorder.js', import.meta.url), 'utf8')
    + readFileSync(new URL('../src/diagnostics/scrollSummary.js', import.meta.url), 'utf8');
  for (const word of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'userAgent', 'location.']) assert.ok(!src.includes(word), word);
});

test('attaches listeners only while running and removes every one on stop', () => {
  const f = fakeEnv();
  assert.equal(f.counts.add, 0);
  const { stop } = startSession(f.env);
  assert.ok(f.counts.add >= 10);
  stop();
  assert.equal(f.counts.remove, f.counts.add);
});

test('the switch lives in the local flag only', () => {
  const f = fakeEnv();
  assert.equal(isRecording(f.env.storage), false);
  setRecording(true, f.env);
  assert.equal(f.env.storage.getItem(FLAG_KEY), '1');
  assert.equal(isRecording(f.env.storage), true);
  setRecording(false, f.env);
  assert.equal(isRecording(f.env.storage), false);
});

test('events are capped and the session says so', () => {
  const f = fakeEnv();
  const { stop, session } = startSession(f.env);
  for (let i = 0; i < MAX_EVENTS + 10; i++) f.doc.dispatchEvent(new Event('keydown'));
  stop();
  assert.equal(session.events.length, MAX_EVENTS);
  assert.equal(session.truncated, true);
});

test('only the last five sessions are kept', async () => {
  const store = createMemoryStore();
  for (let i = 1; i <= 7; i++) await store.put({ id: i, events: [] });
  await store.prune(5);
  assert.deepEqual((await store.all()).map((s) => s.id), [3, 4, 5, 6, 7]);
});

function session(events, extra = {}) {
  return { id: 1, device: { innerHeight: 800, pointerCoarse: true }, firstInput: 'touch', events, durationMs: events.at(-1)?.[0] ?? 0, ...extra };
}

test('summary counts bursts, jumps, backward scrolls, away intervals and viewport changes', () => {
  const ev = [];
  // four full-screen jumps, each a burst, 2 s apart
  let y = 0;
  for (let k = 0; k < 4; k++) { const t = 1000 + k * 2000; for (let i = 0; i < 5; i++) { y += 120; ev.push([t + i * 50, 's', y, 9000]); } }
  // a small backward scroll
  ev.push([10000, 's', y - 80, 9000]);
  ev.push([12000, 'v', 1], [18000, 'v', 0]);   // hidden 6 s
  ev.push([20000, 'b'], [100000, 'f']);        // blurred 80 s
  ev.push([21000, 'h', 700, null, null, null]);
  const r = summarize([session(ev.sort((a, b) => a[0] - b[0]))]);
  assert.equal(r.bursts, 5);
  assert.equal(r.jumps, 4);
  assert.equal(r.backwardScrolls, 1);
  assert.equal(r.screenModeEntered, 1);
  assert.equal(r.visibility.under10s, 1);
  assert.equal(r.blur.over60s, 1);
  assert.equal(r.viewportChanges, 1);
  assert.equal(r.viewportLargestChange, 100);
  assert.ok(r.medianBetweenBurstsMs > 1000);
});

test('scroll dynamics: steady scrolling is smooth, back and forth is hunting', () => {
  const steady = Array.from({ length: 20 }, (_, i) => [i * 100, i * 20]);
  const hunt = Array.from({ length: 20 }, (_, i) => [i * 100, i % 2 ? 100 : 0]);
  assert.ok(dynamicsSubtypes(steady).every((s) => s === 'smooth'));
  assert.ok(dynamicsSubtypes(hunt).every((s) => s === 'hunting'));
});

test('summary of nothing does not throw', () => {
  const r = summarize([]);
  assert.equal(r.sessions, 0);
  assert.equal(r.jumpShare, null);
});
