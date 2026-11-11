import { useEffect, useRef, useState } from 'react';
import { checkBankAnswer, fetchQuestionBank } from '../lib/questionBank.js';
import { markSeen, readSeen, stretchFrom } from '../lib/proveSkip.js';

// "Prove it to skip", every format (see lib/proveSkip.js). Answer a few questions about the part you
// are on; if every one is right the viewer goes to the next part. Reader's own convenience: nothing
// is scored, recorded or sent to anyone. One try per part on this device. Questions already met in
// the "Before you read" warm-up are not asked twice, and a right answer there counts toward the part.
export function useBankItems(assignmentId, sessionToken, enabled, personal = false) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!enabled || !assignmentId) return undefined;
    let cancelled = false;
    fetchQuestionBank(assignmentId, sessionToken, { personal }).then((bank) => { if (!cancelled) setItems(bank?.items ?? []); });
    return () => { cancelled = true; };
  }, [assignmentId, sessionToken, enabled, personal]);
  return items;
}

export default function ProveSkip({ assignmentId, sessionToken, items, start, config, onSkip, personal = false }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(assignmentId));
  const [results, setResults] = useState({}); // itemId -> { choiceId, sure, correct, correctChoiceId, explanation } | { pending } | { error }
  const [picks, setPicks] = useState({}); // itemId -> choiceId chosen but not yet committed with a confidence
  const locked = useRef(null); // the offer this panel was opened for, so scrolling does not swap the questions

  useEffect(() => {
    const refresh = () => setSeen(readSeen(assignmentId));
    refresh();
    window.addEventListener('alcoia:seen', refresh);
    return () => window.removeEventListener('alcoia:seen', refresh);
  }, [assignmentId]);

  const offer = open && locked.current ? locked.current : (items ? stretchFrom(items, start, config, seen) : null);

  useEffect(() => {
    if (!open || !locked.current) return;
    const asked = locked.current.fresh;
    const rs = asked.map((it) => results[it.id]);
    if (rs.some((r) => !r || r.pending || r.error)) return;
    // A skip needs every answer right AND marked "Sure": a right guess is not knowledge (1 in 27 by luck otherwise).
    if (rs.every((r) => r.correct && r.sure)) {
      setOpen(false);
      onSkip(locked.current.target);
    } else {
      // A miss closes this part on this device: none of its questions are asked again.
      for (const it of locked.current.items) markSeen(assignmentId, it.id, 'x');
    }
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!offer) return null;

  // Picking an option only marks it; "Sure", "Not sure" or "Guessing" commits it.
  async function commit(item, confidence) {
    const choiceId = picks[item.id];
    if (!choiceId || results[item.id]) return;
    const sure = confidence === 'sure';
    setResults((prev) => ({ ...prev, [item.id]: { choiceId, sure, pending: true } }));
    try {
      const r = await checkBankAnswer(assignmentId, item.id, choiceId, sessionToken, personal);
      // Only a right AND sure answer counts toward a later skip; a right guess is remembered as not proved.
      markSeen(assignmentId, item.id, r.correct ? (sure ? 'c' : 'u') : 'w');
      setResults((prev) => ({ ...prev, [item.id]: { choiceId, sure, ...r } }));
    } catch {
      setResults((prev) => ({ ...prev, [item.id]: { choiceId, sure, error: true } }));
    }
  }

  // A section the prior-knowledge check showed the reader already knows: skip with no new questions.
  if (offer.held && !open) {
    return (
      <button type="button" className="secondary" title="You showed you already know this part in the check before reading." onClick={() => onSkip(offer.target)}>
        Skip to {offer.goesTo}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="secondary"
        disabled={offer.tried}
        title={offer.tried ? 'You tried this part already. Keep reading it.' : 'Answer a few questions about this part. If you get them all right, you go straight to the next part.'}
        onClick={() => { locked.current = offer; setResults({}); setPicks({}); setOpen(true); }}
      >
        {offer.tried ? 'Tried this part' : 'Prove it to skip'}
      </button>
    );
  }

  const asked = offer.fresh;
  const done = asked.every((it) => results[it.id] && !results[it.id].pending);
  const allRight = done && asked.every((it) => results[it.id].correct && results[it.id].sure);
  return (
    <div className="skip-panel" role="dialog" aria-label="Prove it to skip">
      <div className="prep-head">
        <strong>Prove you know {offer.range}</strong>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>Close</button>
      </div>
      <span className="muted small">
        Get every answer right, and be sure of it, and you go to {offer.goesTo}. One try. Nothing here is scored or sent to anyone.
        {offer.proved > 0 && ` ${offer.proved} ${offer.proved === 1 ? 'question' : 'questions'} from the warm-up already counted.`}
      </span>
      {asked.map((item, n) => {
        const r = results[item.id];
        return (
          <fieldset key={item.id} className="prep-q" disabled={Boolean(r)}>
            <legend>{n + 1}. {item.question}</legend>
            {item.choices.map((c) => {
              const picked = (r?.choiceId ?? picks[item.id]) === c.id;
              const right = r?.correctChoiceId === c.id;
              return (
                <label key={c.id} className={`prep-choice${right ? ' is-right' : ''}${picked && r && !right ? ' is-wrong' : ''}`}>
                  <input type="radio" name={`skip-${item.id}`} value={c.id} checked={picked} onChange={() => setPicks((p) => ({ ...p, [item.id]: c.id }))} /> {c.text}
                </label>
              );
            })}
            {!r && picks[item.id] && (
              <div className="prep-sure" role="group" aria-label="How sure are you?">
                <span className="muted small">How sure are you?</span>
                <button type="button" className="secondary" onClick={() => commit(item, 'guess')}>Guessing</button>
                <button type="button" className="secondary" onClick={() => commit(item, 'unsure')}>Not sure</button>
                <button type="button" onClick={() => commit(item, 'sure')}>Sure</button>
              </div>
            )}
            {r && !r.pending && !r.error && r.correct && !r.sure && <span className="prep-explain" role="status">Right, but a skip needs you to be sure.</span>}
            {r && !r.pending && !r.error && !r.correct && <span className="prep-explain" role="status">{r.explanation}</span>}
            {r?.error && <span className="muted" role="status">That could not be checked right now.</span>}
          </fieldset>
        );
      })}
      {done && !allRight && <span className="prep-explain" role="status">Not this time. Keep reading this part.</span>}
    </div>
  );
}
