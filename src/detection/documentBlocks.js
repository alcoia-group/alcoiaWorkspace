// The paragraphs of the open document, in reading order, in the tracker's block shape.
const DOCUMENT_ROOTS = '[data-anno-scope]';
const TEXT_BLOCKS = 'p, li, blockquote';
export function documentBlocks(doc, pdfBlockSource, segmentation) {
  const pdf = pdfBlockSource();
  if (pdf) return pdf;
  const lang = segmentation.detectLanguage(doc);
  const blocks = [];
  for (const root of doc.querySelectorAll(DOCUMENT_ROOTS)) {
    if (root.closest('[aria-hidden="true"]')) continue; // a slide on its way out
    for (const el of root.querySelectorAll(TEXT_BLOCKS)) {
      if (el.closest('.annotator-ui')) continue; // the reader's own sticky notes are not the document
      blocks.push({ el, words: segmentation.countWords(el.textContent || '', lang), media: false });
    }
  }
  return blocks;
}
