import test from 'node:test';
import assert from 'node:assert/strict';
import { placeGroups } from '../src/lib/docQuestionPlacement.js';

const word = { format: 'docx', pages: [{ blocks: [{ type: 'paragraph' }, { type: 'heading' }] }, { blocks: [{ type: 'paragraph' }, { type: 'paragraph' }, { type: 'paragraph' }] }] };

test('a headed group sits under its heading, counted through the document', () => {
  const p = placeGroups(word, [{ heading: 'Review questions', at: { page: 2, block: 1 }, questions: [{ id: 'q1' }] }]);
  assert.deepEqual(Object.keys(p.block), ['3']);
});
test('an unheaded group sits under the block before its first question', () => {
  const p = placeGroups(word, [{ heading: null, at: { page: 2, block: 2 }, questions: [{ id: 'q1' }] }]);
  assert.deepEqual(Object.keys(p.block), ['3']);
});
test('a PDF group sits under its page, slides and unplaceable groups get no offer', () => {
  assert.deepEqual(Object.keys(placeGroups({ format: 'pdf', pageCount: 5 }, [{ at: { page: 4 }, questions: [{ id: 'q' }] }]).page), ['4']);
  const none = placeGroups({ format: 'pptx', slides: [] }, [{ at: { slide: 1 }, questions: [{ id: 'q' }] }]);
  assert.deepEqual([Object.keys(none.block), Object.keys(none.page)], [[], []]);
  assert.deepEqual(Object.keys(placeGroups(word, [{ at: null, questions: [{ id: 'q' }] }]).block), []);
});
