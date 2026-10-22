import { useCallback, useEffect, useState } from 'react';
import { CHANGE_EVENT, clearSessions, defaultEnv, exportPayload, isRecording, loadSessions, setRecording } from '../../diagnostics/scrollRecorder.js';
import { summarize } from '../../diagnostics/scrollSummary.js';

const FILE_NAME = 'alcoia-scroll-trace.json';

function Buckets({ label, b }) {
  return (
    <li>{label}: {b.count} time{b.count === 1 ? '' : 's'} (under 10 s: {b.under10s}, 10 to 60 s: {b.from10to60s}, over 60 s: {b.over60s})</li>
  );
}

const show = (v, unit = '') => (v == null ? 'not enough data' : `${v}${unit}`);

// Settings > "Scroll recording (this device only)". The switch lives in this browser's localStorage and is
// not part of the account settings: it is never saved to the account or sent anywhere.
export default function ScrollRecordingSection() {
  const [on, setOn] = useState(() => isRecording());
  const [sessions, setSessions] = useState([]);
  const [canShare, setCanShare] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => { setOn(isRecording()); setSessions(await loadSessions(defaultEnv())); }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => window.removeEventListener(CHANGE_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    try {
      const f = new File(['{}'], FILE_NAME, { type: 'application/json' });
      setCanShare(!!(navigator.canShare && navigator.canShare({ files: [f] })));
    } catch { setCanShare(false); }
  }, []);

  const blob = () => new Blob([JSON.stringify(exportPayload(sessions))], { type: 'application/json' });

  function download() {
    const url = URL.createObjectURL(blob());
    const a = document.createElement('a');
    a.href = url; a.download = FILE_NAME;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function share() {
    setMessage('');
    try {
      await navigator.share({ files: [new File([blob()], FILE_NAME, { type: 'application/json' })] });
    } catch (e) {
      if (e?.name !== 'AbortError') setMessage('Sharing did not work. Use Download instead.');
    }
  }

  async function clear() {
    await clearSessions(defaultEnv());
    setMessage('Cleared.');
    refresh();
  }

  const s = sessions.length ? summarize(sessions) : null;

  return (
    <div id="scroll-recording">
      <h2>Scroll recording (this device only)</h2>
      <p>
        Records how you scroll on reading pages so scrolling on phones can be studied. It is saved in this
        browser only and is never sent anywhere. You choose when to download it. It does not record text,
        the page address, the document, your browser name or who you are. It keeps the last 5 reading
        sessions.
      </p>
      <p><strong>{on ? 'Recording is on' : 'Recording is off'}</strong></p>
      <div className="panel-actions">
        {on
          ? <button type="button" onClick={() => { setRecording(false); refresh(); }}>Stop</button>
          : <button type="button" onClick={() => { setRecording(true); refresh(); }}>Start</button>}
        <button type="button" className="secondary" onClick={download} disabled={!sessions.length}>Download</button>
        {canShare && <button type="button" className="secondary" onClick={share} disabled={!sessions.length}>Share file</button>}
        <button type="button" className="secondary" onClick={clear} disabled={!sessions.length}>Clear</button>
      </div>
      {on && <p className="muted">Open a reading and read as you normally would. Come back here to see what was recorded.</p>}
      {message && <p className="muted" role="status">{message}</p>}

      <h3>What this shows</h3>
      {!s && <p className="muted">Nothing recorded yet.</p>}
      {s && (
        <>
          <p className="muted">This describes what was recorded. It says nothing about how well any detector works.</p>
          <ul className="scroll-summary">
            <li>{s.sessions} reading session{s.sessions === 1 ? '' : 's'}, {s.minutes} minutes, {s.events} events{s.truncatedSessions ? ` (${s.truncatedSessions} reached the size limit)` : ''}.</li>
            <li>Touch was the first input in {s.touchFirst} of {s.sessions}. Coarse pointer: {s.devices.coarse}. No hover: {s.devices.hoverNone}.</li>
            <li>Scroll bursts: {s.bursts}. Median length: {show(s.burstFractionMedian)} of the screen height.</li>
            <li>Bursts that moved 60% of the screen or more (jumps): {s.jumps}{s.jumpShare != null ? `, ${s.jumpShare}% of bursts` : ''}. Screen mode would have been on for {show(s.screenModeOnShare, '%')} of bursts and was entered {s.screenModeEntered} time{s.screenModeEntered === 1 ? '' : 's'}.</li>
            <li>The scroll-pattern rule said hunting {s.huntingEvaluations} time{s.huntingEvaluations === 1 ? '' : 's'} and smooth {s.smoothEvaluations} time{s.smoothEvaluations === 1 ? '' : 's'} ({show(s.huntingShare, '%')} hunting).</li>
            <Buckets label="Page hidden" b={s.visibility} />
            <Buckets label="Window lost focus" b={s.blur} />
            <li>Visible height changed {s.viewportChanges} time{s.viewportChanges === 1 ? '' : 's'}; the largest change was {s.viewportLargestChange} px.</li>
            <li>Backward scrolls of more than 50 px: {s.backwardScrolls}.</li>
            <li>Median time between bursts: {s.medianBetweenBurstsMs == null ? 'not enough data' : `${(s.medianBetweenBurstsMs / 1000).toFixed(1)} s`}.</li>
          </ul>
        </>
      )}
    </div>
  );
}
