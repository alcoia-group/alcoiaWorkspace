import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchMyAssignments, fetchSeatNotices, seenNoticeIds, markNoticeSeen } from '../lib/assignments.js';
import { formatDue, formatLabel, isDueSoon, longReadingNotice } from '../lib/format.js';
import { estimateMinutes, minutesLeft, lengthLine, basisNote } from '../lib/readingTime.js';
import { fractionLeft, loadPosition } from '../lib/resume.js';
import { useReadingEstimate } from '../lib/useReadingEstimate.js';

export default function AssignmentsPage() {
  const { session, signOut } = useSession();
  const [state, setState] = useState({ status: 'loading', items: [] });
  const pace = useReadingEstimate(session.sessionToken);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchSeatNotices(session.sessionToken).then((list) => {
      if (cancelled) return;
      const seen = seenNoticeIds();
      setNotices(list.filter((n) => !seen.has(n.id)));
    });
    return () => { cancelled = true; };
  }, [session.sessionToken]);

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
      {notices.map((n) => (
        <p key={n.id} className="alert" role="status">
          You were removed from {n.className ?? 'a class'} by your instructor{n.reason ? `. Reason given: ${n.reason}` : ''}. If this is a mistake, ask your instructor to add you again.{' '}
          <button type="button" className="link-button" onClick={() => { markNoticeSeen(n.id); setNotices((l) => l.filter((x) => x.id !== n.id)); }}>Dismiss</button>
        </p>
      ))}
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
            {items.map((a) => {
              // The reader's own pace, plus help cards when those are on; "left" once they have started (the place is kept in
              // this browser only). Shown once the pace has loaded, so the number does not change under the reader.
              const est = pace.ready ? estimateMinutes({ wordCount: a.documents[0]?.wordCount, baseline: pace.baseline, help: pace.help }) : null;
              const place = loadPosition(session.email ?? null, a.assignmentId);
              const left = est && place ? minutesLeft(est.minutes, fractionLeft(place.index, place.total)) : null;
              return (
              <tr key={a.assignmentId}>
                <td>
                  <Link className="row-link" to={`/a/${a.assignmentId}`} reloadDocument>{a.name || a.className}</Link>
                  {a.name && <div className="muted">{a.className}</div>}
                </td>
                <td>
                  {a.documents[0] ? formatLabel(a.documents[0].format) : 'No file yet'}
                  {est && <div className="muted" title={basisNote(est)}>{lengthLine(est, left)}</div>}
                </td>
                <td>
                  {formatDue(a.closesAt)}
                  {isDueSoon(a.closesAt) && <span className="tag">Due soon</span>}
                  {longReadingNotice(left ?? est?.minutes ?? null, a.closesAt) && <div className="muted">{longReadingNotice(left ?? est?.minutes ?? null, a.closesAt)}</div>}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
