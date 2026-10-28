import { useCallback, useEffect, useMemo, useRef } from 'react';

// Where the reader had got to in a material, kept in this browser only. It is deliberately NOT sent to the server:
// a record of how far each person has read would be a reading history, which alcoia does not keep. It lives under its
// own key (not the session's), so it survives a refresh, signing out and signing in again, and is separate per
// account so two people sharing a computer do not see each other's place.
const PREFIX = 'alcoia_ws_position:';

const keyFor = (account, id) => `${PREFIX}${(account || 'anon').toLowerCase()}:${id}`;

export function loadPosition(account, id) {
  try {
    const p = JSON.parse(localStorage.getItem(keyFor(account, id)) || 'null');
    if (!p || !Number.isInteger(p.index) || !Number.isInteger(p.total) || p.total < 1 || p.index < 0 || p.index >= p.total) return null;
    return { index: p.index, total: p.total };
  } catch {
    return null;
  }
}

export function savePosition(account, id, index, total) {
  try {
    localStorage.setItem(keyFor(account, id), JSON.stringify({ index, total, at: Date.now() }));
  } catch { /* storage blocked: the place is just not remembered */ }
}

// Share of the material still ahead, counting the part on screen: the first page is 100% left, the last is 1/total.
export const fractionLeft = (index, total) => (total > 0 ? (total - index) / total : null);

// For a viewer. `resume` is { initial, total, onPosition } from the reader page (or undefined for a viewer with no
// place to keep). report(index) is ignored until arm() is called, so the viewer's own first measurements (it always
// starts by seeing the top) cannot overwrite the saved place before it has been restored.
export function useResume(resume) {
  const armed = useRef(false);
  const timer = useRef(null);
  const onPosition = resume?.onPosition;
  useEffect(() => () => clearTimeout(timer.current), []);
  const report = useCallback((index) => { if (armed.current && onPosition) onPosition(index); }, [onPosition]);
  const arm = useCallback((delay = 600) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { armed.current = true; }, delay);
  }, []);
  const initial = resume?.initial ?? 0;
  return useMemo(() => ({ report, arm, initial }), [report, arm, initial]);
}
