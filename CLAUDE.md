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
theme only for now). Dev port 8081 (8080 is the console's). Session: `localStorage` Bearer token,
`console` kind only (`src/lib/session.js`).

## What exists

- `/sign-in` magic link (`kind: 'console'`), `/auth-verify` confirm-then-verify (token path only).
- `/assignments` from `GET /api/assignments/mine`.
- `/a/:assignmentId` shows the assignment and a **download** button (`GET /api/documents/:id/download-url`).
  In-page reading is NOT built.
- `/invite/accept` is a deliberate stub, does not call accept.

## Known gaps (all need `alcoiaServer` work; none are fixable here without inventing a contract)

1. **No HTML rendering of documents.** The only document read is a signed download URL served as an
   attachment. No PDF/PPTX conversion exists; DOCX extraction only sets `documents.status` and discards
   the text. The reader needs a server endpoint returning sanitised, paragraph-structured HTML, gated by
   session + seat (same check as `download-url`).
2. **Invite disclosure can't be shown before joining.** `POST /api/invites/accept` returns only
   `{ classId, seatId, role }`; the class and roster reads are staff-only. A student must be told the
   reporting mode before joining. Needs an invite-preview read (token in, class name + reportingMode out).
3. **LTI redirect carries no session.** `buildRedirectUrl` in `lti.js` sets only `classId`/`assignmentId`;
   `ltiReaderBaseUrl` defaults to a console `.invalid` URL. Landing here from the ack/launch leaves the
   student signed out. Needs a handoff like `/launch/exchange`, and `LTI_READER_BASE_URL` pointed here.
4. **CORS.** `CONSOLE_ORIGIN`/`WEB_APP_ORIGIN` don't include this origin; every call from a browser is
   blocked until the auth routes, `assignments/mine`, `download-url`, `invites/accept` allow it.
5. **Magic link host.** `kind=console` links point at `CONSOLE_ORIGIN/auth-verify`, so a student's emailed
   link opens the console. Needs a per-origin verify base (or a new kind).
6. LTI-joined seats have `seatId: null` in the extension (ack response omits it); not this repo.

## Design

See `SERVER-DESIGN.md` for the planned server, extension and reader work (design only, unbuilt).

## Working agreement

One item per session. Report what was verified with real output. No new runtime dependency without asking.
Commits/pushes only when the owner directs it in that session.
