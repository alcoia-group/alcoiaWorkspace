// The "Back to where you were" pill after following a link inside a document.
// On a phone there is no margin beside the page, so it shrinks to an arrow; the full text stays as its label.
export default function ReturnButton({ label, onClick }) {
  return (
    <button type="button" className="link-return" onClick={onClick} aria-label={label} title={label}>
      <svg className="link-return-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M8 4 3 9l5 5M3.5 9H12a5 5 0 0 1 0 10h-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="link-return-text">{label}</span>
    </button>
  );
}
