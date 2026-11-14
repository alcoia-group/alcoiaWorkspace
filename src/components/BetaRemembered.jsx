// BETA-FEEDBACK: this whole file goes when the beta ends.
// After a review: "Did you remember this without looking?" Asked once per visit, always skippable.
import { useState } from 'react';
import { sendBetaAnswer } from '../lib/beta.js';

export default function BetaRemembered({ sessionToken }) {
  const [sent, setSent] = useState(false);
  if (sent) return <p className="beta-q muted small">Thank you.</p>;
  const pick = (answer) => { sendBetaAnswer(sessionToken, { kind: 'remembered_without_looking', answer }); setSent(true); };
  return (
    <div className="beta-q" role="group" aria-label="Beta question">
      <span className="beta-tag">Beta question</span>
      <span>Did you remember this without looking?</span>
      <span className="beta-q-choices">
        <button type="button" className="button secondary" onClick={() => pick('yes')}>Yes</button>
        <button type="button" className="button secondary" onClick={() => pick('partly')}>Partly</button>
        <button type="button" className="button secondary" onClick={() => pick('no')}>No</button>
      </span>
    </div>
  );
}
