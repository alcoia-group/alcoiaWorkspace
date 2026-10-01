import { useEffect } from 'react';
import { apiPost } from './api.js';

const PING_EVERY_MS = 5 * 60 * 1000;
const ACTIVE_WITHIN_MS = 10 * 60 * 1000;

// A reader session slides while it is used. A page that is only being read
// makes almost no requests, so while the student is actually here (tab
// visible, something touched in the last 10 minutes) it pings the server
// every 5 minutes. Only `reader` sessions slide; a stopped ping or a 401 is
// ignored here (the next load or request deals with an ended session).
export function useSessionKeepAlive(session) {
  const token = session?.kind === 'reader' ? session.sessionToken : null;
  useEffect(() => {
    if (!token) return undefined;
    let lastActive = Date.now();
    let stopped = false;
    const mark = () => { lastActive = Date.now(); };
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    const timer = setInterval(() => {
      if (stopped || document.visibilityState !== 'visible') return;
      if (Date.now() - lastActive > ACTIVE_WITHIN_MS) return;
      apiPost('/api/reader/keepalive', undefined, { sessionToken: token }).catch((err) => {
        if (err.status === 401) stopped = true;
      });
    }, PING_EVERY_MS);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
    };
  }, [token]);
}
