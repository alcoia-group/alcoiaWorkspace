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

// Passages that came up again in a later reading. Counts from the learner's own answers only.
function Revisited({ r }) {
  if (!r || !r.passages) return null;
  return (
    <section className="an-section" aria-labelledby="an-revisited">
      <h2 id="an-revisited">Passages you met again</h2>
      <p>{plural(r.passages, 'passage', 'passages')} came up in more than one of your readings.</p>
      {r.struggledBefore > 0 ? (
        <ul className="an-list">
          <li><span>You found it hard the first time</span><span className="an-count">{plural(r.struggledBefore, 'passage', 'passages')}</span></li>
          <li><span>Answered correctly since</span><span className="an-count">{plural(r.wentWellSince, 'passage', 'passages')}</span></li>
          <li><span>Still worth another look</span><span className="an-count">{plural(r.stillStruggling, 'passage', 'passages')}</span></li>
        </ul>
      ) : (
        <p className="muted">You did not struggle with any of them the first time.</p>
      )}
    </section>
  );
}

const STRUGGLE_LABEL = {
  confusion: 'Feeling confused',
  overload: 'Too much at once',
  unclear: 'Not sure why',
  confidentlyWrong: 'Sure of an answer that was wrong',
  unsureWrong: 'Unsure and wrong',
};
const STRUGGLE_MAIN = {
  confusion: 'confusion is what you most often report or show.',
  overload: 'feeling overloaded is what you most often report or show.',
  unclear: 'difficulty you could not name is what you most often report or show.',
  confidentlyWrong: 'being sure of an answer that turned out wrong is the most common.',
  unsureWrong: 'wrong answers you were unsure about are the most common.',
};

// How the learner tends to struggle: five running counts. Private to them; no score, no comparison.
function StrugglePattern({ s }) {
  if (!s || s.state !== 'ready') return null;
  return (
    <section className="an-section" aria-labelledby="an-struggle">
      <h2 id="an-struggle">How you tend to struggle</h2>
      <ul className="an-list">
        {Object.keys(STRUGGLE_LABEL).map((k) => (
          <li key={k}><span>{STRUGGLE_LABEL[k]}</span><span className="an-count">{s.counts[k]}</span></li>
        ))}
      </ul>
      {s.main ? <p>So far, {STRUGGLE_MAIN[s.main]}</p> : <p className="muted">No single kind stands out yet.</p>}
      <p className="muted">Only you can see this. It is a count, not a score, and your instructor never sees it.</p>
    </section>
  );
}

// Ideas that appear in more than one of the learner's readings.
function Concepts({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="an-section" aria-labelledby="an-concepts">
      <h2 id="an-concepts">Ideas that come up in more than one reading</h2>
      <ul className="an-list">
        {items.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span>
            <span className="an-count">
              {plural(c.readings, 'reading', 'readings')} · {plural(c.passages, 'passage', 'passages')}
              {c.needAnotherLook > 0 ? ` · ${c.needAnotherLook} worth another look` : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted">Ideas are matched by the words used in each reading, so a related idea named differently may not appear.</p>
    </section>
  );
}


import SubjectRow from '../components/SubjectRow.jsx';
import { LEVEL_LABEL, LEVEL_ORDER, LEVEL_TONE, countByLevel } from '../lib/subjects.js';

const SUMMARY_TOP = 5;
const DOC_TOP = 5;

// A short summary of every idea the learner has met: how many are at each level and the few that most need a look. The
// full list (any number of ideas) lives on its own page, so this page stays short at 5 subjects or 50.
function Subjects({ items }) {
  if (!items || items.length === 0) return null;
  const counts = countByLevel(items);
  const top = items.filter((s) => s.level === 'needs_help').slice(0, SUMMARY_TOP);
  return (
    <section className="an-section" aria-labelledby="an-subjects">
      <h2 id="an-subjects">By subject</h2>
      <p className="muted">{plural(items.length, 'idea', 'ideas')} met across your readings. Recognising an answer, explaining it, recalling it, using it somewhere new and remembering it later are kept apart because each shows something different.</p>
      <ul className="an-chips" aria-label="Ideas by level">
        {LEVEL_ORDER.filter((l) => counts[l] > 0).map((l) => (
          <li key={l}><Link className={`an-chip an-${LEVEL_TONE[l]}`} to={`/analytics/subjects?level=${l}`}>{counts[l]} {LEVEL_LABEL[l].toLowerCase()}</Link></li>
        ))}
      </ul>
      {top.length > 0 && (
        <>
          <h3 className="an-subhead">Worth another look</h3>
          <div className="an-subjects">{top.map((s) => <SubjectRow key={s.key ?? s.label} s={s} />)}</div>
        </>
      )}
      <p><Link className="row-link" to="/analytics/subjects">See all {plural(items.length, 'idea', 'ideas')}</Link></p>
    </section>
  );
}

// One reading at a time: what you have answered, what is waiting, and how its ideas stand.
function Documents({ items }) {
  const [all, setAll] = useState(false);
  if (!items || items.length === 0) return null;
  const visible = all ? items : items.slice(0, DOC_TOP);
  return (
    <section className="an-section" aria-labelledby="an-documents">
      <h2 id="an-documents">By document</h2>
      <ul className="an-subjects">
        {visible.map((d, i) => (
          <li key={i} className="an-subject">
            <div className="an-subject-head">
              {d.accessible ? <span><Link className="row-link" to={`/a/${d.assignment.assignmentId}`} reloadDocument>{d.assignment.name || d.assignment.className}</Link>{d.assignment.name && d.assignment.className && <span className="muted"> · {d.assignment.className}</span>}</span> : <span className="muted">A piece of material you no longer have access to</span>}
              {d.daysSinceActivity !== null && <span className="muted">{d.daysSinceActivity === 0 ? 'last worked on today' : `last worked on ${plural(d.daysSinceActivity, 'day', 'days')} ago`}</span>}
            </div>
            <p>
              {plural(d.passagesAnswered, 'passage', 'passages')} answered, {d.passagesCorrect} answered correctly with no misses
              {d.passagesWorthAnotherLook > 0 ? `, ${d.passagesWorthAnotherLook} worth another look` : ''}
              {d.reviewsWaiting > 0 ? `, ${plural(d.reviewsWaiting, 'review', 'reviews')} waiting` : ''}.
            </p>
            {d.accessible && d.concepts.length > 0 && (
              <ul className="an-chips" aria-label="Ideas in this document">
                {d.concepts.map((c) => <li key={c.label} className={`an-chip an-${LEVEL_TONE[c.level]}`}>{c.label}: {LEVEL_LABEL[c.level].toLowerCase()}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {items.length > DOC_TOP && (
        <p><button type="button" className="btn btn-secondary" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${items.length} documents`}</button></p>
      )}
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
          <Subjects items={data.subjects} />
          <Documents items={data.documents} />
          <NeedsWork items={data.needsWork} />
          <Progress p={data.progress} />
          <Revisited r={data.revisited} />
          <Concepts items={data.concepts} />
          <StrugglePattern s={data.strugglePattern} />
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
