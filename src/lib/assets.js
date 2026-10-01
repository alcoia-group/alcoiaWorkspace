import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api.js';

// Pictures inside a document are served by the API behind the same session
// check as the document itself, so an <img src> cannot fetch them (it cannot
// send the Authorization header). Fetch the bytes with the header and hand
// the <img> a local blob URL. A picture shown in more than one place (the
// slide and its thumbnail) is fetched once; the URL is revoked when the last
// user goes away.
const cache = new Map(); // key -> { promise, url, refs }

function acquire(assignmentId, path, sessionToken) {
  const key = `${assignmentId}\n${path}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = { refs: 0, url: null, promise: null };
    entry.promise = fetch(`${API_BASE_URL}/api/assignments/${encodeURIComponent(assignmentId)}/document/asset?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        entry.url = URL.createObjectURL(blob);
        return entry.url;
      });
    entry.promise.catch(() => cache.delete(key));
    cache.set(key, entry);
  }
  entry.refs += 1;
  return {
    promise: entry.promise,
    release() {
      entry.refs -= 1;
      if (entry.refs <= 0) {
        cache.delete(key);
        entry.promise.then((url) => URL.revokeObjectURL(url), () => {});
      }
    },
  };
}

export function useAssetUrl(assignmentId, path, sessionToken) {
  const [state, setState] = useState({ url: null, failed: false });
  useEffect(() => {
    let cancelled = false;
    const handle = acquire(assignmentId, path, sessionToken);
    handle.promise.then(
      (url) => !cancelled && setState({ url, failed: false }),
      () => !cancelled && setState({ url: null, failed: true }),
    );
    return () => {
      cancelled = true;
      handle.release();
    };
  }, [assignmentId, path, sessionToken]);
  return state;
}
