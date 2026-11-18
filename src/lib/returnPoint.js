import { useCallback, useEffect, useRef, useState } from 'react';

// Where the reader was before following a link inside the document, offered as a
// small "Back" button. It stays until the reader has moved on: scrolled at least one
// screen away from where the link landed (or, in a deck, left the slide it landed on).
export function useReturnPoint() {
  const [point, setPoint] = useState(null);
  const landing = useRef(null); // { el, top } once the jump has settled
  const clear = useCallback(() => { landing.current = null; setPoint(null); }, []);

  // `getLanding` returns the element the link moved to; omit it (slides) and call clear yourself.
  const remember = useCallback((at, getLanding) => {
    setPoint(at);
    landing.current = null;
    if (!getLanding) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = getLanding();
      if (el) landing.current = { el, top: el.getBoundingClientRect().top };
    }));
  }, []);

  useEffect(() => {
    if (point === null) return undefined;
    const onScroll = () => {
      const l = landing.current;
      if (!l || !l.el.isConnected) return;
      if (Math.abs(l.el.getBoundingClientRect().top - l.top) >= window.innerHeight) clear();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [point, clear]);

  return { point, remember, clear };
}
