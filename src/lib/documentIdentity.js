// DOCUMENT IDENTITY. Every file kept on this device has one. It is the thing that makes a document feel like
// the same document each time you come back to it, and it is small, plain and entirely on this device:
//
//   fingerprint  SHA-256 of the file's bytes. The same file is the same document whatever it is called or
//                wherever it came from, so a file added again (or on another device) is recognised.
//   overview     what the document is: pages or slides, words, the headings or slide titles.
//   position     where the reader got to (index of total, and the part), as lib/resume.js does for classes.
//   parts        per part (a page, a PDF page, a slide): time spent, how many times it was hard, when.
//   marks        NOT copied here: highlights, notes and drawings stay in lib/annotations.js and are read
//                when the identity is summarised or exported.
//   signature    HMAC-SHA256 over everything above, made with a key that never leaves this browser (a
//                non-extractable WebCrypto key). It shows the record is intact and was written by this
//                device, so a record edited by hand, damaged, or copied from another device is flagged
//                instead of trusted.
//
// Nothing here is sent to the server. A record of what each person read and where they struggled is a
// reading history, which alcoia's server is built not to hold. Keep this file's contents on the device.
import { getIdentityRecord, getMeta, putIdentityRecord, setMeta } from './localFiles.js';
import { loadMarks, saveMarks, scopeLabel } from './annotations.js';

export const IDENTITY_VERSION = 1;
const MAX_PARTS = 600;
const MAX_OUTLINE = 60;

// --- canonical form and signing --------------------------------------------------------------------

// Stable JSON: keys sorted, so the same record always produces the same bytes to sign.
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Where the device key is kept: IndexedDB in the browser. A test can swap in a memory store.
let keyStore = { get: () => getMeta('identity-key'), set: (v) => setMeta('identity-key', v) };
export function setKeyStore(store) { keyStore = store; }

// The device key. Created once, never exportable, kept in IndexedDB (a CryptoKey can be stored there as is).
async function deviceKey() {
  const stored = await keyStore.get();
  if (stored?.key) return stored;
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const keyId = hex(crypto.getRandomValues(new Uint8Array(6)).buffer);
  const record = { key, keyId };
  await keyStore.set(record);
  return record;
}

const unsigned = ({ sig, ...rest }) => rest; // eslint-disable-line no-unused-vars

export async function signIdentity(identity) {
  const { key, keyId } = await deviceKey();
  const body = { ...unsigned(identity), keyId };
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonicalJson(body)));
  return { ...body, sig: hex(mac) };
}

// 'signed' (written by this device and intact), 'foreign' (a valid-looking record this device did not sign:
// restored from an export), or 'invalid' (does not match its own signature).
export async function verifyIdentity(identity) {
  try {
    const { key, keyId } = await deviceKey();
    if (!identity?.sig) return 'invalid';
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonicalJson(unsigned(identity))));
    if (identity.keyId === keyId) return hex(mac) === identity.sig ? 'signed' : 'invalid';
    return 'foreign';
  } catch {
    return 'invalid';
  }
}

// --- what the document is -----------------------------------------------------------------------------

function textOfRuns(runs) {
  return (runs ?? []).map((r) => r.text ?? '').join('').replace(/\s+/g, ' ').trim();
}

// Words in a content model (the model the converter returns). A count only.
export function countWords(content) {
  const words = (s) => (s ? s.split(' ').filter(Boolean).length : 0);
  let n = 0;
  const walk = (blocks) => {
    for (const b of blocks ?? []) {
      if (b.type === 'paragraph' || b.type === 'heading') n += words(textOfRuns(b.runs));
      else if (b.type === 'list') for (const item of b.items ?? []) n += words(textOfRuns(item.runs));
      else if (b.type === 'table') for (const row of b.rows ?? []) for (const cell of row) walk(cell.blocks);
    }
  };
  if (content?.format === 'pptx') {
    for (const slide of content.slides ?? []) {
      for (const shape of slide.shapes ?? []) {
        if (shape.kind === 'text') for (const p of shape.paragraphs ?? []) n += words(textOfRuns(p.runs));
      }
    }
  } else if (content?.pages) {
    for (const page of content.pages) walk(page.blocks);
  }
  return n;
}

// The headings of a Word document (by page) or the titles of slides: where things are, not what they say.
export function buildOutline(content) {
  const out = [];
  if (content?.format === 'pptx') {
    (content.slides ?? []).forEach((slide, i) => {
      const first = (slide.shapes ?? []).find((s) => s.kind === 'text' && textOfRuns(s.paragraphs?.[0]?.runs));
      const label = first ? textOfRuns(first.paragraphs[0].runs).slice(0, 90) : '';
      if (label) out.push({ label, scope: `s:${i + 1}`, level: 1 });
    });
  } else if (content?.pages) {
    content.pages.forEach((page, i) => {
      for (const b of page.blocks ?? []) {
        if (b.type === 'heading') {
          const label = textOfRuns(b.runs).slice(0, 90);
          if (label) out.push({ label, scope: `d:${i + 1}`, level: Math.min(Math.max(Number(b.level) || 1, 1), 4) });
        }
      }
    });
  }
  return out.slice(0, MAX_OUTLINE);
}

export function buildOverview(content, wordCount) {
  const format = content?.format ?? null;
  const parts = format === 'pptx' ? (content.slides?.length ?? 0) : format === 'pdf' ? (content.pageCount ?? 0) : (content?.pages?.length ?? 0);
  const words = Number.isFinite(wordCount) ? wordCount : countWords(content) || null;
  return { kind: format === 'pptx' ? 'slides' : 'pages', parts, words, outline: buildOutline(content) };
}

export function newIdentity({ fingerprint, name, format, sizeBytes, content, wordCount, now = Date.now() }) {
  return {
    v: IDENTITY_VERSION,
    fingerprint,
    name,
    format,
    sizeBytes,
    addedAt: now,
    lastOpenedAt: now,
    overview: buildOverview(content, wordCount),
    position: null,
    parts: {},
  };
}

// --- what has happened in it (all of it kept on this device) -----------------------------------------

const blankPart = () => ({ timeMs: 0, hard: 0, slow: 0, lastAt: 0 });

function trimParts(parts) {
  const keys = Object.keys(parts);
  if (keys.length <= MAX_PARTS) return parts;
  const keep = keys.sort((a, b) => parts[b].lastAt - parts[a].lastAt).slice(0, MAX_PARTS);
  return Object.fromEntries(keep.map((k) => [k, parts[k]]));
}

// A pure update: the position and the per-part counters, from what the reader did.
export function applyActivity(identity, { position, dwell = {}, hard = {}, slow = {}, now = Date.now() }) {
  const parts = { ...identity.parts };
  const touch = (scope, f) => { parts[scope] = f({ ...blankPart(), ...parts[scope] }); parts[scope].lastAt = now; };
  for (const [scope, ms] of Object.entries(dwell)) touch(scope, (p) => ({ ...p, timeMs: p.timeMs + Math.max(0, Math.round(ms)) }));
  for (const [scope, n] of Object.entries(hard)) touch(scope, (p) => ({ ...p, hard: p.hard + n }));
  for (const [scope, n] of Object.entries(slow)) touch(scope, (p) => ({ ...p, slow: p.slow + n }));
  return {
    ...identity,
    lastOpenedAt: now,
    position: position ? { index: position.index, total: position.total, scope: position.scope ?? identity.position?.scope ?? null, at: now } : identity.position,
    parts: trimParts(parts),
  };
}

// What the card shows. marks comes from lib/annotations.js (loadMarks).
export function summarise(identity, marks = { items: [], strokes: [], stickies: [], notes: [] }) {
  const markCount = (scope) =>
    marks.items.filter((m) => m.scope === scope).length + (marks.stickies ?? []).filter((m) => m.scope === scope).length;
  const scopes = new Set([...Object.keys(identity.parts), ...marks.items.map((m) => m.scope), ...(marks.stickies ?? []).map((m) => m.scope)]);
  const rows = [...scopes].map((scope) => {
    const p = identity.parts[scope] ?? blankPart();
    const marksHere = markCount(scope);
    // Relevance is how much the reader worked with the part: being stuck counts most, then their own marks,
    // then time. It is a plain tally of what they did, not a judgement of the content.
    const score = p.hard * 3 + p.slow * 1.5 + marksHere * 2 + p.timeMs / 60000;
    return { scope, label: scopeLabel(scope), hard: p.hard, slow: p.slow, marks: marksHere, timeMs: p.timeMs, score };
  });
  const byScore = [...rows].sort((a, b) => b.score - a.score);
  const hardParts = rows.filter((r) => r.hard + r.slow > 0).sort((a, b) => b.hard * 3 + b.slow - (a.hard * 3 + a.slow)).slice(0, 5);
  const key = byScore.filter((r) => r.score > 0).slice(0, 5);
  const pos = identity.position;
  return {
    where: pos ? { index: pos.index, total: pos.total, percent: pos.total > 0 ? Math.round(((pos.index + 1) / pos.total) * 100) : null, scope: pos.scope } : null,
    hardParts,
    keyParts: key,
    hardCount: rows.filter((r) => r.hard > 0).length,
    marks: { highlights: marks.items.length, notes: (marks.notes ?? []).length + (marks.stickies ?? []).length, drawings: marks.strokes.length },
    timeMs: rows.reduce((n, r) => n + r.timeMs, 0),
  };
}

// --- saving, loading, recording -------------------------------------------------------------------------

// The identity of a stored file, created and signed if it does not exist yet.
export async function loadOrCreateIdentity({ id, record, content }) {
  const existing = await getIdentityRecord(id);
  if (existing?.identity) {
    return { identity: existing.identity, status: await verifyIdentity(existing.identity) };
  }
  const identity = await signIdentity(newIdentity({
    fingerprint: record.fingerprint, name: record.name, format: record.format, sizeBytes: record.size, content, wordCount: record.wordCount,
  }));
  await putIdentityRecord({ id, identity });
  return { identity, status: 'signed' };
}

export async function saveIdentity(id, identity) {
  const signed = await signIdentity(identity);
  await putIdentityRecord({ id, identity: signed });
  return signed;
}

// Collects what happens while a file is open and writes it (signed) every few seconds and when the page is
// left. Position is written as the viewer reports it; hard parts and time as the detection reports them.
export function createRecorder({ id, identity, flushMs = 4000 }) {
  let current = identity;
  let position = null;
  const dwell = {};
  const hard = {};
  const slow = {};
  let timer = null;
  let busy = Promise.resolve();
  let dirty = false;

  const flush = () => {
    if (!dirty) return busy;
    dirty = false;
    const batch = { position, dwell: { ...dwell }, hard: { ...hard }, slow: { ...slow } };
    for (const o of [dwell, hard, slow]) for (const k of Object.keys(o)) delete o[k];
    busy = busy.then(async () => {
      current = await saveIdentity(id, applyActivity(current, batch));
    }).catch(() => { /* storage blocked: the place is just not remembered */ });
    return busy;
  };
  const schedule = () => { dirty = true; if (!timer) timer = setTimeout(() => { timer = null; flush(); }, flushMs); };
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  schedule(); // opening a file is itself recorded (lastOpenedAt)

  return {
    position(index, total, scope) { position = { index, total, scope }; schedule(); },
    dwell(scope, ms) { if (scope && ms > 0) { dwell[scope] = (dwell[scope] ?? 0) + ms; schedule(); } },
    hard(scope) { if (scope) { hard[scope] = (hard[scope] ?? 0) + 1; schedule(); } },
    slow(scope) { if (scope) { slow[scope] = (slow[scope] ?? 0) + 1; schedule(); } },
    flush,
    get identity() { return current; },
    stop() {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      return flush();
    },
  };
}

// The part of the page a piece of text is in: the nearest drawn page or slide (data-anno-scope), found by the
// words themselves, since the detection reports text and a paragraph number but not where it is.
export function scopeOfText(text, root = document) {
  const needle = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 48);
  if (needle.length < 12) return null;
  for (const el of root.querySelectorAll('[data-anno-scope]')) {
    if ((el.textContent ?? '').replace(/\s+/g, ' ').includes(needle)) return el.dataset.annoScope;
  }
  return null;
}

// --- moving an identity to another device ------------------------------------------------------------------

export const EXPORT_KIND = 'alcoia-document-identity';

export function exportBundle(identity, docKey) {
  const { sig, keyId, ...rest } = identity; // eslint-disable-line no-unused-vars
  return { kind: EXPORT_KIND, v: IDENTITY_VERSION, exportedAt: Date.now(), identity: rest, marks: loadMarks(docKey) };
}

// Only for the SAME file: the fingerprint must match. Returns the new (re-signed) identity, or throws an Error
// whose message is a code: 'not_an_identity' | 'different_file'.
export async function importBundle({ id, docKey, current, bundle }) {
  if (!bundle || bundle.kind !== EXPORT_KIND || !bundle.identity || typeof bundle.identity !== 'object') throw new Error('not_an_identity');
  if (bundle.identity.fingerprint !== current.fingerprint) throw new Error('different_file');
  const merged = {
    ...current,
    position: bundle.identity.position ?? current.position,
    parts: trimParts(typeof bundle.identity.parts === 'object' && bundle.identity.parts ? bundle.identity.parts : current.parts),
    lastOpenedAt: Date.now(),
  };
  if (bundle.marks && Array.isArray(bundle.marks.items)) saveMarks(docKey, {
    items: bundle.marks.items, strokes: bundle.marks.strokes ?? [], stickies: bundle.marks.stickies ?? [], notes: bundle.marks.notes ?? [],
  });
  return saveIdentity(id, merged);
}
