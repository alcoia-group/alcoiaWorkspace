import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchMyAssignments } from '../lib/assignments.js';

export default function AssignmentsPage() {
  const { session, signOut } = useSession();
  const [state, setState] = useState({ status: 'loading', items: [] });

  useEffect(() => {
    let cancelled = false;
    fetchMyAssignments(session.sessionToken)
      .then((items) => !cancelled && setState({ status: 'ready', items }))
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) signOut();
        else setState({ status: 'error', items: [] });
      });
    return () => { cancelled = true; };
  }, [session.sessionToken, signOut]);

  return (
    <section className="app-main">
      <h1>Your assignments</h1>
      {state.status === 'loading' && <p>Loading…</p>}
      {state.status === 'error' && (
        <p className="status-line status-error">Could not load your assignments. Try again in a moment.</p>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <p>Nothing assigned right now. Open assignments appear here once your instructor adds them.</p>
      )}
      {state.items.map((a) => (
        <div className="card card-row" key={a.assignmentId}>
          <div>
            <strong>{a.className}</strong>
            <p className="meta">Closes {new Date(a.closesAt).toLocaleString()}</p>
          </div>
          <Link className="button" to={`/a/${a.assignmentId}`}>Open</Link>
        </div>
      ))}
    </section>
  );
}
