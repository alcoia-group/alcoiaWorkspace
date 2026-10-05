import { apiGet, apiPost, ApiError } from './api.js';

// Exam Mode client. The server decides everything: the capability (403 capability_required), whether
// the assignment is readable (404), which question comes next, whether an answer is right, and
// whether anything is remembered. This file only carries requests and maps errors to page states.
//   start(assignmentId, count?) -> { sessionId, state, question, progress, personalized, ... }
//   answer(id, text | skip)    -> { result: { verdict, feedback, modelAnswer, learningRecorded }, canContinue, ... }
//   next(id), finish(id) -> { summary }
// An error carries `.code` from the server; a 503 with `retryable: true` means nothing was lost.
const base = '/api/exam/sessions';

export const startExam = (assignmentId, sessionToken, questionCount) =>
  apiPost(base, { assignmentId, ...(questionCount ? { questionCount } : {}) }, { sessionToken });
export const answerExam = (id, sessionToken, payload) => apiPost(`${base}/${encodeURIComponent(id)}/answer`, payload, { sessionToken });
export const nextExam = (id, sessionToken) => apiPost(`${base}/${encodeURIComponent(id)}/next`, {}, { sessionToken });
export const finishExam = (id, sessionToken) => apiPost(`${base}/${encodeURIComponent(id)}/finish`, {}, { sessionToken });
export const getExam = (id, sessionToken) => apiGet(`${base}/${encodeURIComponent(id)}`, { sessionToken });

// Maps a failed call to what the page should show.
export function examErrorKind(err) {
  if (!(err instanceof ApiError)) return 'network';
  if (err.status === 401) return 'signed_out';
  if (err.status === 403 && err.code === 'capability_required') return 'upgrade';
  if (err.status === 404 && err.code === 'assignment_not_found') return 'no_access';
  if (err.status === 404) return 'session_gone';
  if (err.status === 422 && err.code === 'no_examinable_material') return 'no_material';
  if (err.status === 503) return 'unavailable';
  if (err.status === 409) return 'conflict';
  return 'error';
}
