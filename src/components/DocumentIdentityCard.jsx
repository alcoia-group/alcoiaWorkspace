import { useRef, useState } from 'react';
import { formatMinutes } from '../lib/readingTime.js';

const STATUS_TEXT = {
  signed: 'Signed on this device. Nothing has changed it.',
  foreign: 'Restored from another device. It is signed here from now on.',
  invalid: 'This record does not match its signature, so it may have been damaged or edited. It was kept, not trusted.',
};

// A short ID a person can recognise: the first eight characters of the file's fingerprint, in two groups.
export const shortId = (fingerprint) => `${fingerprint.slice(0, 4)}-${fingerprint.slice(4, 8)}`.toUpperCase();

// The document's own record, on this device: what it is, where you were, where it was hard, what you marked.
// Everything here is read from this browser; none of it is on the server.
export default function DocumentIdentityCard({ identity, status, summary, onExport, onImport, message }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { overview } = identity;
  const where = summary.where;
  const unit = overview.kind === 'slides' ? 'slide' : 'page';
  return (
    <details className="identity-card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="identity-id">{shortId(identity.fingerprint)}</span>{' '}
        {where ? `You were on ${unit} ${where.index + 1} of ${where.total}` : 'Not opened for reading yet'}
        {summary.hardCount > 0 && ` · ${summary.hardCount} hard ${summary.hardCount === 1 ? 'part' : 'parts'}`}
        {summary.marks.highlights + summary.marks.notes > 0 && ` · ${summary.marks.highlights} marked, ${summary.marks.notes} notes`}
      </summary>
      <div className="identity-body">
        <p className="muted small">This is the record of this document, kept on this device only. It stays when you close or refresh the page.</p>
        <dl className="identity-facts">
          <dt>Document</dt>
          <dd>{identity.name} ({identity.format.toUpperCase()}, {overview.parts} {overview.kind}{overview.words ? `, about ${overview.words.toLocaleString()} words` : ''})</dd>
          <dt>Fingerprint</dt>
          <dd><code>{identity.fingerprint.slice(0, 16)}…</code> <span className="muted small">Identifies this exact file, whatever it is called.</span></dd>
          <dt>Where you left off</dt>
          <dd>{where ? `${unit[0].toUpperCase()}${unit.slice(1)} ${where.index + 1} of ${where.total}${where.percent != null ? ` (${where.percent}%)` : ''}` : 'Nowhere yet'}</dd>
          <dt>Time spent</dt>
          <dd>{summary.timeMs >= 60000 ? formatMinutes(summary.timeMs / 60000) : 'Under a minute'}</dd>
          <dt>Your marks</dt>
          <dd>{summary.marks.highlights} highlights and underlines, {summary.marks.notes} notes, {summary.marks.drawings} drawings</dd>
        </dl>

        {summary.hardParts.length > 0 && (
          <>
            <h3>Where it was hard</h3>
            <ul className="identity-list">
              {summary.hardParts.map((p) => (
                <li key={p.scope}>{p.label}: {p.hard > 0 ? `${p.hard} time${p.hard === 1 ? '' : 's'} stuck` : ''}{p.hard > 0 && p.slow > 0 ? ', ' : ''}{p.slow > 0 ? `${p.slow} long ${p.slow === 1 ? 'stop' : 'stops'}` : ''}</li>
              ))}
            </ul>
          </>
        )}
        {summary.keyParts.length > 0 && (
          <>
            <h3>The parts you worked with most</h3>
            <ul className="identity-list">
              {summary.keyParts.map((p) => (
                <li key={p.scope}>{p.label}{p.marks > 0 ? `, ${p.marks} mark${p.marks === 1 ? '' : 's'}` : ''}</li>
              ))}
            </ul>
          </>
        )}
        {overview.outline.length > 0 && (
          <>
            <h3>What is in it</h3>
            <ul className="identity-list">
              {overview.outline.slice(0, 12).map((o, i) => <li key={`${o.scope}-${i}`} style={{ marginLeft: `${(o.level - 1) * 12}px` }}>{o.label}</li>)}
            </ul>
          </>
        )}

        <p className={status === 'invalid' ? 'alert alert-error' : 'muted small'}>{STATUS_TEXT[status] ?? ''}</p>
        <p>
          <button type="button" className="secondary" onClick={onExport}>Export this record</button>{' '}
          <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>Restore a record</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Choose a record to restore"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
        </p>
        {message && <p className={message.error ? 'alert alert-error' : 'alert'} role="status">{message.text}</p>}
        <p className="muted small">To use this document on another device, add the same file there and restore the record you exported. A record only fits the file it came from.</p>
      </div>
    </details>
  );
}
