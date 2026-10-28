const FORMAT_LABEL = { pdf: 'PDF', docx: 'Word document', pptx: 'PowerPoint' };

export const formatLabel = (format) => FORMAT_LABEL[format] ?? 'Document';

// "Dec 1, 2026 at 11:59 PM", the way a course page writes a due date.
export function formatDue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

export const isDueSoon = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 && ms < 48 * 3600 * 1000;
};

export const initials = (email) => (email ?? '?').trim().slice(0, 2).toUpperCase();

// How long a reading takes, from its word count at a typical adult reading speed. A rough guide, not a measure of
// you: people read at very different speeds, and dense material takes longer. null when the length is not known.
export const WORDS_PER_MINUTE = 200;
export const LONG_READING_MINUTES = 40; // placeholder
export function readingMinutes(wordCount) {
  if (!Number.isInteger(wordCount) || wordCount <= 0) return null;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
export function formatLength(minutes) {
  if (minutes == null) return '';
  if (minutes < 60) return `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `about ${h} h${m >= 10 ? ` ${m} min` : ''}`;
}
// A plain notice when a long reading closes soon. It states two facts and leaves the decision to the reader; it is shown
// only when both the length and the time left are known, and never says the reader is behind.
export function longReadingNotice(minutes, closesAt, now = Date.now()) {
  if (minutes == null || minutes < LONG_READING_MINUTES) return null;
  const left = new Date(closesAt).getTime() - now;
  if (!(left > 0) || left > 48 * 3600 * 1000) return null;
  const hours = Math.max(1, Math.round(left / 3600000));
  return `This reading is ${formatLength(minutes)} and closes in ${hours === 1 ? 'about an hour' : `${hours} hours`}. You can start now and come back to it.`;
}
