// A tiny bridge between the reading tools (React, Annotator.jsx) and the detection code (boot.js). The selection toolbar
// can ask "I'm stuck here" about the exact words a reader selected; the detection code owns what happens next (it makes that
// paragraph the one being read and reports the same self-report as the bottom-right card). While no reading is running, or
// while the reader has help turned off, nothing is available and the buttons are hidden.
let handler = null;
let enabled = true;
const listeners = new Set();
const notify = () => { const on = handler !== null && enabled; for (const l of listeners) l(on); };

export const SELF_REPORT_CHOICES = Object.freeze([
  { subtype: 'confusion', label: "I'm stuck", full: "I'm stuck / don't get it" },
  { subtype: 'overload', label: 'Too much', full: 'Too much at once' },
  { subtype: 'disengaged', label: 'Lost focus', full: 'Not interested / lost focus' },
]);

export function registerSelfReportAt(fn) {
  handler = typeof fn === 'function' ? fn : null;
  notify();
  return () => { if (handler === fn) { handler = null; notify(); } };
}

// The reader's own settings (help cards off, assistant off) hide the buttons.
export function setSelfReportEnabled(value) {
  enabled = value !== false;
  notify();
}

export const selfReportAvailable = () => handler !== null && enabled;

export function subscribeSelfReportAvailable(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// node: where the selection is (a text node or an element). Returns true when a paragraph was found and the report was sent.
export function selfReportAt(node, subtype) {
  if (!handler || !enabled) return false;
  try { return handler(node, subtype) === true; } catch { return false; }
}
