import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchMyAssignments } from '../lib/assignments.js';
import { formatDue, formatLabel, isDueSoon, readingMinutes, formatLength, longReadingNotice } from '../lib/format.js';

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

  const items = [...state.items].sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt));

  return (
    <section className="page">
      <h1 className="page-title">Materials</h1>
      {state.status === 'loading' && <p className="muted">Loading materials.</p>}
      {state.status === 'error' && (
        <p className="alert alert-error">Materials could not be loaded. Try again in a moment.</p>
      )}
      {state.status === 'ready' && items.length === 0 && (
        <p className="empty">You have no materials right now.</p>
      )}
      {items.length > 0 && (
        <table className="lms-table">
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Due</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.assignmentId}>
                <td>
                  <Link className="row-link" to={`/a/${a.assignmentId}`} reloadDocument>{a.name || a.className}</Link>
                  {a.name && <div className="muted">{a.className}</div>}
                </td>
                <td>
                  {a.documents[0] ? formatLabel(a.documents[0].format) : 'No file yet'}
                  {readingMinutes(a.documents[0]?.wordCount) != null && <div className="muted">{formatLength(readingMinutes(a.documents[0].wordCount))}</div>}
                </td>
                <td>
                  {formatDue(a.closesAt)}
                  {isDueSoon(a.closesAt) && <span className="tag">Due soon</span>}
                  {longReadingNotice(readingMinutes(a.documents[0]?.wordCount), a.closesAt) && <div className="muted">{longReadingNotice(readingMinutes(a.documents[0]?.wordCount), a.closesAt)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
