import { apiGet, ApiError } from './api.js';

// Where the learner turns account-based learning on (the Workspace has no settings page of its
// own; the control lives in the console and the extension) and where plans are described.
export const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL || 'http://localhost:8080';
export const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || 'https://alcoia.app';

// GET /api/account/learner-analytics. The server decides everything: this app never reads a
// plan name or consent value from anywhere else.
//   200 -> { kind: 'ready', data }
//   403 capability_required -> { kind: 'upgrade' }  (not on a plan that includes it)
//   403 learner_memory_consent_required -> { kind: 'memory', status }  (the learner turned
//       learning memory off: 'disabled'); no analytics data accompanies it
// Anything else (401, 5xx, network) throws for the page to handle.
export async function fetchLearnerAnalytics(sessionToken) {
  try {
    return { kind: 'ready', data: await apiGet('/api/account/learner-analytics', { sessionToken }) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      if (err.code === 'capability_required') return { kind: 'upgrade' };
      if (err.code === 'learner_memory_consent_required') return { kind: 'memory', status: err.body?.status ?? 'disabled' };
    }
    throw err;
  }
}
