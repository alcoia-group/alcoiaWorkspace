import { useEffect, useState } from 'react';
import { CHANGE_EVENT, defaultEnv, isRecording, setRecording, startSession } from '../../diagnostics/scrollRecorder.js';

// Shown on reading pages while the on-device scroll recording switch is on. With the switch off it renders
// nothing and attaches nothing.
export default function ScrollRecordingChip() {
  const [on, setOn] = useState(() => isRecording());

  useEffect(() => {
    const sync = () => setOn(isRecording());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(CHANGE_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  useEffect(() => {
    if (!on) return undefined;
    const { stop } = startSession(defaultEnv());
    return stop;
  }, [on]);

  if (!on) return null;
  return (
    <div className="scroll-chip" role="status">
      <span>Recording scrolling on this device</span>
      <button type="button" className="secondary" onClick={() => setRecording(false)}>Stop</button>
    </div>
  );
}
