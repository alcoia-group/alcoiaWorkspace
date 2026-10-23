import { apiPost } from './api.js';

// What the student must be told before joining. Public: no session needed.
export function previewInvite(token) {
  return apiPost('/api/invites/preview', { token });
}

// Joining. `acknowledged: true` says the student was shown the reporting
// notice first, which this page guarantees (the button only exists after the
// notice is on screen).
export function acceptInvite(token, sessionToken) {
  return apiPost('/api/invites/accept', { token, acknowledged: true }, { sessionToken });
}
