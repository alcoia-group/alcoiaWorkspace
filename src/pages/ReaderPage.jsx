import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { formatDue, formatLabel } from '../lib/format.js';
import { fetchDocument, fetchDownloadUrl, fetchMyAssignments } from '../lib/assignments.js';
import DocxViewer from '../components/viewers/DocxViewer.jsx';
import SlideViewer from '../components/viewers/SlideViewer.jsx';
import BeforeYouRead from '../components/BeforeYouRead.jsx';
import Annotator from '../components/Annotator.jsx';
import ExplainBack from '../components/ExplainBack.jsx';
import Connections from '../components/Connections.jsx';
import { fetchSectionMarks, saveSectionMarks } from '../lib/sectionMarks.js';
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
  const [markState, setMarkState] = useState(null); // { optional: Set, canEdit } once loaded
  const [markError, setMarkError] = useState(false);

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

  // Core / optional marks. A failure just means no marks are shown; the reading still opens.
  useEffect(() => {
    let cancelled = false;
    fetchSectionMarks(assignmentId, session.sessionToken)
      .then((m) => { if (!cancelled) setMarkState(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [assignmentId, session.sessionToken]);

  async function toggleMark(unit) {
    if (!markState) return;
    const next = new Set(markState.optional);
    if (next.has(unit)) next.delete(unit); else next.add(unit);
    setMarkError(false);
    setMarkState({ ...markState, optional: next }); // shown at once, undone if the save fails
    try {
      const saved = await saveSectionMarks(assignmentId, next, session.sessionToken);
      setMarkState((m) => (m ? { ...m, optional: saved } : m));
    } catch {
      setMarkState(markState);
      setMarkError(true);
    }
  }

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
      <section className="reader">
        <div className="crumbs">
          <nav aria-label="Breadcrumb">
            <Link to="/assignments">Materials</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span>{assignment.className}{assignment.name ? ` / ${assignment.name}` : ''}</span>
          </nav>
          <span className="crumb-due">Due {formatDue(assignment.closesAt)}</span>
        </div>
        <BeforeYouRead assignmentId={assignmentId} content={doc.content} sessionToken={session.sessionToken} />
        <Annotator docKey={`a:${assignmentId}`} title={assignment.name || assignment.className}>
        <Suspense fallback={<p className="muted pad">Loading.</p>}>
          <Viewer
            content={doc.content}
            title={assignment.name || assignment.className}
            asset={{ assignmentId, sessionToken: session.sessionToken }}
            onDownload={() => handleDownload(doc.documentId)}
            marks={markState ? { ...markState, toggle: toggleMark } : null}
          />
        </Suspense>
        </Annotator>
        <Connections assignmentId={assignmentId} sessionToken={session.sessionToken} />
        <ExplainBack assignmentId={assignmentId} sessionToken={session.sessionToken} />
        {downloadError && <p className="alert alert-error">The download link could not be created.</p>}
        {markError && <p className="alert alert-error">That change could not be saved. Try again.</p>}
      </section>
    );
  }

  const { status, assignment } = state;
  return (
    <section className="page">
      <p><Link to="/assignments">Back to materials</Link></p>
      {status === 'loading' && <p className="muted">Loading.</p>}
      {status === 'error' && <p className="alert alert-error">This material could not be loaded.</p>}
      {status === 'missing' && (
        <>
          <h1 className="page-title">Material not available</h1>
          <p>It may have closed, or it may belong to a class you haven’t joined.</p>
        </>
      )}
      {status === 'ready' && (
        <>
          <h1 className="page-title">{assignment.className}</h1>
          <p className="muted">Due {formatDue(assignment.closesAt)}</p>
          <p className="alert">This file cannot be shown here. You can download the original.</p>
          {assignment.documents.length === 0 && <p>No document has been attached yet.</p>}
          {assignment.documents.map((d) => (
            <div className="file-row" key={d.documentId}>
              <span>{formatLabel(d.format)}</span>
              <button type="button" className="secondary" onClick={() => handleDownload(d.documentId)}>
                Download
              </button>
            </div>
          ))}
          {downloadError && <p className="alert alert-error">The download link could not be created.</p>}
        </>
      )}
    </section>
  );
}
