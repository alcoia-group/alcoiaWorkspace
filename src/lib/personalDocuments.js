import { apiDelete, apiGet, API_BASE_URL } from './api.js';

// Files stored on the SERVER before uploads moved to the user's device (src/lib/localFiles.js). They can still be
// listed, opened, downloaded and deleted until their owner removes them; nothing new is uploaded.
//   GET    /api/personal-documents -> { documents: [{ id, name, format, status, sizeBytes, createdAt }], usage, canUpload }
//          (canUpload now means: the plan allows adding files to the device)
//   DELETE /api/personal-documents/:id -> { deleted: true }
export const listPersonalDocuments = (sessionToken) => apiGet('/api/personal-documents', { sessionToken });
export const deletePersonalDocument = (id, sessionToken) => apiDelete(`/api/personal-documents/${encodeURIComponent(id)}`, { sessionToken });
export const fetchPersonalContent = (id, sessionToken) => apiGet(`/api/personal-documents/${encodeURIComponent(id)}/document`, { sessionToken });

// Download the original: needs the session header, so it is fetched and saved from a blob.
export async function downloadPersonalFile(doc, sessionToken) {
  const res = await fetch(`${API_BASE_URL}/api/personal-documents/${encodeURIComponent(doc.id)}/document/file`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) throw new Error(String(res.status));
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.name}.${doc.format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
