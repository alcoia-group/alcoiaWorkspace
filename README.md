# alcoia workspace

The web app where students, and later any general user, open readings. It shows instructor-assigned readings and the user's own files (PDF, Word and PowerPoint) as real web pages, and offers practice and learning summaries for people on a paid plan.

It needs a backend to work. The backend is a separate private project and is not part of this repository. You can point the app at your own backend with `VITE_API_BASE_URL`, as long as it implements the calls the app makes (see `src/lib/api.js` and the other files in `src/lib/`).
 
## What it does

- **Readings and files.** Word pages, PowerPoint slides (with the transitions the file states) and PDF pages, each in its own viewer with full screen, zoom and download.
- **Reading detection.** On a reading page the app runs the same detection code as the alcoia browser extension, copied into `public/detection` by `scripts/sync-detection.mjs`. Do not edit those files by hand; change the extension and run the script again.
- **Practice and summaries.** Exam Mode and a learning summary page for people on a paid plan.
- **Reading tools.** Highlighters, underlines, notes and a pen. Marks are stored only on your device.
- **Account settings.** Reading preferences and the account-based learning switch.

The app holds no business logic. Access, plans and what is stored are decided by the backend on every request, never by this app.

## Principles

- No accuracy claims, rankings or leaderboards.
- Receipts say "unaltered since issued".
- Nothing is sent off the device without a visible disclosure.
- Plain wording, no em dashes.

## Run it

```bash
npm install
cp .env.example .env     # set VITE_API_BASE_URL
npm run dev              # port 8082
npm run build
npm run lint
```

Build-time values (see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Address of the backend |
| `VITE_CONSOLE_URL` | Where the account settings link points (optional) |
| `VITE_MARKETING_URL` | Where legal links point (optional) |

The app is a static single-page build. Any static host works if it serves `index.html` for unknown paths; `wrangler.jsonc` is an example for Cloudflare.

## Layout

```
src/
  App.jsx          routes
  components/      layout, viewers (Word, slides, PDF), reading tools
  pages/           one file per screen
  lib/             API calls, session, formatting, helpers
  detection/       adapter that lets the vendored detection code run on a web page
public/detection/  vendored from the browser extension (do not edit)
scripts/           sync-detection.mjs
```

## Contributing and licence

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Licensed under AGPL-3.0 ([`LICENSE`](LICENSE)); third-party components are listed in [`NOTICE.md`](NOTICE.md).
