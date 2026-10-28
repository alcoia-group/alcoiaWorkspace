import { useEffect, useState } from 'react';
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
  ['show_self_report', 'Show the “How is it going?” button', 'Lets you say a passage is hard yourself.'],
  ['autohide', 'Hide cards after a while', null],
  ['dark_mode', 'Dark cards', null],
  ['dyslexia', 'Dyslexia-friendly text', 'A readable font, wider spacing and a tinted background.'],
];
const EXTENSION_ONLY = [
  ['explain_on_highlight', 'Explain what I highlight', null],
  ['highlight_color', 'Colour highlights', null],
  ['show_connections', 'Show links to my other documents', null],
];

// The reader's own switch for anonymous usage counts, read by the detection code the same way the extension reads it.
// Kept on this device (not on the account), because it is about what this browser sends.
const SHARE_STORAGE_KEY = 'alcoia_detection_sra_pool_share';
const readShare = () => { try { return localStorage.getItem(SHARE_STORAGE_KEY) !== 'false'; } catch { return true; } };

// Settings for reading help. They are saved on your account, so they apply here and in the alcoia extension
// in every browser where you are signed in.
export default function SettingsPage() {
  const { session } = useSession();
  const token = session.sessionToken;
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [saveState, setSaveState] = useState(null); // null | saved | failed
  const [memory, setMemory] = useState(null);
  const [memoryError, setMemoryError] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [share, setShare] = useState(readShare);

  useEffect(() => {
    let cancelled = false;
    fetchSettings(token).then(
      (r) => { if (!cancelled) { setSettings(r.settings); setStatus('ready'); } },
      () => { if (!cancelled) setStatus('error'); },
    );
    fetchLearningMemory(token).then((m) => { if (!cancelled) setMemory(m); }, () => { if (!cancelled) setMemoryError(true); });
    return () => { cancelled = true; };
  }, [token]);

  async function change(key, value) {
    const before = settings;
    setSettings({ ...settings, [key]: value });
    setSaveState(null);
    try {
      const r = await saveSettings({ [key]: value }, token);
      setSettings(r.settings);
      setSaveState('saved');
    } catch {
      setSettings(before);
      setSaveState('failed');
    }
  }

  async function setMemoryOn(on) {
    setMemoryError(false);
    try {
      setMemory(on ? await enableLearningMemory(token) : await disableLearningMemory(token));
      setConfirmOff(false);
    } catch {
      setMemoryError(true);
    }
  }

  const row = ([key, label, hint]) => (
    <label className="setting-row" key={key}>
      <input type="checkbox" checked={!!settings[key]} onChange={(e) => change(key, e.target.checked)} />
      <span>
        <span className="setting-label">{label}</span>
        {hint && <span className="muted setting-hint">{hint}</span>}
      </span>
    </label>
  );

  return (
    <section className="page settings-page">
      <h1 className="page-title">Settings</h1>
      <p className="muted">Saved on your account. They apply here and in the alcoia extension wherever you are signed in.</p>
      {status === 'loading' && <p className="muted">Loading.</p>}
      {status === 'error' && <p className="alert alert-error">Settings could not be loaded.</p>}
      {status === 'ready' && settings && (
        <>
          <h2>While you read</h2>
          {HERE.map(row)}
          {settings.autohide && (
            <label className="setting-row setting-sub">
              <span className="setting-label">Hide after</span>
              <select value={settings.autohide_timeout} onChange={(e) => change('autohide_timeout', Number(e.target.value))}>
                {[6, 12, 20, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}
              </select>
            </label>
          )}
          {settings.dyslexia && (
            <label className="setting-row setting-sub">
              <span className="setting-label">Background tint</span>
              <select value={settings.dyslexia_color} onChange={(e) => change('dyslexia_color', e.target.value)}>
                {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          )}
          <h2>In the extension</h2>
          {EXTENSION_ONLY.map(row)}
          {saveState === 'saved' && <p className="muted" role="status">Saved.</p>}
          {saveState === 'failed' && <p className="alert alert-error" role="alert">That change could not be saved. Try again.</p>}
        </>
      )}

      <h2>Account-based learning</h2>
      <p>alcoia remembers which passages you answered well and which to review, so questions fit you on any device. Only you can see it.</p>
      {memory && (
        <>
          <p><strong>{memory.status === 'enabled' ? 'On' : 'Off'}</strong></p>
          {memory.status === 'enabled' && !confirmOff && (
            <button type="button" className="secondary" onClick={() => setConfirmOff(true)}>Turn off</button>
          )}
          {memory.status === 'enabled' && confirmOff && (
            <div className="panel-actions">
              <span>Turning it off stops new learning records. What is already stored stays until you delete it in the console.</span>
              <button type="button" onClick={() => setMemoryOn(false)}>Turn off</button>
              <button type="button" className="secondary" onClick={() => setConfirmOff(false)}>Keep it on</button>
            </div>
          )}
          {memory.status !== 'enabled' && <button type="button" onClick={() => setMemoryOn(true)}>Turn on</button>}
        </>
      )}
      {memoryError && <p className="alert alert-error">Account-based learning could not be loaded or changed.</p>}

      <h2>Anonymous usage counts</h2>
      <p>alcoia sends a few daily totals that help show whether it works: how often a question or explanation failed to generate, how often each kind of prompt was answered or closed, which way of explaining readers said helped, and how follow-up checks turned out. Each total is a count with a short label, with no account, page, text or device identifier. Turn this off and nothing is sent from this browser.</p>
      <label className="setting-row">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => {
            const on = e.target.checked;
            setShare(on);
            try { localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(on)); if (!on) localStorage.setItem('alcoia_detection_sra_pool_pending', '[]'); } catch { /* storage blocked */ }
          }}
        />
        <span className="setting-label">Send anonymous usage counts</span>
      </label>

    </section>
  );
}
