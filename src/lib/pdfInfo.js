// What a PDF is, read in the browser when it is added to this device: page count, whether it has selectable
// text, and a word-count estimate from the first pages. Nothing is sent anywhere. Loaded only when a PDF is
// added, because pdf.js is large.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const SAMPLE_PAGES = 12;

export async function pdfInfo(bytes) {
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false });
  const doc = await task.promise;
  try {
    const pageCount = doc.numPages;
    let words = 0;
    let sampled = 0;
    let hasText = false;
    for (let i = 1; i <= Math.min(pageCount, SAMPLE_PAGES); i += 1) {
      const page = await doc.getPage(i);
      const text = (await page.getTextContent()).items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
      sampled += 1;
      words += text ? text.split(' ').length : 0;
      if (text.length > 20) hasText = true;
    }
    const estimate = hasText && sampled > 0 ? Math.round((words / sampled) * pageCount) : null;
    return { content: { format: 'pdf', pageCount, hasText }, wordCount: estimate };
  } finally {
    task.destroy?.();
    doc.destroy?.();
  }
}
