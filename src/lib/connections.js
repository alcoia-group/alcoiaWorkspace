import { apiGet } from './api.js';

// GET /api/assignments/:id/cross-document-connections ->
//   { status, personalized, connections: [{ concept, relatedConcept, relatedDocument: { assignmentId,
//     assignmentName, className } }], relatedDocuments: [{ assignmentId, assignmentName, className }] }
// The server decides the plan (403 for anyone without Reader or Student), whether the reading has been
// indexed and which other readings this person can open. Any failure, or nothing to show, returns an
// empty list and the panel renders nothing.
export async function fetchConnections(assignmentId, sessionToken) {
  try {
    const body = await apiGet(`/api/assignments/${assignmentId}/cross-document-connections`, { sessionToken });
    return groupConnections(body);
  } catch {
    return [];
  }
}

const titleOf = (d) => d.assignmentName || d.className || 'another reading';

// One entry per related reading, with up to three of the ideas it shares.
export function groupConnections(body, maxIdeas = 3) {
  const docs = Array.isArray(body?.relatedDocuments) ? body.relatedDocuments : [];
  const links = Array.isArray(body?.connections) ? body.connections : [];
  return docs
    .filter((d) => typeof d?.assignmentId === 'string')
    .map((d) => {
      const ideas = [];
      for (const c of links) {
        if (c?.relatedDocument?.assignmentId !== d.assignmentId) continue;
        const label = c.relatedConcept?.label || c.concept?.label;
        if (label && !ideas.includes(label)) ideas.push(label);
        if (ideas.length >= maxIdeas) break;
      }
      return { assignmentId: d.assignmentId, title: titleOf(d), ideas };
    });
}
