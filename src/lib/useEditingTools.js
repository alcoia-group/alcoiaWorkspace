import { useSyncExternalStore } from 'react';

// Which screens get the editing tools (notes, sticky notes, pen, eraser, My marks, and the
// instructor's core/optional switch). A phone is a touch screen that is narrow: either the
// viewport is under 600 CSS px wide, or it is a phone held sideways (touch, and under 500 px
// tall). Tablets (600 px and wider, including iPad in either direction) and desktops keep them.
// This is a media query on the current window only: no user-agent test and nothing is recorded.
export const PHONE_QUERY = '(pointer: coarse) and (max-width: 599.98px), (pointer: coarse) and (orientation: landscape) and (max-height: 499.98px)';

function subscribe(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}
const snapshot = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(PHONE_QUERY).matches;

export function useIsPhone() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export const useEditingTools = () => !useIsPhone();
