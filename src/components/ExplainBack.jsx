import { useEffect, useRef, useState } from 'react';
import { ApiError, apiGet } from '../lib/api.js';
import { MIN_READ_MS, REVEAL_SCREENS, instructorLine, pickVariant, wording } from '../lib/explainBackWording.js';
import { MAX_CHARS, MIN_CHARS, fetchExplainBackAvailability, saveLastFeedback, submitExplainBack, wasUsedHere } from '../lib/explainBack.js';

const LABEL = { covered: 'You covered this', partly: 'Partly covered', missing: 'Not mentioned yet' };
const MARK = { covered: '✓', partly: '~', missing: '○' };

// The last step of an assigned reading: write the main ideas from memory, get feedback on which
// key ideas you covered. The instructor only ever sees how many students covered each idea. It never
// blocks anything: if the check is unavailable, the reader just carries on.
//
// It is not on the page from the start. It appears once enough time has passed AND the reader is near
// the end: for Word and PDF, when the end of the document is within a screen or so of the window;
// for slides, on the last two slides (`slideAtEnd`). It is used once: after the reader hands in an
// explanation, right or wrong, they see the feedback, and when they close it it is gone for good (the
// server reports `used` on any device, and this device remembers too). What it asks depends on the evidence the server has for this
// reader (see lib/explainBackWording.js): a plain "what have you understood" when it looks like they
// understood a lot, the main ideas otherwise.
export default function ExplainBack({ assignmentId, sessionToken, personal = false, format = 'docx', slideAtEnd = false }) {
  const [available, setAvailable] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  // Handed in before, on this device or any other: it never shows again.
  const [used, setUsed] = useState(() => wasUsedHere(assignmentId));
  const [hidden, setHidden] = useState(false);
  const [timeOk, setTimeOk] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);
  const [variant, setVariant] = useState('guided');
  const sentinel = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setTimeOk(true), MIN_READ_MS);
    return () => clearTimeout(t);
  }, [assignmentId]);

  useEffect(() => {
    if (format === 'pptx' || nearEnd) return undefined;
    const check = () => {
      const el = sentinel.current;
      if (el && el.getBoundingClientRect().top - window.innerHeight < window.innerHeight * REVEAL_SCREENS) setNearEnd(true);
    };
    // Also runs when the sentinel first exists and when the time is up: a short reading that fits in the
    // window never scrolls or resizes, so waiting for those events would never show the panel.
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [format, nearEnd, available, timeOk]);

  useEffect(() => {
    let cancelled = false;
    fetchExplainBackAvailability(assignmentId, sessionToken, personal).then((r) => {
      if (cancelled) return;
      setAvailable(r.available);
      if (r.used) setUsed(true);
    });
    return () => { cancelled = true; };
  }, [assignmentId, sessionToken, personal]);

  // Once feedback is on screen it stays until the reader closes it, even though `used` is now true.
  const returning = Boolean(feedback);
  const show = available && !hidden && (returning || (!used && timeOk && (format === 'pptx' ? slideAtEnd : nearEnd)));

  // The estimates only decide how hard the question is. Learning memory off, or any failure, means the easier wording.
  useEffect(() => {
    if (!show || personal || returning) return undefined;
    let cancelled = false;
    apiGet(`/api/assignments/${assignmentId}/knowledge-state/estimates`, { sessionToken })
      .then((body) => { if (!cancelled) setVariant(pickVariant(body?.estimates)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [show, personal, returning, assignmentId, sessionToken]);

  if (!available || hidden || (used && !returning)) return null;
  if (!show) return <div ref={sentinel} aria-hidden="true" />;

  async function check(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await submitExplainBack(assignmentId, text, sessionToken, personal);
      setFeedback(res.ideas);
      setUsed(true);
      saveLastFeedback(assignmentId, res.ideas);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setUsed(true); // handed in before, somewhere else: it is gone
      setError(
        err instanceof ApiError && err.status === 409
          ? 'You have already handed in your explanation for this reading.'
          : err instanceof ApiError && err.status === 429
            ? 'You have checked this several times in the last hour. Try again later.'
            : 'The check is not available right now. Your explanation is still here.',
      );
    } finally {
      setBusy(false);
    }
  }

  const w = wording(variant, format);
  const who = instructorLine(personal);
  return (
    <section className="explain-back explain-back-appear" aria-labelledby="eb-heading">
      <h2 id="eb-heading">Explain it back</h2>
      <p>{w.prompt}</p>
      {w.hint && <p className="muted small">{w.hint}</p>}
      {who && <p className="muted small">{who}</p>}
      {!feedback && (
        <form onSubmit={check}>
          <label htmlFor="eb-text" className="visually-hidden">Your explanation</label>
          <textarea id="eb-text" rows={7} value={text} maxLength={MAX_CHARS} onChange={(e) => setText(e.target.value)} placeholder={w.placeholder} />
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
            <button type="button" onClick={() => setHidden(true)}>Done</button>
          </div>
        </div>
      )}
    </section>
  );
}
