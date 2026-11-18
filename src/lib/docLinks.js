// Links in documents. Web links open in a new tab (http, https and mailto only);
// links to another place in the same document move the reader there.

const SAFE_HREF = /^(https?:|mailto:)/i;
export const safeHref = (href) => (typeof href === 'string' && SAFE_HREF.test(href) ? href : null);

function collect(block, add) {
  for (const a of block.anchors ?? []) add(a);
  if (block.type === 'list') for (const item of block.items ?? []) for (const a of item.anchors ?? []) add(a);
  if (block.type === 'table') for (const row of block.rows ?? []) for (const cell of row) for (const b of cell.blocks ?? []) collect(b, add);
}

// Word and EPUB: each place name (a run's `anchor`) -> the index, through the whole document,
// of the top-level block that holds it, plus its page (0-based) as a fallback.
export function anchorIndex(pages, offsets) {
  const map = new Map();
  (pages ?? []).forEach((page, p) => {
    (page.blocks ?? []).forEach((block, i) => {
      collect(block, (name) => { if (!map.has(name)) map.set(name, { block: (offsets?.[p] ?? 0) + i, page: p }); });
    });
  });
  return map;
}

const NAMED = { NextPage: 1, PrevPage: -1, FirstPage: 'first', LastPage: 'last' };

// A pdf.js link annotation -> { href } (a web link), { dest } (a place in the file, resolved
// on click), { page } (a named action), or null (anything else: launch, JavaScript, files).
export function pdfLinkTarget(annot, { page, pageCount }) {
  if (!annot || annot.subtype !== 'Link' || !Array.isArray(annot.rect)) return null;
  const href = safeHref(annot.url);
  if (href) return { href };
  if (annot.url || annot.unsafeUrl) return null;
  if (annot.dest) return { dest: annot.dest };
  const step = NAMED[annot.action];
  if (step === undefined) return null;
  const n = step === 'first' ? 1 : step === 'last' ? pageCount : page + step;
  return n >= 1 && n <= pageCount ? { page: n } : null;
}

// A destination (a name or pdf.js's explicit array) -> a 1-based page number, or null.
export async function resolvePdfDest(pdf, dest) {
  try {
    const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    const ref = Array.isArray(explicit) ? explicit[0] : null;
    if (Number.isInteger(ref)) return ref + 1;
    if (ref && typeof ref === 'object') return (await pdf.getPageIndex(ref)) + 1;
  } catch {
    // a broken destination goes nowhere
  }
  return null;
}
