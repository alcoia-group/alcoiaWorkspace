import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { formatLabel } from '../lib/format.js';
import {
  deletePersonalDocument, formatBytes, formatOfFile, listPersonalDocuments, uploadErrorMessage, uploadPersonalDocument,
} from '../lib/personalDocuments.js';

// My files: the user's own documents. Private to the account; kept until the user deletes them.
// The server decides everything (plan, quota, ownership); this page shows its answers.
export default function FilesPage() {
  const { session, signOut } = useSession();
  const [state, setState] = useState({ status: 'loading' });
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const body = await listPersonalDocuments(session.sessionToken);
      setState({ status: 'ready', ...body });
    } catch (err) {
      setState({ status: err.status === 401 ? 'expired' : 'error' });
    }
  }, [session.sessionToken]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (state.status === 'expired') signOut(); }, [state.status, signOut]);

  async function handleFiles(fileList) {
    setMessage(null);
    for (const file of Array.from(fileList)) {
      if (!formatOfFile(file)) {
        setMessage({ error: true, text: `${file.name}: only PDF, Word (.docx) and PowerPoint (.pptx) files can be added.` });
        continue;
      }
      try {
        setProgress({ name: file.name, fraction: 0 });
        await uploadPersonalDocument(file, { sessionToken: session.sessionToken, onProgress: (f) => setProgress({ name: file.name, fraction: f }) });
      } catch (err) {
        setMessage({ error: true, text: `${file.name}: ${uploadErrorMessage(err)}` });
        if (err.code === 'storage_quota_exceeded' || err.code === 'capability_required') break;
      }
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
    load();
  }

  async function handleDelete(id) {
    setConfirmId(null);
    try {
      await deletePersonalDocument(id, session.sessionToken);
      setMessage({ text: 'File deleted.' });
    } catch {
      setMessage({ error: true, text: 'The file could not be deleted.' });
    }
    load();
  }

  if (state.status === 'expired') return <Navigate to="/sign-in" replace state={{ from: '/files' }} />;
  const { documents = [], usage, canUpload } = state;
  const pct = usage ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100)) : 0;

  return (
    <section className="page">
      <h1 className="page-title">My files</h1>
      <p className="muted">Your own documents, private to your account. They stay until you delete them.</p>
      {state.status === 'loading' && <p className="muted">Loading.</p>}
      {state.status === 'error' && <p className="alert alert-error">Your files could not be loaded.</p>}
      {state.status === 'ready' && (
        <>
          <div className="usage" aria-label="Storage used">
            <div className="usage-bar"><div className="usage-fill" style={{ width: `${pct}%` }} /></div>
            <p className="muted">{formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)} used</p>
          </div>

          {canUpload ? (
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <p>Drop PDF, Word or PowerPoint files here, or</p>
              <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.pptx" onChange={(e) => handleFiles(e.target.files)} disabled={Boolean(progress)} aria-label="Choose files" />
              {progress && (
                <p className="muted">Uploading {progress.name}: {Math.round(progress.fraction * 100)}%</p>
              )}
            </div>
          ) : (
            <p className="alert">Uploading your own files is included with the Reader and Student plans. You can still open and delete any file you added earlier.</p>
          )}

          {message && <p className={message.error ? 'alert alert-error' : 'alert'} role="status">{message.text}</p>}

          {documents.length === 0 ? (
            <p className="muted">You have not added any files yet.</p>
          ) : (
            <table className="list">
              <thead><tr><th>Name</th><th>Type</th><th>Size</th><th /></tr></thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td><Link to={`/f/${d.id}`} reloadDocument>{d.name}</Link></td>
                    <td>{formatLabel(d.format)}</td>
                    <td>{formatBytes(d.sizeBytes)}</td>
                    <td>
                      {confirmId === d.id ? (
                        <span>
                          Delete permanently?{' '}
                          <button type="button" className="link-button" onClick={() => handleDelete(d.id)}>Yes, delete</button>{' '}
                          <button type="button" className="link-button" onClick={() => setConfirmId(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button type="button" className="link-button" onClick={() => setConfirmId(d.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">Deleting a file removes it for good. Only you can see your files. Report a file that breaks the rules through the contact form on alcoia.app.</p>
        </>
      )}
    </section>
  );
}
