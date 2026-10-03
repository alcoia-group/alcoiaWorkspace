import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { apiPost, ApiError } from '../lib/api.js';
import { setPendingEmail, setReturnPath } from '../lib/session.js';
import { useSession } from '../context/SessionContext.jsx';

export default function SignInPage() {
  const { session } = useSession();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  if (session) return <Navigate to={location.state?.from ?? '/assignments'} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setState('sending');
    try {
      // app: 'workspace' makes the emailed link open this site, not the
      // console. 'console' is the only browser-session kind the server issues; the
      // 'extension' kind needs a code handoff a web page can't complete.
      await apiPost('/api/auth/magic-link', { email: email.trim(), kind: 'console', app: 'workspace' });
      setPendingEmail(email.trim());
      // Carry the page that sent us here (an invite, say) across the emailed link.
      if (location.state?.from) setReturnPath(location.state.from);
      setState('sent');
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.code === 'invalid_email'
          ? 'That doesn’t look like an email address.'
          : 'Could not send the link. Check your connection and try again.',
      );
      setState('error');
    }
  }

  return (
    <section className="signin">
      <div className="signin-box">
        <Logo adaptive className="logo-auth" />
        {state === 'sent' ? (
          <>
            <h2>Check your email</h2>
            <p>If that address can sign in, a link is on its way. It works once and expires soon.</p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2>Sign in</h2>
            <p>Enter your email address and we will send you a sign-in link.</p>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="block" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending' : 'Send sign-in link'}
            </button>
            {state === 'error' && <p className="alert alert-error">{message}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
