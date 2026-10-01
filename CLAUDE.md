# CLAUDE.md

Repository context for agents. **Read fully before any task.** Update this file as parts are built;
it describes what exists, not what is intended.

## What this is

`assignments.alcoia.app`: the student-facing web app that replaces the extension's built-in PDF viewer
for instructor-assigned readings. Planned shape: a student opens `/a/<assignmentId>`, the server checks
session + class membership, the document is shown as a real web page, and the alcoia extension runs on
it like on any article. Outcomes flow to the same `POST /api/assignments/:id/outcomes` and land in the
console. Two entry points, one assignment: a direct link / invite (no LMS), or an LTI launch.

Holds no business logic. The server decides entitlement, membership and reporting mode. Same product
rules as the console: no leaderboards, no accuracy claims, receipts say "unaltered since issued".
`ALCOIA-PLATFORM-SPEC.md` and `SERVER-ARCHITECTURE.md` (copied from the console) must stay in this root.

## Stack

React + Vite, plain JS, `react-router-dom`, no UI kit. Tokens/fonts copied from alcoiaConsole (light
theme only for now). Dev port 8082 (8080 console, 8081 marketing default). Session: `localStorage` Bearer token,
`console` kind only (`src/lib/session.js`).

## What exists

- `/sign-in` magic link (`kind: 'console'`), `/auth-verify` confirm-then-verify (token path only).
- `/assignments` from `GET /api/assignments/mine`.
- `/a/:assignmentId`: **Word documents render in the page** (`DocxViewer`): page frames on a neutral
  ground, headings, bold/italic/underline, links (http/https/mailto only), bullet and numbered lists,
  tables, a toolbar with "Page n of N", zoom and download. Real `<h*>/<p>/<ul>/<table>` DOM, so the extension
  can read it. Anything the server cannot render yet (a scanned PDF with no text, a failed conversion, or a pending
  server deploy) shows the assignment with a plain "can't be shown in the page yet" and a download button.
  Pictures show a labelled placeholder (bytes not served yet).
- **PowerPoint decks render as a slide deck** (`SlideViewer`): the file's own aspect ratio, positioned text boxes
  with the file's text sizes (scaled with the slide), colours, fonts and bullets, tables, pictures, a slide list,
  Previous/Next, arrow/PageUp/PageDown/Space/Enter/Home/End/F keys, swipe, and the file's own **slide
  transitions**. Nothing about transitions is hard coded: the server reports the file's transition name and
  options (and the file's own fallback); `src/lib/transitions.js` draws the names it knows (fade incl. through
  black, push, wipe, split, cover, pull, zoom, circle, diamond, cut). A name it does not know uses the file's
  fallback if that is known, else the slide changes instantly and a note says so; never a look-alike. A
  transition belongs to the slide being entered; going back plays the leaving slide's transition in reverse;
  reduced-motion skips them. The slide list shows **real miniature previews** (text painted by CSS from a data
  attribute, so it is not duplicated DOM text for the extension).
- **Full screen** (`lib/fullscreen.js`) works in every viewer. It fullscreens the whole page (`<html>`), not one
  element, so the extension's own UI stays visible; where the Fullscreen API is missing (iPhone Safari) the same
  layout fills the window. PowerPoint becomes a slideshow on black (largest slide that fits, click / right third
  advances, left third goes back, controls fade when the pointer is still); Word and PDF fill the screen with
  the same fading toolbar.
- **PDFs display as PDFs** (`PdfViewer`): the original file is fetched with the session header
  (`GET .../document/file`) and drawn by pdf.js (the **legacy** build, on purpose: the standard one needs very
  recent browser features) as a canvas with pdf.js's transparent `.textLayer` on top, so the words are real DOM
  text for the extension. Pages draw only near the screen; page thumbnails, zoom, "Page n of N", download,
  full screen. pdf.js loads only for a PDF (code-split).
  Slides that advance by timer do so. Text is real `<p>`, bullet glyphs come from CSS (not part of the text).
  Not shown: entrance/emphasis animations, charts, SmartArt, video (labelled placeholders).
- Pictures inside Word and PowerPoint files load through an authenticated fetch (`lib/assets.js`), because an
  `<img src>` cannot send the session header; shown as blob URLs, with a labelled placeholder on failure.
- An ended session (401) clears itself and sends the student to sign in, then back to the same assignment.
- `/invite/accept` is a deliberate stub, does not call accept.
- **Extension handoff:** `/a/:assignmentId#c=<code>` exchanges the code once (`POST /api/reader/exchange`),
  signs the student in with a `reader` session and strips the fragment, no sign-in screen. A bad, used or
  expired code, or no code at all, falls back to the sign-in page. `ReaderGate`, `src/lib/handoff.js`.
- Sign-in requests the link with `app: 'assignments'` so the emailed link opens this site.
- Verified with the API mocked in a real browser, not against `alcoiaServer` (branch
  `claude/reader-handoff-session` there, unmerged) and not against the extension (the popup does not
  request a handoff yet).

## Look and feel

Deliberately plain, like a course site students already know: a dark slate top bar (name left, avatar,
email and Sign out right), white content on light grey, a breadcrumb row on the reader ("Assignments /
class", due date on the right), and the assignment list as an ordinary table (Name, Type, Due, with a
"Due soon" tag inside 48 hours). Sans-serif UI, small 3 px corners, flat borders, one accent colour (the brand
lilac, deepened) for primary buttons and links. No serif headings, tinted cards or decorative copy in the
chrome; Word pages keep a serif because that is how a Word page looks. Plain wording ("Sign in", "Assignments
could not be loaded"), no em dashes. Dates are written the way a course page does ("Dec 4, 2026 at 11:59 PM"),
helpers in `src/lib/format.js`.

**Logo:** `src/components/Logo.jsx` uses the cream-tile wordmark (`src/assets/img/alcoia-logo.png`, copied from
alcoiaConsole's `alcoia-wordmark-cream.png`) in the top bar and above the sign-in box. It is the variant on purpose:
the tile carries its own cream ground, so it stays visible on the dark bar, the grey page and white boxes. The
plain wordmark has black letters on a transparent ground and disappears on the dark bar; the white-letters one
disappears on light grounds. Other repos hold several variants, so do not swap this one without checking both.

## Known gaps (all need `alcoiaServer` work; none are fixable here without inventing a contract)

1. **DOCX, PPTX and PDF render in the page, but need the server branches deployed.** `GET
   /api/assignments/:id/document`, `.../document/asset` and `.../document/file` (server branches
   `claude/document-content-docx`, `...-pptx`, `claude/pdf-and-status-fixes`, stacked on
   `claude/reader-handoff-session`, unmerged). Old uploads keep a stale `unsupported` status until the server
   corrects it on first read or `npm run documents:reconvert` is run there. Entrance animations are not built.
2. **Invite disclosure can't be shown before joining.** `POST /api/invites/accept` returns only
   `{ classId, seatId, role }`; the class and roster reads are staff-only. A student must be told the
   reporting mode before joining. Needs an invite-preview read (token in, class name + reportingMode out).
3. **LTI redirect carries no session** (the extension handoff above is separate and built; this is LTI only). `buildRedirectUrl` in `lti.js` sets only `classId`/`assignmentId`;
   `ltiReaderBaseUrl` defaults to a console `.invalid` URL. Landing here from the ack/launch leaves the
   student signed out. Needs a handoff like `/launch/exchange`, and `LTI_READER_BASE_URL` pointed here.
4. **CORS.** Built in `alcoiaServer` branch `claude/reader-handoff-session` (`READER_ORIGIN`, dev :8082);
   not live until merged, deployed and `READER_ORIGIN` is set in production.
5. **Magic link host.** Built in the same server branch (`app: 'assignments'`); same merge/deploy caveat.
6. LTI-joined seats have `seatId: null` in the extension (ack response omits it); not this repo.

## Deploying (Cloudflare)

Build variable `VITE_API_BASE_URL=https://server.alcoia.app` (baked in at build time, like the console's).
`public/_redirects` (`/* /index.html 200`) makes deep links such as `/a/<id>` and `/auth-verify` load the app;
without it a direct visit or reload 404s. The server needs `READER_ORIGIN=https://assignments.alcoia.app`.
Reader sessions expire after a fixed time (placeholder 8 h from creation, not extended by use). A page that
is already loaded keeps working, because the extension reports outcomes with its own longer session, but a
reload after expiry goes through sign-in.

## Branches

`main` is the default and merged by the owner via PRs. Agents work on `claude/*` branches only, never on `main`.

## Design

See `SERVER-DESIGN.md` for the planned server, extension and reader work (design only, unbuilt).

## Working agreement

One item per session. Report what was verified with real output. No new runtime dependency without asking.
Commits/pushes only when the owner directs it in that session.
