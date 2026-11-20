import { API_BASE_URL, ApiError, apiPost } from './api.js';

// "Explain this picture" (assigned readings only; the server reads the picture from the stored file).
//   POST /api/assignments/:id/document/pictures/describe     { path }   Word, EPUB and slide pictures
//   POST /api/assignments/:id/document/pages/:page/describe  raw image  a PDF page as this viewer drew it
// Answers { available, kind, description, possiblyWrong } or { available: false }. A description is written by a
// model from the picture and may be wrong; the panel always says so.

export function describePicture({ assignmentId, path, sessionToken }) {
  return apiPost(`/api/assignments/${encodeURIComponent(assignmentId)}/document/pictures/describe`, { path }, { sessionToken });
}

export const MAX_PAGE_IMAGE_PX = 1600; // longest side sent for a PDF page; keeps the image well under the server's 3 MB

// The drawn page, scaled down to MAX_PAGE_IMAGE_PX, as a JPEG blob.
export function pageImageBlob(canvas, doc = document) {
  const longest = Math.max(canvas.width, canvas.height) || 1;
  const ratio = Math.min(1, MAX_PAGE_IMAGE_PX / longest);
  const out = doc.createElement('canvas');
  out.width = Math.max(1, Math.round(canvas.width * ratio));
  out.height = Math.max(1, Math.round(canvas.height * ratio));
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('no_image'))), 'image/jpeg', 0.85));
}

export async function describePdfPage({ assignmentId, page, blob, sessionToken }) {
  const res = await fetch(`${API_BASE_URL}/api/assignments/${encodeURIComponent(assignmentId)}/document/pages/${page}/describe`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
    body: blob,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error, body);
  return body;
}

const KIND_LABEL = {
  diagram: 'Diagram', chart: 'Chart', table: 'Table', photo: 'Photo', map: 'Map', equation: 'Equation',
  decorative: 'Decoration', other: 'Picture',
};
export const kindLabel = (kind) => KIND_LABEL[kind] ?? 'Picture';

export function pictureErrorMessage(err) {
  if (err?.status === 429) return 'You have asked about a lot of pictures in the last hour. Try again later.';
  if (err?.status === 0 || err instanceof TypeError) return 'The connection failed. Check it and try again.';
  return 'This picture could not be described right now. Try again in a moment.';
}
