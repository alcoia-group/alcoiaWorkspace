import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../context/SessionContext.jsx';
import { disableLearningMemory, enableLearningMemory, fetchLearningMemory, fetchSettings, saveSettings } from '../lib/settings.js';

const COLORS = [
  ['rgba(255,243,180,0.12)', 'Warm yellow'],
  ['rgba(180,220,255,0.12)', 'Light blue'],
  ['rgba(200,255,200,0.10)', 'Soft green'],
  ['rgba(255,200,200,0.10)', 'Pale rose'],
];

const HERE = [
  ['enabled', 'Reading help', 'Notice when a passage is hard and offer help with it.'],
  ['show_interventions', 'Show help cards', 'Questions and explanations that appear while you read.'],
  ['auto_key_terms', 'Mark key words when explaining', 'When an explanation opens, the key words stay marked in the reading. Point at one and click to remove it.'],
  ['show_self_report', 'Show the “How is it going?” button', 'Lets you say a passage is hard yourself.'],
  ['autohide', 'Hide cards after a while', 'Cards close by themselves if you leave them.'],
  ['dark_mode', 'Dark cards', 'Help cards use a dark background.'],
  ['dyslexia', 'Dyslexia-friendly text', 'A readable font, wider spacing and a tinted background.'],
  // BETA-FEEDBACK: remove with the beta.
  ['beta_questions', 'Beta questions', 'Alcoia is in beta. Now and then, after a reading or a review, it asks one short question. Answers are stored without your name or account.'],
];
const EXTENSION_ONLY = [
  ['explain_on_highlight', 'Explain what I highlight', 'Select text on a web page to get a short explanation.'],
  ['highlight_color', 'Colour highlights', 'Highlights you make on web pages are coloured.'],
  ['show_connections', 'Show links to my other documents', 'Points out ideas you met in another reading.'],
];

// The reader's own switch for anonymous usage counts, read by the detection code the same way the extension reads it.
// Kept on this device (not on the account), because it is about what this browser sends.
const SHARE_STORAGE_KEY = 'alcoia_detection_sra_pool_share';
const readShare = () => { try { return localStorage.getItem(SHARE_STORAGE_KEY) !== 'false'; } catch { return true; } };

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`ws-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="ws-switch-knob" aria-hidden="true" />
    </button>
  );
}

function Row({ label, hint, control, sub }) {
  return (
    <div className={`set-row${sub ? ' set-row-sub' : ''}`}>
      <div className="set-text">
        <span className="set-label">{label}</span>
        {hint && <span className="set-hint">{hint}</span>}
      </div>
      <div className="set-control">{control}</div>
    </div>
  );
}

function Placeholder({ rows }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="set-row set-row-ghost"><span /><span /></div>
      ))}
    </div>
  );
}

// Settings for reading help. They are saved on your account, so they apply here and in the alcoia extension
// in every browser where you are signed in.
//
// Saves run one at a time and only the newest server answer is applied, so switching two things quickly can
// never bring an older value back. A failed save puts back only the value it changed.
export default function SettingsPage() {
  const { session } = useSession();
  const token = session.sessionToken;
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | failed
  const [memory, setMemory] = useState(null);
  const [memoryState, setMemoryState] = useState('loading'); // loading | ready | busy | error
  const [confirmOff, setConfirmOff] = useState(false);
  const [share, setShare] = useState(readShare);
  const queue = useRef(Promise.resolve());
  const latest = useRef(0);
  const confirmed = useRef(null); // the last values the server accepted

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    fetchSettings(token).then(
      (r) => { if (!cancelled) { confirmed.current = r.settings; setSettings(r.settings); setStatus('ready'); } },
      () => { if (!cancelled) setStatus('error'); },
    );
    fetchLearningMemory(token).then(
      (m) => { if (!cancelled) { setMemory(m); setMemoryState('ready'); } },
      () => { if (!cancelled) setMemoryState('error'); },
    );
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => load(), [load]);

  function change(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaveState('saving');
    const seq = ++latest.current;
    queue.current = queue.current.then(async () => {
      try {
        const r = await saveSettings({ [key]: value }, token);
        confirmed.current = r.settings;
        if (seq === latest.current) { setSettings(r.settings); setSaveState('saved'); }
      } catch {
        const was = confirmed.current?.[key];
        setSettings((s) => ({ ...s, [key]: was }));
        setSaveState('failed');
      }
    });
  }

  async function setMemoryOn(on) {
    setMemoryState('busy');
    try {
      setMemory(on ? await enableLearningMemory(token) : await disableLearningMemory(token));
      setConfirmOff(false);
      setMemoryState('ready');
    } catch {
      setMemoryState('error');
    }
  }

  function setShareOn(on) {
    setShare(on);
    try {
      localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(on));
      if (!on) localStorage.setItem('alcoia_detection_sra_pool_pending', '[]');
    } catch { /* storage blocked */ }
  }

  const ready = status === 'ready' && settings;
  const toggleRow = ([key, label, hint]) => (
    <Row
      key={key}
      label={label}
      hint={hint}
      control={<Switch checked={!!settings[key]} label={label} onChange={(v) => change(key, v)} />}
    />
  );
  const memoryOn = memory?.status === 'enabled';

  return (
    <section className="page settings-page">
      <div className="set-head">
        <h1 className="page-title">Settings</h1>
        <p className="set-status" role="status" aria-live="polite">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'All changes saved'}
          {saveState === 'failed' && <span className="set-status-error">A change could not be saved. Try again.</span>}
        </p>
      </div>
      <p className="muted set-intro">Saved on your account. They apply here and in the alcoia extension wherever you are signed in.</p>

      {status === 'error' && (
        <p className="alert alert-error">
          Settings could not be loaded. <button type="button" className="link-button" onClick={load}>Try again</button>
        </p>
      )}

      <div className="set-card">
        <h2 className="set-card-title">While you read</h2>
        {!ready ? <Placeholder rows={6} /> : (
          <>
            {HERE.slice(0, 4).map(toggleRow)}
            {settings.autohide && (
              <Row sub label="Hide after" control={(
                <select value={settings.autohide_timeout} onChange={(e) => change('autohide_timeout', Number(e.target.value))}>
                  {[6, 12, 20, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}
                </select>
              )} />
            )}
            {HERE.slice(4).map(toggleRow)}
            {settings.dyslexia && (
              <Row sub label="Background tint" control={(
                <select value={settings.dyslexia_color} onChange={(e) => change('dyslexia_color', e.target.value)}>
                  {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )} />
            )}
          </>
        )}
      </div>

      <div className="set-card">
        <h2 className="set-card-title">In the extension</h2>
        <p className="set-card-note">These apply on web pages you read with the alcoia browser extension.</p>
        {!ready ? <Placeholder rows={3} /> : EXTENSION_ONLY.map(toggleRow)}
      </div>

      <div className="set-card">
        <h2 className="set-card-title">Account-based learning</h2>
        <p className="set-card-note">alcoia remembers which passages you answered well and which to review, so questions fit you on any device. Only you can see it.</p>
        {memoryState === 'loading' ? <Placeholder rows={1} /> : (
          <Row
            label="Remember what I have learned"
            hint={memoryOn ? 'On' : 'Off'}
            control={(
              <Switch
                checked={memoryOn}
                label="Remember what I have learned"
                disabled={memoryState === 'busy' || !memory}
                onChange={(v) => (v ? setMemoryOn(true) : setConfirmOff(true))}
              />
            )}
          />
        )}
        {confirmOff && memoryOn && (
          <div className="set-confirm">
            <p>Turning it off stops new learning records. What is already stored stays until you delete it in the console.</p>
            <div className="set-confirm-actions">
              <button type="button" onClick={() => setMemoryOn(false)} disabled={memoryState === 'busy'}>Turn off</button>
              <button type="button" className="secondary" onClick={() => setConfirmOff(false)}>Keep it on</button>
            </div>
          </div>
        )}
        {memoryState === 'error' && <p className="alert alert-error">Account-based learning could not be loaded or changed.</p>}
      </div>

      <div className="set-card">
        <h2 className="set-card-title">Anonymous usage counts</h2>
        <p className="set-card-note">
          A few daily totals that help show whether alcoia works, such as how often a question failed to generate or
          which way of explaining readers said helped. Each total is a count with a short label: no account, page,
          text or device identifier. This choice is kept in this browser only.
        </p>
        <Row
          label="Send anonymous usage counts"
          control={<Switch checked={share} label="Send anonymous usage counts" onChange={setShareOn} />}
        />
      </div>
    </section>
  );
}
