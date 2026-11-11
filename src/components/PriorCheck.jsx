import { useEffect, useState } from 'react';
import { answerPriorCheck, fetchPriorCheck, readLocal, rememberForSkip, STATUS_WORDS, writeLocal } from '../lib/priorCheck.js';

// "Check what you already know" (assigned readings). One or two questions per section, chosen by the server from the
// top of the section's reasoning down. Pick an option, then say how sure you are, or press "I don't know". A section
// you already know can be skipped, and the reading interrupts you less there; where nothing was known, help comes as
// an explanation first. The reader can stop at any time. Nothing is scored, ranked or sent to the instructor.
export default function PriorCheck({ assignmentId, sessionToken }) {
  const [check, setCheck] = useState(null); // null loading, false none, { strands, remembered }
  const [local, setLocal] = useState(() => readLocal(assignmentId));
  const [started, setStarted] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(null); // the result of the last answer: { item, result }

  useEffect(() => {
    let cancelled = false;
    fetchPriorCheck(assignmentId, sessionToken).then((c) => { if (!cancelled) setCheck(c?.strands?.length ? c : false); });
    return () => { cancelled = true; };
  }, [assignmentId, sessionToken]);

  if (check === null) return <p className="muted">Looking for questions to check what you know.</p>;
  if (check === false) return null;

  // The server's label wins; a reader with learner memory off keeps the labels on this device instead.
  const statusOf = (s) => (s.status !== 'unknown' ? s.status : local.statuses[s.index] ?? 'unknown');
  const strands = check.strands.map((s) => ({ ...s, status: statusOf(s), next: s.status !== 'unknown' ? s.next : (local.next?.[s.index] !== undefined ? local.next[s.index] : s.next) }));
  const current = strands.find((s) => s.next);
  const item = current ? current.items.find((it) => it.id === current.next) : null;
  const done = !current || stopped;

  async function send(answer) {
    if (!current || busy) return;
    setBusy(true);
    const prior = local.answers[current.index] ?? [];
    const answers = [...prior, answer];
    try {
      const r = await answerPriorCheck(assignmentId, sessionToken, current.index, answers);
      rememberForSkip(assignmentId, current, r.status, answer, r.result?.correct === true);
      const next = {
        statuses: { ...local.statuses, [current.index]: r.status },
        answers: { ...local.answers, [current.index]: answers },
        next: { ...local.next, [current.index]: r.next?.id ?? null },
      };
      setLocal(next);
      writeLocal(assignmentId, next);
      setCheck((c) => ({ ...c, strands: c.strands.map((s) => (s.index === current.index ? { ...s, status: r.status, next: r.next?.id ?? null, items: r.next && !s.items.some((it) => it.id === r.next.id) ? [...s.items, r.next] : s.items } : s)) }));
      setShown({ item, result: r.result, dontKnow: answer.dontKnow === true });
    } catch {
      setShown({ item, error: true });
    } finally {
      setPick(null);
      setBusy(false);
    }
  }

  if (!started) {
    const anyDone = strands.some((s) => s.status !== 'unknown');
    return (
      <div className="prior-check">
        <p>
          <strong>Check what you already know.</strong> One or two questions per section. Parts you already know can be
          skipped, and you will be interrupted less there. Nothing is scored or sent to your instructor.
        </p>
        {anyDone && <Summary strands={strands} />}
        {current && <button type="button" onClick={() => setStarted(true)}>{anyDone ? 'Continue the check' : 'Start the check'}</button>}
      </div>
    );
  }

  return (
    <div className="prior-check" aria-live="polite">
      {shown && !shown.error && (
        <p className="prep-explain" role="status">
          {shown.dontKnow ? 'Fine. ' : shown.result.correct ? 'That matches the reading. ' : 'Not quite. '}
          {!shown.result.correct && shown.result.explanation}
        </p>
      )}
      {shown?.error && <p className="muted" role="status">That could not be checked right now.</p>}
      {!done && item && (
        <fieldset className="prep-q" disabled={busy}>
          <legend>
            {current.label ? `${current.label}: ` : ''}{item.question}
          </legend>
          {item.choices.map((c) => (
            <label key={c.id} className="prep-choice">
              <input type="radio" name={`prior-${item.id}`} value={c.id} checked={pick === c.id} onChange={() => setPick(c.id)} /> {c.text}
            </label>
          ))}
          <div className="prep-sure" role="group" aria-label="How sure are you?">
            {pick ? (
              <>
                <span className="muted small">How sure are you?</span>
                <button type="button" className="secondary" onClick={() => send({ itemId: item.id, choiceId: pick, confidence: 'guess' })}>Guessing</button>
                <button type="button" className="secondary" onClick={() => send({ itemId: item.id, choiceId: pick, confidence: 'unsure' })}>Not sure</button>
                <button type="button" onClick={() => send({ itemId: item.id, choiceId: pick, confidence: 'sure' })}>Sure</button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => send({ itemId: item.id, dontKnow: true })}>I don&apos;t know</button>
            )}
          </div>
        </fieldset>
      )}
      {!done && <button type="button" className="link-button" onClick={() => setStopped(true)}>Stop the check</button>}
      {done && <Summary strands={strands} />}
    </div>
  );
}

function Summary({ strands }) {
  return (
    <ol className="prior-summary">
      {strands.map((s, i) => (
        <li key={s.index}>
          <span>{s.label || `Section ${i + 1}`}</span>{' '}
          <span className={`muted prior-${s.status}`}>{STATUS_WORDS[s.status] ?? STATUS_WORDS.unknown}</span>
        </li>
      ))}
    </ol>
  );
}
