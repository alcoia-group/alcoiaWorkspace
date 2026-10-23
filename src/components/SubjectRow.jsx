import { LEVEL_LABEL, LEVEL_TONE, NEXT_STEP, DIM_LABEL, DIM_STATE, joinWords } from '../lib/subjects.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One idea across every reading. Collapsed it is a single line (name, level, one short hint); opened it shows each kind of
// evidence apart. No score and no comparison: "no answers yet" is never read as a weakness.
export default function SubjectRow({ s, defaultOpen = false }) {
  const hint = s.needsWorkAt?.length ? `Needs work: ${joinWords(s.needsWorkAt)}` : s.strongAt?.length ? `Going well: ${joinWords(s.strongAt)}` : '';
  return (
    <details className="an-subject an-collapsible" open={defaultOpen}>
      <summary className="an-subject-head">
        <strong>{s.label}</strong>
        <span className={`an-pill an-${LEVEL_TONE[s.level]}`}>{LEVEL_LABEL[s.level]}</span>
        {hint && <span className="muted an-hint">{hint}</span>}
      </summary>
      <dl className="an-dims">
        {Object.keys(DIM_LABEL).map((k) => (
          <div key={k}>
            <dt>{DIM_LABEL[k]}</dt>
            <dd>{DIM_STATE[s.dimensions[k].state]}{s.dimensions[k].answers > 0 ? ` (${plural(s.dimensions[k].answers, 'answer', 'answers')})` : ''}</dd>
          </div>
        ))}
        <div><dt>Met in your reading</dt><dd>{s.dimensions.encounters === 0 ? 'not recorded yet' : plural(s.dimensions.encounters, 'time', 'times')}</dd></div>
      </dl>
      {(s.strongAt?.length > 0 || s.needsWorkAt?.length > 0) && (
        <p>
          {s.strongAt.length > 0 && <>Going well: {joinWords(s.strongAt)}. </>}
          {s.needsWorkAt.length > 0 && <>Not yet there: {joinWords(s.needsWorkAt)}.</>}
        </p>
      )}
      <p className="muted">{NEXT_STEP[s.nextStep]}{s.uncertainty === 'high' && s.level !== 'unknown' ? ' This rests on very few answers.' : ''}</p>
    </details>
  );
}
