// Plain-number summary of stored scroll traces. Pure: no DOM, no network. Used by the Settings panel.
// It describes what was recorded; it makes no claim about how well any detector works.

const BURST_GAP_MS = 200;   // same as SCREEN.BURST_GAP_MS in public/detection/src/content/signals/screen-timing.js
const JUMP_FRACTION = 0.6;  // SCREEN.JUMP_FRACTION
const HISTORY = 4;          // SCREEN.HISTORY
const ENTER_JUMPS = 3;      // SCREEN.ENTER_JUMPS

// Same formula as createScrollDynamics in public/detection/src/content/signals/scroll-dynamics.js
// (4 s window, at least 6 samples, 'hunting' when jerk > 0.02 px/ms^2 or two or more direction reversals).
// Copied rather than imported because that folder is a synced copy served as static files.
export function dynamicsSubtypes(points, { windowMs = 4000, minSamples = 6, jerkThreshold = 0.02 } = {}) {
  let samples = [];
  const out = [];
  for (const [t, y] of points) {
    samples.push({ y, t });
    samples = samples.filter((s) => t - s.t <= windowMs);
    if (samples.length < minSamples) continue;
    const v = [];
    for (let i = 1; i < samples.length; i++) {
      const dt = samples[i].t - samples[i - 1].t;
      if (dt <= 0) continue;
      v.push((samples[i].y - samples[i - 1].y) / dt);
    }
    if (v.length < 3) continue;
    let jerkSum = 0; let reversals = 0;
    for (let i = 1; i < v.length; i++) {
      const dt = samples[i + 1].t - samples[i].t;
      if (dt > 0) jerkSum += Math.abs((v[i] - v[i - 1]) / dt);
      if (v[i] * v[i - 1] < 0) reversals++;
    }
    const jerk = jerkSum / (v.length - 1);
    out.push(jerk > jerkThreshold || reversals >= 2 ? 'hunting' : 'smooth');
  }
  return out;
}

export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Scroll events grouped into bursts (gap under 200 ms), each with its signed net move in px, its size as a
// share of the viewport height at the time, and when it started and ended.
export function bursts(session) {
  let ih = session.device?.innerHeight || 800;
  const out = [];
  let cur = null;
  let lastY = null;
  for (const ev of session.events) {
    if (ev[1] === 'h' || ev[1] === 'r') { ih = ev[1] === 'h' ? ev[2] : ev[3]; continue; }
    if (ev[1] !== 's') continue;
    const [t, , y] = ev;
    if (cur && t - cur.end < BURST_GAP_MS) { cur.end = t; cur.endY = y; continue; }
    if (cur) out.push(finish(cur));
    cur = { start: t, end: t, startY: lastY == null ? y : lastY, endY: y, ih };
    lastY = y;
  }
  if (cur) out.push(finish(cur));
  function finish(b) { lastY = b.endY; const net = b.endY - b.startY; return { start: b.start, end: b.end, net, fraction: Math.abs(net) / (b.ih || 800) }; }
  return out;
}

function intervals(events, openCode, closeCode, isOpen) {
  const out = [];
  let open = null;
  for (const ev of events) {
    if (ev[1] === openCode && (isOpen ? isOpen(ev) : true)) { if (open == null) open = ev[0]; }
    else if (ev[1] === closeCode && (closeCode === 'v' ? ev[2] === 0 : true)) { if (open != null) { out.push(ev[0] - open); open = null; } }
  }
  return out;
}

function buckets(durations) {
  return { under10s: durations.filter((d) => d < 10000).length, from10to60s: durations.filter((d) => d >= 10000 && d <= 60000).length, over60s: durations.filter((d) => d > 60000).length };
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);

export function summarize(sessions) {
  const r = {
    sessions: sessions.length, minutes: 0, events: 0, truncatedSessions: 0,
    touchFirst: 0, devices: { coarse: 0, hoverNone: 0, fine: 0 },
    bursts: 0, burstFractionMedian: null, jumps: 0, jumpShare: null, screenModeOnShare: null, screenModeEntered: 0,
    huntingEvaluations: 0, smoothEvaluations: 0, huntingShare: null,
    visibility: { count: 0, ...buckets([]) }, blur: { count: 0, ...buckets([]) },
    viewportChanges: 0, viewportLargestChange: 0, viewportTotalChange: 0,
    backwardScrolls: 0, medianBetweenBurstsMs: null,
  };
  const fractions = [];
  const between = [];
  const visDur = [];
  const blurDur = [];
  let screenOn = 0;
  for (const s of sessions) {
    r.minutes += (s.durationMs || 0) / 60000;
    r.events += s.events.length;
    if (s.truncated) r.truncatedSessions++;
    if (s.firstInput === 'touch') r.touchFirst++;
    if (s.device?.pointerCoarse) r.devices.coarse++;
    if (s.device?.hoverNone) r.devices.hoverNone++;
    if (s.device?.pointerFine) r.devices.fine++;

    const b = bursts(s);
    r.bursts += b.length;
    let hist = [];
    let wasOn = false;
    b.forEach((x, i) => {
      fractions.push(x.fraction);
      const jump = x.fraction >= JUMP_FRACTION;
      if (jump) r.jumps++;
      if (x.net < -50) r.backwardScrolls++;
      hist.push(jump); if (hist.length > HISTORY) hist.shift();
      const on = hist.filter(Boolean).length >= ENTER_JUMPS;
      if (on) screenOn++;
      if (on && !wasOn) r.screenModeEntered++;
      wasOn = on;
      if (i > 0) between.push(x.start - b[i - 1].end);
    });

    const pts = s.events.filter((e) => e[1] === 's').map((e) => [e[0], e[2]]);
    for (const sub of dynamicsSubtypes(pts)) { if (sub === 'hunting') r.huntingEvaluations++; else r.smoothEvaluations++; }

    visDur.push(...intervals(s.events, 'v', 'v', (e) => e[2] === 1));
    blurDur.push(...intervals(s.events, 'b', 'f'));
    let prevIH = s.device?.innerHeight;
    for (const e of s.events) {
      if (e[1] !== 'h') continue;
      if (prevIH != null) { const d = Math.abs(e[2] - prevIH); r.viewportTotalChange += d; r.viewportLargestChange = Math.max(r.viewportLargestChange, d); }
      prevIH = e[2];
      r.viewportChanges++;
    }
  }
  r.minutes = Math.round(r.minutes * 10) / 10;
  r.burstFractionMedian = median(fractions) == null ? null : Math.round(median(fractions) * 100) / 100;
  r.jumpShare = pct(r.jumps, r.bursts);
  r.screenModeOnShare = pct(screenOn, r.bursts);
  const evals = r.huntingEvaluations + r.smoothEvaluations;
  r.huntingShare = pct(r.huntingEvaluations, evals);
  r.visibility = { count: visDur.length, ...buckets(visDur) };
  r.blur = { count: blurDur.length, ...buckets(blurDur) };
  r.medianBetweenBurstsMs = median(between) == null ? null : Math.round(median(between));
  return r;
}
