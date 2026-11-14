import { apiGet, apiPost, ApiError } from './api.js';
import { markSeen } from './proveSkip.js';

// "Check what you already know" before an assigned reading. The server decides everything: which question each
// section starts with, whether an answer is right, which question comes next and what the section's label is. This
// file only carries requests and keeps a copy of the labels on this device (for readers with learner memory off).
//   GET  /api/assignments/:id/prior-check -> { strands: [{ index, label, items, status, next, misconceptions }], remembered }
//        202 while the question bank is being made, 422 when the reading has nothing to check with.
//   POST .../prior-check/answer { strand, answers } -> { result, next, status, misconceptions, remembered }
// Nothing here is sent to the instructor or turned into a class figure.

export async function fetchPriorCheck(assignmentId, sessionToken, { attempts = 8, delayMs = 2500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const body = await apiGet(`/api/assignments/${encodeURIComponent(assignmentId)}/prior-check`, { sessionToken });
      if (body?.status === 'preparing') { await new Promise((r) => setTimeout(r, delayMs)); continue; }
      return body;
    } catch (err) {
      if (err instanceof ApiError && err.status === 202) { await new Promise((r) => setTimeout(r, delayMs)); continue; }
      return null;
    }
  }
  return null;
}

export const answerPriorCheck = (assignmentId, sessionToken, strand, answers) =>
  apiPost(`/api/assignments/${encodeURIComponent(assignmentId)}/prior-check/answer`, { strand, answers }, { sessionToken });

const KEY = (id) => `alcoia_workspace_prior_${id}`;
export function readLocal(id) {
  try { return JSON.parse(localStorage.getItem(KEY(id)) ?? 'null') || { statuses: {}, answers: {} }; } catch { return { statuses: {}, answers: {} }; }
}
export function writeLocal(id, data) {
  try { localStorage.setItem(KEY(id), JSON.stringify(data)); } catch { /* storage unavailable */ }
}

// After an answer: what prove-it-to-skip should remember about the questions of this section. A held section lets
// the reader skip it without new questions ('h'); a single answer is remembered as right-and-sure, right-but-unsure
// or wrong, exactly as prove-it-to-skip records its own answers.
export function rememberForSkip(assignmentId, strand, status, lastAnswer, correct) {
  if (status === 'held') for (const it of strand.items) markSeen(assignmentId, it.id, 'h');
  else if (lastAnswer && !lastAnswer.dontKnow) markSeen(assignmentId, lastAnswer.itemId, correct ? (lastAnswer.confidence === 'sure' ? 'c' : 'u') : 'w');
  else if (lastAnswer?.dontKnow) markSeen(assignmentId, lastAnswer.itemId, 'w');
}

export const STATUS_WORDS = {
  held: 'You already know this part.',
  partly: 'You know some of this part.',
  not_yet: 'Read this part closely.',
  unknown: 'Not checked.',
};
