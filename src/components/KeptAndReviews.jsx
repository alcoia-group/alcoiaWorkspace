import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';

// "Due for review" and "Kept". Both are read from the account (private learner memory). Each part stays out of the way
// when there is nothing to show, and both stay hidden when account-based learning is off (the server answers 403).

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function KeptAndReviews({ sessionToken }) {
  const [kept, setKept] = useState([]);
  const [due, setDue] = useState([]);
  const [open, setOpen] = useState(null); // the review being answered
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const opts = { sessionToken };
    apiGet('/api/account/kept', opts).then((r) => !cancelled && setKept(r.items ?? [])).catch(() => {});
    apiGet('/api/account/reviews/due', opts).then((r) => !cancelled && setDue(r.reviews ?? [])).catch(() => {});
    return () => { cancelled = true; };
  }, [sessionToken]);

  async function answer(review, choiceId) {
    setBusy(true);
    try {
      const body = choiceId === null ? { reviewId: review.reviewId, dontKnow: true } : { reviewId: review.reviewId, choiceId };
      const r = await apiPost('/api/account/reviews/answer', body, { sessionToken });
      setResult({ review, ...r });
    } catch {
      setResult({ review, error: true });
    } finally { setBusy(false); }
  }

  function next() {
    setDue((d) => d.filter((x) => x.reviewId !== result.review.reviewId));
    setOpen(null); setResult(null);
  }

  if (!kept.length && !due.length) return null;
  return (
    <>
      {due.length > 0 && (
        <section className="ov-card ov-span" aria-labelledby="ov-review">
          <div className="ov-card-head"><h2 id="ov-review">Ready to check again</h2></div>
          {!open && (
            <>
              <p className="muted small">{due.length === 1 ? 'One idea is' : `${due.length} ideas are`} due for a quick check. Each takes under a minute.</p>
              <button type="button" className="button secondary" onClick={() => setOpen(due[0])}>Start</button>
            </>
          )}
          {open && !result && (
            <div>
              {open.reading && <p className="muted small">{open.reading}</p>}
              <p><strong>{open.question}</strong></p>
              <ul className="ov-list">
                {open.choices.map((c) => (
                  <li key={c.id}><button type="button" className="button secondary" disabled={busy} onClick={() => answer(open, c.id)}>{c.text}</button></li>
                ))}
                <li><button type="button" className="button link" disabled={busy} onClick={() => answer(open, null)}>I don&rsquo;t know</button></li>
              </ul>
            </div>
          )}
          {open && result && (
            <div>
              {result.error ? <p className="alert alert-error">That did not save. Try again in a moment.</p> : (
                <>
                  <p><strong>{result.correct ? 'Right.' : 'Not this time.'}</strong> {result.explanation}</p>
                  {result.thenAndNow?.missedAt && <p className="muted">On {day(result.thenAndNow.missedAt)} this did not hold. Today you recalled it without help.</p>}
                </>
              )}
              <button type="button" className="button secondary" onClick={next}>{due.length > 1 ? 'Next' : 'Done'}</button>
            </div>
          )}
        </section>
      )}
      {kept.length > 0 && (
        <section className="ov-card ov-span" aria-labelledby="ov-kept">
          <div className="ov-card-head"><h2 id="ov-kept">Kept</h2></div>
          <p className="muted small">Ideas you missed or needed help with, then recalled on your own later.</p>
          <ul className="ov-list">
            {kept.slice(0, 8).map((k) => (
              <li key={`${k.assignmentId}-${k.recalledOn}-${k.missedOn}`}>
                <span>{k.reading || 'A reading'}</span>
                <span className="muted small">missed {day(k.missedOn)}, recalled {day(k.recalledOn)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
