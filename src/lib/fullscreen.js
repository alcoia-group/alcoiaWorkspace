import { useCallback, useEffect, useState } from 'react';

// Full screen for any viewer. The whole page (<html>) is what goes full
// screen, not one element: anything the alcoia extension adds to the page
// stays visible and usable. Where the browser has no Fullscreen API (iPhone
// Safari) the same layout is applied without it, so "full screen" still fills
// the window. The `is-fullscreen` class on <html> is what the CSS keys on.
const CLASS = 'is-fullscreen';
const root = () => document.documentElement;

export function useFullscreen() {
  const [active, setActive] = useState(false);

  const exit = useCallback(() => {
    root().classList.remove(CLASS);
    setActive(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  const enter = useCallback(async () => {
    root().classList.add(CLASS);
    setActive(true);
    try {
      await root().requestFullscreen?.();
    } catch {
      // Refused: the in-window layout still applies.
    }
  }, []);

  const toggle = useCallback(() => (root().classList.contains(CLASS) ? exit() : enter()), [enter, exit]);

  useEffect(() => {
    const onChange = () => {
      // The browser left native full screen (Esc, or its own button).
      if (!document.fullscreenElement && root().classList.contains(CLASS)) {
        root().classList.remove(CLASS);
        setActive(false);
      }
    };
    const onKey = (e) => {
      // Native full screen handles Esc itself; this covers the in-window fallback.
      if (e.key === 'Escape' && root().classList.contains(CLASS) && !document.fullscreenElement) exit();
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
      root().classList.remove(CLASS);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [exit]);

  return { active, toggle, enter, exit };
}

// Controls that fade out while the pointer is still, like a media player.
export function useIdleControls(enabled, ms = 2500) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!enabled) { setVisible(true); return undefined; }
    let timer;
    const wake = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), ms);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [enabled, ms]);
  return visible;
}
