import { useEffect, useRef } from 'react';
import { startDetection } from './boot.js';

// Runs the reading detection (the extension's own code, see boot.js) while a reading is on screen. Renders
// nothing itself: cards appear in their own layer, exactly as the extension draws them.
export default function Detection({ assignmentId = null, observers = null }) {
  // The latest observers, read through a stable wrapper so changing them never restarts the detection.
  const latest = useRef(observers);
  latest.current = observers;
  useEffect(() => {
    let stop = null;
    let cancelled = false;
    const stable = {
      onStruggle: (...a) => latest.current?.onStruggle?.(...a),
      onParagraphRead: (...a) => latest.current?.onParagraphRead?.(...a),
    };
    startDetection({ assignmentId, observers: stable })
      .then((s) => { if (cancelled) s(); else stop = s; })
      .catch((err) => console.warn('[alcoia] detection did not start', err));
    return () => { cancelled = true; stop?.(); };
  }, [assignmentId]);
  return null;
}
