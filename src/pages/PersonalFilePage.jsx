import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { downloadPersonalFile, fetchPersonalContent } from '../lib/personalDocuments.js';
import DocxViewer from '../components/viewers/DocxViewer.jsx';
import SlideViewer from '../components/viewers/SlideViewer.jsx';
const PdfViewer = lazy(() => import('../components/viewers/PdfViewer.jsx'));

// A file the user added themselves, shown with the same viewers as an assigned reading.
// The page is a normal full page load: the alcoia extension works on it like on any web page
// (assignment reporting does not apply, because there is no class behind it).
export default function PersonalFilePage() {
  const { id } = useParams();
  const { session, signOut } = useSession();
  const location = useLocation();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchPersonalContent(id, session.sessionToken).then(
      (doc) => !cancelled && setState({ status: 'ready', doc }),
      (err) => !cancelled && setState({ status: err.status === 401 ? 'expired' : err.status === 404 ? 'missing' : 'error' }),
    );
    return () => { cancelled = true; };
  }, [id, session.sessionToken]);
  useEffect(() => { if (state.status === 'expired') signOut(); }, [state.status, signOut]);

  if (state.status === 'expired') return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  const { doc } = state;
  if (state.status === 'ready' && doc.content) {
    const Viewer = { pptx: SlideViewer, pdf: PdfViewer }[doc.content.format] ?? DocxViewer;
    return (
      <section className="reader">
        <div className="crumbs">
          <nav aria-label="Breadcrumb">
            <Link to="/files">My files</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span>{doc.name}</span>
          </nav>
        </div>
        <Suspense fallback={<p className="muted pad">Loading.</p>}>
          <Viewer
            content={doc.content}
            title={doc.name}
            asset={{ personalId: id, sessionToken: session.sessionToken }}
            onDownload={() => downloadPersonalFile({ id, name: doc.name, format: doc.format }, session.sessionToken)}
          />
        </Suspense>
      </section>
    );
  }
  return (
    <section className="page">
      <p><Link to="/files">Back to my files</Link></p>
      {state.status === 'loading' && <p className="muted">Loading.</p>}
      {state.status === 'error' && <p className="alert alert-error">This file could not be loaded.</p>}
      {state.status === 'missing' && <p>This file is not available. It may have been deleted.</p>}
      {state.status === 'ready' && (
        <>
          <h1 className="page-title">{doc.name}</h1>
          <p className="alert">This file cannot be shown here (for example a scanned PDF with no text). You can download the original.</p>
          <button type="button" className="secondary" onClick={() => downloadPersonalFile({ id, name: doc.name, format: doc.format }, session.sessionToken)}>Download</button>
        </>
      )}
    </section>
  );
}
