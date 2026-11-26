import { wordLayout } from './proveSkip.js';

// Where each group is offered, in the viewer's own terms: Word and EPUB by top-level block counted through the
// whole document, PDF by page. A group with a heading is offered right under it; one without is offered under the
// block just before its first question. Slides and anything unplaceable: no offer (never a banner).
// Returns { block: { [index]: group }, page: { [number]: group } }.
export function placeGroups(content, groups) {
  const out = { block: {}, page: {} };
  if (!content) return out;
  const layout = content.format === 'pdf' || content.format === 'pptx' ? null : wordLayout(content);
  for (const g of groups) {
    const at = g.at;
    if (!at) continue;
    if (content.format === 'pdf') {
      if (Number.isInteger(at.page) && at.page >= 1 && !out.page[at.page]) out.page[at.page] = g;
    } else if (layout && Number.isInteger(at.page) && Number.isInteger(at.block)) {
      const base = layout.offsets[at.page - 1];
      if (base === undefined) continue;
      const idx = g.heading ? base + at.block : Math.max(0, base + at.block - 1);
      if (!out.block[idx]) out.block[idx] = g;
    }
  }
  return out;
}

