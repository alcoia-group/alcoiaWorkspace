// Wording and pure helpers for the "By subject" views. The server computes every level and state; this file only turns
// them into words and narrows a long list. Nothing here scores, ranks learners or compares anyone.
export const LEVEL_LABEL = { needs_help: 'Needs another look', developing: 'Building', secure: 'Solid so far', unknown: 'Not enough answers yet' };
export const LEVEL_TONE = { needs_help: 'due', developing: 'mid', secure: 'good', unknown: 'none' };
export const LEVEL_ORDER = ['needs_help', 'developing', 'secure', 'unknown'];
export const NEXT_STEP = {
  correct_a_misconception: 'Worth checking your understanding: some answers you were sure of turned out wrong.',
  review_the_explanation: 'Worth another read of the explanation.',
  try_recalling_it: 'Next, try recalling it in your own words.',
  try_applying_it: 'Next, try using it in a new situation.',
  review_later: 'A review later will help it stick.',
  nothing_needed: 'Nothing needed right now.',
  not_enough_evidence: 'Not enough answers yet to say.',
};
export const DIM_LABEL = { understanding: 'Understanding', recall: 'Recall', transfer: 'Using it in new situations', retention: 'Remembering later' };
export const DIM_STATE = { none: 'no answers yet', positive: 'going well', negative: 'not yet', uncertain: 'mixed so far' };
const DIM_SHORT = { understanding: 'understanding', recall: 'recall', transfer: 'using it in new situations', retention: 'remembering later' };

export const joinWords = (names) => names.map((n) => DIM_SHORT[n] ?? n).join(', ');

// Counts per level, so a long list can be summarised in one line.
export function countByLevel(items) {
  const counts = { needs_help: 0, developing: 0, secure: 0, unknown: 0 };
  for (const s of items ?? []) if (s.level in counts) counts[s.level] += 1;
  return counts;
}

// level: one of LEVEL_ORDER or 'all'. query: free text matched against the idea's name, case-insensitive.
export function filterSubjects(items, { level = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return (items ?? []).filter((s) => (level === 'all' || s.level === level) && (!q || s.label.toLowerCase().includes(q)));
}
