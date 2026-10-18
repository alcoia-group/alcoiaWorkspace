import { apiGet, apiPost } from './api.js';

export const MIN_CHARS = 40;
export const MAX_CHARS = 3000;
const KEY = (id) => `alcoia_workspace_explainback_${id}`;

// GET /api/assignments/:id/explain-back -> { available, ideaCount, previous }. `previous` is the
// learner's own last result, sent only when their account-based learning is on. Any failure
// means "not shown".
export async function fetchExplainBackAvailability(assignmentId, sessionToken) {
  try {
    const body = await apiGet(`/api/assignments/${encodeURIComponent(assignmentId)}/explain-back`, { sessionToken });
    return { available: body?.available === true, previous: Array.isArray(body?.previous) ? body.previous : null };
  } catch {
    return { available: false, previous: null };
  }
}

// POST -> { ideas: [{ text, level }], recorded }. Throws ApiError (422, 429, 503 ...).
export function submitExplainBack(assignmentId, text, sessionToken) {
  return apiPost(`/api/assignments/${encodeURIComponent(assignmentId)}/explain-back`, { text }, { sessionToken });
}

// The last feedback is kept on this device so the panel is not empty after a reload.
// The reader's own text is never kept anywhere.
export function loadLastFeedback(assignmentId) {
  try { return JSON.parse(localStorage.getItem(KEY(assignmentId)) ?? 'null'); } catch { return null; }
}
export function saveLastFeedback(assignmentId, ideas) {
  try { localStorage.setItem(KEY(assignmentId), JSON.stringify({ ideas, at: Date.now() })); } catch { /* storage blocked */ }
}
