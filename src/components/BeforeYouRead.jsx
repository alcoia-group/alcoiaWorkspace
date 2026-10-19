import { useEffect, useState } from 'react';
import { checkBankAnswer, fetchQuestionBank, outlineOf, pickWarmup } from '../lib/questionBank.js';
import { markSeen, readSeen } from '../lib/proveSkip.js';

// Shown above an assigned reading: a map of the reading (from the file's own headings or slide
// titles) and, when the reading has questions, two or three to try BEFORE reading. Nothing here is
// scored, ranked or sent to the instructor: it is the reader's own warm-up (trying first helps what
// follows stick, even when the answer is a guess). Skippable, and remembered per reading.
// What was answered is kept on this device so "Prove it to skip" does not ask the same question again
// and counts a right answer here toward the part it belongs to (lib/proveSkip.js).
const KEY = (id) => `alcoia_workspace_prep_${id}`;
const remember = (id, v) => { try { localStorage.setItem(KEY(id), v); } catch { /* storage unavailable */ } };
const recall = (id) => { try { return localStorage.getItem(KEY(id)); } catch { return null; } };

export default function BeforeYouRead({ assignmentId, content, sessionToken, personal = false }) {
  const [open, setOpen] = useState(() => recall(assignmentId) !== 'skipped');
  const [items, setItems] = useState(null); // null = loading, [] = none
  const [results, setResults] = useState({}); // itemId -> { choiceId, correct, correctChoiceId, explanation }
  const outline = outlineOf(content);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    fetchQuestionBank(assignmentId, sessionToken, { personal }).then((bank) => {
      if (!cancelled) setItems(bank ? pickWarmup(bank.items) : []);
    });
    return () => { cancelled = true; };
  }, [assignmentId, sessionToken, open, personal]);

  async function choose(item, choiceId) {
    if (results[item.id]) return;
    setResults((prev) => ({ ...prev, [item.id]: { choiceId, pending: true } }));
    try {
      const r = await checkBankAnswer(assignmentId, item.id, choiceId, sessionToken, personal);
      // Only the first answer to a question counts, however many times the page is reloaded.
      if (!readSeen(assignmentId)[item.id]) markSeen(assignmentId, item.id, r.correct ? 'c' : 'w');
      setResults((prev) => ({ ...prev, [item.id]: { choiceId, ...r } }));
    } catch {
      setResults((prev) => ({ ...prev, [item.id]: { choiceId, error: true } }));
    }
  }

  if (!open) {
    return (
      <div className="prep prep-closed">
        <button type="button" className="link-button" onClick={() => { remember(assignmentId, 'open'); setOpen(true); }}>Show the map and warm-up</button>
      </div>
    );
  }
  if (outline.length === 0 && Array.isArray(items) && items.length === 0) return null;

  return (
    <section className="prep" aria-label="Before you read">
      <div className="prep-head">
        <h2>Before you read</h2>
        <button type="button" className="link-button" onClick={() => { remember(assignmentId, 'skipped'); setOpen(false); }}>Skip</button>
      </div>
      {outline.length > 0 && (
        <details open>
          <summary>What is in this reading</summary>
          <ol className="prep-outline">
            {outline.map((o, i) => (
              <li key={i} style={{ marginLeft: (o.level - 1) * 16 }}>{o.text} <span className="muted">{o.where}</span></li>
            ))}
          </ol>
        </details>
      )}
      {items === null && <p className="muted">Looking for warm-up questions.</p>}
      {Array.isArray(items) && items.length > 0 && (
        <div className="prep-questions">
          <p className="muted">Try these first. A guess is fine. Nothing here is scored or sent to anyone.</p>
          {items.map((item, n) => {
            const r = results[item.id];
            return (
              <fieldset key={item.id} className="prep-q" disabled={Boolean(r)}>
                <legend>{n + 1}. {item.question}</legend>
                {item.choices.map((c) => {
                  const picked = r?.choiceId === c.id;
                  const right = r && r.correctChoiceId === c.id;
                  return (
                    <label key={c.id} className={`prep-choice${right ? ' is-right' : ''}${picked && !right ? ' is-wrong' : ''}`}>
                      <input type="radio" name={item.id} value={c.id} checked={picked} onChange={() => choose(item, c.id)} /> {c.text}
                    </label>
                  );
                })}
                {r && !r.error && !r.pending && (
                  <p className="prep-explain" role="status">
                    {r.correct ? 'That matches the reading.' : 'Not quite. Keep it in mind as you read.'} {!r.correct && r.explanation}
                  </p>
                )}
                {r?.error && <p className="muted" role="status">That could not be checked right now.</p>}
              </fieldset>
            );
          })}
        </div>
      )}
    </section>
  );
}
