// The user's own files, kept on THIS device only. The file itself, the model the workspace draws from it and
// its document identity (see documentIdentity.js) live in this browser's IndexedDB. Nothing here is uploaded:
// the server never holds the file, and a reading position or a list of hard parts is the kind of record that
// would be a reading history if the server kept it, so it does not.
//
// What survives: closing the tab, refreshing, signing out and back in, restarting the browser. What does not:
// clearing this site's data, using another browser or device, or the browser evicting storage under pressure
// (asked not to: requestPersistence()). A file that is gone can be added again; the same file has the same
// fingerprint, so its identity (if exported) restores the place, the hard parts and the notes.
//
// Records are per account on this device (two people sharing a browser do not see each other's files).

const DB_NAME = 'alcoia-workspace-files';
const VERSION = 1;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const files = db.createObjectStore('files', { keyPath: 'id' });
      files.createIndex('account', 'account');
      db.createObjectStore('content', { keyPath: 'id' });
      db.createObjectStore('identity', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

const wrap = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// Runs fn(...stores) in one transaction and resolves when it commits.
export async function withStores(names, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    let out;
    Promise.resolve(fn(...names.map((n) => t.objectStore(n)))).then((v) => { out = v; }, reject);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const isLocalId = (id) => typeof id === 'string' && /^l-[0-9a-f]{24}$/.test(id);

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const accountKey = (account) => String(account || 'anon').toLowerCase();

// The id in the address (/f/l-...) belongs to one account and one file: the same file added by two accounts on
// one browser gets two ids, the same file added twice by one account gets the same id (it is not stored twice).
export async function localFileId(account, fingerprint) {
  const bytes = new TextEncoder().encode(`${accountKey(account)}:${fingerprint}`);
  return `l-${(await sha256Hex(bytes)).slice(0, 24)}`;
}

// Ask the browser to keep this site's storage rather than evict it when the device is short of space.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* not supported */ }
  return false;
}

export async function storageEstimate() {
  try {
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      const persisted = (await navigator.storage.persisted?.()) ?? false;
      return { usage: usage ?? null, quota: quota ?? null, persisted };
    }
  } catch { /* not supported */ }
  return { usage: null, quota: null, persisted: false };
}

// Keeps the file and what was read from it. `existed` is true when this account already had the same file.
export async function putLocalFile({ account, file, fingerprint, content, status, wordCount }) {
  const id = await localFileId(account, fingerprint);
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Untitled';
  const format = file.name.split('.').pop()?.toLowerCase();
  const existed = await withStores(['files'], 'readonly', (files) => wrap(files.get(id))).then(Boolean);
  if (!existed) {
    await withStores(['files', 'content'], 'readwrite', (files, contentStore) => {
      files.put({ id, account: accountKey(account), name, format, size: file.size, addedAt: Date.now(), fingerprint, status, wordCount: wordCount ?? null, blob: file });
      contentStore.put({ id, content });
    });
  }
  return { id, name, format, existed };
}

export async function listLocalFiles(account) {
  const rows = await withStores(['files'], 'readonly', (files) => wrap(files.index('account').getAll(accountKey(account))));
  return rows
    .map(({ blob, ...rest }) => rest) // eslint-disable-line no-unused-vars
    .sort((a, b) => b.addedAt - a.addedAt);
}

// { record, blob } or null. A record from another account is the same as no record.
export async function getLocalFile(account, id) {
  const row = await withStores(['files'], 'readonly', (files) => wrap(files.get(id)));
  if (!row || row.account !== accountKey(account)) return null;
  const { blob, ...record } = row;
  return { record, blob };
}

export async function getLocalContent(id) {
  const row = await withStores(['content'], 'readonly', (store) => wrap(store.get(id)));
  return row?.content ?? null;
}

// Genuinely removes the file, the model and the identity from this device.
export async function deleteLocalFile(account, id) {
  const found = await getLocalFile(account, id);
  if (!found) return false;
  await withStores(['files', 'content', 'identity'], 'readwrite', (files, content, identity) => {
    files.delete(id);
    content.delete(id);
    identity.delete(id);
  });
  return true;
}

export async function getMeta(key) {
  const row = await withStores(['meta'], 'readonly', (meta) => wrap(meta.get(key)));
  return row?.value ?? null;
}
export async function setMeta(key, value) {
  await withStores(['meta'], 'readwrite', (meta) => { meta.put({ key, value }); });
}

export async function getIdentityRecord(id) {
  return withStores(['identity'], 'readonly', (store) => wrap(store.get(id)));
}
export async function putIdentityRecord(record) {
  await withStores(['identity'], 'readwrite', (store) => { store.put(record); });
}
