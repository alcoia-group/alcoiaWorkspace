import { apiGet } from './api.js';
export { placeGroups } from './docQuestionPlacement.js';

// GET /api/assignments/:id/document/questions -> { count, groups: [{ heading, at, questions: [{ id, text, choices, at }] }] }.
// The reading's own questions (review questions, exercises). Any failure means "none".
export async function fetchDocQuestions(assignmentId, sessionToken) {
  try {
    const body = await apiGet(`/api/assignments/${assignmentId}/document/questions`, { sessionToken });
    return (body?.groups ?? []).filter((g) => (g.questions ?? []).length > 0);
  } catch {
    return [];
  }
}

// The reader's own answers stay on this device only.
const KEY = (id, gid) => `alcoia_workspace_found_${id}_${gid}`;
export function loadAnswers(assignmentId, groupId) {
  try { return JSON.parse(localStorage.getItem(KEY(assignmentId, groupId)) ?? '{}') || {}; } catch { return {}; }
}
export function saveAnswers(assignmentId, groupId, answers) {
  try { localStorage.setItem(KEY(assignmentId, groupId), JSON.stringify(answers)); } catch { /* storage full or blocked */ }
}
