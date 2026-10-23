import { apiDelete, apiGet, apiUploadWithProgress, API_BASE_URL } from './api.js';

// The user's own files. The server decides the plan (403 capability_required on upload only),
// the quota (413 storage_quota_exceeded) and ownership (a file that is not yours is a 404).
//   GET    /api/personal-documents -> { documents: [{ id, name, format, status, sizeBytes, createdAt }], usage: { usedBytes, quotaBytes }, canUpload }
//   POST   /api/personal-documents?format=&name= (raw bytes) -> the new document + usage
//   DELETE /api/personal-documents/:id -> { deleted: true }
export const listPersonalDocuments = (sessionToken) => apiGet('/api/personal-documents', { sessionToken });
export const deletePersonalDocument = (id, sessionToken) => apiDelete(`/api/personal-documents/${encodeURIComponent(id)}`, { sessionToken });
export const fetchPersonalContent = (id, sessionToken) => apiGet(`/api/personal-documents/${encodeURIComponent(id)}/document`, { sessionToken });

const EXT_FORMAT = { pdf: 'pdf', pptx: 'pptx', docx: 'docx' };
export function formatOfFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return EXT_FORMAT[ext] ?? null;
}

export function uploadPersonalDocument(file, { sessionToken, onProgress }) {
  const format = formatOfFile(file);
  const name = file.name.replace(/\.[^.]+$/, '');
  return apiUploadWithProgress(`/api/personal-documents?format=${format}&name=${encodeURIComponent(name)}`, file, { sessionToken, onProgress });
}

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

export function uploadErrorMessage(err) {
  if (err.code === 'capability_required') return 'Uploading your own files is included with the Reader and Student plans.';
  if (err.code === 'storage_quota_exceeded') return 'Not enough storage left. Delete a file you no longer need and try again.';
  if (err.code === 'file_too_large') return 'This file is larger than the server accepts in one upload.';
  if (err.code === 'personal_storage_full') return 'Storage is temporarily full. Please try again later.';
  if (err.code === 'invalid_file_content') return 'This does not look like a valid file of that type.';
  if (err.code === 'invalid_format') return 'Only PDF, Word (.docx) and PowerPoint (.pptx) files can be added.';
  return 'The upload failed. Please try again.';
}
