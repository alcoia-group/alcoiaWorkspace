// Pictures inside a Word or PowerPoint file kept on this device. The server used to serve them out of the stored
// file; now the file is here, so the picture is read straight out of it in the browser: a .docx or .pptx is a
// ZIP, and a picture is one entry in it. Only plain raster images are returned (never SVG or anything that could
// carry script), and only from the document's own media folder.
import { useEffect, useState } from 'react';

const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const MEDIA = { docx: 'word/media/', pptx: 'ppt/media/' };
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);

// The entry named `path` as bytes, or null. Stored and deflated entries only (what Word and PowerPoint write).
export async function readZipEntry(buffer, path) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65535); i -= 1) {
    if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const names = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= buffer.byteLength; n += 1) {
    if (u32(view, p) !== 0x02014b50) return null;
    const method = u16(view, p + 10);
    const compressed = u32(view, p + 20);
    const size = u32(view, p + 24);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const localOffset = u32(view, p + 42);
    const name = names.decode(new Uint8Array(buffer, p + 46, nameLen));
    if (name === path) {
      if (size > MAX_IMAGE_BYTES || compressed > MAX_IMAGE_BYTES) return null;
      const dataStart = localOffset + 30 + u16(view, localOffset + 26) + u16(view, localOffset + 28);
      const raw = new Uint8Array(buffer, dataStart, compressed);
      if (method === 0) return raw.slice();
      if (method !== 8) return null;
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// A picture as a Blob, from the file's own media folder. null for anything else.
export async function readLocalImage(blob, format, path) {
  const folder = MEDIA[format];
  const type = TYPES[String(path).split('.').pop()?.toLowerCase()];
  if (!folder || !type || !String(path).startsWith(folder) || String(path).slice(folder.length).includes('/') || String(path).includes('..')) return null;
  const bytes = await readZipEntry(await blob.arrayBuffer(), path);
  if (!bytes) return null;
  return new Blob([bytes], { type });
}

// Same shape as useAssetUrl (lib/assets.js): { url, failed }. `local` is { blob, format }.
export function useLocalImageUrl(local, path) {
  const [state, setState] = useState({ url: null, failed: false });
  useEffect(() => {
    let cancelled = false;
    let made = null;
    readLocalImage(local.blob, local.format, path).then(
      (img) => {
        if (cancelled) return;
        if (!img) { setState({ url: null, failed: true }); return; }
        made = URL.createObjectURL(img);
        setState({ url: made, failed: false });
      },
      () => !cancelled && setState({ url: null, failed: true }),
    );
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [local, path]);
  return state;
}
