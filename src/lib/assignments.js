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

// GET /api/assignments/:id/document -> { documentId, format, status, content }.
// `content` is a structured model ({ format, pages: [{ blocks }] }), or null
// when the server cannot render this document (the reader then offers the
// original download). 404 for anything the caller may not read, whether or
// not it exists.
export async function fetchDocument(assignmentId, sessionToken) {
  return apiGet(`/api/assignments/${encodeURIComponent(assignmentId)}/document`, { sessionToken });
}
