import { apiGet, API_BASE_URL } from './api.js';

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

// GET <base>/document/file (base = assetBase(asset): an assignment or a personal file) -> the original PDF bytes (needs the
// session header, so it is fetched, not linked).
export async function fetchPdfBytes(base, sessionToken) {
  const res = await fetch(`${API_BASE_URL}${base}/document/file`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) {
    const err = new Error(`pdf ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return new Uint8Array(await res.arrayBuffer());
}

// GET /api/account/seat-notices -> { notices: [{ id, className, reason, removedAt }] }: classes an instructor removed
// this account from recently. Best effort: a failure shows nothing.
export async function fetchSeatNotices(sessionToken) {
  try {
    const body = await apiGet('/api/account/seat-notices', { sessionToken });
    return body.notices ?? [];
  } catch {
    return [];
  }
}

const SEEN_KEY = 'alcoia_seat_notices_seen';
export function seenNoticeIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')); } catch { return new Set(); }
}
export function markNoticeSeen(id) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenNoticeIds(), id].slice(-50))); } catch { /* storage can be unavailable */ }
}
