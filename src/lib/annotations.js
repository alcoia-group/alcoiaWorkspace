// Marks the reader makes on a document: highlights, underlines, strike-throughs, notes and pen
// strokes. They live ONLY on this device (localStorage), never on the server: the server is built
// not to hold what a person reads or thinks about it.
//
// Text marks are anchored by quotation, not by position in the page: each one stores the scope it
// is in (a Word page, a PDF page, a slide), the character offsets inside that scope's text, the
// quoted text and a little text either side. When the page is drawn again the mark is found by its
// offsets, or by its quote if the page has shifted. A mark whose text cannot be found is kept (it
// still shows in the list) but not drawn.

export const COLORS = {
  yellow: { name: 'Yellow', fill: 'rgba(255, 214, 10, 0.45)', solid: '#d4a500' },
  green: { name: 'Green', fill: 'rgba(52, 199, 89, 0.38)', solid: '#1f9d45' },
  blue: { name: 'Blue', fill: 'rgba(10, 132, 255, 0.32)', solid: '#1769d1' },
  pink: { name: 'Pink', fill: 'rgba(255, 105, 180, 0.38)', solid: '#d6336c' },
  orange: { name: 'Orange', fill: 'rgba(255, 149, 0, 0.40)', solid: '#d9730d' },
  purple: { name: 'Purple', fill: 'rgba(175, 82, 222, 0.34)', solid: '#8e44ad' },
};
export const COLOR_KEYS = Object.keys(COLORS);

// A colour is a preset name (yellow, green, ...) or a custom '#rrggbb'. Marks made before custom
// colours existed only hold preset names, so they keep working. Anything else falls back to yellow.
export const HEX_RE = /^#[0-9a-f]{6}$/i;
const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const isCustomColor = (key) => typeof key === 'string' && HEX_RE.test(key);

export function resolveColor(key) {
  if (COLORS[key]) return COLORS[key];
  if (!isCustomColor(key)) return COLORS.yellow;
  const [r, g, b] = [0, 1, 2].map((i) => channel(key, i));
  return {
    name: key.toUpperCase(),
    fill: `rgba(${r}, ${g}, ${b}, 0.40)`,
    // Lines and pen strokes use a slightly darker shade so they read on white paper.
    solid: `#${toHex(r * 0.78)}${toHex(g * 0.78)}${toHex(b * 0.78)}`,
  };
}

// The name used in CSS highlight rules: a preset name, or x + the six hex digits.
export const colorToken = (key) => (COLORS[key] ? key : isCustomColor(key) ? `x${key.slice(1).toLowerCase()}` : 'yellow');

// Custom colours need their own ::highlight rules, written once into a style element the first
// time a colour is used. Only validated hex values ever reach the rule text.
const customTokens = new Set();
let customSheet = null;
export function registerColor(key) {
  const token = colorToken(key);
  if (COLORS[token] || customTokens.has(token)) return token;
  customTokens.add(token);
  if (typeof document === 'undefined') return token;
  const c = resolveColor(key);
  if (!customSheet) {
    customSheet = document.createElement('style');
    customSheet.id = 'alc-custom-highlights';
    document.head.appendChild(customSheet);
  }
  customSheet.appendChild(document.createTextNode(
    `::highlight(alc-hl-${token}) { background-color: ${c.fill}; }\n`
    + `::highlight(alc-ul-${token}) { text-decoration: underline; text-decoration-color: ${c.solid}; text-decoration-thickness: 2px; }\n`
    + `::highlight(alc-wv-${token}) { text-decoration: underline wavy; text-decoration-color: ${c.solid}; text-decoration-thickness: 1.5px; }\n`
    + `::highlight(alc-st-${token}) { text-decoration: line-through; text-decoration-color: ${c.solid}; text-decoration-thickness: 2px; }\n`,
  ));
  return token;
}
export const highlightNames = () => ['hl', 'ul', 'wv', 'st'].flatMap((k) => [...COLOR_KEYS, ...customTokens].map((c) => `alc-${k}-${c}`));

// The reader's choice (and the custom colours they made) stay on this device.
const COLOR_PREF_KEY = 'alcoia_highlight_color';
const RECENT_KEY = 'alcoia_recent_colors';
export const RECENT_MAX = 6;
export function loadColorChoice() {
  try {
    const v = localStorage.getItem(COLOR_PREF_KEY);
    return COLORS[v] || isCustomColor(v) ? v : 'yellow';
  } catch { return 'yellow'; }
}
export function saveColorChoice(v) { try { localStorage.setItem(COLOR_PREF_KEY, v); } catch { /* storage blocked: lasts this visit */ } }
export function loadRecentColors() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isCustomColor).slice(0, RECENT_MAX) : [];
  } catch { return []; }
}
export function rememberColor(list, hex) {
  const next = [hex.toLowerCase(), ...list.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
// kind: hl = highlight, ul = underline, wv = wavy underline, st = strike-through
export const TEXT_KINDS = ['hl', 'ul', 'wv', 'st'];
export const KIND_LABEL = { hl: 'Highlight', ul: 'Underline', wv: 'Wavy underline', st: 'Strike-through' };

export function highlightsSupported() {
  return typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function scopeLabel(scope) {
  const [k, n] = String(scope).split(':');
  return k === 's' ? `Slide ${n}` : `Page ${n}`;
}

export function scopeOrder(scope) {
  return Number(String(scope).split(':')[1]) || 0;
}

// --- text in a scope ---------------------------------------------------------------------------

function textNodesOf(scopeEl) {
  const out = [];
  const walker = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('button, svg, [data-anno-skip]')) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) out.push(walker.currentNode);
  return out;
}

export function scopeText(scopeEl) {
  return textNodesOf(scopeEl).map((n) => n.nodeValue).join('');
}

function offsetOf(nodes, node, offset) {
  const pos = document.createRange();
  pos.setStart(node, offset);
  pos.collapse(true);
  let acc = 0;
  for (const n of nodes) {
    let c0; let c1;
    try { c0 = pos.comparePoint(n, 0); c1 = pos.comparePoint(n, n.nodeValue.length); } catch { continue; }
    if (c1 < 0) { acc += n.nodeValue.length; continue; }
    if (c0 > 0) break;
    acc += n === node ? offset : (c1 === 0 ? n.nodeValue.length : 0);
    break;
  }
  return acc;
}

function pointAt(nodes, offset) {
  let acc = 0;
  for (const n of nodes) {
    const len = n.nodeValue.length;
    if (offset <= acc + len) return { node: n, offset: offset - acc };
    acc += len;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.nodeValue.length } : null;
}

export function rangeFromOffsets(scopeEl, start, end, nodes = textNodesOf(scopeEl)) {
  const a = pointAt(nodes, start);
  const b = pointAt(nodes, end);
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  return r;
}

// The piece of a selection inside one scope, as an anchor, or null.
export function anchorFromSelection(selRange, scopeEl, context = 32) {
  if (!selRange.intersectsNode(scopeEl)) return null;
  const nodes = textNodesOf(scopeEl);
  const text = nodes.map((n) => n.nodeValue).join('');
  const whole = document.createRange();
  whole.selectNodeContents(scopeEl);
  const start = selRange.compareBoundaryPoints(Range.START_TO_START, whole) < 0
    ? 0 : offsetOf(nodes, selRange.startContainer, selRange.startOffset);
  const end = selRange.compareBoundaryPoints(Range.END_TO_END, whole) > 0
    ? text.length : offsetOf(nodes, selRange.endContainer, selRange.endOffset);
  if (end <= start) return null;
  let s = start; let e = end;
  while (s < e && /\s/.test(text[s])) s += 1;
  while (e > s && /\s/.test(text[e - 1])) e -= 1;
  if (e <= s) return null;
  return {
    start: s,
    end: e,
    quote: text.slice(s, e),
    prefix: text.slice(Math.max(0, s - context), s),
    suffix: text.slice(e, e + context),
  };
}

function commonSuffixLen(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}
function commonPrefixLen(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

// Where an anchor sits in the scope's text now: [start, end] or null.
export function resolveAnchor(a, text) {
  if (text.slice(a.start, a.end) === a.quote) return [a.start, a.end];
  let best = null; let bestScore = -1;
  let from = 0;
  for (;;) {
    const i = text.indexOf(a.quote, from);
    if (i < 0) break;
    const score = commonSuffixLen(a.prefix, text.slice(Math.max(0, i - a.prefix.length), i))
      + commonPrefixLen(a.suffix, text.slice(i + a.quote.length, i + a.quote.length + a.suffix.length));
    if (score > bestScore) { best = i; bestScore = score; }
    from = i + 1;
  }
  return best === null ? null : [best, best + a.quote.length];
}

// The scope element and character offset under a point on screen.
export function caretAtPoint(x, y) {
  let node = null; let offset = 0;
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  if (!node) return null;
  const el = node.nodeType === 1 ? node : node.parentElement;
  const scopeEl = el?.closest?.('[data-anno-scope]');
  if (!scopeEl) return null;
  return { scopeEl, offset: offsetOf(textNodesOf(scopeEl), node, offset) };
}

// --- storage -----------------------------------------------------------------------------------

const KEY = (docKey) => `alcoia_workspace_marks_${docKey}`;

export function loadMarks(docKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(docKey)) ?? 'null');
    if (raw && raw.v === 1) {
      return { items: raw.items ?? [], strokes: raw.strokes ?? [], stickies: raw.stickies ?? [], notes: raw.notes ?? [] };
    }
  } catch { /* unreadable: start empty */ }
  return { items: [], strokes: [], stickies: [], notes: [] };
}

export function saveMarks(docKey, marks) {
  try {
    const empty = marks.items.length + marks.strokes.length + (marks.stickies?.length ?? 0) + (marks.notes?.length ?? 0) === 0;
    if (empty) localStorage.removeItem(KEY(docKey));
    else localStorage.setItem(KEY(docKey), JSON.stringify({ v: 1, ...marks }));
    return true;
  } catch { return false; }
}

export const NOTE_MAX = 2000;
export const clamp01 = (n) => Math.min(1, Math.max(0, n));

// A plain-text (Markdown) copy of the reader's marks, to keep outside the app. Sticky notes sit
// under their page or slide; free notes come last.
export function marksToMarkdown(title, items, extra = {}) {
  const stickies = extra.stickies ?? [];
  const notes = extra.notes ?? [];
  const rows = [
    ...items.map((it) => ({ type: 'mark', scope: it.scope, pos: it.start, it })),
    ...stickies.map((st) => ({ type: 'sticky', scope: st.scope, pos: -1 + st.y / 10, it: st })),
  ].sort((a, b) => scopeOrder(a.scope) - scopeOrder(b.scope) || a.pos - b.pos);
  const lines = [`# Notes on ${title}`, ''];
  let last = null;
  for (const r of rows) {
    if (r.scope !== last) { lines.push(`## ${scopeLabel(r.scope)}`, ''); last = r.scope; }
    if (r.type === 'sticky') {
      lines.push(`*Sticky note, ${Math.round(r.it.y * 100)}% down the page*`, '', r.it.text || '(empty)', '');
      continue;
    }
    const it = r.it;
    lines.push(`> ${it.quote.replace(/\s+/g, ' ')}`, '');
    lines.push(`*${KIND_LABEL[it.kind] ?? 'Mark'}, ${resolveColor(it.color).name}*`.replace(', *', '*'), '');
    if (it.note) lines.push(it.note, '');
  }
  if (notes.length) {
    lines.push('## Notes', '');
    for (const n of notes) lines.push(n.text || '(empty)', '');
  }
  return lines.join('\n');
}
