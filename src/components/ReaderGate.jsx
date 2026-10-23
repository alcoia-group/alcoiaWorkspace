import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { captureHandoffCode, clearHandoffCode, exchangeHandoffCode } from '../lib/handoff.js';
import ReaderPage from '../pages/ReaderPage.jsx';

// Guards /a/:assignmentId. Opened from the extension (a code in the URL
// fragment) the student lands directly on the assignment with no sign-in
// step. Opened any other way, the default stands: no session means the
// sign-in page, and a guessed URL shows nothing.
export default function ReaderGate() {
  const { assignmentId } = useParams();
  const { session, signIn } = useSession();
  const location = useLocation();
  const [code] = useState(() => captureHandoffCode());
  const [state, setState] = useState(code ? 'exchanging' : 'done');

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    exchangeHandoffCode(code, assignmentId)
      .then((body) => {
        if (cancelled) return;
        signIn({ sessionToken: body.sessionToken, kind: body.kind, expiresAt: body.expiresAt, email: body.email });
      })
      .catch(() => {
        // Bad, used or expired code: fall back to whatever session exists,
        // else sign-in. Never an error that says why.
      })
      .finally(() => {
        clearHandoffCode();
        if (!cancelled) setState('done');
      });
    return () => { cancelled = true; };
  }, [code, assignmentId, signIn]);

  if (state === 'exchanging') {
    return <section className="page"><p className="muted">Opening your material.</p></section>;
  }
  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <ReaderPage />;
}
