import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api.js';

// Pictures inside a document are served by the API behind the same session
// check as the document itself, so an <img src> cannot fetch them (it cannot
// send the Authorization header). Fetch the bytes with the header and hand
// the <img> a local blob URL. The URL is revoked when the image goes away.
export function useAssetUrl(assignmentId, path, sessionToken) {
  const [state, setState] = useState({ url: null, failed: false });
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    fetch(`${API_BASE_URL}/api/assignments/${encodeURIComponent(assignmentId)}/document/asset?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, failed: false });
      })
      .catch(() => !cancelled && setState({ url: null, failed: true }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assignmentId, path, sessionToken]);
  return state;
}
