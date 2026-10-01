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
  can read it. Anything the server cannot render yet (PDF, PowerPoint, a failed conversion, or a pending
  server deploy) shows the assignment with a plain "can't be shown in the page yet" and a download button.
  Pictures show a labelled placeholder (bytes not served yet).
- An ended session (401) clears itself and sends the student to sign in, then back to the same assignment.
- `/invite/accept` is a deliberate stub, does not call accept.
- **Extension handoff:** `/a/:assignmentId#c=<code>` exchanges the code once (`POST /api/reader/exchange`),
  signs the student in with a `reader` session and strips the fragment, no sign-in screen. A bad, used or
  expired code, or no code at all, falls back to the sign-in page. `ReaderGate`, `src/lib/handoff.js`.
- Sign-in requests the link with `app: 'assignments'` so the emailed link opens this site.
- Verified with the API mocked in a real browser, not against `alcoiaServer` (branch
  `claude/reader-handoff-session` there, unmerged) and not against the extension (the popup does not
  request a handoff yet).

## Known gaps (all need `alcoiaServer` work; none are fixable here without inventing a contract)

1. **Only DOCX renders in the page.** `GET /api/assignments/:id/document` (server branch
   `claude/document-content-docx`, unmerged, stacked on `claude/reader-handoff-session`) returns a structured
   model, not HTML, and renders for DOCX only. **PPTX** (slide stage with transitions) and **PDF** (pdf.js,
   `pdfjs-dist` approved) are the next items; until then they fall back to download. Pictures inside
   Word files are not served yet.
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
