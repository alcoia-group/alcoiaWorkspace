// Slide transitions. Nothing here chooses a transition: the file names one
// (`type`, with its own `options`), and this table says how to draw each name
// it knows. A name that is not in the table is never replaced by a look-alike:
// the file's own fallback is used if it has one the table knows, otherwise the
// slide simply changes ("cut") and the viewer says so.
//
// A plan describes the FORWARD move: what the entering slide does, what the
// leaving slide does, and which one is on top. Going backwards plays the same
// plan in reverse, with the roles swapped.

const vec = (dir = '') => ({
  dx: dir.includes('l') ? -1 : dir.includes('r') ? 1 : 0,
  dy: dir.includes('u') ? -1 : dir.includes('d') ? 1 : 0,
});
const tx = (x, y) => `translate(${x}%, ${y}%)`;
const none = 'translate(0%, 0%)';

// The file's direction is the way the content moves.
const from = (dir) => { const { dx, dy } = vec(dir || 'l'); return tx(-dx * 100, -dy * 100); };
const away = (dir) => { const { dx, dy } = vec(dir || 'l'); return tx(dx * 100, dy * 100); };

function wipeClip(dir) {
  const { dx, dy } = vec(dir || 'l');
  // A region that grows from the edge the content comes from.
  const top = dy > 0 ? 0 : dy < 0 ? 100 : 0;
  const bottom = dy < 0 ? 0 : dy > 0 ? 100 : 0;
  const left = dx < 0 ? 100 : 0;
  const right = dx > 0 ? 100 : 0;
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

const FULL = 'inset(0% 0% 0% 0%)';

const TABLE = {
  cut: () => null,
  fade: (o) => (o.thruBlk === '1' || o.thruBlk === 'true'
    ? {
        leaving: [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }],
        entering: [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }],
        enteringOnTop: true,
        ground: '#000',
      }
    : { entering: [{ opacity: 0 }, { opacity: 1 }], enteringOnTop: true }),
  push: (o) => ({
    entering: [{ transform: from(o.dir) }, { transform: none }],
    leaving: [{ transform: none }, { transform: away(o.dir) }],
    enteringOnTop: true,
  }),
  cover: (o) => ({ entering: [{ transform: from(o.dir) }, { transform: none }], enteringOnTop: true }),
  pull: (o) => ({ leaving: [{ transform: none }, { transform: away(o.dir) }], enteringOnTop: false }),
  wipe: (o) => ({ entering: [{ clipPath: wipeClip(o.dir) }, { clipPath: FULL }], enteringOnTop: true }),
  split: (o) => {
    const closed = o.orient === 'vert' ? 'inset(0% 50% 0% 50%)' : 'inset(50% 0% 50% 0%)';
    // out: the new slide opens from the centre. in: it arrives from the edges,
    // so the old one shrinks to the centre and leaves.
    return o.dir === 'in'
      ? { leaving: [{ clipPath: FULL }, { clipPath: closed }], enteringOnTop: false }
      : { entering: [{ clipPath: closed }, { clipPath: FULL }], enteringOnTop: true };
  },
  zoom: (o) => (o.dir === 'out'
    ? { leaving: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.2)', opacity: 0 }], enteringOnTop: false }
    : { entering: [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], enteringOnTop: true }),
  circle: (o) => (o.dir === 'in'
    ? { leaving: [{ clipPath: 'circle(75% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)' }], enteringOnTop: false }
    : { entering: [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], enteringOnTop: true }),
  diamond: (o) => {
    const small = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)';
    const big = 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)';
    return o.dir === 'in'
      ? { leaving: [{ clipPath: big }, { clipPath: small }], enteringOnTop: false }
      : { entering: [{ clipPath: small }, { clipPath: big }], enteringOnTop: true };
  },
};

export const canPlay = (type) => type in TABLE;

// Pick what to play for a slide's transition: the file's own choice if the
// table knows it, else the file's own fallback, else a cut.
export function resolveTransition(t) {
  if (!t) return { plan: null, played: null, note: null };
  const durationMs = t.durationMs ?? 500;
  const attempts = [t, t.fallback].filter(Boolean);
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    if (canPlay(a.type)) {
      return {
        plan: TABLE[a.type](a.options ?? {}),
        played: a.type,
        durationMs,
        note: i === 1 ? `This slide uses a “${t.type}” transition; the file’s own “${a.type}” version plays here.` : null,
      };
    }
  }
  return { plan: null, played: null, durationMs, note: `This slide uses a “${t.type}” transition that this viewer cannot play yet, so it changes instantly.` };
}
