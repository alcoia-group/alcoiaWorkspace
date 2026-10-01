import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchDocument, fetchDownloadUrl, fetchMyAssignments } from '../lib/assignments.js';
import DocxViewer from '../components/viewers/DocxViewer.jsx';
import SlideViewer from '../components/viewers/SlideViewer.jsx';
// pdf.js is large; only load it for a PDF.
const PdfViewer = lazy(() => import('../components/viewers/PdfViewer.jsx'));

// The reader. Word documents (DocxViewer), PowerPoint decks (SlideViewer) and
// PDFs (PdfViewer) render in the page; a document the server cannot read (a
// scanned PDF, a failed conversion) falls back to the original download, said plainly.
// A 401 means the session ended (reader sessions are time-limited): the
// student is sent to sign in and brought straight back here.
export default function ReaderPage() {
  const { assignmentId } = useParams();
  const { session, signOut } = useSession();
  const location = useLocation();
  const [state, setState] = useState({ status: 'loading' });
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchMyAssignments(session.sessionToken);
        const assignment = items.find((a) => a.assignmentId === assignmentId) ?? null;
        if (!assignment) {
          if (!cancelled) setState({ status: 'missing' });
          return;
        }
        let doc = null;
        try {
          doc = await fetchDocument(assignmentId, session.sessionToken);
        } catch (err) {
          if (err.status === 401) throw err;
          // 404 (no document yet) and anything else: show the assignment without one.
        }
        if (!cancelled) setState({ status: 'ready', assignment, doc });
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) setState({ status: 'expired' });
        else setState({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [assignmentId, session.sessionToken]);

  useEffect(() => {
    if (state.status === 'expired') signOut();
  }, [state.status, signOut]);

  async function handleDownload(documentId) {
    setDownloadError(false);
    try {
      window.open(await fetchDownloadUrl(documentId, session.sessionToken), '_blank', 'noopener');
    } catch {
      setDownloadError(true);
    }
  }

  if (state.status === 'expired') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  if (state.status === 'ready' && state.doc?.content) {
    const { assignment, doc } = state;
    const Viewer = { pptx: SlideViewer, pdf: PdfViewer }[doc.content.format] ?? DocxViewer;
    return (
      <section className="app-main wide">
        <Suspense fallback={<p style={{ padding: '24px' }}>Loading…</p>}>
          <Viewer
            content={doc.content}
            title={assignment.className}
            asset={{ assignmentId, sessionToken: session.sessionToken }}
            onDownload={() => handleDownload(doc.documentId)}
          />
        </Suspense>
        {downloadError && <p className="status-line status-error" style={{ padding: '0 24px' }}>Could not get the download link.</p>}
      </section>
    );
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
            This document can’t be shown in the page yet. You can download the original.
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
