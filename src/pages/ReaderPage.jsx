import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchDownloadUrl, fetchMyAssignments } from '../lib/assignments.js';

// The reader itself is NOT built: alcoiaServer has no endpoint that returns
// a document as HTML (the only document read is the signed download URL,
// served as an attachment, and no PDF/PPTX conversion exists server-side --
// DOCX extraction only decides documents.status, then discards the text).
// This page shows what is real -- the assignment and its document -- and
// says plainly that in-page reading is not available yet. See CLAUDE.md.
export default function ReaderPage() {
  const { assignmentId } = useParams();
  const { session } = useSession();
  const [state, setState] = useState({ status: 'loading', assignment: null });
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyAssignments(session.sessionToken)
      .then((items) => {
        if (cancelled) return;
        const assignment = items.find((a) => a.assignmentId === assignmentId) ?? null;
        setState({ status: assignment ? 'ready' : 'missing', assignment });
      })
      .catch(() => !cancelled && setState({ status: 'error', assignment: null }));
    return () => { cancelled = true; };
  }, [assignmentId, session.sessionToken]);

  async function handleDownload(documentId) {
    setDownloadError(false);
    try {
      window.open(await fetchDownloadUrl(documentId, session.sessionToken), '_blank', 'noopener');
    } catch {
      setDownloadError(true);
    }
  }

  const { status, assignment } = state;
  return (
    <section className="app-main">
      <p><Link to="/assignments">← Your assignments</Link></p>
      {status === 'loading' && <p>Loading…</p>}
      {status === 'error' && <p className="status-line status-error">Could not load this assignment.</p>}
      {status === 'missing' && (
        <>
          <h1>Assignment not available</h1>
          <p>It may have closed, or it may belong to a class you haven’t joined.</p>
        </>
      )}
      {status === 'ready' && (
        <>
          <h1>{assignment.className}</h1>
          <p className="meta">Closes {new Date(assignment.closesAt).toLocaleString()}</p>
          <div className="notice">
            Reading in the page isn’t available yet. For now the document can only be downloaded.
          </div>
          {assignment.documents.length === 0 && <p>No document has been attached yet.</p>}
          {assignment.documents.map((d) => (
            <div className="card card-row" key={d.documentId}>
              <span>{d.format.toUpperCase()} document</span>
              <button type="button" className="secondary" onClick={() => handleDownload(d.documentId)}>
                Download
              </button>
            </div>
          ))}
          {downloadError && <p className="status-line status-error">Could not get the download link.</p>}
        </>
      )}
    </section>
  );
}
