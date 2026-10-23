import { MARKETING_URL } from '../lib/analytics.js';

// The workspace has no legal pages of its own: one set covers every alcoia app, and it lives on the
// marketing site so there is a single version to keep right.
export default function LegalLinks({ lead }) {
  const base = MARKETING_URL.replace(/\/$/, '');
  return (
    <p className="muted legal-links">
      {lead ? `${lead} ` : ''}
      <a href={`${base}/legal/terms`} target="_blank" rel="noreferrer">Terms</a>
      {' · '}
      <a href={`${base}/legal/privacy-policy`} target="_blank" rel="noreferrer">Privacy policy</a>
      {' · '}
      <a href={`${base}/legal/cookies`} target="_blank" rel="noreferrer">Cookies</a>
    </p>
  );
}
