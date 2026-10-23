import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  COLORS, COLOR_KEYS, KIND_LABEL, NOTE_MAX, clamp01, anchorFromSelection, caretAtPoint, highlightsSupported, loadMarks,
  marksToMarkdown, newId, rangeFromOffsets, resolveAnchor, saveMarks, scopeLabel, scopeOrder, scopeText,
} from '../lib/annotations.js';
import { useEditingTools } from '../lib/useEditingTools.js';

// Reading tools around any viewer: highlighters, underlines, strike-through, notes, a pen and an
// eraser. Marks stay on this device. Text marks are drawn with the browser's CSS Custom Highlight
// API, so the document's own text is never touched (the alcoia extension reads it as before).
// Each viewer marks the parts it draws with data-anno-scope (a Word page, a PDF page, a slide).

const TEXT_TOOLS = { highlight: 'hl', underline: 'ul', wavy: 'wv', strike: 'st' };
const PEN_WIDTHS = { thin: 2, medium: 4, thick: 8 };

function useScopes(rootRef) {
  const [scopes, setScopes] = useState([]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let timer = null;
    const scan = () => {
      const found = [...root.querySelectorAll('[data-anno-scope]')].map((el) => ({ id: el.dataset.annoScope, el }));
      setScopes((prev) => (prev.length === found.length && prev.every((p, i) => p.id === found[i].id && p.el === found[i].el) ? prev : found));
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(scan, 120); };
    scan();
    const mo = new MutationObserver(later);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-anno-scope'] });
    return () => { mo.disconnect(); clearTimeout(timer); };
  }, [rootRef]);
  return scopes;
}

function StrokeLayer({ scopeId, strokes, drawing, color, width, onAdd, onErase }) {
  const svgRef = useRef(null);
  const [live, setLive] = useState(null);
  const mine = strokes.filter((s) => s.scope === scopeId);
  const pt = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const down = (e) => {
    if (drawing !== 'pen') return;
    e.preventDefault();
    svgRef.current.setPointerCapture?.(e.pointerId);
    setLive({ points: [pt(e)] });
  };
  const move = (e) => {
    if (!live) return;
    const p = pt(e);
    const last = live.points[live.points.length - 1];
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 0.002) return;
    setLive({ points: [...live.points, p] });
  };
  const up = () => {
    if (live && live.points.length > 1) onAdd({ id: newId(), scope: scopeId, color, width, points: live.points });
    setLive(null);
  };
  const d = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(4)} ${p[1].toFixed(4)}`).join(' ');
  const active = drawing === 'pen' || drawing === 'eraser';
  return (
    <svg
      ref={svgRef}
      className="stroke-layer"
      data-active={active ? drawing : undefined}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-hidden="true"
    >
      {mine.map((s) => (
        <path
          key={s.id}
          d={d(s.points)}
          stroke={COLORS[s.color]?.solid ?? '#333'}
          strokeWidth={s.width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          onClick={drawing === 'eraser' ? () => onErase(s.id) : undefined}
          style={{ pointerEvents: drawing === 'eraser' ? 'stroke' : 'none' }}
        />
      ))}
      {live && (
        <path d={d(live.points)} stroke={COLORS[color].solid} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

// Sticky notes: a small pin per note, drawn inside the page or slide it belongs to and placed as
// fractions of that scope, so it follows zoom. The pin holds no text (its name is an attribute and
// its look comes from CSS), so nothing is added to the passage text the detection code reads. The
// note body opens in a popup outside the document.
function StickyLayer({ scopeId, stickies, openId, onToggle, onMove }) {
  const layerRef = useRef(null);
  const drag = useRef(null);
  const mine = stickies.filter((s) => s.scope === scopeId);
  if (mine.length === 0) return null;
  const frac = (e) => {
    const r = layerRef.current.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };
  const down = (e, s) => {
    if (e.button > 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: s.id, x0: e.clientX, y0: e.clientY, moved: false };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 5) return;
    d.moved = true;
    const [x, y] = frac(e);
    onMove(d.id, x, y);
  };
  const up = (e, s) => {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d && !d.moved) onToggle(s.id);
  };
  const key = (e, s) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) return;
    e.stopPropagation(); // the viewer must not also turn the slide or page
    const step = e.shiftKey ? 0.05 : 0.01;
    const dx = { ArrowLeft: -step, ArrowRight: step }[e.key] ?? 0;
    const dy = { ArrowUp: -step, ArrowDown: step }[e.key] ?? 0;
    if (dx || dy) { e.preventDefault(); onMove(s.id, clamp01(s.x + dx), clamp01(s.y + dy)); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(s.id); }
  };
  return (
    <div className="sticky-layer annotator-ui" ref={layerRef}>
      {mine.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={s.id === openId ? 'sticky-pin open' : 'sticky-pin'}
          data-sticky-id={s.id}
          style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, '--c': COLORS[s.color]?.solid ?? '#d4a500' }}
          aria-label={`Sticky note ${i + 1}${s.text ? `: ${s.text.slice(0, 60)}` : ' (empty)'}. Enter opens it, arrow keys move it.`}
          aria-expanded={s.id === openId}
          onPointerDown={(e) => down(e, s)}
          onPointerMove={move}
          onPointerUp={(e) => up(e, s)}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => key(e, s)}
        />
      ))}
    </div>
  );
}

export default function Annotator({ docKey, title, children }) {
  const rootRef = useRef(null);
  const scopes = useScopes(rootRef);
  const supported = useMemo(highlightsSupported, []);
  const editable = useEditingTools(); // false on a phone: marks are drawn, nothing can be edited
  const [barH, setBarH] = useState(0);
  const [marks, setMarks] = useState(() => loadMarks(docKey));
  const [toolChoice, setTool] = useState('select'); // select | highlight | underline | wavy | strike | pen | eraser
  const tool = editable ? toolChoice : 'select';
  const [color, setColor] = useState('yellow');
  const [penWidth, setPenWidth] = useState('medium');
  const [panelChoice, setPanel] = useState(false);
  const panel = editable && panelChoice;
  const [popover, setPopover] = useState(null); // { x, y, kind: 'new' | 'edit', pieces?, id? }
  const [saveFailed, setSaveFailed] = useState(false);
  const [focusNote, setFocusNote] = useState(null);
  const [openId, setOpenId] = useState(null); // open sticky note
  const [stickyPos, setStickyPos] = useState(null); // { x, y } of the open note's popup
  const barRef = useRef(null);
  const resolved = useRef(new Map()); // id -> { scopeEl, start, end }
  const pending = useRef(null);

  useEffect(() => { setMarks(loadMarks(docKey)); setOpenId(null); }, [docKey]);
  useEffect(() => { if (!editable) { setPopover(null); setOpenId(null); } }, [editable]);
  // The reading tools bar is sticky; the viewer's own toolbar sticks just below it (CSS var --anno-h).
  useEffect(() => {
    const el = barRef.current;
    if (!el || !editable) { setBarH(0); return undefined; }
    const measure = () => setBarH(Math.round(el.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editable]);
  useEffect(() => {
    const t = setTimeout(() => setSaveFailed(!saveMarks(docKey, marks)), 300);
    return () => clearTimeout(t);
  }, [docKey, marks]);

  // Draw the text marks: one named highlight per kind and colour, ranges rebuilt whenever the
  // marks or the drawn parts of the document change.
  useEffect(() => {
    if (!supported) return undefined;
    const groups = new Map();
    resolved.current = new Map();
    for (const { id: scopeId, el } of scopes) {
      const here = marks.items.filter((m) => m.scope === scopeId);
      if (here.length === 0) continue;
      const text = scopeText(el);
      for (const m of here) {
        const at = resolveAnchor(m, text);
        if (!at) continue;
        const range = rangeFromOffsets(el, at[0], at[1]);
        if (!range) continue;
        resolved.current.set(m.id, { scopeEl: el, start: at[0], end: at[1] });
        const name = `alc-${m.kind}-${m.color}`;
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(range);
      }
    }
    const names = [];
    for (const k of ['hl', 'ul', 'wv', 'st']) for (const c of COLOR_KEYS) names.push(`alc-${k}-${c}`);
    // A browser with a partial Custom Highlight API must never break reading: drawing is best effort.
    const clear = () => { try { for (const n of names) CSS.highlights.delete(n); } catch { /* not supported */ } };
    clear();
    try {
      for (const [name, ranges] of groups) CSS.highlights.set(name, new Highlight(...ranges));
    } catch { /* marks stay stored; they are just not drawn here */ }
    return clear;
  }, [supported, scopes, marks.items]);

  const addItems = useCallback((pieces, kind, col) => {
    setMarks((m) => ({ ...m, items: [...m.items, ...pieces.map((p) => ({ id: newId(), kind, color: col, note: '', createdAt: Date.now(), ...p }))] }));
  }, []);

  const piecesFromSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!rootRef.current?.contains(range.commonAncestorContainer)) return null;
    const out = [];
    for (const { id, el } of scopes) {
      const a = anchorFromSelection(range, el);
      if (a) out.push({ scope: id, ...a });
    }
    return out.length ? { pieces: out, rect: range.getBoundingClientRect() } : null;
  };

  const onSelectionEnd = (e) => {
    if (!editable || !supported || e.target.closest?.('.annotator-ui')) return;
    setTimeout(() => {
      const got = piecesFromSelection();
      if (!got) return;
      if (TEXT_TOOLS[tool]) {
        addItems(got.pieces, TEXT_TOOLS[tool], color);
        window.getSelection().removeAllRanges();
        return;
      }
      if (tool !== 'select') return;
      pending.current = got.pieces;
      setPopover({ kind: 'new', x: Math.min(got.rect.left + got.rect.width / 2, window.innerWidth - 150), y: got.rect.bottom + 8 });
    }, 0);
  };

  const onClick = (e) => {
    if (!editable || !supported || e.target.closest?.('.annotator-ui, .stroke-layer, button, a')) return;
    if (!window.getSelection().isCollapsed) return;
    if (tool !== 'select' && tool !== 'eraser') return;
    const at = caretAtPoint(e.clientX, e.clientY);
    if (!at) { setPopover(null); return; }
    const hit = [...resolved.current.entries()].filter(([, r]) => r.scopeEl === at.scopeEl && at.offset >= r.start && at.offset < r.end).map(([id]) => id);
    if (hit.length === 0) { setPopover(null); return; }
    if (tool === 'eraser') {
      setMarks((m) => ({ ...m, items: m.items.filter((it) => !hit.includes(it.id)) }));
      return;
    }
    setPopover({ kind: 'edit', id: hit[hit.length - 1], x: Math.min(e.clientX, window.innerWidth - 260), y: e.clientY + 12 });
  };

  const applyNew = (kind, col, withNote) => {
    const pieces = pending.current;
    if (!pieces) return;
    const base = pieces.map((p) => ({ id: newId(), kind, color: col, note: '', createdAt: Date.now(), ...p }));
    setMarks((m) => ({ ...m, items: [...m.items, ...base] }));
    window.getSelection().removeAllRanges();
    pending.current = null;
    setPopover(withNote ? { kind: 'edit', id: base[0].id, x: popover.x, y: popover.y } : null);
  };

  const update = (id, patch) => setMarks((m) => ({ ...m, items: m.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const remove = (id) => { setMarks((m) => ({ ...m, items: m.items.filter((it) => it.id !== id) })); setPopover(null); };

  // Keep the open sticky note's popup beside its pin through scroll, zoom and slide changes.
  useEffect(() => {
    if (!openId) { setStickyPos(null); return undefined; }
    let raf = 0;
    const tick = () => {
      const pin = rootRef.current?.querySelector(`[data-sticky-id="${openId}"]`);
      if (pin) {
        const r = pin.getBoundingClientRect();
        const w = Math.min(250, window.innerWidth - 20);
        const x = Math.max(10, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 10));
        const below = r.bottom + 190 < window.innerHeight;
        const y = below ? r.bottom + 8 : Math.max(10, r.top - 190);
        setStickyPos((p) => (p && p.x === x && p.y === y ? p : { x, y }));
      } else setStickyPos((p) => (p === null ? p : null));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [openId]);

  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const pin = rootRef.current?.querySelector(`[data-sticky-id="${openId}"]`);
      setOpenId(null);
      pin?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openId]);

  const addSticky = () => {
    // Put it on the page or slide most in view, a little below the top of the screen.
    let best = null; let bestOverlap = 0;
    for (const { id, el } of scopes) {
      const r = el.getBoundingClientRect();
      const overlap = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (overlap > bestOverlap) { best = { id, r }; bestOverlap = overlap; }
    }
    if (!best) { setSaveFailed(false); return; }
    const y = clamp01((Math.max(best.r.top, 0) + 80 - best.r.top) / best.r.height);
    const s = { id: newId(), scope: best.id, x: 0.5, y, text: '', color, createdAt: Date.now() };
    setMarks((m) => ({ ...m, stickies: [...m.stickies, s] }));
    setPopover(null);
    setOpenId(s.id);
  };
  const updateSticky = (id, patch) => setMarks((m) => ({ ...m, stickies: m.stickies.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeSticky = (id) => { setMarks((m) => ({ ...m, stickies: m.stickies.filter((s) => s.id !== id) })); setOpenId(null); };
  const moveSticky = useCallback((id, x, y) => updateSticky(id, { x, y }), []);
  const addNote = () => {
    const n = { id: newId(), text: '', createdAt: Date.now() };
    setMarks((m) => ({ ...m, notes: [...m.notes, n] }));
    setPanel(true);
    setFocusNote(n.id);
  };
  const updateNote = (id, text) => setMarks((m) => ({ ...m, notes: m.notes.map((n) => (n.id === id ? { ...n, text: text.slice(0, NOTE_MAX) } : n)) }));
  const removeNote = (id) => setMarks((m) => ({ ...m, notes: m.notes.filter((n) => n.id !== id) }));
  const toggleSticky = useCallback((id) => { setPopover(null); setOpenId((cur) => (cur === id ? null : id)); }, []);

  const goTo = (item) => {
    window.dispatchEvent(new CustomEvent('alcoia:goto-scope', { detail: { scope: item.scope } }));
    setTimeout(() => {
      const el = rootRef.current?.querySelector(`[data-anno-scope="${item.scope}"]`);
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 60);
  };

  const download = () => {
    const blob = new Blob([marksToMarkdown(title ?? 'this reading', marks.items, marks)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(title ?? 'notes').replace(/[^\w-]+/g, '-').slice(0, 60)}-notes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const clearAll = () => {
    if (window.confirm('Remove every mark you made on this document? This cannot be undone.')) {
      setMarks({ items: [], strokes: [], stickies: [], notes: [] });
      setOpenId(null);
      setPopover(null);
    }
  };

  const editing = popover?.kind === 'edit' ? marks.items.find((i) => i.id === popover.id) : null;
  const sortedItems = [...marks.items].sort((a, b) => scopeOrder(a.scope) - scopeOrder(b.scope) || a.start - b.start);
  const textToolButtons = [['highlight', 'Highlight'], ['underline', 'Underline'], ['wavy', 'Wavy'], ['strike', 'Strike']];
  const count = marks.items.length + marks.strokes.length + marks.stickies.length + marks.notes.length;
  const openSticky = marks.stickies.find((s) => s.id === openId);
  const stickyRows = [...marks.stickies].sort((a, b) => scopeOrder(a.scope) - scopeOrder(b.scope) || a.y - b.y);

  return (
    <div className="annotator" data-tool={tool} data-editable={editable ? 'true' : 'false'} style={{ '--anno-h': `${barH}px` }} ref={rootRef} onMouseUp={onSelectionEnd} onTouchEnd={onSelectionEnd} onKeyUp={onSelectionEnd} onClick={onClick}>
      {editable && (
      <div className="annotator-bar annotator-ui" role="toolbar" aria-label="Reading tools" ref={barRef}>
        <button type="button" className={tool === 'select' ? 'tool on' : 'tool'} onClick={() => { setTool('select'); setPopover(null); }} aria-pressed={tool === 'select'} title="Select text; a menu appears">Select</button>
        {supported && textToolButtons.map(([k, label]) => (
          <button key={k} type="button" className={tool === k ? 'tool on' : 'tool'} onClick={() => setTool(tool === k ? 'select' : k)} aria-pressed={tool === k} title={`${label}: select text to mark it`}>
            <span className={`tool-icon tool-${k}`} aria-hidden="true" style={{ '--c': COLORS[color].solid, '--f': COLORS[color].fill }}>A</span>{label}
          </button>
        ))}
        <button type="button" className={tool === 'pen' ? 'tool on' : 'tool'} onClick={() => setTool(tool === 'pen' ? 'select' : 'pen')} aria-pressed={tool === 'pen'} title="Draw freehand on the page">Pen</button>
        <button type="button" className={tool === 'eraser' ? 'tool on' : 'tool'} onClick={() => setTool(tool === 'eraser' ? 'select' : 'eraser')} aria-pressed={tool === 'eraser'} title="Click a mark or stroke to remove it">Eraser</button>
        <span className="swatches" role="group" aria-label="Colour">
          {COLOR_KEYS.map((c) => (
            <button key={c} type="button" className={c === color ? 'swatch on' : 'swatch'} style={{ background: COLORS[c].solid }} onClick={() => setColor(c)} aria-label={COLORS[c].name} aria-pressed={c === color} />
          ))}
        </span>
        {tool === 'pen' && (
          <span className="widths" role="group" aria-label="Pen size">
            {Object.keys(PEN_WIDTHS).map((w) => (
              <button key={w} type="button" className={w === penWidth ? 'tool on' : 'tool'} onClick={() => setPenWidth(w)} aria-pressed={w === penWidth}>{w}</button>
            ))}
          </span>
        )}
        <button type="button" className="tool" onClick={addSticky} disabled={scopes.length === 0} title="Pin a small note to the page or slide in view">Sticky note</button>
        <button type="button" className="tool" onClick={addNote} title="Write a note about this reading">Add note</button>
        <span className="annotator-spacer" />
        <button type="button" className={panel ? 'tool on' : 'tool'} onClick={() => setPanel((v) => !v)} aria-expanded={panel}>My marks{count ? ` (${count})` : ''}</button>
      </div>
      )}
      {editable && !supported && <p className="annotator-note annotator-ui muted">Highlighting needs a newer browser. The pen still works.</p>}
      {editable && saveFailed && <p className="annotator-note annotator-ui alert alert-error">Your marks could not be saved on this device (storage is full or blocked).</p>}
      <div className="annotator-body">
        <div className="annotator-doc">{children}</div>
        {panel && (
          <aside className="annotator-panel annotator-ui" aria-label="My marks">
            <p className="muted small">Saved on this device only. They are never sent to alcoia or your instructor.</p>
            {count === 0 && <p className="muted">Nothing marked yet.</p>}
            <ul>
              {sortedItems.map((it) => (
                <li key={it.id}>
                  <button type="button" className="mark-row" onClick={() => goTo(it)}>
                    <span className={`mark-chip kind-${it.kind}`} style={{ '--c': COLORS[it.color]?.solid, '--f': COLORS[it.color]?.fill }} aria-hidden="true" />
                    <span className="mark-body">
                      <span className="mark-where">{scopeLabel(it.scope)} · {KIND_LABEL[it.kind]}{resolved.current.has(it.id) ? '' : ' · text moved'}</span>
                      <span className="mark-quote">{it.quote.length > 140 ? `${it.quote.slice(0, 140)}…` : it.quote}</span>
                      {it.note && <span className="mark-note">{it.note}</span>}
                    </span>
                  </button>
                  <button type="button" className="mark-del secondary" onClick={() => remove(it.id)} aria-label="Delete this mark">Delete</button>
                </li>
              ))}
            </ul>
            {stickyRows.length > 0 && (
              <>
                <h3 className="panel-h">Sticky notes</h3>
                <ul>
                  {stickyRows.map((st) => (
                    <li key={st.id}>
                      <button type="button" className="mark-row" onClick={() => { goTo(st); setTimeout(() => setOpenId(st.id), 250); }}>
                        <span className="mark-chip sticky-chip" style={{ '--c': COLORS[st.color]?.solid }} aria-hidden="true" />
                        <span className="mark-body">
                          <span className="mark-where">{scopeLabel(st.scope)} · Sticky note</span>
                          <span className="mark-note">{st.text ? (st.text.length > 140 ? `${st.text.slice(0, 140)}…` : st.text) : 'Empty'}</span>
                        </span>
                      </button>
                      <button type="button" className="mark-del secondary" onClick={() => removeSticky(st.id)} aria-label="Delete this sticky note">Delete</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="panel-h">Notes</h3>
            {marks.notes.length === 0 && <p className="muted small">Notes about the whole reading go here. Use Add note.</p>}
            <ul>
              {marks.notes.map((n) => (
                <li key={n.id} className="note-item">
                  <textarea
                    className="note-text"
                    rows={4}
                    value={n.text}
                    ref={(el) => { if (el && focusNote === n.id) { el.focus(); setFocusNote(null); } }}
                    onChange={(e) => updateNote(n.id, e.target.value)}
                    aria-label="Note about this reading"
                    placeholder="Write a note"
                  />
                  <button type="button" className="mark-del secondary" onClick={() => removeNote(n.id)} aria-label="Delete this note">Delete</button>
                </li>
              ))}
            </ul>
            {marks.strokes.length > 0 && <p className="muted small">{marks.strokes.length} pen stroke{marks.strokes.length === 1 ? '' : 's'}.</p>}
            <div className="panel-actions">
              <button type="button" className="secondary" onClick={download} disabled={sortedItems.length + marks.stickies.length + marks.notes.length === 0}>Download notes (.md)</button>
              <button type="button" className="secondary" onClick={clearAll} disabled={count === 0}>Remove all</button>
            </div>
          </aside>
        )}
      </div>

      {scopes.map(({ id, el }) => createPortal(
        <StrokeLayer
          key={id}
          scopeId={id}
          strokes={marks.strokes}
          drawing={tool}
          color={color}
          width={PEN_WIDTHS[penWidth]}
          onAdd={(s) => setMarks((m) => ({ ...m, strokes: [...m.strokes, s] }))}
          onErase={(sid) => setMarks((m) => ({ ...m, strokes: m.strokes.filter((x) => x.id !== sid) }))}
        />,
        el,
        id,
      ))}

      {editable && scopes.map(({ id, el }) => createPortal(
        <StickyLayer key={id} scopeId={id} stickies={marks.stickies} openId={openId} onToggle={toggleSticky} onMove={moveSticky} />,
        el,
        `st-${id}`,
      ))}

      {editable && openSticky && stickyPos && (
        <div className="annotator-pop annotator-ui sticky-pop" style={{ left: stickyPos.x, top: stickyPos.y }} role="dialog" aria-label="Sticky note">
          <textarea
            autoFocus
            value={openSticky.text}
            onChange={(e) => updateSticky(openSticky.id, { text: e.target.value.slice(0, NOTE_MAX) })}
            placeholder="Write a note"
            rows={4}
            aria-label="Sticky note text"
          />
          <div className="pop-row">
            {COLOR_KEYS.map((c) => (
              <button key={c} type="button" className={c === openSticky.color ? 'swatch on' : 'swatch'} style={{ background: COLORS[c].solid }} onClick={() => updateSticky(openSticky.id, { color: c })} aria-label={COLORS[c].name} aria-pressed={c === openSticky.color} />
            ))}
          </div>
          <div className="pop-row">
            <button type="button" className="secondary" onClick={() => setOpenId(null)}>Done</button>
            <button type="button" className="secondary" onClick={() => removeSticky(openSticky.id)}>Delete</button>
          </div>
        </div>
      )}

      {editable && popover?.kind === 'new' && (
        <div className="annotator-pop annotator-ui" style={{ left: popover.x, top: popover.y }} role="menu">
          <div className="pop-row">
            {COLOR_KEYS.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: COLORS[c].solid }} onClick={() => applyNew('hl', c, false)} aria-label={`Highlight ${COLORS[c].name}`} />
            ))}
          </div>
          <div className="pop-row">
            <button type="button" className="secondary" onClick={() => applyNew('ul', color, false)}>Underline</button>
            <button type="button" className="secondary" onClick={() => applyNew('wv', color, false)}>Wavy</button>
            <button type="button" className="secondary" onClick={() => applyNew('st', color, false)}>Strike</button>
            <button type="button" className="secondary" onClick={() => applyNew('hl', color, true)}>Note</button>
          </div>
        </div>
      )}

      {editable && editing && (
        <div className="annotator-pop annotator-ui" style={{ left: popover.x, top: popover.y }} role="dialog" aria-label="Edit mark">
          <div className="pop-row">
            {COLOR_KEYS.map((c) => (
              <button key={c} type="button" className={c === editing.color ? 'swatch on' : 'swatch'} style={{ background: COLORS[c].solid }} onClick={() => update(editing.id, { color: c })} aria-label={COLORS[c].name} />
            ))}
          </div>
          <div className="pop-row">
            {['hl', 'ul', 'wv', 'st'].map((k) => (
              <button key={k} type="button" className={editing.kind === k ? 'tool on' : 'tool'} onClick={() => update(editing.id, { kind: k })} aria-pressed={editing.kind === k}>{KIND_LABEL[k]}</button>
            ))}
          </div>
          <textarea
            value={editing.note}
            onChange={(e) => update(editing.id, { note: e.target.value.slice(0, 2000) })}
            placeholder="Add a note"
            rows={3}
            aria-label="Note"
          />
          <div className="pop-row">
            <button type="button" className="secondary" onClick={() => setPopover(null)}>Done</button>
            <button type="button" className="secondary" onClick={() => remove(editing.id)}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
