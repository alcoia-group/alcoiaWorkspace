import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchMyAssignments } from '../lib/assignments.js';
import { formatDue, formatLabel } from '../lib/format.js';
import { estimateMinutes, formatMinutes, minutesLeft } from '../lib/readingTime.js';
import { fractionLeft, loadPosition } from '../lib/resume.js';
import { useReadingEstimate } from '../lib/useReadingEstimate.js';
import { loadMarks } from '../lib/annotations.js';
import { getIdentityRecord, listLocalFiles } from '../lib/localFiles.js';
import { summarise } from '../lib/documentIdentity.js';
import KeptAndReviews from '../components/KeptAndReviews.jsx';

// Overview: where to pick up. Built only from what the workspace already has: the open materials the server lists,
// and what this browser keeps (where you were, your marks, your own files). Nothing new is sent or stored.

const DAY = 86_400_000;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// "today", "tomorrow", "in 3 days". Whole days on the calendar, not 24-hour blocks.
function dueWhen(iso, now = new Date()) {
  const d = new Date(iso);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / DAY);
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

function countMarks(docKey) {
  const m = loadMarks(docKey);
  return { notes: (m.notes?.length ?? 0) + (m.stickies?.length ?? 0), highlights: m.items.length };
}

function marksLine({ notes, highlights }) {
  const parts = [];
  if (notes) parts.push(`${notes} ${notes === 1 ? 'note' : 'notes'}`);
  if (highlights) parts.push(`${highlights} ${highlights === 1 ? 'highlight' : 'highlights'}`);
  return parts.join(', ');
}

export default function HomePage() {
  const { session, signOut } = useSession();
  const account = session.email ?? null;
  const pace = useReadingEstimate(session.sessionToken);
  const [materials, setMaterials] = useState({ status: 'loading', items: [] });
  const [files, setFiles] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyAssignments(session.sessionToken)
      .then((items) => !cancelled && setMaterials({ status: 'ready', items }))
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) signOut();
        else setMaterials({ status: 'error', items: [] });
      });
    return () => { cancelled = true; };
  }, [session.sessionToken, signOut]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listLocalFiles(account);
        const out = await Promise.all(rows.map(async (r) => {
          const rec = await getIdentityRecord(r.id);
          const summary = rec?.identity ? summarise(rec.identity, loadMarks(`f:${r.id}`)) : null;
          return { id: r.id, name: r.name, format: r.format, summary, kind: rec?.identity?.overview?.kind ?? 'pages', lastAt: rec?.identity?.lastOpenedAt ?? r.addedAt };
        }));
        if (!cancelled) setFiles(out);
      } catch {
        if (!cancelled) setFiles([]);
      }
    })();
    return () => { cancelled = true; };
  }, [account]);

  const now = Date.now();
  const open = [...materials.items].sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt));
  const enriched = open.map((a) => {
    const est = pace.ready ? estimateMinutes({ wordCount: a.documents[0]?.wordCount, baseline: pace.baseline, help: pace.help }) : null;
    const place = loadPosition(account, a.assignmentId);
    const left = place ? fractionLeft(place.index, place.total) : null;
    return {
      ...a,
      est,
      place,
      progress: place ? Math.round((1 - left) * 100) : 0,
      minutesLeft: est && place ? minutesLeft(est.minutes, left) : est?.minutes ?? null,
      marks: countMarks(`a:${a.assignmentId}`),
    };
  });
  const dueThisWeek = enriched.filter((a) => new Date(a.closesAt).getTime() - now < 7 * DAY).length;
  const started = enriched.filter((a) => a.place).length + (files ?? []).filter((f) => f.summary?.where).length;
  const noteDocs = [
    ...enriched.filter((a) => a.marks.notes + a.marks.highlights > 0).map((a) => ({ key: `a:${a.assignmentId}`, to: `/a/${a.assignmentId}`, name: a.name || a.className, marks: a.marks })),
    ...(files ?? []).map((f) => ({ key: `f:${f.id}`, to: `/f/${f.id}`, name: f.name, marks: countMarks(`f:${f.id}`) })).filter((d) => d.marks.notes + d.marks.highlights > 0),
  ];
  const totalNotes = noteDocs.reduce((n, d) => n + d.marks.notes + d.marks.highlights, 0);
  const recentFiles = (files ?? []).filter((f) => f.summary?.where).sort((a, b) => b.lastAt - a.lastAt).slice(0, 4);
  const loading = materials.status === 'loading' || files === null;

  return (
    <section className="page ov-page">
      <header className="ov-head">
        <p className="ov-eyebrow">{greeting()}</p>
        <h1 className="ov-title">Your overview</h1>
        <p className="muted">What is due, where you stopped, and the notes you kept.</p>
      </header>

      <div className="ov-stats" aria-busy={loading}>
        <Stat value={materials.status === 'ready' ? dueThisWeek : null} label="Due in the next 7 days" to="/assignments" />
        <Stat value={loading ? null : started} label="Started, not finished" />
        <Stat value={loading ? null : totalNotes} label="Notes and highlights on this device" />
      </div>

      <div className="ov-grid">
        <section className="ov-card ov-span" aria-labelledby="ov-due">
          <div className="ov-card-head">
            <h2 id="ov-due">Coming up</h2>
            <Link to="/assignments">All materials</Link>
          </div>
          {materials.status === 'loading' && <div className="ov-skeleton" aria-label="Loading"><span /><span /><span /></div>}
          {materials.status === 'error' && <p className="alert alert-error">Materials could not be loaded. Try again in a moment.</p>}
          {materials.status === 'ready' && enriched.length === 0 && (
            <p className="ov-empty">Nothing is due. When an instructor assigns a reading, it shows here with its due date.</p>
          )}
          {enriched.length > 0 && (
            <ul className="ov-due-list">
              {enriched.slice(0, 5).map((a) => {
                const soon = new Date(a.closesAt).getTime() - now < 2 * DAY;
                return (
                  <li key={a.assignmentId} className="ov-due-item">
                    <div className="ov-due-main">
                      <Link className="row-link" to={`/a/${a.assignmentId}`} reloadDocument>{a.name || a.className}</Link>
                      <div className="muted small">
                        {a.name ? `${a.className} · ` : ''}
                        {a.documents[0] ? formatLabel(a.documents[0].format) : 'No file yet'}
                        {a.minutesLeft != null && (a.minutesLeft < 1 ? ' · nearly done' : ` · about ${formatMinutes(a.minutesLeft)}${a.place ? ' left' : ''}`)}
                      </div>
                      {a.place && (
                        <div className="ov-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={a.progress} aria-label="How far you got">
                          <span style={{ width: `${a.progress}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="ov-due-side">
                      <div className="ov-due-dates">
                        <span className={`ov-when${soon ? ' is-soon' : ''}`}>{dueWhen(a.closesAt)}</span>
                        <span className="muted small">{formatDue(a.closesAt)}</span>
                      </div>
                      <Link className="button secondary ov-open" to={`/a/${a.assignmentId}`} reloadDocument>{a.place ? 'Continue' : 'Open'}</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <details className="ov-how">
            <summary>How due dates work</summary>
            <p>
              Your instructor sets a due date for each reading. Until then you can open it as often as you like, and the
              questions you answer while reading count toward your class&rsquo;s results. How those results are shown to your
              instructor was explained when you joined the class.
            </p>
            <p>
              After the due date the reading leaves your list and nothing more is added to the class results. Where you
              stopped and your notes stay in this browser.
            </p>
          </details>
        </section>
        <KeptAndReviews sessionToken={session.sessionToken} />

        <section className="ov-card" aria-labelledby="ov-continue">
          <div className="ov-card-head">
            <h2 id="ov-continue">Your files</h2>
            <Link to="/files">My files</Link>
          </div>
          {files === null && <div className="ov-skeleton" aria-label="Loading"><span /><span /></div>}
          {files !== null && recentFiles.length === 0 && (
            <p className="ov-empty">
              {files.length === 0 ? 'Add your own PDF, Word or PowerPoint files. They stay on this device.' : 'Open one of your files and it shows here, with where you stopped.'}
            </p>
          )}
          {recentFiles.length > 0 && (
            <ul className="ov-list">
              {recentFiles.map((f) => (
                <li key={f.id}>
                  <Link className="row-link" to={`/f/${f.id}`} reloadDocument>{f.name}</Link>
                  <span className="muted small">
                    {f.kind === 'slides' ? 'Slide' : 'Page'} {f.summary.where.index + 1} of {f.summary.where.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {files !== null && files.length === 0 && <Link className="button secondary" to="/files">Add a file</Link>}
        </section>

        <section className="ov-card" aria-labelledby="ov-notes">
          <div className="ov-card-head">
            <h2 id="ov-notes">Your notes</h2>
          </div>
          {loading && <div className="ov-skeleton" aria-label="Loading"><span /><span /></div>}
          {!loading && noteDocs.length === 0 && (
            <p className="ov-empty">Highlight a passage or add a note while you read. They are kept in this browser only.</p>
          )}
          {!loading && noteDocs.length > 0 && (
            <ul className="ov-list">
              {noteDocs.slice(0, 5).map((d) => (
                <li key={d.key}>
                  <Link className="row-link" to={d.to} reloadDocument>{d.name}</Link>
                  <span className="muted small">{marksLine(d.marks)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ov-card ov-span" aria-labelledby="ov-go">
          <h2 id="ov-go">Go to</h2>
          <ul className="ov-links">
            <li><Link to="/assignments"><strong>Materials</strong><span>Readings your instructors assigned</span></Link></li>
            <li><Link to="/files"><strong>My files</strong><span>Your own documents, kept on this device</span></Link></li>
            <li><Link to="/analytics"><strong>Learner analytics</strong><span>What you answered well and what to review</span></Link></li>
            <li><Link to="/settings"><strong>Settings</strong><span>Help cards, reading options and your data</span></Link></li>
          </ul>
        </section>
      </div>
    </section>
  );
}

function Stat({ value, label, to }) {
  const body = (
    <>
      <span className="ov-stat-value">{value == null ? <span className="ov-shimmer" aria-hidden="true" /> : value}</span>
      <span className="ov-stat-label">{label}</span>
    </>
  );
  return to ? <Link className="ov-stat" to={to}>{body}</Link> : <div className="ov-stat">{body}</div>;
}
