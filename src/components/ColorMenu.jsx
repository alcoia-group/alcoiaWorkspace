import { useEffect, useRef, useState } from 'react';
import { COLORS, COLOR_KEYS, HEX_RE, resolveColor } from '../lib/annotations.js';

// The colour control of the reading tools: a highlighter that shows the current colour, and a
// menu beside it with the preset colours, the custom colours made recently, and a way to make a
// new one (like Word's "More colours"). The choice is kept on this device by the caller.

function HighlighterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </svg>
  );
}

// Preset colours and recent custom colours as round buttons.
export function Swatches({ value, onPick, recent = [], presets = true, label = (name) => name, className = '' }) {
  const all = [...(presets ? COLOR_KEYS : []), ...recent];
  return (
    <>
      {all.map((c) => {
        const col = resolveColor(c);
        const on = c.toLowerCase() === String(value).toLowerCase();
        return (
          <button key={c} type="button" className={`swatch${on ? ' on' : ''} ${className}`.trim()} style={{ background: col.solid }} onClick={() => onPick(c)} aria-label={label(COLORS[c]?.name ?? col.name)} aria-pressed={on} />
        );
      })}
    </>
  );
}

export default function ColorMenu({ value, onChange, onRemember, recent, active, onToggleTool }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('#ff8a65');
  const [hexText, setHexText] = useState('#ff8a65');
  const wrapRef = useRef(null);
  const chevronRef = useRef(null);
  const current = resolveColor(value);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); chevronRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const pick = (c) => { onChange(c); setOpen(false); };
  const setDraftBoth = (v) => { setDraft(v); setHexText(v); };
  const typed = (v) => {
    const t = v.startsWith('#') ? v : `#${v}`;
    setHexText(v);
    if (HEX_RE.test(t)) setDraft(t.toLowerCase());
  };
  const useCustom = () => { onRemember(draft); onChange(draft.toLowerCase()); setOpen(false); };

  return (
    <span className="color-menu" ref={wrapRef}>
      <span className="split-tool">
        <button type="button" className={active ? 'tool on split-main' : 'tool split-main'} onClick={onToggleTool} aria-pressed={active} title={`Highlight in ${current.name}: select text to mark it`}>
          <span className="hl-icon"><HighlighterIcon /><span className="hl-strip" style={{ background: current.fill, borderColor: current.solid }} /></span>
          <span className="sr-only">Highlight, {current.name}</span>
        </button>
        <button type="button" ref={chevronRef} className={open ? 'tool on split-arrow' : 'tool split-arrow'} onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Colour: ${current.name}. Change colour`} title="Change colour">
          <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </span>
      {open && (
        <div className="color-pop annotator-ui" role="dialog" aria-label="Colours">
          <p className="color-pop-h">Colours</p>
          <div className="pop-row color-grid"><Swatches value={value} onPick={pick} label={(n) => n} /></div>
          {recent.length > 0 && (
            <>
              <p className="color-pop-h">Your colours</p>
              <div className="pop-row color-grid"><Swatches value={value} onPick={pick} recent={recent} presets={false} label={(n) => n} /></div>
            </>
          )}
          <p className="color-pop-h">Custom colour</p>
          <div className="color-custom">
            <input type="color" value={draft} onChange={(e) => setDraftBoth(e.target.value)} aria-label="Pick a colour" />
            <input type="text" className="color-hex" value={hexText} onChange={(e) => typed(e.target.value)} maxLength={7} spellCheck={false} aria-label="Colour as a hex code, for example #ff8a65" />
            <span className="color-preview" style={{ background: resolveColor(draft).fill, borderColor: resolveColor(draft).solid }} aria-hidden="true" />
            <button type="button" className="secondary" onClick={useCustom}>Use</button>
          </div>
        </div>
      )}
    </span>
  );
}
