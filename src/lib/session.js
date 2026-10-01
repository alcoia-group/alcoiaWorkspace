// localStorage, not a cookie -- same reasoning as alcoiaConsole's CLAUDE.md
// §4: alcoiaServer only ever reads `Authorization: Bearer <token>`, so a
// cookie set here would be no safer and would add an auto-sent credential.
const SESSION_KEY = 'alcoia_assignments_session';
const PENDING_EMAIL_KEY = 'alcoia_assignments_pending_email';

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  if (!parsed?.sessionToken) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  // expiresAt is optional: a handed-off bare token carries none, and the
  // server enforces its own TTL on every request regardless.
  if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return parsed;
}

export function setSession({ sessionToken, kind, expiresAt, email }) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ sessionToken, kind, expiresAt: expiresAt ?? null, email: email ?? null }),
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function setPendingEmail(email) {
  localStorage.setItem(PENDING_EMAIL_KEY, email);
}

export function takePendingEmail() {
  const email = localStorage.getItem(PENDING_EMAIL_KEY);
  localStorage.removeItem(PENDING_EMAIL_KEY);
  return email;
}
