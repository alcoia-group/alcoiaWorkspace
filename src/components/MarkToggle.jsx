// The optional/core control and badge. `marks` is { optional: Set, canEdit, toggle(unit) } or null
// (no marks: personal files, or the server has none to give). Students only ever see the badge.
export function OptionalBadge({ marks, unit }) {
  if (!marks || !marks.optional.has(unit)) return null;
  return <span className="optional-badge">Optional</span>;
}

export default function MarkToggle({ marks, unit, className = 'secondary' }) {
  if (!marks?.canEdit) return null;
  const optional = marks.optional.has(unit);
  return (
    <button type="button" className={className} onClick={() => marks.toggle(unit)} aria-pressed={optional}>
      {optional ? 'Optional: make core' : 'Mark optional'}
    </button>
  );
}
