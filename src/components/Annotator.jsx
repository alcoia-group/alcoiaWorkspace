import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  COLORS, COLOR_KEYS, KIND_LABEL, anchorFromSelection, caretAtPoint, highlightsSupported, loadMarks,
  marksToMarkdown, newId, rangeFromOffsets, resolveAnchor, saveMarks, scopeLabel, scopeOrder, scopeText,
} from '../lib/annotations.js';

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

export default function Annotator({ docKey, title, children }) {
  const rootRef = useRef(null);
  const scopes = useScopes(rootRef);
  const supported = useMemo(highlightsSupported, []);
  const [marks, setMarks] = useState(() => loadMarks(docKey));
  const [tool, setTool] = useState('select'); // select | highlight | underline | wavy | strike | pen | eraser
  const [color, setColor] = useState('yellow');
  const [penWidth, setPenWidth] = useState('medium');
  const [panel, setPanel] = useState(false);
  const [popover, setPopover] = useState(null); // { x, y, kind: 'new' | 'edit', pieces?, id? }
  const [saveFailed, setSaveFailed] = useState(false);
  const resolved = useRef(new Map()); // id -> { scopeEl, start, end }
  const pending = useRef(null);

  useEffect(() => { setMarks(loadMarks(docKey)); }, [docKey]);
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
    for (const n of names) CSS.highlights.delete(n);
    for (const [name, ranges] of groups) CSS.highlights.set(name, new Highlight(...ranges));
    return () => { for (const n of names) CSS.highlights.delete(n); };
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
    if (!supported || e.target.closest?.('.annotator-ui')) return;
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
    if (!supported || e.target.closest?.('.annotator-ui, .stroke-layer, button, a')) return;
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

  const goTo = (item) => {
    window.dispatchEvent(new CustomEvent('alcoia:goto-scope', { detail: { scope: item.scope } }));
    setTimeout(() => {
      const el = rootRef.current?.querySelector(`[data-anno-scope="${item.scope}"]`);
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 60);
  };

  const download = () => {
    const blob = new Blob([marksToMarkdown(title ?? 'this reading', marks.items)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(title ?? 'notes').replace(/[^\w-]+/g, '-').slice(0, 60)}-notes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const clearAll = () => {
    if (window.confirm('Remove every mark you made on this document? This cannot be undone.')) {
      setMarks({ items: [], strokes: [] });
      setPopover(null);
    }
  };

  const editing = popover?.kind === 'edit' ? marks.items.find((i) => i.id === popover.id) : null;
  const sortedItems = [...marks.items].sort((a, b) => scopeOrder(a.scope) - scopeOrder(b.scope) || a.start - b.start);
  const textToolButtons = [['highlight', 'Highlight'], ['underline', 'Underline'], ['wavy', 'Wavy'], ['strike', 'Strike']];
  const count = marks.items.length + marks.strokes.length;

  return (
    <div className="annotator" data-tool={tool} ref={rootRef} onMouseUp={onSelectionEnd} onTouchEnd={onSelectionEnd} onKeyUp={onSelectionEnd} onClick={onClick}>
      <div className="annotator-bar annotator-ui" role="toolbar" aria-label="Reading tools">
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
        <span className="annotator-spacer" />
        <button type="button" className={panel ? 'tool on' : 'tool'} onClick={() => setPanel((v) => !v)} aria-expanded={panel}>My marks{count ? ` (${count})` : ''}</button>
      </div>
      {!supported && <p className="annotator-note annotator-ui muted">Highlighting needs a newer browser. The pen still works.</p>}
      {saveFailed && <p className="annotator-note annotator-ui alert alert-error">Your marks could not be saved on this device (storage is full or blocked).</p>}
      <div className="annotator-body">
        <div className="annotator-doc">{children}</div>
        {panel && (
          <aside className="annotator-panel annotator-ui" aria-label="My marks">
            <p className="muted small">Saved on this device only. They are never sent to alcoia or your instructor.</p>
            {sortedItems.length === 0 && marks.strokes.length === 0 && <p className="muted">Nothing marked yet. Select text and choose a colour.</p>}
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
            {marks.strokes.length > 0 && <p className="muted small">{marks.strokes.length} pen stroke{marks.strokes.length === 1 ? '' : 's'}.</p>}
            <div className="panel-actions">
              <button type="button" className="secondary" onClick={download} disabled={sortedItems.length === 0}>Download notes (.md)</button>
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

      {popover?.kind === 'new' && (
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

      {editing && (
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
