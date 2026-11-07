import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentBlocks } from '../src/detection/documentBlocks.js';

// A tiny stand-in for the DOM: elements know their text, their selector matches and their ancestors.
function el(text, { classes = [], attrs = {}, parent = null } = {}) {
  const node = { textContent: text, classes, attrs, parent, children: [] };
  if (parent) parent.children.push(node);
  node.closest = (sel) => {
    for (let n = node; n; n = n.parent) {
      if (sel === '.annotator-ui' && n.classes.includes('annotator-ui')) return n;
      if (sel === '[aria-hidden="true"]' && n.attrs['aria-hidden'] === 'true') return n;
    }
    return null;
  };
  node.querySelectorAll = () => descendants(node).filter((n) => n.attrs.tag === 'p');
  return node;
}
const descendants = (n) => n.children.flatMap((c) => [c, ...descendants(c)]);
const seg = { detectLanguage: () => 'en', countWords: (t) => t.split(/\s+/).filter(Boolean).length };

test('only paragraphs inside the document are reading material, never the app around it', () => {
  const body = el('');
  const card = el('Your record of this file is kept on this device and signed so you can see it is unaltered.', { attrs: { tag: 'p' }, parent: body });
  const page = el('', { attrs: { 'data-anno-scope': 'd:1' }, parent: body });
  const para = el('Price signals explain the fall in household energy use, the authors argue.', { attrs: { tag: 'p' }, parent: page });
  const sticky = el('', { classes: ['annotator-ui'], parent: page });
  el('My own note about this page that is long enough to count as a paragraph here.', { attrs: { tag: 'p' }, parent: sticky });
  const outgoing = el('', { attrs: { 'data-anno-scope': 's:1', 'aria-hidden': 'true' }, parent: body });
  el('The slide that is leaving the screen.', { attrs: { tag: 'p' }, parent: outgoing });
  const doc = { querySelectorAll: (sel) => (sel === '[data-anno-scope]' ? [page, outgoing] : descendants(body).filter((n) => n.attrs.tag === 'p')) };
  const blocks = documentBlocks(doc, () => null, seg);
  assert.deepEqual(blocks.map((b) => b.el), [para]);
  assert.equal(blocks[0].words, 12);
  assert.ok(!blocks.some((b) => b.el === card));
});

test('a PDF text layer wins, and nothing on screen means no paragraphs rather than the whole page', () => {
  const pdf = [{ el: {}, words: 30, media: false }];
  assert.equal(documentBlocks({ querySelectorAll: () => [] }, () => pdf, seg), pdf);
  assert.deepEqual(documentBlocks({ querySelectorAll: () => [] }, () => null, seg), []);
});
