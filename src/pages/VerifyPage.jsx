import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost, ApiError } from '../lib/api.js';
import { takePendingEmail } from '../lib/session.js';
import { useSession } from '../context/SessionContext.jsx';

const ERROR_MESSAGES = {
  invalid_request: 'This link is missing its token.',
  invalid_token: 'This link isn’t valid. Request a new one.',
  token_used: 'This link has already been used. Request a new one.',
  token_expired: 'This link has expired. Request a new one.',
};

// Confirm-then-verify, never verify-on-mount: mail clients prescan links by
// GETting them, which would burn the single-use token before the person
// clicks. The verify call fires only from the button.
export default function VerifyPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'confirm' : 'error');
  const [error, setError] = useState(token ? '' : ERROR_MESSAGES.invalid_request);

  async function handleConfirm() {
    setState('verifying');
    try {
      const body = await apiPost('/api/auth/magic-link/verify', { token });
      if (body?.kind !== 'console') {
        // An extension-kind response is a code, not a session; never
        // half-handle it here.
        setError('This link is for the alcoia extension, not this site.');
        setState('error');
        return;
      }
      signIn({ sessionToken: body.sessionToken, kind: body.kind, expiresAt: body.expiresAt, email: takePendingEmail() });
      // Strip the spent token and navigate imperatively in the same tick;
      // signIn() swaps the layout tree and can remount this page.
      window.history.replaceState({}, '', window.location.pathname);
      navigate('/assignments', { replace: true });
    } catch (err) {
      setError(ERROR_MESSAGES[err instanceof ApiError ? err.code : null] ?? 'Could not verify this link.');
      setState('error');
    }
  }

  if (state === 'confirm' || state === 'verifying') {
    return (
      <section className="signin">
        <div className="signin-box">
          <h2>Sign in</h2>
          <p>Select the button to finish signing in.</p>
          <button type="button" className="block" onClick={handleConfirm} disabled={state === 'verifying'}>
            {state === 'verifying' ? 'Signing in' : 'Sign in'}
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="signin">
      <div className="signin-box">
        <h2>Sign-in failed</h2>
        <p className="alert alert-error">{error}</p>
        <p><Link to="/sign-in">Back to sign in</Link></p>
      </div>
    </section>
  );
}
