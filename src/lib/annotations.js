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
    if (raw && raw.v === 1) return { items: raw.items ?? [], strokes: raw.strokes ?? [] };
  } catch { /* unreadable: start empty */ }
  return { items: [], strokes: [] };
}

export function saveMarks(docKey, marks) {
  try {
    if (marks.items.length === 0 && marks.strokes.length === 0) localStorage.removeItem(KEY(docKey));
    else localStorage.setItem(KEY(docKey), JSON.stringify({ v: 1, ...marks }));
    return true;
  } catch { return false; }
}

// A plain-text (Markdown) copy of the reader's marks, to keep outside the app.
export function marksToMarkdown(title, items) {
  const sorted = [...items].sort((a, b) => scopeOrder(a.scope) - scopeOrder(b.scope) || a.start - b.start);
  const lines = [`# Notes on ${title}`, ''];
  let last = null;
  for (const it of sorted) {
    if (it.scope !== last) { lines.push(`## ${scopeLabel(it.scope)}`, ''); last = it.scope; }
    lines.push(`> ${it.quote.replace(/\s+/g, ' ')}`, '');
    lines.push(`*${KIND_LABEL[it.kind] ?? 'Mark'}, ${COLORS[it.color]?.name ?? ''}*`.replace(', *', '*'), '');
    if (it.note) lines.push(it.note, '');
  }
  return lines.join('\n');
}
