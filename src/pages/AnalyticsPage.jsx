import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchLearnerAnalytics, CONSOLE_URL, MARKETING_URL } from '../lib/analytics.js';

// Learner analytics: how the learner is actually learning, from their own private learning
// memory. Learning state and review timing only -- no time spent, no reading speed, no
// attention, no comparison with anyone. Everything shown is an aggregate the server computed;
// access (plan and consent) is decided by the server, never here.

const CATEGORIES = [
  { key: 'well_retained', label: 'Well retained', tone: 'good', blurb: 'Recalled successfully several times; next review is further out.' },
  { key: 'developing', label: 'Developing', tone: 'mid', blurb: 'Answered correctly and scheduled for review; still building.' },
  { key: 'due_for_review', label: 'Due for review', tone: 'due', blurb: 'The scheduled review time has arrived.' },
  { key: 'not_established', label: 'Not yet established', tone: 'none', blurb: 'No correct answer recorded yet, so no review is scheduled.' },
];

const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 100));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const weekLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

function AssignmentLabel({ item }) {
  if (!item.accessible) return <span className="muted">A piece of material you no longer have access to</span>;
  const a = item.assignment;
  return (
    <>
      <Link className="row-link" to={`/a/${a.assignmentId}`} reloadDocument>{a.name || a.className}</Link>
      {a.name && a.className && <div className="muted">{a.className}</div>}
    </>
  );
}

function Overview({ o }) {
  return (
    <section className="an-section" aria-labelledby="an-overview">
      <h2 id="an-overview">Where your knowledge stands</h2>
      <p className="muted">{plural(o.unitsTotal, 'passage', 'passages')} you have answered questions about.</p>
      <div className="an-stack" role="img" aria-label={CATEGORIES.map((c) => `${c.label}: ${o[c.key]}`).join(', ')}>
        {CATEGORIES.map((c) => o[c.key] > 0 && <span key={c.key} className={`an-seg an-${c.tone}`} style={{ flexGrow: o[c.key] }} />)}
      </div>
      <ul className="an-legend">
        {CATEGORIES.map((c) => (
          <li key={c.key}>
            <span className={`an-swatch an-${c.tone}`} aria-hidden="true" />
            <div><strong>{c.label}</strong>: {o[c.key]}<div className="muted">{c.blurb}</div></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Review({ r }) {
  return (
    <section className="an-section" aria-labelledby="an-review">
      <h2 id="an-review">Reviews</h2>
      <div className="an-stats">
        <div className="an-stat"><div className="an-num">{r.dueNow}</div><div className="muted">due now</div></div>
        <div className="an-stat"><div className="an-num">{r.overdue}</div><div className="muted">overdue (more than a day)</div></div>
        <div className="an-stat"><div className="an-num">{r.upcoming7Days}</div><div className="muted">coming up in 7 days</div></div>
      </div>
      {r.byAssignment.length > 0 ? (
        <>
          <p className="muted">Reviews come up as you read these documents with the alcoia extension.</p>
          <ul className="an-list">
            {r.byAssignment.map((a, i) => (
              <li key={i}><div><AssignmentLabel item={a} /></div><span className="an-count">{plural(a.dueNow, 'review', 'reviews')} waiting</span></li>
            ))}
          </ul>
        </>
      ) : <p className="muted">Nothing is due right now.</p>}
    </section>
  );
}

function NeedsWork({ items }) {
  return (
    <section className="an-section" aria-labelledby="an-work">
      <h2 id="an-work">Areas needing work</h2>
      {items.length === 0 ? (
        <p className="muted">Nothing stands out right now. A single wrong answer is not treated as a weakness; this list only shows repeated difficulty.</p>
      ) : (
        <>
          <p className="muted">Shown only where there is repeated evidence: several wrong answers on the same passage, or a review that has been waiting a long time.</p>
          <ul className="an-list">
            {items.map((a, i) => (
              <li key={i}>
                <div>
                  <AssignmentLabel item={a} />
                  <div className="muted">
                    {[a.repeatedIncorrect > 0 && `${plural(a.repeatedIncorrect, 'passage', 'passages')} with repeated wrong answers`,
                      a.longOverdue > 0 && `${plural(a.longOverdue, 'passage', 'passages')} with a long-overdue review`].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Progress({ p }) {
  const maxWeek = Math.max(1, ...p.firstAnsweredByWeek.map((w) => w.units));
  const scheduled = p.retentionStages.reduce((n, s) => n + s.units, 0);
  return (
    <section className="an-section" aria-labelledby="an-progress">
      <h2 id="an-progress">Progress</h2>
      <p>
        {p.successRate === null ? 'No graded answers yet.' : <><strong>{Math.round(p.successRate * 100)}%</strong> of your graded answers were correct</>}
        {' '}<span className="muted">({plural(p.correct, 'correct answer', 'correct answers')}, {plural(p.incorrect, 'incorrect', 'incorrect')}{p.ungraded > 0 ? `, ${p.ungraded} not graded` : ''})</span>
      </p>
      <h3>How far apart your reviews are</h3>
      {scheduled === 0 ? <p className="muted">Reviews are scheduled after a first correct answer.</p> : (
        <ul className="an-rows">
          {p.retentionStages.map((s) => (
            <li key={s.stage}>
              <span className="an-rowlabel">Every {s.intervalDays} {s.intervalDays === 1 ? 'day' : 'days'}</span>
              <span className="an-bar"><span style={{ width: `${pct(s.units, scheduled)}%` }} /></span>
              <span className="an-rowcount">{s.units}</span>
            </li>
          ))}
        </ul>
      )}
      <h3>New passages you first answered, by week</h3>
      <ul className="an-rows">
        {p.firstAnsweredByWeek.map((w) => (
          <li key={w.weekStart}>
            <span className="an-rowlabel">Week of {weekLabel(w.weekStart)}</span>
            <span className="an-bar"><span style={{ width: `${pct(w.units, maxWeek)}%` }} /></span>
            <span className="an-rowcount">{w.units}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recent({ r }) {
  return (
    <section className="an-section" aria-labelledby="an-recent">
      <h2 id="an-recent">Recent learning</h2>
      <ul className="an-list">
        <li><span>Last 7 days</span><span className="an-count">{plural(r.last7Days.practised, 'passage', 'passages')} practised · {plural(r.last7Days.reviewed, 'review', 'reviews')} completed</span></li>
        <li><span>Last 30 days</span><span className="an-count">{plural(r.last30Days.practised, 'passage', 'passages')} practised · {plural(r.last30Days.reviewed, 'review', 'reviews')} completed</span></li>
      </ul>
    </section>
  );
}

function MemoryOff({ status }) {
  const copy = {
    disabled: ['Your private learning memory is turned off, so analytics cannot be shown.', 'Nothing was deleted. Turn it back on and your analytics resume.'],
  }[status] ?? ['Your private learning memory is not currently available, so analytics cannot be shown.', ''];
  return (
    <div className="notice">
      <h2>{copy[0]}</h2>
      {copy[1] && <p>{copy[1]}</p>}
      <p><a className="button" href={`${CONSOLE_URL}/settings#learning-memory`}>Open account-based learning settings</a></p>
      <p className="muted">You can also change this in the alcoia extension&apos;s settings.</p>
    </div>
  );
}

function Upgrade() {
  return (
    <div className="notice">
      <h2>Learner analytics is part of the Reader and Student plans</h2>
      <p>It shows what you know well, what needs another look and what is due for review, from your own private learning memory.</p>
      <p><a className="button" href={`${MARKETING_URL}/pricing`}>See plans</a></p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { session, signOut } = useSession();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchLearnerAnalytics(session.sessionToken)
      .then((result) => !cancelled && setState({ status: 'done', result }))
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) signOut();
        else setState({ status: 'error' });
      });
    return () => { cancelled = true; };
  }, [session.sessionToken, signOut]);

  const result = state.result;
  const data = result?.kind === 'ready' ? result.data : null;

  return (
    <section className="page an-page">
      <h1 className="page-title">Learner analytics</h1>
      <p className="muted">Private to you. Built from your own learning memory; no one else, including instructors, can see it.</p>
      {state.status === 'loading' && <p className="muted">Loading your analytics.</p>}
      {state.status === 'error' && <p className="alert alert-error">Your analytics could not be loaded. Try again in a moment.</p>}
      {result?.kind === 'upgrade' && <Upgrade />}
      {result?.kind === 'memory' && <MemoryOff status={result.status} />}
      {data?.state === 'empty' && (
        <div className="notice">
          <h2>Your analytics will appear as you learn</h2>
          <p>Once you answer questions about your reading, this page shows what you know well, what needs another look and what is due for review.</p>
        </div>
      )}
      {data?.state === 'ready' && (
        <>
          <Overview o={data.overview} />
          <Review r={data.review} />
          <NeedsWork items={data.needsWork} />
          <Progress p={data.progress} />
          <Recent r={data.recent} />
          {data.truncated && <p className="muted">Showing your most recent passages only.</p>}
          <details className="an-how">
            <summary>How these are worked out</summary>
            <p>Every figure is counted from the answers and review schedule alcoia keeps for you. It does not measure time spent, reading speed or attention, and it is never compared with anyone else.</p>
            <p>A passage is &ldquo;not yet established&rdquo; until you answer it correctly once. After that it is reviewed after 1, 3, 7, 14 and 30 days as you recall it; a miss moves it back a step. &ldquo;Well retained&rdquo; means three or more successful recalls. These thresholds are first versions and may change.</p>
          </details>
        </>
      )}
    </section>
  );
}
