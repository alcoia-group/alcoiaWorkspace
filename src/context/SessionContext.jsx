import { createContext, useContext, useMemo, useState } from 'react';
import { getSession, setSession as persistSession, clearSession as clearPersistedSession } from '../lib/session.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession());

  const value = useMemo(
    () => ({
      session,
      signIn(sessionData) {
        persistSession(sessionData);
        setSessionState(sessionData);
      },
      signOut() {
        // No server-side revoke endpoint exists yet (the server has no
        // /api/auth/logout) -- this clears the credential this app holds.
        // The session token itself remains valid server-side until its
        // own TTL expires; there is currently nothing this app can do
        // about that beyond not holding onto it.
        clearPersistedSession();
        setSessionState(null);
      },
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
