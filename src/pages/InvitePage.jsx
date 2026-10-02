import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { ApiError } from '../lib/api.js';
import { previewInvite, acceptInvite } from '../lib/invites.js';
import { setReturnPath } from '../lib/session.js';

const PREVIEW_ERRORS = {
  invalid_request: 'This invite link is missing its code.',
  invalid_invite: 'This invite link is not valid. Ask your instructor for a new one.',
  invite_revoked: 'This invite link was cancelled. Ask your instructor for a new one.',
  invite_expired: 'This invite link has expired. Ask your instructor for a new one.',
  invite_full: 'This invite link has been used up. Ask your instructor for a new one.',
  org_plan_expired: 'This class is not accepting new students right now. Ask your instructor.',
  invite_preview_rate_limit: 'Too many attempts. Try again in a little while.',
};

const JOIN_ERRORS = {
  ...PREVIEW_ERRORS,
  domain_mismatch: 'This invite is only for people with a particular school email address, and the address you signed in with does not match.',
  seat_capacity_exceeded: 'This class is full. Ask your instructor.',
};

// The reporting-mode notice is the promise made to the student, and it cannot
// be changed after they join. It is shown, in full, before there is any way to
// join (the join button is rendered inside this component's ready state only).
function ReportingNotice({ className, reportingMode }) {
  return (
    <div className="notice" role="region" aria-label="What your instructor can see">
      <h2>What your instructor can see</h2>
      {reportingMode === 'identified' ? (
        <>
          <p>
            In <strong>{className}</strong>, your instructor sees <strong>individual results</strong>:
            which parts of a reading you found hard and how you answered the questions, with your name
            on them.
          </p>
          <p>
            This was set when the class was created and cannot be changed after you join. If you would
            rather not be seen individually, do not join this class.
          </p>
        </>
      ) : (
        <>
          <p>
            In <strong>{className}</strong>, your instructor sees <strong>aggregate results only</strong>,
            things like “most of the class found section 2 hard.” Nothing about your own reading,
            individually, is visible to them.
          </p>
          <p>
            The one exception: if you choose to submit a reading receipt for a specific assignment, your
            instructor sees that one receipt. Nothing else, and never automatically.
          </p>
        </>
      )}
    </div>
  );
}

export default function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || params.get('code');
  const { session, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState(token ? { status: 'loading' } : { status: 'error', message: PREVIEW_ERRORS.invalid_request });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    previewInvite(token)
      .then((info) => !cancelled && setState({ status: 'ready', info }))
      .catch((err) => {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.code : null;
        setState({ status: 'error', message: PREVIEW_ERRORS[code] ?? 'This invite could not be checked. Try again in a moment.' });
      });
    return () => { cancelled = true; };
  }, [token]);

  function goSignIn() {
    const here = location.pathname + location.search;
    setReturnPath(here);
    navigate('/sign-in', { state: { from: here } });
  }

  async function handleJoin() {
    setJoining(true);
    setJoinError('');
    try {
      await acceptInvite(token, session.sessionToken);
      setState((prev) => ({ ...prev, status: 'joined' }));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'already_a_member') {
        setState((prev) => ({ ...prev, status: 'joined' }));
      } else if (err instanceof ApiError && err.status === 401) {
        signOut();
        setJoinError('Your sign-in ended. Sign in again to join.');
      } else {
        setJoinError(JOIN_ERRORS[code] ?? 'Could not join the class. Check your connection and try again.');
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <section className="page narrow">
      <h1 className="page-title">Join a class</h1>
      {state.status === 'loading' && <p className="muted">Checking your invite.</p>}
      {state.status === 'error' && <p className="alert alert-error">{state.message}</p>}

      {state.status === 'ready' && (
        <>
          <p>You have been invited to <strong>{state.info.className}</strong>.</p>
          <ReportingNotice className={state.info.className} reportingMode={state.info.reportingMode} />
          {state.info.domain && (
            <p className="muted">This invite is for people with an <strong>@{state.info.domain}</strong> email address.</p>
          )}
          {session ? (
            <button type="button" onClick={handleJoin} disabled={joining}>
              {joining ? 'Joining' : 'Join this class'}
            </button>
          ) : (
            <button type="button" onClick={goSignIn}>Sign in to join</button>
          )}
          {joinError && <p className="alert alert-error">{joinError}</p>}
        </>
      )}

      {state.status === 'joined' && (
        <>
          <p className="alert">You have joined <strong>{state.info.className}</strong>.</p>
          <p>
            Your assignments are on the <Link to="/assignments">assignments page</Link>. To get alcoia’s
            help while you read, install the alcoia browser extension and sign in with the same email
            address.
          </p>
        </>
      )}
    </section>
  );
}
