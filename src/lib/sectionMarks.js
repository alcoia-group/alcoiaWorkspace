import { apiGet, apiPut } from './api.js';

// Core / optional marks on an assigned reading (server: /api/assignments/:id/section-marks).
// Units are built from the document's own structure: a Word block "b:<page>.<block>" (0-based),
// a slide "s:<n>" and a PDF page "p:<n>" (1-based).
export const wordUnit = (page, block) => `b:${page}.${block}`;
export const slideUnit = (n) => `s:${n}`;
export const pageUnit = (n) => `p:${n}`;

export async function fetchSectionMarks(assignmentId, sessionToken) {
  const body = await apiGet(`/api/assignments/${encodeURIComponent(assignmentId)}/section-marks`, { sessionToken });
  return { optional: new Set(body.optional ?? []), canEdit: body.canEdit === true };
}

export async function saveSectionMarks(assignmentId, optional, sessionToken) {
  const body = await apiPut(`/api/assignments/${encodeURIComponent(assignmentId)}/section-marks`, { optional: [...optional] }, { sessionToken });
  return new Set(body.optional ?? []);
}
