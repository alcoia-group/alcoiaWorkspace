import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorIndex, pdfLinkTarget, resolvePdfDest, safeHref } from '../src/lib/docLinks.js';

test('anchorIndex maps places in blocks, list items and table cells to their top-level block', () => {
  const pages = [
    { blocks: [{ type: 'paragraph', runs: [] }, { type: 'heading', anchors: ['a'], runs: [] }] },
    { blocks: [
      { type: 'list', items: [{ runs: [] }, { runs: [], anchors: ['b'] }] },
      { type: 'table', rows: [[{ blocks: [{ type: 'paragraph', anchors: ['c'], runs: [] }] }]] },
    ] },
  ];
  const map = anchorIndex(pages, [0, 2]);
  assert.deepEqual(map.get('a'), { block: 1, page: 0 });
  assert.deepEqual(map.get('b'), { block: 2, page: 1 });
  assert.deepEqual(map.get('c'), { block: 3, page: 1 });
  assert.equal(map.get('d'), undefined);
});

test('pdf links: web links only http/https/mailto, places, named page actions', () => {
  const at = { page: 3, pageCount: 5 };
  const link = (o) => ({ subtype: 'Link', rect: [0, 0, 1, 1], ...o });
  assert.deepEqual(pdfLinkTarget(link({ url: 'https://x.org/a' }), at), { href: 'https://x.org/a' });
  assert.equal(pdfLinkTarget(link({ url: 'javascript:alert(1)' }), at), null);
  assert.equal(pdfLinkTarget(link({ unsafeUrl: 'file:///etc/passwd' }), at), null);
  assert.deepEqual(pdfLinkTarget(link({ dest: 'chap2' }), at), { dest: 'chap2' });
  assert.deepEqual(pdfLinkTarget(link({ action: 'NextPage' }), at), { page: 4 });
  assert.deepEqual(pdfLinkTarget(link({ action: 'LastPage' }), at), { page: 5 });
  assert.equal(pdfLinkTarget(link({ action: 'NextPage' }), { page: 5, pageCount: 5 }), null);
  assert.equal(pdfLinkTarget(link({ action: 'Print' }), at), null);
  assert.equal(pdfLinkTarget({ subtype: 'Widget', rect: [0, 0, 1, 1], url: 'https://x.org' }, at), null);
  assert.equal(safeHref('data:text/html,x'), null);
});

test('resolvePdfDest follows named and explicit destinations', async () => {
  const ref = { num: 7, gen: 0 };
  const pdf = {
    getDestination: async (name) => (name === 'chap2' ? [ref, { name: 'XYZ' }] : null),
    getPageIndex: async (r) => (r === ref ? 4 : 0),
  };
  assert.equal(await resolvePdfDest(pdf, 'chap2'), 5);
  assert.equal(await resolvePdfDest(pdf, [2, { name: 'Fit' }]), 3);
  assert.equal(await resolvePdfDest(pdf, 'nowhere'), null);
});

import { fontStack, readableColor } from '../src/lib/docLinks.js';

test('fontStack keeps the file\'s font first, adds a free stand-in, and refuses odd names', () => {
  assert.equal(fontStack('Calibri'), "'Calibri', 'Carlito', 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif");
  assert.match(fontStack('Georgia'), /^'Georgia', 'Literata'/);
  assert.equal(fontStack("x';}body{"), undefined);
  assert.equal(fontStack(undefined), undefined);
});

test('readableColor keeps dark colours and drops ones too pale for a white page', () => {
  assert.equal(readableColor('#2f5496'), '#2f5496');
  assert.equal(readableColor('#ffffff'), undefined);
  assert.equal(readableColor('#f2f2f2'), undefined);
  assert.equal(readableColor('red'), undefined);
});
