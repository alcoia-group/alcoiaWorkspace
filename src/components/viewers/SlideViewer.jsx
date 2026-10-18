import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { resolveTransition } from '../../lib/transitions.js';
import { useFullscreen, useIdleControls } from '../../lib/fullscreen.js';
import AssetImage from './AssetImage.jsx';
import MarkToggle, { OptionalBadge } from '../MarkToggle.jsx';
import { slideUnit } from '../../lib/sectionMarks.js';

// PowerPoint-style viewer for the server's slide model. Every slide is drawn
// at the file's own aspect ratio from fractional geometry, with the file's
// own text sizes (scaled with the slide), colours, fonts, bullets and
// tables, and the file's own slide transition when moving forward. Text is
// real <p> elements, so the alcoia extension reads it like any page; bullet
// glyphs come from CSS so they are not part of the text it reads.
//
// Transitions come entirely from the file (src/lib/transitions.js draws the
// names it knows; an unknown one is a cut, said plainly, never a look-alike).
// Not shown: entrance/emphasis animations, charts, SmartArt, video (labelled
// placeholders).

const SERIF = /times|georgia|garamond|cambria|palatino|book|minion|serif/i;
const stackFor = (font) => (font ? `'${font.replace(/'/g, '')}', ${SERIF.test(font) ? "'Literata', Georgia, serif" : "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"}` : 'inherit');
const ALIGN = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };

function Paragraphs({ paragraphs, slideW, compact, thumb }) {
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
            data-t={thumb ? r.text : undefined}
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
            {thumb ? null : r.text}
          </span>
        ))}
      </p>
    );
  });
}

function Shape({ shape, slideW, asset, thumb }) {
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
                <td key={c} colSpan={cell.colSpan}><Paragraphs paragraphs={cell.paragraphs} slideW={slideW} compact thumb={thumb} /></td>
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
      <Paragraphs paragraphs={shape.paragraphs} slideW={slideW} thumb={thumb} />
    </div>
  );
}

// `thumb`: a miniature for the slide list. Its text is drawn by CSS from a
// data attribute, so it is a picture of the slide, not a second copy of the
// text for the alcoia extension to read.
function Slide({ slide, slideSize, asset, thumb }) {
  return (
    <div className={thumb ? 'slide slide-thumb' : 'slide'} style={{ background: slide.background, color: '#000' }}>
      {slide.shapes.map((shape, i) => <Shape key={i} shape={shape} slideW={slideSize.w} asset={asset} thumb={thumb} />)}
    </div>
  );
}

function Thumb({ slide, slideSize, asset, number, current, onSelect }) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (current) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);
  return (
    <button
      ref={ref}
      type="button"
      className={current ? 'rail-item current' : 'rail-item'}
      onClick={onSelect}
      aria-current={current ? 'true' : undefined}
      aria-label={`Go to slide ${number}`}
    >
      <span className="rail-no" aria-hidden="true">{number}</span>
      <span className="rail-thumb" style={{ aspectRatio: `${slideSize.w} / ${slideSize.h}`, background: slide.background ?? '#fff' }} aria-hidden="true" inert>
        {near && <Slide slide={slide} slideSize={slideSize} asset={asset} thumb />}
      </span>
    </button>
  );
}

export default function SlideViewer({ content, title, asset, onDownload, marks }) {
  const { slides, slideSize } = content;
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(null);
  const [onTop, setOnTop] = useState('incoming');
  const [ground, setGround] = useState(null);
  const indexRef = useRef(0);
  const incomingRef = useRef(null);
  const outgoingRef = useRef(null);
  const pendingJob = useRef(null);
  const fs = useFullscreen();
  const controlsVisible = useIdleControls(fs.active);

  const go = useCallback((next) => {
    const current = indexRef.current;
    if (next < 0 || next >= slides.length || next === current) return;
    // The transition belongs to the slide being entered. Going back plays the
    // leaving slide's own transition in reverse.
    const reverse = next < current;
    const resolved = resolveTransition((reverse ? slides[current] : slides[next]).transition);
    pendingJob.current = { ...resolved, reverse };
    indexRef.current = next;
    const entersOnTop = resolved.plan?.enteringOnTop ?? true;
    setOnTop(reverse ? (entersOnTop ? 'outgoing' : 'incoming') : (entersOnTop ? 'incoming' : 'outgoing'));
    setGround(resolved.plan?.ground ?? null);
    setLeaving(current);
    setIndex(next);
  }, [slides]);

  useLayoutEffect(() => {
    const job = pendingJob.current;
    if (!job) return undefined;
    pendingJob.current = null;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!job.plan || reduced) {
      setLeaving(null);
      return undefined;
    }
    const opts = { duration: job.durationMs, easing: 'ease-in-out', fill: 'both', direction: job.reverse ? 'reverse' : 'normal' };
    const forIncoming = job.reverse ? job.plan.leaving : job.plan.entering;
    const forOutgoing = job.reverse ? job.plan.entering : job.plan.leaving;
    const anims = [];
    if (forIncoming && incomingRef.current) anims.push(incomingRef.current.animate(forIncoming, opts));
    if (forOutgoing && outgoingRef.current) anims.push(outgoingRef.current.animate(forOutgoing, opts));
    if (anims.length === 0) {
      setLeaving(null);
      return undefined;
    }
    let done = false;
    const finish = () => { if (!done) { done = true; setLeaving(null); setGround(null); } };
    Promise.all(anims.map((a) => a.finished)).then(finish, finish);
    return () => anims.forEach((a) => a.cancel());
  }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(index + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(slides.length - 1);
      else if (e.key === 'f' || e.key === 'F') fs.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, slides.length, fs]);

  // Slides that advance by themselves (File > timings in PowerPoint).
  useEffect(() => {
    const ms = slides[index + 1]?.transition?.advanceAfterMs;
    if (!ms || index + 1 >= slides.length) return undefined;
    const timer = setTimeout(() => go(index + 1), ms);
    return () => clearTimeout(timer);
  }, [index, slides, go]);

  // In the slideshow a click moves on (left third goes back), a swipe too.
  const touch = useRef(null);
  const onStageClick = (e) => {
    if (!fs.active) return;
    if (window.getSelection()?.toString()) return; // selecting text is not a slide change
    const box = e.currentTarget.getBoundingClientRect();
    go(e.clientX - box.left < box.width / 3 ? index - 1 : index + 1);
  };

  // The notes panel asks for a slide by its scope ("s:4").
  useEffect(() => {
    const onGoto = (e) => {
      const [k, n] = String(e.detail?.scope ?? '').split(':');
      if (k === 's' && Number(n) >= 1) go(Number(n) - 1);
    };
    window.addEventListener('alcoia:goto-scope', onGoto);
    return () => window.removeEventListener('alcoia:goto-scope', onGoto);
  }, [go]);

  const slide = slides[index];
  const note = resolveTransition(slide.transition).note;

  return (
    <div className="viewer slides-viewer" data-idle={fs.active && !controlsVisible ? 'true' : undefined}>
      <div className="viewer-toolbar" role="toolbar" aria-label="Presentation controls">
        <span className="viewer-title">{title}</span>
        <span className="viewer-pageno" aria-live="polite">Slide {index + 1} of {slides.length}</span>
        <OptionalBadge marks={marks} unit={slideUnit(index + 1)} />
        <span className="viewer-controls">
          <MarkToggle marks={marks} unit={slideUnit(index + 1)} />
          <button type="button" className="secondary" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">←</button>
          <button type="button" className="secondary" onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Next slide">→</button>
          <button type="button" className="secondary" onClick={fs.toggle}>{fs.active ? 'Exit full screen' : 'Full screen'}</button>
          {onDownload && <button type="button" className="secondary" onClick={onDownload}>Download</button>}
        </span>
      </div>
      <div className="slides-body">
        <nav className="slides-rail" aria-label="Slides">
          {slides.map((s, i) => (
            <Thumb key={i} slide={s} slideSize={slideSize} asset={asset} number={i + 1} current={i === index} onSelect={() => go(i)} />
          ))}
        </nav>
        <div className="slides-stage-wrap">
          <div
            className="slides-stage"
            style={{ aspectRatio: `${slideSize.w} / ${slideSize.h}`, '--slide-ratio': slideSize.w / slideSize.h, background: ground ?? undefined }}
            onClick={onStageClick}
            onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touch.current === null) return;
              const dx = e.changedTouches[0].clientX - touch.current;
              touch.current = null;
              if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
            }}
          >
            {leaving !== null && (
              <div className="slide-layer" ref={outgoingRef} aria-hidden="true" data-role="outgoing" style={{ zIndex: onTop === 'outgoing' ? 3 : 1 }}>
                <Slide slide={slides[leaving]} slideSize={slideSize} asset={asset} />
              </div>
            )}
            <div className="slide-layer" ref={incomingRef} data-role="current" data-anno-scope={`s:${index + 1}`} style={{ zIndex: onTop === 'outgoing' ? 1 : 2 }}>
              <Slide slide={slide} slideSize={slideSize} asset={asset} />
            </div>
          </div>
          {note && !fs.active && <p className="slides-note">{note}</p>}
        </div>
      </div>
    </div>
  );
}
