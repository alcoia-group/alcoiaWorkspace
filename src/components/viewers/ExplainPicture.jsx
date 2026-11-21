import { useState } from 'react';
import { kindLabel, pictureErrorMessage, PICTURE_EXPLANATIONS_ON } from '../../lib/pictures.js';

// A button under a picture that asks the server to explain it, and the answer below it: a short explanation of what the
// picture is for in this text and how to read it, and under it what the picture shows (the description the explanation
// was written from). If the explaining step failed on the server there is only the description. Shown only on assigned
// readings. Nothing happens until the reader presses it. The panel is marked data-anno-skip and annotator-ui, so its
// text is never part of the document for highlights or for reading detection.
export default function ExplainPicture({ run, label = 'Explain this picture', className = '' }) {
  const [state, setState] = useState({ status: 'idle' });
  // Closed for the beta (see lib/pictures.js): no button, no panel, no request.
  if (!PICTURE_EXPLANATIONS_ON) return null;

  async function ask() {
    setState({ status: 'loading' });
    try {
      const answer = await run();
      if (!answer?.available) setState({ status: 'none' });
      else setState({ status: 'done', kind: answer.kind, description: answer.description, explanation: answer.explanation ?? null });
    } catch (err) {
      setState({ status: 'error', message: pictureErrorMessage(err) });
    }
  }

  return (
    <div className={`explain-picture annotator-ui ${className}`} data-anno-skip="">
      {state.status !== 'done' && (
        <button type="button" className="secondary explain-picture-button" onClick={ask} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Looking at the picture…' : label}
        </button>
      )}
      {state.status === 'done' && (
        <div className="explain-picture-answer" role="status">
          <div className="explain-picture-kind">{kindLabel(state.kind)}</div>
          {state.explanation ? (
            <>
              <div>{state.explanation}</div>
              <div className="explain-picture-shows"><strong>What the picture shows.</strong> {state.description}</div>
            </>
          ) : (
            <div>{state.description}</div>
          )}
          <div className="explain-picture-note">Written by AI from the picture and the text. It may be wrong: check it against the picture and the text.</div>
          <button type="button" className="link-button" onClick={() => setState({ status: 'idle' })}>Hide</button>
        </div>
      )}
      {state.status === 'none' && <div className="explain-picture-note" role="status">No description is available for this picture.</div>}
      {state.status === 'error' && <div className="explain-picture-note explain-picture-error" role="status">{state.message}</div>}
    </div>
  );
}
