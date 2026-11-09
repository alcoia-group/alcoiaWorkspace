import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import DocxViewer from '../components/viewers/DocxViewer.jsx';
import SlideViewer from '../components/viewers/SlideViewer.jsx';
import Annotator from '../components/Annotator.jsx';
import Detection from '../detection/Detection.jsx';
import { createRecorder, loadOrCreateIdentity, scopeOfText } from '../lib/documentIdentity.js';
import { getLocalContent, getLocalFile } from '../lib/localFiles.js';
import { wordLayout } from '../lib/proveSkip.js';
const PdfViewer = lazy(() => import('../components/viewers/PdfViewer.jsx'));

const LONG_STOP_MS = 90_000; // a paragraph held this long counts as a long stop
const MAX_DWELL_MS = 5 * 60_000; // one reading of one paragraph never counts for more than this

const totalOf = (content) => (content.format === 'pptx' ? content.slides.length : content.format === 'pdf' ? content.pageCount : wordLayout(content).total);

// A file that is on THIS device (added from My files). Same viewers and the same reading help as an assigned
// reading, but the file, its model and its document identity all come from this browser. Nothing about the
// file is requested from the server, and the server is told nothing about where in it you are.
// The question bank, prove-it-to-skip, explain it back and cross-document connections need the file on the
// server, so they are not offered here.
export default function LocalFilePage({ id }) {
  const { session } = useSession();
  const account = session.email ?? null;
  const [state, setState] = useState({ status: 'loading' });
  const [slideAtEnd, setSlideAtEnd] = useState(false); // eslint-disable-line no-unused-vars
  const [snap, setSnap] = useState(null);
  const recorder = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getLocalFile(account, id);
        if (!found) { if (!cancelled) setState({ status: 'missing' }); return; }
        const content = await getLocalContent(id);
        if (!content) { if (!cancelled) setState({ status: 'missing' }); return; }
        const { identity, status } = await loadOrCreateIdentity({ id, record: found.record, content });
        if (cancelled) return;
        recorder.current = createRecorder({ id, identity });
        setSnap({ identity, status });
        setState({ status: 'ready', record: found.record, blob: found.blob, content });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
      recorder.current?.stop();
      recorder.current = null;
    };
  }, [id, account]);

  const content = state.status === 'ready' ? state.content : null;
  const total = content ? totalOf(content) : 0;
  // The saved place is read once, when the file opens. Later saves (every few seconds while reading) must not
  // hand the viewer a new starting point, or it would jump back and redraw.
  const startAt = useRef(null);
  if (startAt.current === null && snap && total > 0) {
    startAt.current = snap.identity.position && snap.identity.position.total === total ? snap.identity.position.index : 0;
  }
  const initial = startAt.current ?? 0;
  const onPosition = useCallback((index) => recorder.current?.position(index, total, null), [total]);
  const resume = useMemo(() => (total > 0 ? { initial, onPosition } : undefined), [total, initial, onPosition]);
  // Opening a file for the first time is a position too (the start), so even a one-page file has a place recorded.
  useEffect(() => {
    if (state.status === 'ready' && total > 0 && !snap?.identity.position) recorder.current?.position(0, total, null);
  }, [state.status, total, snap]);
  // One stable object for the viewer: a new one each render made the PDF viewer load the file again every time the
  // identity card refreshed (every few seconds), which showed as a flicker.
  const blob = state.status === 'ready' ? state.blob : null;
  const format = content?.format ?? null;
  const asset = useMemo(() => (blob ? { local: { blob, format }, sessionToken: session.sessionToken } : null), [blob, format, session.sessionToken]);
  const onSlide = useCallback((i, n) => setSlideAtEnd(i >= n - 2), []);

  // What the detection decides, kept in this document's own record.
  const observers = useMemo(() => ({
    onStruggle: (text) => recorder.current?.hard(scopeOfText(text)),
    onParagraphRead: (text, dwellMs) => {
      const scope = scopeOfText(text);
      if (!scope || !(dwellMs > 1000)) return;
      recorder.current?.dwell(scope, Math.min(dwellMs, MAX_DWELL_MS));
      if (dwellMs >= LONG_STOP_MS) recorder.current?.slow(scope);
    },
  }), []);

  const docKey = `f:${id}`;

  function handleDownload() {
    const url = URL.createObjectURL(state.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.record.name}.${state.record.format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  if (state.status === 'ready') {
    const Viewer = { pptx: SlideViewer, pdf: PdfViewer }[content.format] ?? DocxViewer;
    return (
      <section className="reader">
        <div className="crumbs">
          <nav aria-label="Breadcrumb">
            <Link to="/files">My files</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span>{state.record.name}</span>
          </nav>
        </div>
        <Annotator docKey={docKey} title={state.record.name}>
          <Suspense fallback={<p className="muted pad">Loading.</p>}>
            <Viewer
              onIndex={onSlide}
              content={content}
              title={state.record.name}
              resume={resume}
              asset={asset}
              onDownload={handleDownload}
            />
          </Suspense>
        </Annotator>
        <Detection observers={observers} />
      </section>
    );
  }
  return (
    <section className="page">
      <p><Link to="/files">Back to my files</Link></p>
      {state.status === 'loading' && <p className="muted">Loading.</p>}
      {state.status === 'error' && <p className="alert alert-error">This file could not be opened from this device.</p>}
      {state.status === 'missing' && (
        <p>
          This file is not on this device. Files you add are kept in the browser they were added in, so it may have been removed
          (clearing the site&rsquo;s data does that) or added on another device. Add the file again from My files.
        </p>
      )}
    </section>
  );
}
