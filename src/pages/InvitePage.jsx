import { Link, useSearchParams } from 'react-router-dom';

// Deliberately does not call POST /api/invites/accept yet. A student must be
// told the class's reporting mode (anonymous vs identified) BEFORE joining
// -- the promise is made to the student and cannot be changed afterwards.
// The server gives a not-yet-joined student no way to learn that mode:
// accept returns only { classId, seatId, role }, and the class/roster reads
// are staff-only. Joining first and disclosing after would break the
// promise's own timing. See CLAUDE.md "Known gaps".
export default function InvitePage() {
  const [params] = useSearchParams();
  const hasToken = Boolean(params.get('token'));
  return (
    <section className="app-main">
      <h1>Join a class</h1>
      {!hasToken && <p className="status-line status-error">This invite link is missing its token.</p>}
      <div className="notice">
        Joining by invite isn’t available here yet. Before you join, you need to be told whether your
        instructor sees only class-wide results or your individual results, and this page can’t look
        that up safely yet.
      </div>
      <p><Link to="/sign-in">Sign in</Link></p>
    </section>
  );
}
