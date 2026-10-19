import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchLearnerAnalytics } from '../lib/analytics.js';
import { LEVEL_LABEL, LEVEL_ORDER, countByLevel, filterSubjects } from '../lib/subjects.js';
import SubjectRow from '../components/SubjectRow.jsx';

const PAGE = 20;

// Every idea the learner has met, however many: filter by level, search by name, rows collapsed until opened, and a
// "show more" step. The server computes everything; this page only narrows and words it.
export default function SubjectsPage() {
  const { session, signOut } = useSession();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const level = LEVEL_ORDER.includes(params.get('level')) ? params.get('level') : 'all';

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

  const items = state.result?.kind === 'ready' ? state.result.data.subjects ?? [] : [];
  const counts = useMemo(() => countByLevel(items), [items]);
  const filtered = useMemo(() => filterSubjects(items, { level, query }), [items, level, query]);

  const pick = (l) => {
    setShown(PAGE);
    setParams(l === 'all' ? {} : { level: l }, { replace: true });
  };

  return (
    <section className="page an-page">
      <p className="muted"><Link className="row-link" to="/analytics">Learner analytics</Link> / By subject</p>
      <h1 className="page-title">By subject</h1>
      {state.status === 'loading' && <p className="muted">Loading your subjects.</p>}
      {state.status === 'error' && <p className="alert alert-error">Your subjects could not be loaded. Try again in a moment.</p>}
      {state.result && state.result.kind !== 'ready' && <p className="notice">Your analytics are not available right now. <Link className="row-link" to="/analytics">Back to learner analytics</Link></p>}
      {state.result?.kind === 'ready' && items.length === 0 && <p className="muted">Ideas appear here as you answer questions about your reading.</p>}
      {items.length > 0 && (
        <>
          <div className="an-filters" role="group" aria-label="Filter by level">
            <button type="button" className={`an-filter${level === 'all' ? ' is-on' : ''}`} aria-pressed={level === 'all'} onClick={() => pick('all')}>All ({items.length})</button>
            {LEVEL_ORDER.filter((l) => counts[l] > 0).map((l) => (
              <button key={l} type="button" className={`an-filter${level === l ? ' is-on' : ''}`} aria-pressed={level === l} onClick={() => pick(l)}>{LEVEL_LABEL[l]} ({counts[l]})</button>
            ))}
          </div>
          <label className="an-search">
            <span className="muted">Search by name</span>
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="For example: osmosis" />
          </label>
          {filtered.length === 0 && <p className="muted">No ideas match.</p>}
          <div className="an-subjects">
            {filtered.slice(0, shown).map((s) => <SubjectRow key={s.key ?? s.label} s={s} />)}
          </div>
          {filtered.length > shown && (
            <p><button type="button" className="btn btn-secondary" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} more ({filtered.length - shown} left)</button></p>
          )}
        </>
      )}
    </section>
  );
}
