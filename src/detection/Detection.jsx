import { useEffect } from 'react';
import { startDetection } from './boot.js';

// Runs the reading detection (the extension's own code, see boot.js) while a reading is on screen. Renders
// nothing itself: cards appear in their own layer, exactly as the extension draws them.
export default function Detection({ assignmentId = null }) {
  useEffect(() => {
    let stop = null;
    let cancelled = false;
    startDetection({ assignmentId })
      .then((s) => { if (cancelled) s(); else stop = s; })
      .catch((err) => console.warn('[alcoia] detection did not start', err));
    return () => { cancelled = true; stop?.(); };
  }, [assignmentId]);
  return null;
}
