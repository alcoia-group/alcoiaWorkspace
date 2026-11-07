import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { formatLabel } from '../lib/format.js';
import { addErrorMessage, addFileToDevice, formatOf } from '../lib/addLocalFile.js';
import { deleteLocalFile, listLocalFiles, requestPersistence, storageEstimate } from '../lib/localFiles.js';
import { getIdentityRecord } from '../lib/localFiles.js';
import { summarise } from '../lib/documentIdentity.js';
import { loadMarks } from '../lib/annotations.js';
import {
  deletePersonalDocument, downloadPersonalFile, formatBytes, listPersonalDocuments,
} from '../lib/personalDocuments.js';

// My files: the user's own documents, kept on THIS device. The workspace holds the file in the browser and
// opens it from there; the server never receives a copy to keep. Closing the tab, refreshing or coming back
// later does not remove them. Clearing this site's data in the browser does.
export default function FilesPage() {
  const { session, signOut } = useSession();
  const account = session.email ?? null;
  const [files, setFiles] = useState(null);
  const [legacy, setLegacy] = useState({ status: 'loading', documents: [] });
  const [estimate, setEstimate] = useState({ usage: null, quota: null, persisted: false });
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const inputRef = useRef(null);

  const loadLocal = useCallback(async () => {
    try {
      const rows = await listLocalFiles(account);
      const withState = await Promise.all(rows.map(async (r) => {
        const rec = await getIdentityRecord(r.id);
        return { ...r, summary: rec?.identity ? summarise(rec.identity, loadMarks(`f:${r.id}`)) : null, parts: rec?.identity?.overview?.parts ?? null, kind: rec?.identity?.overview?.kind ?? 'pages' };
      }));
      setFiles(withState);
    } catch {
      setFiles('error');
    }
    setEstimate(await storageEstimate());
  }, [account]);

  const loadLegacy = useCallback(async () => {
    try {
      const body = await listPersonalDocuments(session.sessionToken);
      setLegacy({ status: 'ready', documents: body.documents ?? [] });
    } catch (err) {
      setLegacy({ status: err.status === 401 ? 'expired' : 'error', documents: [] });
    }
  }, [session.sessionToken]);

  useEffect(() => { loadLocal(); }, [loadLocal]);
  useEffect(() => { loadLegacy(); }, [loadLegacy]);
  useEffect(() => { if (legacy.status === 'expired') signOut(); }, [legacy.status, signOut]);

  async function handleFiles(fileList) {
    setMessage(null);
    for (const file of Array.from(fileList)) {
      if (!formatOf(file)) {
        setMessage({ error: true, text: `${file.name}: ${addErrorMessage('unsupported_format')}` });
        continue;
      }
      try {
        setProgress({ name: file.name, fraction: 0 });
        const result = await addFileToDevice({ file, account, sessionToken: session.sessionToken, onProgress: (f) => setProgress({ name: file.name, fraction: f }) });
        if (result.existed) setMessage({ text: `${result.name} is already on this device.` });
      } catch (err) {
        setMessage({ error: true, text: `${file.name}: ${addErrorMessage(err.code)}` });
        if (err.code === 'capability_required' || err.code === 'device_storage_full') break;
      }
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
    requestPersistence();
    loadLocal();
  }

  async function handleDelete(id) {
    setConfirmId(null);
    try {
      await deleteLocalFile(account, id);
      try { localStorage.removeItem(`alcoia_workspace_marks_f:${id}`); } catch { /* storage blocked */ }
      setMessage({ text: 'File removed from this device.' });
    } catch {
      setMessage({ error: true, text: 'The file could not be removed.' });
    }
    loadLocal();
  }

  async function handleLegacyDelete(id) {
    try {
      await deletePersonalDocument(id, session.sessionToken);
      setMessage({ text: 'File deleted from our servers.' });
    } catch {
      setMessage({ error: true, text: 'The file could not be deleted.' });
    }
    loadLegacy();
  }

  async function handleLegacyDownload(d) {
    try { await downloadPersonalFile(d, session.sessionToken); } catch { setMessage({ error: true, text: 'The file could not be downloaded.' }); }
  }

  if (legacy.status === 'expired') return <Navigate to="/sign-in" replace state={{ from: '/files' }} />;
  const pct = estimate.usage != null && estimate.quota ? Math.min(100, Math.round((estimate.usage / estimate.quota) * 100)) : null;

  return (
    <section className="page">
      <h1 className="page-title">My files</h1>
      <p className="muted">
        Your own documents. They are kept on this device, in this browser. They are not uploaded to our servers, and
        they stay when you close the tab, refresh or come back later. Clearing this site&rsquo;s data in your browser, or
        using another browser or device, means adding them again.
      </p>
      <p className="muted">Single-column documents work best.</p>

      {pct != null && (
        <div className="usage" aria-label="Space used in this browser">
          <div className="usage-bar"><div className="usage-fill" style={{ width: `${pct}%` }} /></div>
          <p className="muted">{formatBytes(estimate.usage)} of about {formatBytes(estimate.quota)} used in this browser{estimate.persisted ? '. The browser has agreed to keep your files.' : ''}</p>
        </div>
      )}

      {/* Every plan may add files: they stay on this device. Shown at once, never swapped after the server answers. */}
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <p>Drop PDF, Word or PowerPoint files here, or</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.pptx" onChange={(e) => handleFiles(e.target.files)} disabled={Boolean(progress)} aria-label="Choose files" />
        {progress && <p className="muted">Preparing {progress.name}{progress.fraction > 0 && progress.fraction < 1 ? `: ${Math.round(progress.fraction * 100)}%` : ''}</p>}
        <p className="muted small">Up to 100 MB each. Word and PowerPoint files are sent to our server once so they can be read and drawn, and are not kept there. PDFs never leave your device.</p>
      </div>

      {message && <p className={message.error ? 'alert alert-error' : 'alert'} role="status">{message.text}</p>}

      {files === 'error' && <p className="alert alert-error">Your files could not be read from this browser. Private windows often do not keep them.</p>}
      {files === null && <p className="muted">Loading.</p>}
      {Array.isArray(files) && (files.length === 0 ? (
        <p className="muted">There are no files on this device yet.</p>
      ) : (
        <table className="list">
          <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Where you were</th><th /></tr></thead>
          <tbody>
            {files.map((d) => (
              <tr key={d.id}>
                <td><Link to={`/f/${d.id}`} reloadDocument>{d.name}</Link></td>
                <td>{formatLabel(d.format)}</td>
                <td>{formatBytes(d.size)}</td>
                <td className="muted small">
                  {d.summary?.where ? `${d.kind === 'slides' ? 'Slide' : 'Page'} ${d.summary.where.index + 1} of ${d.summary.where.total}` : 'Not opened yet'}
                  {d.summary?.hardCount > 0 && `, ${d.summary.hardCount} hard ${d.summary.hardCount === 1 ? 'part' : 'parts'}`}
                </td>
                <td>
                  {confirmId === d.id ? (
                    <span>
                      Remove from this device?{' '}
                      <button type="button" className="link-button" onClick={() => handleDelete(d.id)}>Yes, remove</button>{' '}
                      <button type="button" className="link-button" onClick={() => setConfirmId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className="link-button" onClick={() => setConfirmId(d.id)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      {legacy.documents.length > 0 && (
        <>
          <h2>Stored on our servers earlier</h2>
          <p className="alert">
            These files were uploaded before files moved to your device. We are removing server storage for them, so download any you want to keep, then
            add them here from your own copy. You can still open and delete them until then.
          </p>
          <table className="list">
            <thead><tr><th>Name</th><th>Type</th><th>Size</th><th /></tr></thead>
            <tbody>
              {legacy.documents.map((d) => (
                <tr key={d.id}>
                  <td><Link to={`/f/${d.id}`} reloadDocument>{d.name}</Link></td>
                  <td>{formatLabel(d.format)}</td>
                  <td>{formatBytes(d.sizeBytes)}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => handleLegacyDownload(d)}>Download</button>{' '}
                    <button type="button" className="link-button" onClick={() => handleLegacyDelete(d.id)}>Delete from server</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="muted small">To report a file that breaks the rules, use the contact form on alcoia.app.</p>
    </section>
  );
}
