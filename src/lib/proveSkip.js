// "Prove it to skip". A reader who already knows the part they are on can answer a few questions
// about it; if every answer is right the workspace scrolls straight to the next part. It is the
// reader's own convenience: nothing is scored, recorded, reported or sent to anyone, and it never
// hides anything (unlike core/optional marks, which the instructor sets).
//
// Works on every format. What differs is only how a question is placed in the document and where
// "the next part" is:
//   PDF   place = page (server: item.page)          next = the page after the last question's page
//   Slide place = slide (item.slide)                next = the slide after the last question's slide
//   Word  place = top-level block counted through   next = the next heading after the last question
//         the whole document (item.page + item.block), or the block after it when no heading follows
//
// A "stretch" starts at the place in view and runs forward until it holds enough questions to say
// something real (MIN_QUESTIONS), within maxSpan. Too few questions in range means no offer at all,
// rather than a skip earned on one lucky answer.
//
// Questions the reader already met are remembered on this device only (SEEN): a right answer in the
// "Before you read" warm-up counts toward the part it belongs to (head start), a wrong one closes it,
// and a question is never asked twice. At least one question is always asked fresh, so a skip is
// never granted by the warm-up alone.
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 4;

const PAGE_SPAN = 6;
const BLOCK_SPAN = 40;

export function pdfConfig(pageCount) {
  return {
    kind: 'page',
    ordOf: (it) => (Number.isInteger(it.page) ? it.page : null),
    maxSpan: PAGE_SPAN,
    targetOf: (end) => (end + 1 <= pageCount ? end + 1 : null),
    range: (a, b) => (a === b ? `page ${a}` : `pages ${a} to ${b}`),
    goesTo: (t) => `page ${t}`,
  };
}

export function slideConfig(slideCount) {
  return {
    kind: 'slide',
    ordOf: (it) => (Number.isInteger(it.slide) ? it.slide : null),
    maxSpan: PAGE_SPAN,
    targetOf: (end) => (end + 1 <= slideCount ? end + 1 : null),
    range: (a, b) => (a === b ? `slide ${a}` : `slides ${a} to ${b}`),
    goesTo: (t) => `slide ${t}`,
  };
}

// Word: a block's place is its index counted through the whole document, so the same number works
// in one long page or many. `blocks` and `headings` describe the document's top-level blocks.
export function wordLayout(content) {
  const offsets = [];
  const headings = [];
  let total = 0;
  for (const page of content?.pages ?? []) {
    offsets.push(total);
    for (const b of page.blocks ?? []) {
      if (b.type === 'heading') headings.push(total);
      total += 1;
    }
  }
  return { offsets, headings, total };
}

export function wordConfig(layout) {
  return {
    kind: 'block',
    ordOf: (it) => (Number.isInteger(it.page) && Number.isInteger(it.block) && layout.offsets[it.page - 1] !== undefined ? layout.offsets[it.page - 1] + it.block : null),
    maxSpan: BLOCK_SPAN,
    targetOf: (end) => {
      const heading = layout.headings.find((h) => h > end);
      if (heading !== undefined) return heading;
      return end + 1 < layout.total ? end + 1 : null;
    },
    range: () => 'this part',
    goesTo: (t) => (layout.headings.includes(t) ? 'the next section' : 'the next part'),
  };
}

function pick(items, start, cfg, excluded) {
  const placed = [];
  for (const it of items ?? []) {
    const ord = cfg.ordOf(it);
    if (ord === null || ord < start || excluded(it)) continue;
    placed.push({ it, ord });
  }
  placed.sort((a, b) => a.ord - b.ord || (a.it.paragraph ?? 0) - (b.it.paragraph ?? 0));
  const chosen = [];
  for (const p of placed) {
    if (p.ord - start >= cfg.maxSpan) break;
    chosen.push(p);
    if (chosen.length >= MAX_QUESTIONS) break;
  }
  return chosen;
}

// The offer for the part in view, or null for no offer. `seen` maps item id -> 'c' (answered right),
// 'w' (answered wrong) or 'x' (closed by a missed attempt).
// Returns { start, end, target, items (all in the stretch), fresh (to ask now), proved (already right),
//           tried (this part was closed: show it disabled), range, goesTo }.
export function stretchFrom(items, start, cfg, seen = {}) {
  const raw = pick(items, start, cfg, () => false);
  if (raw.length < MIN_QUESTIONS) return null;
  const closed = (id) => seen[id] === 'w' || seen[id] === 'x';
  const tried = closed(raw[0].it.id);
  // A closed part is shown disabled; otherwise the offer is made from the questions still open.
  const basis = tried ? raw : pick(items, start, cfg, (it) => closed(it.id));
  if (basis.length < MIN_QUESTIONS) return null;
  const end = basis[basis.length - 1].ord;
  const target = cfg.targetOf(end);
  if (target === null) return null;
  const list = basis.map((p) => p.it);
  const fresh = tried ? list : list.filter((it) => seen[it.id] !== 'c');
  if (fresh.length < 1) return null;
  return {
    start: basis[0].ord,
    end,
    target,
    items: list,
    fresh,
    proved: list.length - fresh.length,
    tried,
    range: cfg.range(basis[0].ord, end),
    goesTo: cfg.goesTo(target),
  };
}

const KEY = (id) => `alcoia_workspace_seen_${id}`;
export function readSeen(id) {
  try { return JSON.parse(localStorage.getItem(KEY(id)) ?? '{}') || {}; } catch { return {}; }
}
// Device only. Capped so a long-lived reading cannot grow it without bound.
export function markSeen(id, itemId, mark) {
  try {
    const seen = readSeen(id);
    seen[itemId] = mark;
    const keys = Object.keys(seen);
    if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete seen[k];
    localStorage.setItem(KEY(id), JSON.stringify(seen));
  } catch { /* storage unavailable */ }
  try { window.dispatchEvent(new Event('alcoia:seen')); } catch { /* no window */ }
}
