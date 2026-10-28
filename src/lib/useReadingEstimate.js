import { useEffect, useState } from 'react';
import { apiGet } from './api.js';
import { fetchSettings } from './settings.js';
import { helpIsOn } from './readingTime.js';

// The reader's own pace (the reading baseline kept on the account, only while account-based learning is on) and
// whether help cards are on. Either can be missing or fail; the estimate then falls back to a typical pace / help on,
// and never blocks the page. { ready: false } until both have answered, so a number does not change under the reader.
export function useReadingEstimate(sessionToken) {
  const [state, setState] = useState({ ready: false, baseline: null, help: true });
  useEffect(() => {
    let cancelled = false;
    const base = apiGet('/api/account/reading-baseline', { sessionToken }).then((b) => (b?.status === 'disabled' ? null : b), () => null);
    const sets = fetchSettings(sessionToken).then((r) => r?.settings ?? null, () => null);
    Promise.all([base, sets]).then(([baseline, settings]) => {
      if (!cancelled) setState({ ready: true, baseline, help: helpIsOn(settings) });
    });
    return () => { cancelled = true; };
  }, [sessionToken]);
  return state;
}
