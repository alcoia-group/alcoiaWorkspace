import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { fetchMyAssignments } from '../lib/assignments.js';
import { startExam, answerExam, nextExam, finishExam, examErrorKind } from '../lib/exam.js';
import { listPersonalDocuments } from '../lib/personalDocuments.js';
import { MARKETING_URL, CONSOLE_URL } from '../lib/analytics.js';

// Exam Mode: a private practice session on one or several readings (up to six). One question at a time, free-text answer,
// feedback, then the next. You can stop at any time, with no penalty. No score, no ranking, no
// prediction of any result. The server decides access, questions, correctness and what is
// remembered; this page only shows them.

const TYPE_LABEL = {
  explain: 'Explain', apply: 'Apply', predict: 'Predict', diagnose: 'Diagnose', scenario: 'Scenario',
  compare: 'Compare', distinguish: 'Distinguish', identify_error: 'Find the error', defend: 'Defend',
};
const VERDICT = { correct: 'Correct', partial: 'Partly there', incorrect: 'Not quite', skipped: 'Skipped' };

const ERROR_COPY = {
  network: 'The request could not be completed. Check your connection and try again.',
  unavailable: 'Questions could not be prepared right now. Nothing was lost; try again in a moment.',
  no_material: 'The selected readings have no text that Exam Mode can ask about yet (for example a scanned PDF).',
  bad_selection: 'Choose between one and six different readings.',
  no_access: 'That reading is not available to you.',
  session_gone: 'This session has ended or expired. Start a new one.',
  conflict: 'That action is not available right now.',
  error: 'Something went wrong. Try again.',
};

function Upgrade() {
  return (
    <div className="notice">
      <h2>Exam Mode is part of the Reader and Student plans</h2>
      <p>Practise a reading with questions that adapt as you answer, and see what to review. Nothing is shared with anyone.</p>
      <p><a className="button" href={`${MARKETING_URL}/pricing`}>See plans</a></p>
    </div>
  );
}

function Summary({ s, onAgain }) {
  return (
    <section className="exam-summary" aria-labelledby="exam-sum">
      <h2 id="exam-sum">Session summary</h2>
      <ul className="an-list">
        <li><span>Questions answered</span><span className="an-count">{s.questionsAnswered}</span></li>
        <li><span>Correct / partly / not quite</span><span className="an-count">{s.correct} / {s.partial} / {s.incorrect}</span></li>
        {s.skipped > 0 && <li><span>Skipped</span><span className="an-count">{s.skipped}</span></li>}
        <li><span>Highest level shown</span><span className="an-count">{s.highestLevelDemonstrated ? s.highestLevelDemonstrated.label : 'None yet'}</span></li>
      </ul>
      {s.strengths.length > 0 && <p><strong>Went well:</strong> {s.strengths.map((x) => `${x.source ? `${x.source}, ` : ''}paragraph ${x.paragraph}`).join('; ')}.</p>}
      {s.bySource?.length > 1 && <ul className="an-list">{s.bySource.map((b) => <li key={b.source}><span>{b.source}</span><span className="an-count">{b.asked} asked, {b.correct} correct</span></li>)}</ul>}
      {s.needsReview.length > 0 && (
        <>
          <h3>Worth another look</h3>
          <ul className="exam-review">
            {s.needsReview.map((n, i) => <li key={i}><span className="muted">{n.source ? `${n.source}, ` : ''}Paragraph {n.paragraph} · {VERDICT[n.verdict]}</span><div>{n.question}</div></li>)}
          </ul>
        </>
      )}
      {s.followUps.length > 0 && <ul>{s.followUps.map((f) => <li key={f}>{f}</li>)}</ul>}
      <p><strong>Next:</strong> {s.nextAction}</p>
      <p className="muted">This describes this session only. It is not a grade, and it does not predict any result.</p>
      <button type="button" className="button" onClick={onAgain}>Choose a reading</button>
    </section>
  );
}

export default function ExamPage() {
  const { session, signOut } = useSession();
  const token = session.sessionToken;
  const [assignments, setAssignments] = useState(null);
  const [phase, setPhase] = useState('choose'); // choose | question | feedback | summary
  const [exam, setExam] = useState(null);
  const [result, setResult] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [upgrade, setUpgrade] = useState(false);
  const [picked, setPicked] = useState([]); // assignment ids
  const [files, setFiles] = useState([]);
  const [pickedFiles, setPickedFiles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lastQ, setLastQ] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyAssignments(token)
      .then((a) => !cancelled && setAssignments(a))
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) signOut();
        else setAssignments('error');
      });
    return () => { cancelled = true; };
  }, [token, signOut]);

  useEffect(() => {
    let cancelled = false;
    listPersonalDocuments(token).then((b) => !cancelled && setFiles(b.documents.filter((d) => d.status === 'accepted')), () => {});
    return () => { cancelled = true; };
  }, [token]);

  const run = async (fn) => {
    setBusy(true);
    setProblem(null);
    try {
      return await fn();
    } catch (err) {
      const kind = examErrorKind(err);
      if (kind === 'signed_out') signOut();
      else if (kind === 'upgrade') setUpgrade(true);
      else setProblem(kind);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const total_picked = picked.length + pickedFiles.length;
  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : total_picked < 6 ? [...p, id] : p));
  const togglePickFile = (id) => setPickedFiles((p) => (p.includes(id) ? p.filter((x) => x !== id) : total_picked < 6 ? [...p, id] : p));
  const begin = async () => {
    const s = await run(() => startExam(picked, token, undefined, pickedFiles));
    if (!s) return;
    setExam(s);
    setText('');
    setResult(null);
    setSummary(null);
    setPhase('question');
  };
  const submit = async (skip = false) => {
    const r = await run(() => answerExam(exam.sessionId, token, skip ? { skip: true } : { answer: text }));
    if (!r) return;
    setLastQ(exam.question);
    setExam((prev) => ({ ...prev, ...r }));
    setResult(r);
    setPhase('feedback');
  };
  const advance = async () => {
    const r = await run(() => nextExam(exam.sessionId, token));
    if (!r) return;
    setExam(r);
    setText('');
    setResult(null);
    setPhase('question');
  };
  const stop = async () => {
    const r = await run(() => finishExam(exam.sessionId, token));
    if (!r) return;
    setSummary(r.summary);
    setPhase('summary');
  };
  const reset = () => { setPicked([]); setPickedFiles([]); setExam(null); setSummary(null); setResult(null); setPhase('choose'); };

  const q = phase === 'feedback' ? lastQ : exam?.question;
  const total = exam?.progress?.target;

  return (
    <section className="page exam-page">
      <h1 className="page-title">Exam Mode</h1>
      <p className="muted">Private practice on one or more of your readings. Questions come only from the readings you choose. You can stop whenever you like.</p>
      {upgrade && <Upgrade />}
      {problem && <p className="alert alert-error" role="alert">{ERROR_COPY[problem]}</p>}

      {!upgrade && phase === 'choose' && (
        <>
          {assignments === null && <p className="muted">Loading your readings.</p>}
          {assignments === 'error' && <p className="alert alert-error">Your readings could not be loaded.</p>}
          {Array.isArray(assignments) && assignments.length === 0 && files.length === 0 && (
            <div className="notice"><h2>No readings to practise yet</h2><p>When a reading is assigned to you it appears here. <Link to="/assignments">Back to assignments</Link></p></div>
          )}
          {Array.isArray(assignments) && (assignments.length > 0 || files.length > 0) && (
            <>
              <p className="muted">Choose one or more readings (up to six). Questions are spread across the ones you pick.</p>
              <ul className="exam-list">
                {assignments.map((a) => (
                  <li key={a.assignmentId}>
                    <label className="exam-pick">
                      <input type="checkbox" checked={picked.includes(a.assignmentId)} onChange={() => togglePick(a.assignmentId)} disabled={busy} />
                      <span><strong>{a.name || a.className}</strong>{a.name && a.className && <span className="muted"> · {a.className}</span>}</span>
                    </label>
                  </li>
                ))}
                {files.map((f) => (
                  <li key={f.id}>
                    <label className="exam-pick">
                      <input type="checkbox" checked={pickedFiles.includes(f.id)} onChange={() => togglePickFile(f.id)} disabled={busy} />
                      <span><strong>{f.name}</strong><span className="muted"> · my file</span></span>
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" className="button" disabled={busy || total_picked === 0} onClick={begin}>
                {busy ? 'Preparing…' : `Start exam${total_picked > 1 ? ` with ${total_picked} readings` : ''}`}
              </button>
            </>
          )}
        </>
      )}

      {!upgrade && (phase === 'question' || phase === 'feedback') && q && (
        <div className="exam-card">
          <div className="exam-meta">
            <span>Question {q.number} of up to {total}</span>
            <span>{TYPE_LABEL[q.type] ?? q.type} · {q.levelLabel} · from {exam.sources?.length > 1 ? `${q.source.label}, ` : ''}paragraph {q.paragraph}</span>
            {exam.personalized
              ? <span className="muted">Using your private learning memory to choose questions.</span>
              : <span className="muted">Learning memory is off, so questions are chosen from the reading alone. <a href={`${CONSOLE_URL}/settings#learning-memory`}>Settings</a></span>}
          </div>
          <p className="exam-question">{q.text}</p>
        </div>
      )}
      
      {!upgrade && phase === 'question' && (
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) submit(); }}>
          <label htmlFor="exam-answer">Your answer</label>
          <textarea id="exam-answer" rows={6} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
          <div className="exam-actions">
            <button type="submit" className="button" disabled={busy || !text.trim()}>{busy ? 'Checking…' : 'Submit answer'}</button>
            <button type="button" className="link-button" disabled={busy} onClick={() => submit(true)}>Skip</button>
            <button type="button" className="link-button" disabled={busy} onClick={stop}>End session</button>
          </div>
          {problem === 'unavailable' && <p className="muted">Your answer is kept above. Press Submit answer to try again.</p>}
        </form>
      )}

      {!upgrade && phase === 'feedback' && result && (
        <div className="exam-feedback" role="status">
          <h2>{VERDICT[result.result.verdict]}</h2>
          {result.result.feedback && <p>{result.result.feedback}</p>}
          {result.result.modelAnswer && <p className="muted"><strong>A good answer:</strong> {result.result.modelAnswer}</p>}
          <div className="exam-actions">
            {result.canContinue && <button type="button" className="button" disabled={busy} onClick={advance}>{busy ? 'Preparing…' : 'Next question'}</button>}
            <button type="button" className={result.canContinue ? 'link-button' : 'button'} disabled={busy} onClick={stop}>{result.canContinue ? 'End session' : 'See summary'}</button>
          </div>
        </div>
      )}

      {!upgrade && phase === 'summary' && summary && <Summary s={summary} onAgain={reset} />}
    </section>
  );
}
