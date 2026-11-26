import { apiGet } from './api.js';

// GET /api/assignments/:id/document/questions -> { count, groups: [{ heading, questions: [{ id, text, choices }] }] }.
// Questions the reading itself carries. Any failure means "none".
export async function fetchDocQuestions(assignmentId, sessionToken) {
  try {
    const body = await apiGet(`/api/assignments/${assignmentId}/document/questions`, { sessionToken });
    const questions = (body?.groups ?? []).flatMap((g) => (g.questions ?? []).map((q) => ({ ...q, heading: g.heading })));
    return questions;
  } catch {
    return [];
  }
}
