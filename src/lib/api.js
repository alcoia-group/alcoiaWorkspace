export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(status, code) {
    super(code ?? `${status}`);
    this.status = status;
    this.code = code ?? null;
  }
}

async function request(path, { method = 'GET', body, sessionToken } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, responseBody?.error);
  }
  return responseBody;
}

export function apiGet(path, opts) {
  return request(path, { ...opts, method: 'GET' });
}

export function apiPost(path, body, opts) {
  return request(path, { ...opts, method: 'POST', body });
}

// Document upload is not JSON (documents.js's raw() middleware wants the
// raw file bytes as the body, ?format= identifying what they are -- no
// multer, no multipart) -- separate from request() above rather than
// forcing that shape through the JSON path.
export async function apiUpload(path, file, { sessionToken } = {}) {
  const headers = { 'Content-Type': file.type || 'application/octet-stream' };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: file });
  const responseBody = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, responseBody?.error);
  }
  return responseBody;
}
