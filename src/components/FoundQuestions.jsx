import { useEffect, useState } from 'react';
import { fetchDocQuestions } from '../lib/docQuestions.js';

// Questions the reading itself carries (review questions, exercises). Offered, never forced: a banner, then one card
// at a time. Answers stay in this page: nothing is graded and nothing is sent, because there is no answer key.
export default function FoundQuestions({ assignmentId, sessionToken }) {
  const [questions, setQuestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetchDocQuestions(assignmentId, sessionToken).then((q) => { if (!cancelled) setQuestions(q); });
    return () => { cancelled = true; };
  }, [assignmentId, sessionToken]);

  if (questions.length === 0) return null;
  if (!open) {
    return (
      <div className="alert found-questions">
        This reading has {questions.length} question{questions.length === 1 ? '' : 's'} of its own.{' '}
        <button type="button" className="secondary" onClick={() => setOpen(true)}>Answer them here</button>
      </div>
    );
  }
  const done = i >= questions.length;
  const q = questions[i];
  return (
    <section className="found-questions card" aria-label="Questions from the reading">
      {done ? (
        <>
          <h2>Your answers</h2>
          <p className="muted">These stay on this page. Nothing here is graded or sent.</p>
          <ol>
            {questions.map((x) => (
              <li key={x.id}><strong>{x.text}</strong><br />{answers[x.id] || <span className="muted">Skipped</span>}</li>
            ))}
          </ol>
          <button type="button" className="secondary" onClick={() => { setOpen(false); setI(0); }}>Close</button>
        </>
      ) : (
        <>
          <p className="muted">Question {i + 1} of {questions.length}{q.heading ? ` · ${q.heading}` : ''}</p>
          <p><strong>{q.text}</strong></p>
          {q.choices?.length ? (
            q.choices.map((c) => (
              <label key={c.id} className="choice">
                <input type="radio" name={q.id} checked={answers[q.id] === `${c.id}) ${c.text}`} onChange={() => setAnswers({ ...answers, [q.id]: `${c.id}) ${c.text}` })} />
                {c.id}) {c.text}
              </label>
            ))
          ) : (
            <textarea rows={3} value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} aria-label="Your answer" />
          )}
          <p>
            <button type="button" className="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>{' '}
            <button type="button" onClick={() => setI(i + 1)}>{i === questions.length - 1 ? 'Finish' : 'Next'}</button>{' '}
            <button type="button" className="secondary" onClick={() => setOpen(false)}>Not now</button>
          </p>
        </>
      )}
    </section>
  );
}
