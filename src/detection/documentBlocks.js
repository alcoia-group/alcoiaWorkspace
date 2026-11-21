// The paragraphs of the open document, in reading order, in the tracker's block shape.
//
// Word and EPUB pages: each p, li and blockquote is a block, and each picture large enough to study is a block of its
// own marked media, so time spent on a diagram lands on the diagram and is never read as slow reading of the text
// next to it (the tracker does no pace maths on media blocks).
//
// Slides: the whole slide is ONE block. A slide is on screen all at once and its bullets are rarely 20 words each, so
// per-bullet blocks left most slides with nothing the tracker would follow. A slide with a picture, chart or diagram,
// or with fewer than MIN_TEXT_WORDS words, is media: its time is followed (moving on, going back) but not judged as
// reading pace, because looking at a picture is part of reading a slide.
//
// PDFs come from their own text layer (pdfBlockSource); pictures drawn on a PDF page are not found here.
const DOCUMENT_ROOTS = '[data-anno-scope]';
const BLOCKS = 'p, li, blockquote, img';
const SLIDE_PICTURES = '.slide-image, .slide-placeholder';
export const MIN_PICTURE_PX = 64; // smaller pictures are icons or bullets, not something to study
export const MIN_TEXT_WORDS = 20; // the tracker's own floor for a text block

const isSlide = (root) => (root.getAttribute?.('data-anno-scope') || '').startsWith('s:');

function bigEnough(img) {
  try {
    const r = img.getBoundingClientRect();
    return r.width >= MIN_PICTURE_PX && r.height >= MIN_PICTURE_PX;
  } catch { return false; }
}

// The slide's text exactly as the server builds a slide passage (alcoiaServer src/crossDocument/paragraphs.js): every
// paragraph in reading order, whitespace collapsed, a full stop added when a line has no closing punctuation, joined
// by spaces. The same text gives the same content hash, so the server can match this slide to the assigned deck (slide
// rules, speaker notes when the instructor allows them, the class cache). Table cells hold paragraphs too.
export function slideText(root) {
  return [...root.querySelectorAll('p')]
    .filter((n) => !n.closest('.annotator-ui'))
    .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((l) => (/[.!?:;]$/.test(l) ? l : `${l}.`))
    .join(' ');
}

// One detached element per slide carrying that text (the tracker and the host read a block's text from its element),
// measured where the slide is. Cached so the tracker does not see a "new" paragraph on every scan.
const slideEls = new Map();
function slideBlock(doc, root, segmentation, lang) {
  const text = slideText(root);
  const scope = root.getAttribute('data-anno-scope');
  let el = slideEls.get(scope);
  if (!el || el.textContent !== text) {
    el = doc.createElement('span');
    el.textContent = text;
    slideEls.set(scope, el);
    if (slideEls.size > 500) slideEls.delete(slideEls.keys().next().value);
  }
  el.getBoundingClientRect = () => root.getBoundingClientRect();
  const words = text ? segmentation.countWords(text, lang) : 0;
  const pictures = root.querySelectorAll(SLIDE_PICTURES).length > 0;
  return { el, words, media: pictures || words < MIN_TEXT_WORDS };
}

export function documentBlocks(doc, pdfBlockSource, segmentation) {
  const pdf = pdfBlockSource();
  if (pdf) return pdf;
  const lang = segmentation.detectLanguage(doc);
  const blocks = [];
  for (const root of doc.querySelectorAll(DOCUMENT_ROOTS)) {
    if (root.closest('[aria-hidden="true"]')) continue; // a slide on its way out
    if (isSlide(root)) { blocks.push(slideBlock(doc, root, segmentation, lang)); continue; }
    for (const el of root.querySelectorAll(BLOCKS)) {
      if (el.closest('.annotator-ui')) continue; // the reader's own sticky notes are not the document
      if ((el.tagName || '').toLowerCase() === 'img') {
        if (bigEnough(el)) blocks.push({ el, words: 0, media: true });
        continue;
      }
      blocks.push({ el, words: segmentation.countWords(el.textContent || '', lang), media: false });
    }
  }
  return blocks;
}
