import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import wordmark from '../assets/img/alcoia-wordmark.png';
import { apiPost, ApiError } from '../lib/api.js';
import { setPendingEmail } from '../lib/session.js';
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
      // 'console' is the only browser-session kind the server issues; the
      // 'extension' kind needs a code handoff a web page can't complete.
      await apiPost('/api/auth/magic-link', { email: email.trim(), kind: 'console' });
      setPendingEmail(email.trim());
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
    <section className="center-card">
      <img src={wordmark} alt="alcoia" className="wordmark-img" />
      {state === 'sent' ? (
        <>
          <h1>Check your email</h1>
          <p>If that address can sign in, a link is on its way. It works once and expires soon.</p>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <h1>Sign in to read your assignments</h1>
          <p>We’ll email you a link. No password to remember.</p>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <p>
            <button type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </p>
          {state === 'error' && <p className="status-line status-error">{message}</p>}
        </form>
      )}
    </section>
  );
}
