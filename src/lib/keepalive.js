import { useEffect } from 'react';
import { apiPost } from './api.js';
import { getSession, setSession } from './session.js';

const PING_EVERY_MS = 5 * 60 * 1000;
const ACTIVE_WITHIN_MS = 10 * 60 * 1000;

// Reader and console sessions slide while it is used. A page that is only being read
// makes almost no requests, so while the student is actually here (tab
// visible, something touched in the last 10 minutes) it pings the server
// every 5 minutes. Both kinds slide on the server; a stopped ping or a 401 is
// ignored here (the next load or request deals with an ended session).
export function useSessionKeepAlive(session) {
  const token = session?.kind === 'reader' || session?.kind === 'console' ? session.sessionToken : null;
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
      apiPost('/api/reader/keepalive', undefined, { sessionToken: token }).then((r) => {
        // The saved expiry would otherwise sign the student out locally at the
        // time first issued, even though the server has moved it later.
        const cur = getSession();
        if (r?.expiresAt && cur?.sessionToken === token) setSession({ ...cur, expiresAt: r.expiresAt });
      }).catch((err) => {
        if (err.status === 401) stopped = true;
      });
    }, PING_EVERY_MS);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
    };
  }, [token]);
}
