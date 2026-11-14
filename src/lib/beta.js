// BETA-FEEDBACK: this whole file goes when the beta ends (alcoiaServer docs/beta-feedback-plan.md, "Removing it").
// Whether a beta question may be asked here (the server says the beta is open and the reader has not turned beta
// questions off), and sending one answer. Answers are stored on the server without the account.
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from './api.js';

export function useBetaQuestions(sessionToken) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!sessionToken) return undefined;
    let cancelled = false;
    Promise.all([
      apiGet('/api/beta-feedback/status').catch(() => null),
      apiGet('/api/account/settings', { sessionToken }).catch(() => null),
    ]).then(([status, settings]) => {
      if (!cancelled) setOn(status?.open === true && settings?.settings?.beta_questions !== false);
    });
    return () => { cancelled = true; };
  }, [sessionToken]);
  return on;
}

export function sendBetaAnswer(sessionToken, { kind, answer, note, assignmentId }) {
  return apiPost('/api/beta-feedback', {
    surface: 'workspace', kind, answer,
    ...(note ? { note } : {}),
    ...(assignmentId ? { assignmentId } : {}),
  }, { sessionToken }).then(() => true, () => false);
}
