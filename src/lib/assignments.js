import { apiGet } from './api.js';

// GET /api/assignments/mine -> { assignments: [{ assignmentId, classId,
// className, closesAt, documents: [{ documentId, format, status }] }] }.
// Server returns only active (not yet closed) assignments for the account.
export async function fetchMyAssignments(sessionToken) {
  const body = await apiGet('/api/assignments/mine', { sessionToken });
  return body.assignments ?? [];
}

// GET /api/documents/:id/download-url -> { url, expiresInSeconds }. A fresh
// short-lived signed URL per call; served as an attachment, never inline.
export async function fetchDownloadUrl(documentId, sessionToken) {
  const body = await apiGet(`/api/documents/${documentId}/download-url`, { sessionToken });
  return body.url;
}
