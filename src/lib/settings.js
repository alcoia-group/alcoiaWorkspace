import { apiGet, apiPost, apiPut } from './api.js';
import { STORAGE_PREFIX } from '../detection/platform.js';

// Reading settings follow the account (GET/PUT /api/account/settings): the same choices apply here and in
// every browser with the alcoia extension. The server keeps a closed list; unknown keys are ignored there.
export const SETTING_TO_STORAGE = Object.freeze({
  enabled: 'sra_enabled',
  show_interventions: 'sra_show_interventions',
  explain_on_highlight: 'sra_explain_on_highlight',
  show_self_report: 'sra_show_self_report',
  show_connections: 'sra_show_connections',
  dyslexia: 'sra_dyslexia',
  dyslexia_color: 'sra_dyslexia_color',
  dark_mode: 'sra_dark_mode',
  autohide: 'sra_autohide',
  autohide_timeout: 'sra_autohide_timeout',
  highlight_color: 'sra_highlight_color',
});
const SNAPSHOT_KEY = 'sra_account_sync_snapshot';

export function fetchSettings(sessionToken) {
  return apiGet('/api/account/settings', { sessionToken });
}

// Saves on the account, then copies the values to this browser's reading detection so an open reading picks
// them up (as the account's own values, so they are not sent back again).
export async function saveSettings(changes, sessionToken) {
  const saved = await apiPut('/api/account/settings', changes, { sessionToken });
  try {
    const snap = JSON.parse(localStorage.getItem(STORAGE_PREFIX + SNAPSHOT_KEY) || '{}');
    for (const [k, v] of Object.entries(changes)) {
      const key = SETTING_TO_STORAGE[k];
      if (!key) continue;
      snap[key] = v;
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(v));
    }
    localStorage.setItem(STORAGE_PREFIX + SNAPSHOT_KEY, JSON.stringify(snap));
  } catch { /* storage blocked: the next reading page loads them from the account */ }
  return saved;
}

// Account-based learning (the learner's own memory), the same endpoints the console uses.
export const fetchLearningMemory = (sessionToken) => apiGet('/api/account/learning-memory', { sessionToken });
export const enableLearningMemory = (sessionToken) => apiPost('/api/account/learning-memory/enable', { confirm: true }, { sessionToken });
export const disableLearningMemory = (sessionToken) => apiPost('/api/account/learning-memory/disable', {}, { sessionToken });
