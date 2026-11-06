import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
  applyActivity, buildOutline, buildOverview, canonicalJson, countWords, newIdentity, setKeyStore, signIdentity, summarise, verifyIdentity,
} from '../src/lib/documentIdentity.js';
import { readLocalImage, readZipEntry } from '../src/lib/localAssets.js';
import { isLocalId } from '../src/lib/localFiles.js';

const run = (text) => ({ text });
const docx = {
  format: 'docx',
  pages: [
    { blocks: [{ type: 'heading', level: 1, runs: [run('Cells')] }, { type: 'paragraph', runs: [run('Cells are the basic unit of life.')] }] },
    { blocks: [{ type: 'heading', level: 2, runs: [run('Energy')] }, { type: 'list', items: [{ runs: [run('ATP stores energy')] }] }, { type: 'table', rows: [[{ blocks: [{ type: 'paragraph', runs: [run('one two three')] }] }]] }] },
  ],
};
const pptx = {
  format: 'pptx',
  slides: [
    { shapes: [{ kind: 'text', paragraphs: [{ runs: [run('Photosynthesis')] }] }] },
    { shapes: [{ kind: 'text', paragraphs: [{ runs: [run('Light reactions')] }, { runs: [run('and more words here')] }] }] },
  ],
};

test('the same record always has the same canonical form, whatever order its keys are in', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, 2], c: null } }), canonicalJson({ a: { c: null, d: [1, 2] }, b: 1 }));
  assert.notEqual(canonicalJson({ a: 1 }), canonicalJson({ a: 2 }));
});

test('words and an outline are read from the content model, counts and headings only', () => {
  assert.equal(countWords(docx), 15);
  assert.equal(countWords(pptx), 1 + 2 + 4);
  assert.deepEqual(buildOutline(docx), [{ label: 'Cells', scope: 'd:1', level: 1 }, { label: 'Energy', scope: 'd:2', level: 2 }]);
  assert.deepEqual(buildOutline(pptx).map((o) => o.scope), ['s:1', 's:2']);
  assert.deepEqual(buildOverview(pptx, null), { kind: 'slides', parts: 2, words: 7, outline: buildOutline(pptx) });
  assert.equal(buildOverview({ format: 'pdf', pageCount: 30, hasText: true }, 9000).parts, 30);
  assert.equal(buildOverview({ format: 'pdf', pageCount: 30, hasText: true }, 9000).words, 9000);
});

function memoryKeys() {
  let held = null;
  setKeyStore({ get: async () => held, set: async (v) => { held = v; } });
}

test('a signed identity verifies; any change to it, or a different device, is noticed', async () => {
  memoryKeys();
  const base = newIdentity({ fingerprint: 'a'.repeat(64), name: 'Bio', format: 'docx', sizeBytes: 100, content: docx, wordCount: null, now: 1000 });
  const signed = await signIdentity(base);
  assert.equal(await verifyIdentity(signed), 'signed');
  assert.equal(await verifyIdentity({ ...signed, name: 'Edited' }), 'invalid');
  assert.equal(await verifyIdentity({ ...signed, parts: { 'd:1': { timeMs: 1, hard: 9, slow: 0, lastAt: 1 } } }), 'invalid');
  assert.equal(await verifyIdentity({ ...signed, sig: undefined }), 'invalid');
  // another browser has another key: the same record is "foreign" there, not trusted as its own
  let other = null;
  setKeyStore({ get: async () => other, set: async (v) => { other = v; } });
  assert.equal(await verifyIdentity(signed), 'foreign');
  const resigned = await signIdentity(signed);
  assert.equal(await verifyIdentity(resigned), 'signed');
  assert.notEqual(resigned.keyId, signed.keyId);
});

test('the signature is stable: signing the same record twice on one device gives the same answer', async () => {
  memoryKeys();
  const base = newIdentity({ fingerprint: 'b'.repeat(64), name: 'x', format: 'pdf', sizeBytes: 1, content: { format: 'pdf', pageCount: 3, hasText: true }, wordCount: 300, now: 5 });
  assert.equal((await signIdentity(base)).sig, (await signIdentity(base)).sig);
});

test('activity adds up per part, keeps the place, and never loses what was already there', () => {
  let id = newIdentity({ fingerprint: 'c'.repeat(64), name: 'x', format: 'docx', sizeBytes: 1, content: docx, wordCount: null, now: 1 });
  id = applyActivity(id, { position: { index: 3, total: 10, scope: 'd:2' }, dwell: { 'd:1': 4000 }, hard: { 'd:2': 1 }, now: 10 });
  id = applyActivity(id, { dwell: { 'd:1': 6000, 'd:2': 1000 }, hard: { 'd:2': 2 }, slow: { 'd:1': 1 }, now: 20 });
  assert.deepEqual(id.position, { index: 3, total: 10, scope: 'd:2', at: 10 }); // no new position reported: kept
  assert.deepEqual(id.parts['d:1'], { timeMs: 10000, hard: 0, slow: 1, lastAt: 20 });
  assert.deepEqual(id.parts['d:2'], { timeMs: 1000, hard: 3, slow: 0, lastAt: 20 });
  id = applyActivity(id, { position: { index: 5, total: 10 }, now: 30 });
  assert.equal(id.position.index, 5);
  assert.equal(id.position.scope, 'd:2'); // an unknown scope does not erase the last known one
  assert.equal(id.lastOpenedAt, 30);
});

test('the summary says where you were, where it was hard, and what you worked with most', () => {
  let id = newIdentity({ fingerprint: 'd'.repeat(64), name: 'x', format: 'docx', sizeBytes: 1, content: docx, wordCount: null, now: 1 });
  id = applyActivity(id, { position: { index: 1, total: 4, scope: null }, dwell: { 'd:1': 120000, 'd:2': 30000 }, hard: { 'd:2': 2 }, slow: { 'd:1': 1 }, now: 5 });
  const marks = { items: [{ scope: 'd:1' }, { scope: 'd:1' }, { scope: 'd:3' }], strokes: [{}], stickies: [{ scope: 'd:2' }], notes: [{}] };
  const s = summarise(id, marks);
  assert.deepEqual(s.where, { index: 1, total: 4, percent: 50, scope: null });
  assert.equal(s.hardCount, 1);
  assert.equal(s.hardParts[0].scope, 'd:2');
  assert.deepEqual(s.marks, { highlights: 3, notes: 2, drawings: 1 });
  assert.equal(s.timeMs, 150000);
  assert.equal(s.keyParts[0].scope, 'd:2'); // 2 stuck x3 + 1 mark x2 + 0.5 min outranks 2 min + 2 marks + one long stop
  assert.ok(s.keyParts.every((p) => p.score > 0));
  const empty = summarise(newIdentity({ fingerprint: 'e'.repeat(64), name: 'x', format: 'pdf', sizeBytes: 1, content: { format: 'pdf', pageCount: 2, hasText: true }, wordCount: null }));
  assert.equal(empty.where, null);
  assert.deepEqual(empty.hardParts, []);
});

test('a file id on this device has one shape, so it cannot be mistaken for a server file id', () => {
  assert.equal(isLocalId('l-0123456789abcdef01234567'), true);
  assert.equal(isLocalId('11111111-1111-4111-8111-111111111111'), false);
  assert.equal(isLocalId('l-xyz'), false);
  assert.equal(isLocalId(undefined), false);
});

// A one-entry ZIP, written by hand, so the picture reader is tested on real ZIP structure.
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data, deflate } of entries) {
    const nameBytes = Buffer.from(name);
    const body = deflate ? deflateRawSync(data) : data;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(deflate ? 8 : 0, 8); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBytes.length, 26);
    locals.push(lh, nameBytes, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(deflate ? 8 : 0, 10); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBytes.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(centralBytes.length, 12); eocd.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...locals, centralBytes, eocd]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
}

test('a picture is read out of the file itself, stored or deflated, and nothing else is', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const buffer = zip([
    { name: 'word/document.xml', data: Buffer.from('<w:document/>'), deflate: true },
    { name: 'word/media/image1.png', data: png, deflate: true },
    { name: 'word/media/image2.jpg', data: png, deflate: false },
    { name: 'word/media/vector.svg', data: Buffer.from('<svg onload="x"/>'), deflate: false },
  ]);
  assert.deepEqual(Buffer.from(await readZipEntry(buffer, 'word/media/image1.png')), png);
  assert.deepEqual(Buffer.from(await readZipEntry(buffer, 'word/media/image2.jpg')), png);
  assert.equal(await readZipEntry(buffer, 'word/media/missing.png'), null);
  const blob = new Blob([buffer]);
  const img = await readLocalImage(blob, 'docx', 'word/media/image1.png');
  assert.equal(img.type, 'image/png');
  assert.equal(await readLocalImage(blob, 'docx', 'word/media/vector.svg'), null); // never SVG
  assert.equal(await readLocalImage(blob, 'docx', 'word/document.xml'), null); // not an image
  assert.equal(await readLocalImage(blob, 'docx', 'word/media/../document.xml'), null);
  assert.equal(await readLocalImage(blob, 'pptx', 'word/media/image1.png'), null); // wrong folder for the format
  assert.equal(await readZipEntry(new ArrayBuffer(10), 'x'), null); // not a zip at all
});
