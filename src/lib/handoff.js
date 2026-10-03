import { apiPost } from './api.js';

// The extension opens /a/<id>#c=<code>. The code travels in the URL
// fragment so it never reaches a server log or Referer. It is single use,
// so it must be read once and exchanged once, even though React StrictMode
// runs initializers and effects twice in development.
let captured = null;
const inFlight = new Map();

// Reads the code from the fragment (if any) and strips it from the address
// bar immediately. Idempotent across StrictMode's double invocation: the
// second call finds the fragment already gone and returns the same code.
export function captureHandoffCode() {
  const match = /[#&]c=([^&]+)/.exec(window.location.hash);
  if (match) {
    captured = decodeURIComponent(match[1]);
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }
  return captured;
}

export function clearHandoffCode() {
  captured = null;
}

// POST /api/reader/exchange -> { sessionToken, email, kind: 'reader', expiresAt }.
// One network call per code, however many times this is invoked.
export function exchangeHandoffCode(code, assignmentId) {
  if (!inFlight.has(code)) {
    inFlight.set(code, apiPost('/api/reader/exchange', { code, assignmentId }));
  }
  return inFlight.get(code);
}
