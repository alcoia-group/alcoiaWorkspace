// Adding a file to THIS device. The file is read here, fingerprinted here and kept here (lib/localFiles.js).
// What the server is asked:
//   GET  /api/personal-documents/local-access   the plan check (403 capability_required without the Reader or
//                                               Student plan). Nothing is sent about the file.
//   POST /api/personal-documents/convert        Word and PowerPoint only: the bytes are sent once, turned into
//                                               the model the workspace draws, and not kept by the server.
// A PDF is read entirely in the browser and sends nothing at all.
import { apiGet, apiUploadWithProgress } from './api.js';
import { loadOrCreateIdentity } from './documentIdentity.js';
import { getLocalFile, localFileId, putLocalFile, requestPersistence, sha256Hex, storageEstimate } from './localFiles.js';

const FORMATS = { pdf: 'pdf', docx: 'docx', pptx: 'pptx' };
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // the converter's own ceiling; a PDF kept here follows the same

export const formatOf = (file) => FORMATS[file.name.split('.').pop()?.toLowerCase()] ?? null;

// Resolves { id, name, existed } or throws an Error with `code`: unsupported_format, file_too_large,
// device_storage_full, capability_required, unreadable_file, invalid_file_content, rate_limited, network.
export async function addFileToDevice({ file, account, sessionToken, onProgress }) {
  const format = formatOf(file);
  if (!format) throw coded('unsupported_format');
  if (file.size > MAX_FILE_BYTES) throw coded('file_too_large');

  try {
    await apiGet('/api/personal-documents/local-access', { sessionToken });
  } catch (err) {
    throw coded(err.code ?? (err.status === 0 ? 'network' : 'access_check_failed'));
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fingerprint = await sha256Hex(bytes);
  const id = await localFileId(account, fingerprint);
  const already = await getLocalFile(account, id);
  if (already) return { id, name: already.record.name, existed: true };

  const { usage, quota } = await storageEstimate();
  if (quota != null && usage != null && usage + file.size * 1.1 > quota) throw coded('device_storage_full');

  let content;
  let status;
  let wordCount = null;
  if (format === 'pdf') {
    const { pdfInfo } = await import('./pdfInfo.js');
    try {
      ({ content, wordCount } = await pdfInfo(bytes));
    } catch {
      throw coded('unreadable_file');
    }
    status = content.hasText ? 'accepted' : 'unsupported';
  } else {
    try {
      const body = await apiUploadWithProgress(`/api/personal-documents/convert?format=${format}`, file, { sessionToken, onProgress });
      ({ content, status, wordCount } = body);
    } catch (err) {
      throw coded(err.code ?? 'network');
    }
  }

  try {
    const stored = await putLocalFile({ account, file, fingerprint, content, status, wordCount });
    const found = await getLocalFile(account, stored.id);
    await loadOrCreateIdentity({ id: stored.id, record: found.record, content });
    requestPersistence(); // best effort: ask the browser to keep the files rather than evict them
    return { id: stored.id, name: stored.name, existed: stored.existed };
  } catch (err) {
    throw coded(err?.name === 'QuotaExceededError' ? 'device_storage_full' : 'device_storage_failed');
  }
}

function coded(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

export function addErrorMessage(code) {
  return ({
    unsupported_format: 'Only PDF, Word (.docx) and PowerPoint (.pptx) files can be added.',
    file_too_large: 'This file is larger than 100 MB, which is the most that can be added.',
    device_storage_full: 'There is not enough room left in this browser to keep the file. Delete a file you no longer need and try again.',
    capability_required: 'Adding your own files is included with the Reader and Student plans.',
    unreadable_file: 'This file could not be read. It may be damaged or password protected.',
    invalid_file_content: 'This does not look like a valid file of that type.',
    rate_limited: 'You have added a lot of files in the last hour. Try again later.',
    network: 'The connection failed. Check it and try again.',
    device_storage_failed: 'This browser would not keep the file. Private windows often do not allow it.',
  })[code] ?? 'The file could not be added. Please try again.';
}
