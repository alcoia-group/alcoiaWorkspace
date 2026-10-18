// "Prove it to skip" (PDFs only). A reader who already knows the part they are on can answer a few
// questions about it; if every answer is right the workspace scrolls straight to the next part.
// It is the reader's own convenience: nothing is scored, recorded, reported or sent to anyone, and
// it never hides a page (unlike core/optional marks, which the instructor sets).
//
// A "stretch" starts at the page in view and runs forward until it holds enough questions to say
// something real (MIN_QUESTIONS), within MAX_PAGES. The skip lands on the page after the stretch.
// Too few questions in range means no offer at all, rather than a skip earned on one lucky answer.
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 4;
export const MAX_PAGES = 6;

export function stretchFrom(items, startPage, pageCount) {
  const onPdf = (items ?? []).filter((it) => Number.isInteger(it.page) && it.page >= startPage && it.page <= pageCount);
  onPdf.sort((a, b) => a.page - b.page || a.paragraph - b.paragraph);
  const chosen = [];
  for (const it of onPdf) {
    if (it.page - startPage >= MAX_PAGES) break;
    chosen.push(it);
    if (chosen.length >= MAX_QUESTIONS) break;
  }
  if (chosen.length < MIN_QUESTIONS) return null;
  const endPage = chosen[chosen.length - 1].page;
  const nextPage = endPage + 1;
  if (nextPage > pageCount) return null;
  return { startPage, endPage, nextPage, items: chosen };
}

const KEY = (id) => `alcoia_workspace_skip_${id}`;
// A part that was tried and missed stays closed on this device, so the same questions cannot be
// retried once their explanations have been read.
export function triedBefore(assignmentId, startPage) {
  try { return (JSON.parse(localStorage.getItem(KEY(assignmentId)) ?? '[]')).includes(startPage); } catch { return false; }
}
export function rememberTried(assignmentId, startPage) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY(assignmentId)) ?? '[]');
    if (!list.includes(startPage)) localStorage.setItem(KEY(assignmentId), JSON.stringify([...list, startPage].slice(-200)));
  } catch { /* storage unavailable */ }
}
