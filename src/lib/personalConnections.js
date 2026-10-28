import { apiGet } from './api.js';
import { shapePersonalConnections } from './personalConnectionsShape.js';

// GET /api/personal-documents/:id/connections ->
//   { status: { state, validated, note }, connections: [{ type, confidence: 'likely'|'possible',
//     concept, relatedConcept, relatedDocument: { id, name } }] }
// The links are suggestions a model made from the idea lists of the person's own files. They are not checked, and
// the server says so in `status.validated`. Any failure, or nothing to show, returns null and nothing is rendered.
export async function fetchPersonalConnections(id, sessionToken) {
  try {
    const body = await apiGet(`/api/personal-documents/${id}/connections`, { sessionToken });
    return shapePersonalConnections(body);
  } catch {
    return null;
  }
}
