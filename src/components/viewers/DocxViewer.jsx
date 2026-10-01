import { useFullscreen, useIdleControls } from '../../lib/fullscreen.js';
import { useEffect, useRef, useState } from 'react';

// Word-style viewer for the server's structured DOCX model. It renders real
// <h*>/<p>/<ul>/<table> elements inside page frames, so the alcoia extension
// reads it like any article, while it looks like a document, not a web page.
// Text goes through React only: nothing in the model is ever treated as markup.

import AssetImage from './AssetImage.jsx';

const SAFE_HREF = /^(https?:|mailto:)/i;

function Runs({ runs }) {
  return runs.map((run, i) => {
    let node = run.text;
    if (run.bold) node = <strong>{node}</strong>;
    if (run.italic) node = <em>{node}</em>;
    if (run.underline) node = <u>{node}</u>;
    if (run.strike) node = <s>{node}</s>;
    if (run.href && SAFE_HREF.test(run.href)) {
      node = <a href={run.href} target="_blank" rel="noopener noreferrer">{node}</a>;
    }
    return <span key={i} className="docx-run">{node}</span>;
  });
}

function Blocks({ blocks, asset }) {
  return blocks.map((block, i) => {
    switch (block.type) {
      case 'heading': {
        const Tag = `h${Math.min(Math.max(block.level, 1), 6)}`;
        return <Tag key={i} className="docx-heading"><Runs runs={block.runs} /></Tag>;
      }
      case 'paragraph':
        return <p key={i}><Runs runs={block.runs} /></p>;
      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul';
        return (
          <Tag key={i} className="docx-list">
            {block.items.map((item, j) => (
              <li key={j} style={{ marginLeft: `${item.level * 1.5}em` }}><Runs runs={item.runs} /></li>
            ))}
          </Tag>
        );
      }
      case 'table':
        return (
          <table key={i} className="docx-table">
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} colSpan={cell.colSpan}><Blocks blocks={cell.blocks} asset={asset} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'image':
        return <AssetImage key={i} asset={asset} path={block.assetId} alt={block.alt} className="docx-image" />;
      default:
        return null;
    }
  });
}

const ZOOM_STEPS = [0.75, 0.9, 1, 1.15, 1.3, 1.5];

export default function DocxViewer({ content, title, asset, onDownload }) {
  const pages = content.pages;
  const [zoomIndex, setZoomIndex] = useState(2);
  const [current, setCurrent] = useState(1);
  const pageRefs = useRef([]);
  const fs = useFullscreen();
  const controlsVisible = useIdleControls(fs.active);

  useEffect(() => {
    // Track which page is most visible for "Page n of N".
    const visible = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(Number(e.target.dataset.page), e.intersectionRatio);
        let best = 1;
        let bestRatio = -1;
        for (const [page, ratio] of visible) {
          if (ratio > bestRatio) { best = page; bestRatio = ratio; }
        }
        setCurrent(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [pages.length, zoomIndex]);

  return (
    <div className="viewer" style={{ '--z': ZOOM_STEPS[zoomIndex] }} data-idle={fs.active && !controlsVisible ? 'true' : undefined}>
      <div className="viewer-toolbar" role="toolbar" aria-label="Document controls">
        <span className="viewer-title">{title}</span>
        <span className="viewer-pageno" aria-live="polite">Page {current} of {pages.length}</span>
        <span className="viewer-controls">
          <button type="button" className="secondary" onClick={() => setZoomIndex((z) => Math.max(0, z - 1))} disabled={zoomIndex === 0} aria-label="Zoom out">−</button>
          <span className="viewer-zoom">{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
          <button type="button" className="secondary" onClick={() => setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))} disabled={zoomIndex === ZOOM_STEPS.length - 1} aria-label="Zoom in">+</button>
          <button type="button" className="secondary" onClick={fs.toggle}>{fs.active ? 'Exit full screen' : 'Full screen'}</button>
          {onDownload && <button type="button" className="secondary" onClick={onDownload}>Download</button>}
        </span>
      </div>
      <div className="viewer-stage">
        {pages.map((page, i) => (
          <article
            key={i}
            className="docx-page"
            data-page={i + 1}
            ref={(el) => { pageRefs.current[i] = el; }}
            aria-label={`Page ${i + 1} of ${pages.length}`}
          >
            <Blocks blocks={page.blocks} asset={asset} />
          </article>
        ))}
      </div>
    </div>
  );
}
