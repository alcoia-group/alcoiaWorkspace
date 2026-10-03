import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { apiPost, ApiError } from '../lib/api.js';
import ReportingNotice from '../components/ReportingNotice.jsx';

// Where a student lands from an LMS launch when they have no extension to
// answer it. The launch page on the marketing site puts what it received in
// the URL fragment (never sent to a server or logged):
//   #p=<base64url JSON { ackCode, reportingMode }>  the student still has to
//       agree to the reporting-mode notice, shown here before the button exists
//   #s=<session token>                              nothing left to agree to;
//       sign in with it and show the student's assignments
// Read once and remembered: React StrictMode runs initializers twice in
// development and the second run would find the fragment already stripped.
let cachedLaunch = null;
function readFragment() {
  if (cachedLaunch) return cachedLaunch;
  cachedLaunch = parseFragment();
  return cachedLaunch;
}

function parseFragment() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  history.replaceState(null, '', window.location.pathname);
  const session = params.get('s');
  if (session) return { kind: 'session', sessionToken: session };
  const packed = params.get('p');
  if (!packed) return { kind: 'none' };
  try {
    const b64 = packed.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(decodeURIComponent(escape(atob(b64))));
    if (typeof data.ackCode === 'string' && data.ackCode
      && (data.reportingMode === 'anonymous' || data.reportingMode === 'identified')) {
      return { kind: 'disclosure', ackCode: data.ackCode, reportingMode: data.reportingMode };
    }
  } catch { /* fall through */ }
  return { kind: 'none' };
}

const ERRORS = {
  invalid_code: 'This launch link is no longer valid. Open the reading from your course again.',
  code_already_used: 'This launch was already confirmed. Open the reading from your course again.',
  code_expired: 'This launch link has expired. Open the reading from your course again.',
};

export default function LtiJoinPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [launch] = useState(readFragment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A session handed over directly: sign in and go.
  useEffect(() => {
    if (launch.kind !== 'session' || launch.used) return;
    launch.used = true;
    signIn({ sessionToken: launch.sessionToken, kind: 'lti' });
    navigate('/assignments', { replace: true });
  }, [launch, signIn, navigate]);

  async function agree() {
    setBusy(true);
    setError('');
    try {
      const body = await apiPost('/api/lti/disclosure/ack', { acknowledged: true, ackCode: launch.ackCode });
      // Straight into the assignment when the launch named one (the redirect
      // carries a one-use code that signs the student in); otherwise use the
      // session just created and show the list.
      const target = typeof body.redirectTo === 'string' ? new URL(body.redirectTo, window.location.origin) : null;
      if (target && target.origin === window.location.origin && target.hash.startsWith('#c=')) {
        window.location.replace(target.toString());
        return;
      }
      signIn({ sessionToken: body.sessionToken, kind: body.kind || 'lti' });
      navigate('/assignments', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && ERRORS[err.code] ? ERRORS[err.code] : 'Could not confirm. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <section className="page narrow">
      <h1 className="page-title">Join your class</h1>
      {launch.kind === 'disclosure' ? (
        <>
          <ReportingNotice reportingMode={launch.reportingMode} />
          <button type="button" onClick={agree} disabled={busy}>{busy ? 'Joining' : 'Join this class'}</button>
          {error && <p className="alert alert-error">{error}</p>}
        </>
      ) : launch.kind === 'session' ? (
        <p className="muted">Opening your assignments.</p>
      ) : (
        <p className="alert alert-error">This page needs a launch from your course. Open the reading from your course again.</p>
      )}
    </section>
  );
}
