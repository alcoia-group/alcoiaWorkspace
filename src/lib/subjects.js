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
  review_later: 'Review it again later.',
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

// One line for an item of evidence behind a label: the learner's own answer, nothing inferred.
const KIND_WORD = { recognition: 'a multiple-choice question', recall: 'a question you answered in your own words', application: 'a question about using the idea' };
export function evidenceLine(e) {
  const where = `${e.reading}${e.paragraph ? `, paragraph ${e.paragraph}` : ''}`;
  const sure = e.sure === 'sure' ? ', and you were sure' : e.sure === 'unsure' ? ', and you were not sure' : '';
  const day = e.at ? new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return `${where}: ${KIND_WORD[e.kind] ?? 'a question'}, answered ${e.result === 'right' ? 'correctly' : 'incorrectly'}${sure}${day ? ` (${day})` : ''}.`;
}

// Plain words for the "which help worked" section. Each says what happened for this learner, never a trait.
export const CARD_LEAN = { usually_answered: 'you usually answered these', usually_turned_away: 'you usually turned these away', mixed: 'mixed' };
export const STYLE_LEAN = { helped: 'helped', did_not_help: 'did not help', mixed: 'mixed' };
export const STYLE_WORDS = { example_first: 'an example first', analogy: 'an analogy', step_by_step: 'step by step', scenario: 'a situation', plain_definition: 'a plain definition', contrast: 'a contrast' };
export const MODE_WORDS = { explain_more: 'When you asked for more explanation', simplify: 'When you asked for it simpler', repair: 'After a miss' };
