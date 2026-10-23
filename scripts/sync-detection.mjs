// Copies the alcoia extension's reading-detection modules into this app, unchanged, so the workspace runs the
// same code the extension runs (paragraph tracker, signals, state engine, intervention policy, orchestrator and
// host, question card, explain/repair cards, retention, learner estimates, teaching focus, policy profile, i18n,
// away detector, account sync). The owner holds copyright in both repositories.
//
// Usage: node scripts/sync-detection.mjs [path to the extension's alcoia/src]  (default ../alcoia/alcoia/src)
//
// Files land in public/detection/src/ with the extension's own folder layout, so the extension's module loader
// (import of a path such as 'src/content/host.js') works unchanged; src/detection/platform.js supplies the small
// `chrome` surface those modules expect. Only two lines change, both in shared/config.js: the server origin and
// the workspace origin are read from self.__ALCOIA_PLATFORM__ when it is set. Every .js file gets a header naming
// its source. Do not edit files in public/detection by hand: change the extension and run this again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.resolve(process.argv[2] || path.join(root, '..', 'alcoia', 'alcoia', 'src'));
const dest = path.join(root, 'public', 'detection', 'src');

const INCLUDE = [
  { dir: 'content', skip: new Set(['content.js']) },
  { dir: 'shared' },
  { dir: 'styles' },
  { dir: 'libs/fonts' },
  { dir: 'libs/wordfreq', only: new Set(['common-words.js', 'common-words-fr.js', 'common-words-es.js', 'common-words-de.js', 'common-words-pt.js', 'common-words-it.js']) },
];

if (!fs.existsSync(path.join(source, 'content', 'host.js'))) {
  console.error(`not the extension's src folder: ${source}`);
  process.exit(1);
}

let commit = 'unknown';
try {
  const head = fs.readFileSync(path.join(source, '..', '..', '.git', 'HEAD'), 'utf8').trim();
  const ref = head.startsWith('ref: ') ? head.slice(5) : null;
  commit = ref ? fs.readFileSync(path.join(source, '..', '..', '.git', ref), 'utf8').trim().slice(0, 12) : head.slice(0, 12);
} catch { /* no git metadata */ }

function rewriteConfig(text) {
  const out = text
    .replace("const BACKEND_ORIGIN = 'https://server.alcoia.app';",
      "const BACKEND_ORIGIN = (root.__ALCOIA_PLATFORM__ && root.__ALCOIA_PLATFORM__.backendOrigin) || 'https://server.alcoia.app';")
    .replace("READER_ORIGIN: 'https://workspace.alcoia.app',",
      "READER_ORIGIN: (root.__ALCOIA_PLATFORM__ && root.__ALCOIA_PLATFORM__.readerOrigin) || 'https://workspace.alcoia.app',");
  if (!out.includes('__ALCOIA_PLATFORM__.backendOrigin') || !out.includes('__ALCOIA_PLATFORM__.readerOrigin')) {
    throw new Error('shared/config.js changed shape; update rewriteConfig in scripts/sync-detection.mjs');
  }
  return out;
}

fs.rmSync(dest, { recursive: true, force: true });
let count = 0;
for (const { dir, skip, only } of INCLUDE) {
  const from = path.join(source, dir);
  for (const entry of fs.readdirSync(from, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const abs = path.join(entry.parentPath ?? entry.path, entry.name);
    const rel = path.relative(source, abs);
    if (skip?.has(entry.name) || (only && !only.has(entry.name))) continue;
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (abs.endsWith('.js')) {
      let text = fs.readFileSync(abs, 'utf8');
      if (rel === path.join('shared', 'config.js')) text = rewriteConfig(text);
      const header = `/* Vendored from the alcoia browser extension (alcoia/src/${rel.split(path.sep).join('/')}, commit ${commit}) by scripts/sync-detection.mjs. Do not edit here. */\n`;
      fs.writeFileSync(target, header + text);
    } else {
      fs.copyFileSync(abs, target);
    }
    count++;
  }
}
fs.writeFileSync(path.join(dest, '..', 'SOURCE.txt'), `alcoia extension src, commit ${commit}\n${count} files, copied by scripts/sync-detection.mjs\n`);
console.log(`copied ${count} files from ${source} (commit ${commit}) to ${path.relative(root, dest)}`);
