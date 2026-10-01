import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { fetchPdfBytes } from '../../lib/assignments.js';
import { useFullscreen, useIdleControls } from '../../lib/fullscreen.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// The legacy pdf.js build is used on purpose: it carries the polyfills older
// browsers need (the standard build needs very recent JavaScript features).
// A PDF drawn the way a PDF reader draws it: the page as an image (canvas)
// with pdf.js's transparent text layer on top, so the words are real DOM text
// the alcoia extension can read and the student can select. Pages are drawn
// only when near the screen. The thumbnail list shows the actual pages.

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2];
const MAX_PAGE_CSS_WIDTH = 1000;

function useVisible(rootMargin) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, near];
}

// Draws one page into a canvas (and optionally the text layer) at `scale`.
async function drawPage({ pdf, number, scale, canvas, textHost, signal }) {
  const page = await pdf.getPage(number);
  if (signal.cancelled) return;
  const viewport = page.getViewport({ scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  const task = page.render({
    canvasContext: canvas.getContext('2d'),
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  });
  signal.onCancel(() => task.cancel());
  await task.promise;
  if (textHost && !signal.cancelled) {
    textHost.replaceChildren();
    const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textHost, viewport });
    signal.onCancel(() => layer.cancel());
    await layer.render();
  }
  page.cleanup();
}

function makeSignal() {
  const handlers = [];
  return {
    cancelled: false,
    onCancel(fn) { handlers.push(fn); },
    cancel() { this.cancelled = true; handlers.forEach((fn) => { try { fn(); } catch { /* already done */ } }); },
  };
}

function PdfPage({ pdf, number, scale, base, onNear }) {
  const [ref, near] = useVisible('900px 0px');
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { if (near) onNear?.(number); }, [near, number, onNear]);
  useEffect(() => {
    if (!near) return undefined;
    const signal = makeSignal();
    setDrawn(false);
    drawPage({ pdf, number, scale, canvas: canvasRef.current, textHost: textRef.current, signal })
      .then(() => !signal.cancelled && setDrawn(true))
      .catch(() => {});
    return () => signal.cancel();
  }, [near, pdf, number, scale]);
  return (
    <article
      ref={ref}
      className="pdf-page"
      data-page={number}
      aria-label={`Page ${number}`}
      style={{ width: base.w * scale, height: base.h * scale, '--scale-factor': scale, '--user-unit': 1, '--total-scale-factor': scale }}
    >
      <canvas ref={canvasRef} className="pdf-canvas" aria-hidden="true" data-drawn={drawn ? 'true' : undefined} />
      <div ref={textRef} className="textLayer" />
    </article>
  );
}

function PdfThumb({ pdf, number, base, current, onSelect }) {
  const [ref, near] = useVisible('400px 0px');
  const canvasRef = useRef(null);
  const width = 140;
  useEffect(() => {
    if (!near) return undefined;
    const signal = makeSignal();
    drawPage({ pdf, number, scale: width / base.w, canvas: canvasRef.current, textHost: null, signal }).catch(() => {});
    return () => signal.cancel();
  }, [near, pdf, number, base.w]);
  useEffect(() => { if (current) ref.current?.scrollIntoView?.({ block: 'nearest' }); }, [current, ref]);
  return (
    <button ref={ref} type="button" className={current ? 'rail-item current' : 'rail-item'} onClick={onSelect} aria-current={current ? 'true' : undefined} aria-label={`Go to page ${number}`}>
      <span className="rail-no" aria-hidden="true">{number}</span>
      <span className="rail-thumb pdf-thumb" style={{ aspectRatio: `${base.w} / ${base.h}` }} aria-hidden="true">
        <canvas ref={canvasRef} />
      </span>
    </button>
  );
}

export default function PdfViewer({ content, title, asset, onDownload }) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(false);
  const [base, setBase] = useState(null); // page 1 at scale 1
  const [zoomIndex, setZoomIndex] = useState(2);
  const [fit, setFit] = useState(1);
  const [current, setCurrent] = useState(1);
  const stageRef = useRef(null);
  const fs = useFullscreen();
  const controlsVisible = useIdleControls(fs.active);

  useEffect(() => {
    let cancelled = false;
    let doc = null;
    let task = null;
    fetchPdfBytes(asset.assignmentId, asset.sessionToken)
      .then((data) => {
        task = pdfjs.getDocument({ data, isEvalSupported: false });
        return task.promise;
      })
      .then(async (d) => {
        doc = d;
        const first = await d.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setBase({ w: vp.width, h: vp.height });
        setPdf(d);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      task?.destroy?.();
      doc?.destroy?.();
    };
  }, [asset.assignmentId, asset.sessionToken]);

  // "Fit" is the page filling the stage width (up to a comfortable maximum).
  useEffect(() => {
    if (!base || !stageRef.current) return undefined;
    const el = stageRef.current;
    const measure = () => {
      const avail = Math.min(el.clientWidth - 32, MAX_PAGE_CSS_WIDTH);
      if (avail > 0) setFit(avail / base.w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [base, fs.active]);

  // Which page is most in view.
  useEffect(() => {
    if (!pdf || !stageRef.current) return undefined;
    const ratios = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) ratios.set(Number(e.target.dataset.page), e.intersectionRatio);
      let best = 1; let bestRatio = -1;
      for (const [page, ratio] of ratios) if (ratio > bestRatio) { best = page; bestRatio = ratio; }
      if (bestRatio > 0) setCurrent(best);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    stageRef.current.querySelectorAll('.pdf-page').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pdf, fit, zoomIndex]);

  const scrollTo = (n) => stageRef.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView?.({ block: 'start' });

  if (error) return <p className="alert alert-error">This PDF could not be opened. You can still download it.</p>;
  if (!pdf || !base) return <p className="muted pad">Loading.</p>;

  const scale = fit * ZOOM_STEPS[zoomIndex];
  const pages = Array.from({ length: content.pageCount }, (_, i) => i + 1);

  return (
    <div className="viewer pdf-viewer" data-idle={fs.active && !controlsVisible ? 'true' : undefined}>
      <div className="viewer-toolbar" role="toolbar" aria-label="PDF controls">
        <span className="viewer-title">{title}</span>
        <span className="viewer-pageno" aria-live="polite">Page {current} of {content.pageCount}</span>
        <span className="viewer-controls">
          <button type="button" className="secondary" onClick={() => setZoomIndex((z) => Math.max(0, z - 1))} disabled={zoomIndex === 0} aria-label="Zoom out">−</button>
          <span className="viewer-zoom">{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
          <button type="button" className="secondary" onClick={() => setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))} disabled={zoomIndex === ZOOM_STEPS.length - 1} aria-label="Zoom in">+</button>
          <button type="button" className="secondary" onClick={fs.toggle}>{fs.active ? 'Exit full screen' : 'Full screen'}</button>
          {onDownload && <button type="button" className="secondary" onClick={onDownload}>Download</button>}
        </span>
      </div>
      <div className="slides-body pdf-body">
        <nav className="slides-rail" aria-label="Pages">
          {pages.map((n) => (
            <PdfThumb key={n} pdf={pdf} number={n} base={base} current={n === current} onSelect={() => scrollTo(n)} />
          ))}
        </nav>
        <div className="viewer-stage pdf-stage" ref={stageRef}>
          {pages.map((n) => <PdfPage key={n} pdf={pdf} number={n} scale={scale} base={base} />)}
        </div>
      </div>
    </div>
  );
}
