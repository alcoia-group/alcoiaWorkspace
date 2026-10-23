import { useEffect, useState } from 'react';
import { fetchConnections } from '../lib/connections.js';

// Other readings that cover the same ideas as this one. The server decides who sees anything:
// without the Reader or Student plan, or before the reading is indexed, the list is empty and
// nothing is rendered. Links are full page loads, like every reading link.
export default function Connections({ assignmentId, sessionToken }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchConnections(assignmentId, sessionToken).then((r) => { if (!cancelled) setItems(r); });
    return () => { cancelled = true; };
  }, [assignmentId, sessionToken]);

  if (items.length === 0) return null;
  return (
    <aside className="connections" aria-labelledby="connections-title">
      <h2 id="connections-title">Connections</h2>
      <ul>
        {items.map((d) => (
          <li key={d.assignmentId}>
            Also in <a href={`/a/${d.assignmentId}`}>{d.title}</a>
            {d.ideas.length > 0 && <span className="muted">: {d.ideas.join(', ')}</span>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
