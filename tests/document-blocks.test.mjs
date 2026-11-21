import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentBlocks, MIN_PICTURE_PX } from '../src/detection/documentBlocks.js';

// A tiny stand-in for the DOM: elements know their tag, classes, attributes, text, size and ancestors.
function el(text, { tag = 'div', classes = [], attrs = {}, parent = null, size = [600, 200] } = {}) {
  const node = { textContent: text, tagName: tag.toUpperCase(), classes, attrs, parent, children: [] };
  if (parent) parent.children.push(node);
  node.getAttribute = (name) => attrs[name] ?? null;
  node.getBoundingClientRect = () => ({ width: size[0], height: size[1] });
  node.closest = (sel) => {
    for (let n = node; n; n = n.parent) if (matches(n, sel)) return n;
    return null;
  };
  node.querySelectorAll = (sel) => descendants(node).filter((n) => matches(n, sel));
  return node;
}
function matches(n, sel) {
  return sel.split(',').map((s) => s.trim()).some((s) => {
    if (s === '[aria-hidden="true"]') return n.attrs['aria-hidden'] === 'true';
    if (s === '[data-anno-scope]') return n.attrs['data-anno-scope'] != null;
    if (s.startsWith('.')) return n.classes.includes(s.slice(1));
    return n.tagName === s.toUpperCase();
  });
}
const descendants = (n) => n.children.flatMap((c) => [c, ...descendants(c)]);
const docOf = (body) => ({
  querySelectorAll: (sel) => descendants(body).filter((n) => matches(n, sel)),
  createElement: () => ({ textContent: '' }),
});
const seg = { detectLanguage: () => 'en', countWords: (t) => t.split(/\s+/).filter(Boolean).length };

test('only paragraphs inside the document are reading material, never the app around it', () => {
  const body = el('');
  const card = el('Your record of this file is kept on this device and signed so you can see it is unaltered.', { tag: 'p', parent: body });
  const page = el('', { attrs: { 'data-anno-scope': 'd:1' }, parent: body });
  const para = el('Price signals explain the fall in household energy use, the authors argue.', { tag: 'p', parent: page });
  const sticky = el('', { classes: ['annotator-ui'], parent: page });
  el('My own note about this page that is long enough to count as a paragraph here.', { tag: 'p', parent: sticky });
  const outgoing = el('', { attrs: { 'data-anno-scope': 's:1', 'aria-hidden': 'true' }, parent: body });
  el('The slide that is leaving the screen.', { tag: 'p', parent: outgoing });
  const blocks = documentBlocks(docOf(body), () => null, seg);
  assert.deepEqual(blocks.map((b) => b.el), [para]);
  assert.equal(blocks[0].words, 12);
  assert.ok(!blocks.some((b) => b.el === card));
});

test('a PDF text layer wins, and nothing on screen means no paragraphs rather than the whole page', () => {
  const pdf = [{ el: {}, words: 30, media: false }];
  assert.equal(documentBlocks({ querySelectorAll: () => [] }, () => pdf, seg), pdf);
  assert.deepEqual(documentBlocks({ querySelectorAll: () => [] }, () => null, seg), []);
});

test('a slide is one block with all its text, even when every bullet is short', () => {
  const body = el('');
  const slide = el('', { attrs: { 'data-anno-scope': 's:3' }, parent: body });
  const bullets = [
    'Glycolysis happens in the cytoplasm of the cell',
    'It splits one glucose into two pyruvate molecules',
    'It makes a small net gain of two ATP',
    'No oxygen is needed for this first stage',
  ];
  for (const b of bullets) el(b, { tag: 'p', parent: slide });
  const doc = docOf(body);
  const blocks = documentBlocks(doc, () => null, seg);
  assert.equal(blocks.length, 1);
  // The server's slide passage: each line closed with a full stop, joined by spaces, so the hashes match.
  assert.equal(blocks[0].el.textContent, bullets.map((b) => `${b}.`).join(' '));
  assert.equal(blocks[0].words, bullets.join(' ').split(' ').length);
  assert.equal(blocks[0].media, false, 'a text slide of 20 words or more gets reading-pace maths');
  assert.equal(documentBlocks(doc, () => null, seg)[0].el, blocks[0].el, 'the same element on the next scan');
});

test('a slide with a picture, chart or too few words is followed but not judged on pace', () => {
  const body = el('');
  const pictured = el('', { attrs: { 'data-anno-scope': 's:11' }, parent: body });
  el('The heart has four chambers and two of them pump blood to the lungs while the others pump it to the body', { tag: 'p', parent: pictured });
  el('', { tag: 'img', classes: ['slide-image'], parent: pictured });
  const chart = el('', { attrs: { 'data-anno-scope': 's:12' }, parent: body });
  el('[Chart]', { classes: ['slide-placeholder'], parent: chart });
  const short = el('', { attrs: { 'data-anno-scope': 's:14' }, parent: body });
  el('Summary', { tag: 'p', parent: short });
  const blocks = documentBlocks(docOf(body), () => null, seg);
  assert.deepEqual(blocks.map((b) => b.media), [true, true, true]);
  assert.equal(blocks[2].el.textContent, 'Summary.');
});

test('a picture on a Word page is its own media block; an icon is not', () => {
  const body = el('');
  const page = el('', { attrs: { 'data-anno-scope': 'd:1' }, parent: body });
  const para = el('The diagram below shows how the four chambers of the heart pass blood along in turn.', { tag: 'p', parent: page });
  const figure = el('', { tag: 'img', parent: page, size: [480, 320] });
  el('', { tag: 'img', parent: page, size: [MIN_PICTURE_PX - 1, 20] });
  const blocks = documentBlocks(docOf(body), () => null, seg);
  assert.deepEqual(blocks.map((b) => [b.el, b.media, b.words]), [[para, false, 16], [figure, true, 0]]);
});
