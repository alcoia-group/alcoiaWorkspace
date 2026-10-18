import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api.js';
import { MAX_CHARS, MIN_CHARS, fetchExplainBackAvailability, loadLastFeedback, saveLastFeedback, submitExplainBack } from '../lib/explainBack.js';

const LABEL = { covered: 'You covered this', partly: 'Partly covered', missing: 'Not mentioned yet' };
const MARK = { covered: '✓', partly: '~', missing: '○' };

// The last step of an assigned reading: write the main ideas from memory, get feedback on which
// key ideas you covered. The text is checked and thrown away; the instructor only ever sees how
// many students covered each idea. It never blocks anything: if the check is unavailable, the
// reader just carries on.
export default function ExplainBack({ assignmentId, sessionToken }) {
  const [available, setAvailable] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(() => loadLastFeedback(assignmentId)?.ideas ?? null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchExplainBackAvailability(assignmentId, sessionToken).then((ok) => { if (!cancelled) setAvailable(ok); });
    return () => { cancelled = true; };
  }, [assignmentId, sessionToken]);

  if (!available || hidden) return null;

  async function check(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await submitExplainBack(assignmentId, text, sessionToken);
      setFeedback(res.ideas);
      saveLastFeedback(assignmentId, res.ideas);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'You have checked this several times in the last hour. Try again later.'
          : 'The check is not available right now. Your explanation is still here, and you can try again later.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="explain-back" aria-labelledby="eb-heading">
      <h2 id="eb-heading">Explain it back</h2>
      <p>
        Last step. Without looking, write the main ideas of what you just read, in your own words.
        What you write is checked and then discarded. Your instructor never sees it, only how many
        students covered each idea.
      </p>
      {!feedback && (
        <form onSubmit={check}>
          <label htmlFor="eb-text" className="visually-hidden">Your explanation</label>
          <textarea id="eb-text" rows={7} value={text} maxLength={MAX_CHARS} onChange={(e) => setText(e.target.value)} placeholder="The main ideas were..." />
          <div className="explain-back-actions">
            <button type="submit" disabled={busy || text.trim().length < MIN_CHARS}>{busy ? 'Checking' : 'Check my explanation'}</button>
            <button type="button" className="secondary" onClick={() => setHidden(true)}>Skip for now</button>
            <span className="muted small">{text.trim().length < MIN_CHARS ? `${MIN_CHARS - text.trim().length} more characters` : ''}</span>
          </div>
          {error && <p className="alert alert-error">{error}</p>}
        </form>
      )}
      {feedback && (
        <div>
          <ul className="explain-back-ideas">
            {feedback.map((idea, i) => (
              <li key={i} data-level={idea.level}>
                <span className="eb-mark" aria-hidden="true">{MARK[idea.level]}</span>
                <span><strong>{LABEL[idea.level]}.</strong> {idea.text}</span>
              </li>
            ))}
          </ul>
          <div className="explain-back-actions">
            <button type="button" className="secondary" onClick={() => { setFeedback(null); setText(''); }}>Try again</button>
            <button type="button" className="secondary" onClick={() => setHidden(true)}>Done</button>
          </div>
        </div>
      )}
    </section>
  );
}
