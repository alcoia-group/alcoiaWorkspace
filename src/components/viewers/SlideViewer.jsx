import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import AssetImage from './AssetImage.jsx';

// PowerPoint-style viewer for the server's slide model. Every slide is drawn
// at the file's own aspect ratio from fractional geometry, with the file's
// own text sizes (scaled with the slide), colours, fonts, bullets and
// tables, and the file's own slide transition when moving forward. Text is
// real <p> elements, so the alcoia extension reads it like any page; bullet
// glyphs come from CSS so they are not part of the text it reads.
//
// Not shown: entrance/emphasis animations, charts, SmartArt, video (labelled
// placeholders). Transitions PowerPoint offers beyond the supported set play
// as the nearest match (a fade); the model flags those as `approximate`.

const SERIF = /times|georgia|garamond|cambria|palatino|book|minion|serif/i;
const stackFor = (font) => (font ? `'${font.replace(/'/g, '')}', ${SERIF.test(font) ? "'Literata', Georgia, serif" : "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"}` : 'inherit');
const ALIGN = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };

function Paragraphs({ paragraphs, slideW, compact }) {
  return paragraphs.map((p, i) => {
    const bullet = p.bullet ? (p.bullet.type === 'number' ? `${p.bullet.index}.` : p.bullet.char) : null;
    return (
      <p
        key={i}
        className={bullet ? 'slide-p has-bullet' : 'slide-p'}
        data-bullet={bullet ?? undefined}
        style={{
          // The bullet glyph is drawn by the paragraph, so it takes the paragraph's size: the first run's.
          fontSize: `${(p.runs[0].size / slideW) * 100}cqw`,
          textAlign: ALIGN[p.align] ?? 'left',
          marginLeft: compact ? 0 : `${(p.level * 28 + (bullet ? 22 : 0)) / slideW * 100}cqw`,
          '--bullet-indent': `${22 / slideW * 100}cqw`,
        }}
      >
        {p.runs.map((r, j) => (
          <span
            key={j}
            style={{
              fontSize: `${(r.size / slideW) * 100}cqw`,
              color: r.color,
              fontWeight: r.bold ? 700 : undefined,
              fontStyle: r.italic ? 'italic' : undefined,
              textDecoration: [r.underline && 'underline', r.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
              fontFamily: stackFor(r.font),
              whiteSpace: 'pre-wrap',
            }}
          >
            {r.text}
          </span>
        ))}
      </p>
    );
  });
}

function Shape({ shape, slideW, asset }) {
  const geo = { left: `${shape.x * 100}%`, top: `${shape.y * 100}%`, width: `${shape.w * 100}%`, height: `${shape.h * 100}%` };
  if (shape.kind === 'image') {
    return <AssetImage asset={asset} path={shape.assetId} alt={shape.alt} className="slide-shape slide-image" style={geo} />;
  }
  if (shape.kind === 'placeholder') {
    return <div className="slide-shape slide-placeholder" style={geo}>[{shape.label}]</div>;
  }
  if (shape.kind === 'table') {
    return (
      <table className="slide-shape slide-table" style={geo}>
        <tbody>
          {shape.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} colSpan={cell.colSpan}><Paragraphs paragraphs={cell.paragraphs} slideW={slideW} compact /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div
      className="slide-shape slide-text"
      style={{
        ...geo,
        justifyContent: { t: 'flex-start', ctr: 'center', b: 'flex-end' }[shape.anchor] ?? 'flex-start',
        background: shape.fill,
        border: shape.line ? `${(shape.line.width / slideW) * 100}cqw solid ${shape.line.color}` : undefined,
        borderRadius: shape.geometry === 'ellipse' ? '50%' : shape.geometry === 'roundRect' ? '8%' : undefined,
        transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
        padding: `${(3.6 / slideW) * 100}cqw ${(7.2 / slideW) * 100}cqw`,
      }}
    >
      <Paragraphs paragraphs={shape.paragraphs} slideW={slideW} />
    </div>
  );
}

function Slide({ slide, slideSize, asset }) {
  return (
    <div className="slide" style={{ background: slide.background, color: '#000' }}>
      {slide.shapes.map((shape, i) => <Shape key={i} shape={shape} slideW={slideSize.w} asset={asset} />)}
    </div>
  );
}

// Where the incoming slide starts, for directional transitions. The file's
// direction is the way the content moves.
const FROM = { l: 'translateX(100%)', r: 'translateX(-100%)', u: 'translateY(100%)', d: 'translateY(-100%)' };
const AWAY = { l: 'translateX(-100%)', r: 'translateX(100%)', u: 'translateY(-100%)', d: 'translateY(100%)' };
const WIPE = { l: 'inset(0 0 0 100%)', r: 'inset(0 100% 0 0)', u: 'inset(100% 0 0 0)', d: 'inset(0 0 100% 0)' };

export function planTransition(t) {
  if (!t || t.type === 'cut') return null;
  const dir = t.direction in FROM ? t.direction : 'l';
  switch (t.type) {
    case 'push': return { incoming: [{ transform: FROM[dir] }, { transform: 'none' }], outgoing: [{ transform: 'none' }, { transform: AWAY[dir] }] };
    case 'cover': return { incoming: [{ transform: FROM[dir] }, { transform: 'none' }], outgoing: null, incomingOnTop: true };
    case 'uncover': return { incoming: null, outgoing: [{ transform: 'none' }, { transform: AWAY[dir] }], outgoingOnTop: true };
    case 'wipe': return { incoming: [{ clipPath: WIPE[dir] }, { clipPath: 'inset(0 0 0 0)' }], outgoing: null, incomingOnTop: true };
    case 'split': return { incoming: [{ clipPath: t.orientation === 'vert' ? 'inset(0 50%)' : 'inset(50% 0)' }, { clipPath: 'inset(0 0 0 0)' }], outgoing: null, incomingOnTop: true };
    case 'zoom': return { incoming: [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], outgoing: null, incomingOnTop: true };
    default: return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null, incomingOnTop: true };
  }
}

function slideTitle(slide, i) {
  const first = slide.shapes.find((s) => s.kind === 'text' && s.paragraphs.length > 0);
  const text = first?.paragraphs[0].runs.map((r) => r.text).join('').trim();
  return text ? text.slice(0, 80) : `Slide ${i + 1}`;
}

export default function SlideViewer({ content, title, asset, onDownload }) {
  const { slides, slideSize } = content;
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(null);
  const [onTop, setOnTop] = useState('incoming');
  const indexRef = useRef(0);
  const stageRef = useRef(null);
  const incomingRef = useRef(null);
  const outgoingRef = useRef(null);
  const pendingPlan = useRef(null);

  const go = useCallback((next) => {
    const current = indexRef.current;
    if (next < 0 || next >= slides.length || next === current) return;
    // A transition belongs to the slide being entered. Going back plays a short fade.
    const t = next > current ? slides[next].transition : { type: 'fade', durationMs: 220 };
    const plan = planTransition(t);
    pendingPlan.current = { plan, duration: t?.durationMs ?? 500 };
    indexRef.current = next;
    setOnTop(plan?.outgoingOnTop ? 'outgoing' : 'incoming');
    setLeaving(current);
    setIndex(next);
  }, [slides]);

  useLayoutEffect(() => {
    const job = pendingPlan.current;
    if (!job) return undefined;
    pendingPlan.current = null;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!job.plan || reduced) {
      setLeaving(null);
      return undefined;
    }
    const opts = { duration: job.duration, easing: 'ease-in-out', fill: 'both' };
    const anims = [];
    if (job.plan.incoming && incomingRef.current) anims.push(incomingRef.current.animate(job.plan.incoming, opts));
    if (job.plan.outgoing && outgoingRef.current) anims.push(outgoingRef.current.animate(job.plan.outgoing, opts));
    if (anims.length === 0) {
      setLeaving(null);
      return undefined;
    }
    let done = false;
    const finish = () => { if (!done) { done = true; setLeaving(null); } };
    Promise.all(anims.map((a) => a.finished)).then(finish, finish);
    return () => anims.forEach((a) => a.cancel());
  }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(index + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(slides.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, slides.length]);

  // Slides that advance by themselves (File > timings in PowerPoint).
  useEffect(() => {
    const ms = slides[index + 1]?.transition?.advanceAfterMs;
    if (!ms || index + 1 >= slides.length) return undefined;
    const timer = setTimeout(() => go(index + 1), ms);
    return () => clearTimeout(timer);
  }, [index, slides, go]);

  const slide = slides[index];
  const ratio = `${slideSize.w} / ${slideSize.h}`;

  return (
    <div className="viewer slides-viewer">
      <div className="viewer-toolbar" role="toolbar" aria-label="Presentation controls">
        <span className="viewer-title">{title}</span>
        <span className="viewer-pageno" aria-live="polite">Slide {index + 1} of {slides.length}</span>
        <span className="viewer-controls">
          <button type="button" className="secondary" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">←</button>
          <button type="button" className="secondary" onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Next slide">→</button>
          <button type="button" className="secondary" onClick={() => stageRef.current?.requestFullscreen?.()}>Full screen</button>
          {onDownload && <button type="button" className="secondary" onClick={onDownload}>Download</button>}
        </span>
      </div>
      <div className="slides-body">
        <nav className="slides-rail" aria-label="Slides">
          {slides.map((s, i) => (
            <button key={i} type="button" className={i === index ? 'rail-item current' : 'rail-item'} onClick={() => go(i)} aria-current={i === index ? 'true' : undefined}>
              <span className="rail-no">{i + 1}</span>
              <span className="rail-title">{slideTitle(s, i)}</span>
            </button>
          ))}
        </nav>
        <div className="slides-stage-wrap">
          <div className="slides-stage" ref={stageRef} style={{ aspectRatio: ratio }}>
            {leaving !== null && (
              <div className="slide-layer" ref={outgoingRef} aria-hidden="true" data-role="outgoing" style={{ zIndex: onTop === 'outgoing' ? 3 : 1 }}>
                <Slide slide={slides[leaving]} slideSize={slideSize} asset={asset} />
              </div>
            )}
            <div className="slide-layer" ref={incomingRef} data-role="current" style={{ zIndex: 2 }}>
              <Slide slide={slide} slideSize={slideSize} asset={asset} />
            </div>
          </div>
          {slide.transition?.approximate && (
            <p className="slides-note">This slide uses a “{slide.transition.original}” transition, shown here as a fade.</p>
          )}
        </div>
      </div>
    </div>
  );
}
