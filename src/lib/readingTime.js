import { readingMinutes } from './format.js';

// How long a reading will take THIS reader. The pace is the reader's own, from the reading baseline the
// detection keeps (a running median once it has seen enough paragraphs); until there is one, a typical adult pace
// is used and the line says so. Help cards (questions and explanations) are added only while the reader has them
// on. That part is an allowance, a fixed share of the reading time, not something measured: how long help takes
// varies a lot, and the estimate is a guide, never a target or a measure of the reader.
export const GENERIC_WPM = 200;
export const MIN_WPM = 80; // outside this range a stored figure is treated as unusable
export const MAX_WPM = 600;
export const HELP_ALLOWANCE = 0.15; // placeholder: 15% of the reading time while help cards are on

const usable = (n) => Number.isFinite(n) && n >= MIN_WPM && n <= MAX_WPM;

// baseline is the server's { globalWpm, byLanguage } or null. language is optional (a two-letter code).
export function paceFor(baseline, language) {
  const own = language && baseline?.byLanguage?.[language];
  if (usable(own)) return { wpm: own, basis: 'yours' };
  if (usable(baseline?.globalWpm)) return { wpm: baseline.globalWpm, basis: 'yours' };
  return { wpm: GENERIC_WPM, basis: 'typical' };
}

// Help cards are on only when reading help is on AND the cards are shown. An unknown setting counts as on, because
// that is the default.
export const helpIsOn = (settings) => settings?.enabled !== false && settings?.show_interventions !== false;

export function estimateMinutes({ wordCount, baseline, language, help }) {
  if (!Number.isInteger(wordCount) || wordCount <= 0) return null;
  const pace = paceFor(baseline, language);
  const reading = wordCount / pace.wpm;
  const total = help ? reading * (1 + HELP_ALLOWANCE) : reading;
  return { minutes: Math.max(1, Math.round(total)), basis: pace.basis, help: Boolean(help) };
}

// Minutes left from the share of the document still ahead (0 to 1).
export function minutesLeft(totalMinutes, fractionLeft) {
  if (totalMinutes == null || !Number.isFinite(fractionLeft)) return null;
  const f = Math.min(1, Math.max(0, fractionLeft));
  return Math.round(totalMinutes * f);
}

export function formatMinutes(minutes) {
  if (minutes == null) return '';
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m >= 5 ? `${h} h ${m} min` : `${h} h`;
}

// The short line on the Materials list.
export function lengthLine(est, left) {
  if (!est) return null;
  if (left != null) return left < 1 ? 'Nearly done' : `${formatMinutes(left)} left`;
  return `~${formatMinutes(est.minutes)} read`;
}

// The small print under it, saying what the number rests on.
export function basisNote(est) {
  if (!est) return '';
  const pace = est.basis === 'yours' ? 'at your pace' : 'at a typical pace';
  return est.help ? `${pace}, with help cards` : pace;
}

export { readingMinutes };
