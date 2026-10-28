import { useEffect, useState } from 'react';
import { fetchPersonalConnections } from '../lib/personalConnections.js';

// Ideas in this file that look like ideas in the person's other files. The server decides who sees anything
// (Reader or Student plan, and both files indexed); with nothing to show the panel renders nothing. Every link is a
// suggestion made by a model and has not been checked, and the panel says so.
export default function PersonalConnections({ id, sessionToken }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchPersonalConnections(id, sessionToken).then((r) => { if (!cancelled) setData(r); });
    return () => { cancelled = true; };
  }, [id, sessionToken]);

  if (!data) return null;
  return (
    <aside className="connections" aria-labelledby="pc-title">
      <h2 id="pc-title">Possible connections to your other files</h2>
      <p className="muted small">{data.note}</p>
      <ul>
        {data.items.map((c) => (
          <li key={c.key}>
            <strong>{c.here}</strong> {c.relation} <strong>{c.there}</strong> in <a href={`/f/${c.documentId}`}>{c.documentName}</a>
            {c.likely ? '' : <span className="muted"> (less certain)</span>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
