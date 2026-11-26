import { useState } from 'react';
import { loadAnswers, saveAnswers } from '../lib/docQuestions.js';

// The reading's own questions, offered where they are in the document (under their heading), never as a banner.
// One line first; then one card at a time. Answers stay on this device: nothing is graded and nothing is sent,
// because the document has no answer key. The component is `data-anno-skip` so highlights and detection ignore it.
export default function FoundQuestions({ assignmentId, group }) {
  const questions = group.questions;
  const gid = questions[0].id;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState(() => loadAnswers(assignmentId, gid));
  const set = (qid, value) => {
    const next = { ...answers, [qid]: value };
    setAnswers(next);
    saveAnswers(assignmentId, gid, next);
  };
  const answered = questions.filter((q) => answers[q.id]).length;

  if (!open) {
    return (
      <div className="found-questions found-offer" data-anno-skip="true">
        <span>
          {questions.length === 1 ? 'This question' : `These ${questions.length} questions`} {questions.length === 1 ? 'is' : 'are'} from the reading.
          {answered > 0 ? ` You answered ${answered}.` : ''}
        </span>{' '}
        <button type="button" className="secondary" onClick={() => { setI(0); setOpen(true); }}>{answered > 0 ? 'Review your answers' : 'Answer here'}</button>
      </div>
    );
  }
  const done = i >= questions.length;
  const q = questions[i];
  return (
    <section className="found-questions card" aria-label="Questions from the reading" data-anno-skip="true">
      {done ? (
        <>
          <h3>Your answers</h3>
          <p className="muted">These stay on this device. Nothing here is graded or sent.</p>
          <ol>
            {questions.map((x) => (
              <li key={x.id}><strong>{x.text}</strong><br />{answers[x.id] || <span className="muted">Skipped</span>}</li>
            ))}
          </ol>
          <button type="button" className="secondary" onClick={() => setOpen(false)}>Close</button>
        </>
      ) : (
        <>
          <p className="muted">Question {i + 1} of {questions.length}</p>
          <p><strong>{q.text}</strong></p>
          {q.choices?.length ? (
            q.choices.map((c) => {
              const val = `${c.id}) ${c.text}`;
              return (
                <label key={c.id} className="choice">
                  <input type="radio" name={q.id} checked={answers[q.id] === val} onChange={() => set(q.id, val)} />
                  {val}
                </label>
              );
            })
          ) : (
            <textarea rows={3} value={answers[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)} aria-label="Your answer" />
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
