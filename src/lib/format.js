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
