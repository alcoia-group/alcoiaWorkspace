// The platform adapter for the vendored extension modules (public/detection/src, copied by
// scripts/sync-detection.mjs). Those modules were written for a browser extension and reach the browser through a
// small `chrome` surface: chrome.storage.local, chrome.storage.onChanged, chrome.runtime.getURL and
// chrome.runtime.sendMessage (to the extension's background script, which makes their server calls). This file
// supplies the same surface on a web page:
//
//   storage   localStorage, under the prefix below. One key is virtual: `sra_session` reads the workspace's own
//             session, so the modules see the signed-in account exactly as they would in the extension.
//   getURL    the vendored files' public path.
//   messages  the background script's actions, done here with a direct fetch: 'apiPost'/'summarize' send the
//             workspace session as Authorization: Bearer (the server accepts a session in place of an install
//             token on its reading AI routes), 'proxyFetch' passes the caller's request through. The install-token
//             request is answered locally with a placeholder, because the session is the credential here; the
//             anonymous evidence-pool counters report "off", because they are tied to an install, not an account.
//
// Nothing here decides anything: entitlement, consent and what is stored stay with the server.

export const STORAGE_PREFIX = 'alcoia_detection_';
const SESSION_KEY = 'sra_session';
export const PLACEHOLDER_INSTALL_TOKEN = 'workspace-session';

function read(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(key, value) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export function createPlatform({ apiBase, getSession, detectionBase = '/detection', openUrl = (u) => window.open(u, '_blank', 'noopener') }) {
  const listeners = new Set();
  const origin = new URL(apiBase).origin;

  function sessionValue() {
    const s = getSession();
    if (!s?.sessionToken) return undefined;
    const exp = s.expiresAt ? Date.parse(s.expiresAt) : NaN;
    return { token: s.sessionToken, email: s.email ?? '', expiresAt: Number.isFinite(exp) ? exp : Date.now() + 24 * 3600_000 };
  }

  function getOne(key) {
    return key === SESSION_KEY ? sessionValue() : read(key);
  }

  function notify(changes) {
    if (!Object.keys(changes).length) return;
    for (const fn of Array.from(listeners)) {
      try { fn(changes, 'local'); } catch { /* a listener's own failure */ }
    }
  }

  const local = {
    get(keys, cb) {
      const out = {};
      if (keys === null || keys === undefined) {
        // everything this page stored
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(STORAGE_PREFIX)) out[k.slice(STORAGE_PREFIX.length)] = read(k.slice(STORAGE_PREFIX.length));
        }
      } else if (typeof keys === 'string' || Array.isArray(keys)) {
        for (const k of [].concat(keys)) { const v = getOne(k); if (v !== undefined) out[k] = v; }
      } else {
        for (const [k, def] of Object.entries(keys)) { const v = getOne(k); out[k] = v === undefined ? def : v; }
      }
      const result = structuredClone(out);
      if (cb) queueMicrotask(() => cb(result));
      return Promise.resolve(result);
    },
    set(obj, cb) {
      const changes = {};
      for (const [k, v] of Object.entries(obj || {})) {
        if (k === SESSION_KEY) continue; // the workspace owns its session
        const oldValue = read(k);
        write(k, v);
        changes[k] = { oldValue, newValue: v };
      }
      queueMicrotask(() => { notify(changes); cb?.(); });
      return Promise.resolve();
    },
    remove(keys, cb) {
      const changes = {};
      for (const k of [].concat(keys)) {
        if (k === SESSION_KEY) continue;
        const oldValue = read(k);
        try { localStorage.removeItem(STORAGE_PREFIX + k); } catch { /* blocked */ }
        changes[k] = { oldValue, newValue: undefined };
      }
      queueMicrotask(() => { notify(changes); cb?.(); });
      return Promise.resolve();
    },
  };

  function authHeaders(extra = {}) {
    const s = sessionValue();
    return { ...extra, ...(s ? { Authorization: `Bearer ${s.token}` } : {}) };
  }

  async function handle(msg) {
    if (!msg || !msg.action) return undefined;
    if (msg.action === 'summarize' || msg.action === 'apiPost') {
      const url = msg.url || `${origin}/api/summarize`;
      if (!sessionValue()) return { ok: false, error: 'no_session' };
      try {
        const resp = await fetch(url, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(msg.body || {}) });
        if (!resp.ok) return { ok: false, status: resp.status };
        return { ok: true, data: await resp.json() };
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
    }
    if (msg.action === 'proxyFetch') {
      const url = String(msg.url || '');
      if (/\/api\/token\/?$/.test(new URL(url, origin).pathname)) {
        return { ok: true, status: 200, data: { token: PLACEHOLDER_INSTALL_TOKEN } };
      }
      if (/\/api\/pool\/status\/?$/.test(new URL(url, origin).pathname)) {
        return { ok: true, status: 200, data: { enabled: false } };
      }
      try {
        const options = { ...msg.options };
        if (/\/api\/sessions\/kinematics\/?$/.test(url)) options.keepalive = true; // sent as the page closes
        const resp = await fetch(url, options);
        const data = await resp.json().catch(() => null);
        return { ok: resp.ok, status: resp.status, data };
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
    }
    if (msg.action === 'openTab') {
      if (msg.url && /^https?:/i.test(msg.url)) openUrl(msg.url);
      return { status: 'ok' };
    }
    if (msg.action === 'saveNote') {
      const notes = read('sra_notes') || [];
      notes.unshift({ id: Date.now(), text: msg.note?.text || '', meta: msg.note?.meta || {} });
      write('sra_notes', notes.slice(0, 200));
      return { status: 'ok' };
    }
    return { status: 'ok' };
  }

  const runtime = {
    lastError: undefined,
    getURL: (p) => new URL(`${detectionBase}/${String(p).replace(/^\/+/, '')}`, window.location.origin).href,
    sendMessage(msg, cb) {
      const p = handle(msg);
      if (cb) p.then((r) => cb(r), () => cb(undefined));
      return p;
    },
    onMessage: { addListener() {}, removeListener() {} },
  };

  const chrome = {
    storage: {
      local,
      onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) },
    },
    runtime,
  };

  // Another workspace tab changed a stored value.
  const onStorageEvent = (e) => {
    if (!e.key?.startsWith(STORAGE_PREFIX)) return;
    let newValue;
    let oldValue;
    try { newValue = e.newValue === null ? undefined : JSON.parse(e.newValue); } catch { newValue = undefined; }
    try { oldValue = e.oldValue === null ? undefined : JSON.parse(e.oldValue); } catch { oldValue = undefined; }
    notify({ [e.key.slice(STORAGE_PREFIX.length)]: { oldValue, newValue } });
  };

  return { chrome, handle, onStorageEvent };
}

// Puts the adapter where the vendored modules look for it (the global `chrome`). The previous value, if the
// browser defines one on web pages, is restored by the returned function.
export function installPlatform(platform) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'chrome');
  const previous = globalThis.chrome;
  Object.defineProperty(globalThis, 'chrome', { value: platform.chrome, configurable: true, writable: true });
  window.addEventListener('storage', platform.onStorageEvent);
  return () => {
    window.removeEventListener('storage', platform.onStorageEvent);
    if (had) Object.defineProperty(globalThis, 'chrome', { value: previous, configurable: true, writable: true });
    else delete globalThis.chrome;
  };
}
