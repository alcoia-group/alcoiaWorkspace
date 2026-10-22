// Local-only scroll trace recorder, for tuning detection on phones.
//
// Everything stays on this device: nothing here calls the network, and the only way data leaves is the
// person pressing Download or Share in Settings. It records how the page was scrolled and what happened
// around it (visibility, focus, size changes, touch and wheel markers). It never records text, the URL,
// the document, the title, the user agent or any identifier. A key press is noted as "a key", never which.
//
// The recorder attaches passive listeners only while a session is running, and a session only runs when
// the on-device switch is on. It never touches the detector.

export const FLAG_KEY = 'alcoia_scroll_recording';
export const MAX_EVENTS = 50000;
export const MAX_SESSIONS = 5;
export const CHANGE_EVENT = 'alcoia-scroll-recording';
const SAVE_EVERY_MS = 4000;

// Event shapes. The first item is ms since the session started, the second a short code.
//   [t, 's', y, scrollHeight]            scroll
//   [t, 'h', innerHeight, vvHeight, vvScale, vvOffsetTop]   viewport size changed
//   [t, 'r', innerWidth, innerHeight]    resize
//   [t, 'o']                             orientation change
//   [t, 'v', hidden(1|0)]                visibility change
//   [t, 'b'] / [t, 'f']                  window blur / focus
//   [t, 'ts'] / [t, 'tm'] / [t, 'te', dyBucket]   touch start, first move, end (bucket -4..4 of 50 px steps)
//   [t, 'pd'] / [t, 'w'] / [t, 'k']      pointer down, wheel, a key was pressed
export const CODES = Object.freeze({ scroll: 's', viewport: 'h', resize: 'r', orientation: 'o', visibility: 'v', blur: 'b', focus: 'f', touchStart: 'ts', touchMove: 'tm', touchEnd: 'te', pointerDown: 'pd', wheel: 'w', key: 'k' });

export function isRecording(storage = safeStorage()) {
  try { return storage?.getItem(FLAG_KEY) === '1'; } catch { return false; }
}

export function setRecording(on, env = defaultEnv()) {
  try {
    if (on) env.storage?.setItem(FLAG_KEY, '1'); else env.storage?.removeItem(FLAG_KEY);
  } catch { /* storage blocked: the switch simply does not stick */ }
  try { env.window?.dispatchEvent(new env.window.CustomEvent(CHANGE_EVENT)); } catch { /* ignore */ }
}

function safeStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function defaultEnv() {
  return {
    window: typeof window === 'undefined' ? null : window,
    document: typeof document === 'undefined' ? null : document,
    storage: safeStorage(),
    store: createIdbStore(),
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    clock: () => Date.now(),
  };
}

function bucket(dy) {
  const b = Math.min(4, Math.ceil(Math.abs(dy) / 50));
  return dy < 0 ? -b : b;
}

function deviceFacts(w) {
  const mm = (q) => { try { return !!w.matchMedia?.(q).matches; } catch { return false; } };
  return {
    pointerCoarse: mm('(pointer: coarse)'),
    pointerFine: mm('(pointer: fine)'),
    hoverNone: mm('(hover: none)'),
    orientation: mm('(orientation: portrait)') ? 'portrait' : 'landscape',
    devicePixelRatio: w.devicePixelRatio ?? 1,
    screenWidth: w.screen?.width ?? null,
    screenHeight: w.screen?.height ?? null,
    innerWidth: w.innerWidth,
    innerHeight: w.innerHeight,
    // Pinch zoom and a page wider than the screen both change what the page thinks the viewport is.
    visualViewportWidth: w.visualViewport ? Math.round(w.visualViewport.width) : null,
    visualViewportScale: w.visualViewport ? w.visualViewport.scale : null,
    pageScrollWidth: w.document?.documentElement?.scrollWidth ?? null,
  };
}

// Starts one session and returns { stop, session }. Listener functions are named "trace..." so a test can
// tell them apart from every other listener on the page.
export function startSession(env = defaultEnv()) {
  const w = env.window;
  const d = env.document;
  if (!w || !d) return { stop() {}, session: null };

  const t0 = env.now();
  const startedAt = env.clock();
  const session = {
    id: startedAt,
    startedAt: new Date(startedAt).toISOString(),
    device: deviceFacts(w),
    firstInput: null, // 'touch' | 'mouse' | 'wheel'
    events: [],
    truncated: false,
    durationMs: 0,
  };
  let dirty = true;
  let touchY0 = null;
  let touchMoved = false;
  let lastIH = w.innerHeight;
  let lastVV = vvKey(w);
  const vv = w.visualViewport || null;

  const at = () => Math.round(env.now() - t0);
  function push(ev) {
    if (session.events.length >= MAX_EVENTS) { session.truncated = true; return; }
    session.events.push(ev);
    session.durationMs = ev[0];
    dirty = true;
  }
  function vvKey(win) {
    const v = win.visualViewport;
    return v ? `${Math.round(v.height)}|${v.scale}|${Math.round(v.offsetTop)}` : '';
  }
  function noteViewport() {
    const key = vvKey(w);
    if (w.innerHeight === lastIH && key === lastVV) return;
    lastIH = w.innerHeight; lastVV = key;
    const v = w.visualViewport;
    push([at(), 'h', w.innerHeight, v ? Math.round(v.height) : null, v ? v.scale : null, v ? Math.round(v.offsetTop) : null]);
  }
  function first(kind) { if (!session.firstInput) session.firstInput = kind; }

  const traceScroll = () => {
    push([at(), 's', Math.round(w.scrollY), d.documentElement?.scrollHeight ?? null]);
    noteViewport();
  };
  const traceResize = () => { push([at(), 'r', w.innerWidth, w.innerHeight]); noteViewport(); };
  const traceViewport = () => noteViewport();
  const traceOrientation = () => push([at(), 'o']);
  const traceVisibility = () => { push([at(), 'v', d.visibilityState === 'hidden' ? 1 : 0]); if (d.visibilityState === 'hidden') save(); };
  const traceBlur = () => push([at(), 'b']);
  const traceFocus = () => push([at(), 'f']);
  const traceTouchStart = (e) => {
    first('touch');
    touchY0 = e.touches?.[0]?.clientY ?? null; touchMoved = false;
    push([at(), 'ts']);
  };
  const traceTouchMove = (e) => {
    if (touchMoved) return;
    touchMoved = true;
    push([at(), 'tm']);
    touchY0 = touchY0 ?? e.touches?.[0]?.clientY ?? null;
  };
  const traceTouchEnd = (e) => {
    const y1 = e.changedTouches?.[0]?.clientY;
    const dy = touchY0 != null && y1 != null ? y1 - touchY0 : 0;
    push([at(), 'te', bucket(dy)]);
    touchY0 = null;
  };
  const tracePointerDown = () => push([at(), 'pd']);
  const traceWheel = () => { first('wheel'); push([at(), 'w']); };
  const traceKey = () => push([at(), 'k']);
  const traceMouseMove = () => { first('mouse'); d.removeEventListener('mousemove', traceMouseMove); };

  const passive = { passive: true };
  const capture = { passive: true, capture: true };
  const targets = [
    [w, 'scroll', traceScroll, capture],
    [w, 'resize', traceResize, passive],
    [w, 'orientationchange', traceOrientation, passive],
    [d, 'visibilitychange', traceVisibility, passive],
    [w, 'blur', traceBlur, passive],
    [w, 'focus', traceFocus, passive],
    [d, 'touchstart', traceTouchStart, capture],
    [d, 'touchmove', traceTouchMove, capture],
    [d, 'touchend', traceTouchEnd, capture],
    [d, 'pointerdown', tracePointerDown, capture],
    [d, 'wheel', traceWheel, capture],
    [d, 'keydown', traceKey, capture],
    [d, 'mousemove', traceMouseMove, passive],
  ];
  if (vv) targets.push([vv, 'resize', traceViewport, passive]);
  for (const [t, type, fn, opt] of targets) t.addEventListener(type, fn, opt);

  let timer = null;
  function save() {
    if (!dirty || !session.events.length) return; // a session with nothing in it is not kept
    dirty = false;
    try { Promise.resolve(env.store.put(session)).catch(() => {}); } catch { /* storage unavailable */ }
  }
  timer = env.window.setInterval ? env.window.setInterval(save, SAVE_EVERY_MS) : null;
  const pagehide = function tracePageHide() { save(); };
  w.addEventListener('pagehide', pagehide, passive);
  save();

  function stop() {
    for (const [t, type, fn, opt] of targets) t.removeEventListener(type, fn, opt);
    w.removeEventListener('pagehide', pagehide, passive);
    if (timer != null) w.clearInterval(timer);
    dirty = true;
    save();
    Promise.resolve(env.store.prune?.(MAX_SESSIONS)).catch(() => {});
  }
  return { stop, session };
}

// ---- storage: IndexedDB, with a memory fallback when it is blocked ----

export function createMemoryStore() {
  const rows = new Map();
  return {
    async put(s) { rows.set(s.id, JSON.parse(JSON.stringify(s))); },
    async all() { return [...rows.values()].sort((a, b) => a.id - b.id); },
    async clear() { rows.clear(); },
    async prune(n) { const ids = [...rows.keys()].sort((a, b) => a - b); while (ids.length > n) rows.delete(ids.shift()); },
  };
}

export function createIdbStore() {
  const memory = createMemoryStore();
  if (typeof indexedDB === 'undefined') return memory;
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        let req;
        try { req = indexedDB.open('alcoia_scroll_traces', 1); } catch (e) { reject(e); return; }
        req.onupgradeneeded = () => req.result.createObjectStore('sessions', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction('sessions', mode);
      const out = fn(t.objectStore('sessions'));
      t.oncomplete = () => resolve(out?.result);
      t.onerror = () => reject(t.error);
    });
  }
  const guard = (fn, fallback) => async (...a) => { try { return await fn(...a); } catch { return fallback(...a); } };
  return {
    put: guard((s) => tx('readwrite', (st) => st.put(s)), (s) => memory.put(s)),
    all: guard(async () => {
      const d = await db();
      return new Promise((resolve, reject) => {
        const r = d.transaction('sessions').objectStore('sessions').getAll();
        r.onsuccess = () => resolve(r.result.sort((a, b) => a.id - b.id));
        r.onerror = () => reject(r.error);
      });
    }, () => memory.all()),
    clear: guard(() => tx('readwrite', (st) => st.clear()), () => memory.clear()),
    prune: guard(async (n) => {
      const d = await db();
      const keys = await new Promise((resolve, reject) => {
        const r = d.transaction('sessions').objectStore('sessions').getAllKeys();
        r.onsuccess = () => resolve(r.result.sort((a, b) => a - b));
        r.onerror = () => reject(r.error);
      });
      const drop = keys.slice(0, Math.max(0, keys.length - n));
      if (drop.length) await tx('readwrite', (st) => drop.forEach((k) => st.delete(k)));
    }, (n) => memory.prune(n)),
  };
}

export async function loadSessions(env = defaultEnv()) {
  try { return await env.store.all(); } catch { return []; }
}
export async function clearSessions(env = defaultEnv()) {
  try { await env.store.clear(); } catch { /* nothing to clear */ }
}

// What gets downloaded: the sessions as recorded. No URL, text, user agent or identifier is in them.
export function exportPayload(sessions) {
  return { format: 'alcoia-scroll-trace-v1', note: 'Recorded on this device only. Event codes are described in scrollRecorder.js.', sessions };
}
