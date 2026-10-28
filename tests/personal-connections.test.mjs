import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapePersonalConnections } from '../src/lib/personalConnectionsShape.js';

const link = (over = {}) => ({ type: 'same_concept', confidence: 'likely', concept: { label: 'Osmosis' }, relatedConcept: { label: 'Water uptake' }, relatedDocument: { id: 'f2', name: 'Paper two' }, ...over });

test('shapes links into plain items and keeps the server note', () => {
  const r = shapePersonalConnections({ status: { note: 'Not checked.' }, connections: [link(), link({ type: 'related_concept', confidence: 'possible' })] });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].relation, 'looks like the same idea as');
  assert.equal(r.items[1].likely, false);
  assert.equal(r.note, 'Not checked.');
});

test('shows nothing when there is nothing usable', () => {
  assert.equal(shapePersonalConnections({ connections: [] }), null);
  assert.equal(shapePersonalConnections(null), null);
  assert.equal(shapePersonalConnections({ connections: [{ relatedDocument: {} }] }), null);
});

test('always carries a note saying the links are unchecked', () => {
  assert.match(shapePersonalConnections({ connections: [link()] }).note, /not checked/i);
});
