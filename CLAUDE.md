# CLAUDE.md

Repository context for agents. **Read fully before any task.** Update this file as parts are built;
it describes what exists, not what is intended.

## What this is

`workspace.alcoia.app` (**the workspace**, formerly `assignments.alcoia.app` / "alcoia assignments", then briefly `reader.alcoia.app`): the web app general users, students first, use. It replaces the extension's built-in PDF viewer
for instructor-assigned readings. Planned shape: a student opens `/a/<assignmentId>`, the server checks
session + class membership, the document is shown as a real web page, and the alcoia extension runs on
it like on any article. Outcomes flow to the same `POST /api/assignments/:id/outcomes` and land in the
console. Two entry points, one assignment: a direct link / invite (no LMS), or an LTI launch.

**Why the name changed:** this is the interface every general user will use. Besides assigned readings it is meant to let users with a Reader or Student plan **upload their own documents**, and to show **reading analytics** (a Reader/Student plan feature). **Neither is built**; today it shows assigned documents, the assignment list, invites and the LTI landing. It is called the workspace, not the reader, so it is not confused with the Reader *plan*. Routes (`/a/:id`, `/assignments`, `/invite/accept`, `/lti/join`) were deliberately not renamed: the extension and sent invite links depend on them. The magic-link request sends `app: 'workspace'` (the server still accepts `'reader'` and `'assignments'`). The repository name is unchanged for now.

Holds no business logic. The server decides entitlement, membership and reporting mode. Same product
rules as the console: no leaderboards, no accuracy claims, receipts say "unaltered since issued".
`ALCOIA-PLATFORM-SPEC.md` and `SERVER-ARCHITECTURE.md` (copied from the console) must stay in this root.

**Where the workspace is headed (direction, not a commitment).** "Workspace" was chosen over "reader" because it is a place to work, not only a document viewer, so it has room to grow. **Supported today:** assigned readings, several documents and assignments per user (the assignment list), class invites and the LTI landing. **Possible later, none of it built:** notes, a user's own uploaded documents (Reader and Student plans only), reading analytics (Reader and Student plans), discussions, exercises and saved material. Each needs its own design and privacy review before it ships (anything stored per user is new account-linked data; see the server's CLAUDE.md, section 2 invariants and section 12). Keep this paragraph honest: move an item up only when it exists.

**How the workspace behaves (decided, mostly unbuilt).** A reading assigned to you opens directly in the document view (`/a/:id`, built).
Opening the workspace itself (its home) is meant to offer more, **reserved to people with the Reader or Student plan (a seat that
gives the Reader plan counts):** uploading your own documents, and **reading analytics, always available there**. Free accounts
can open assigned readings but not uploads or analytics. The server decides this, never the app (server invariant 8): it will
return the capability in `GET /api/entitlements` `features[]`. **Nothing of this exists yet.** The pricing page already lists both, with
the FAQ saying they are not available yet. **Privacy objection to settle in the audit, not assume away:** reading analytics about a person
need a record of what that person read, which the server must not hold (server invariant 1). They have to be computed on the device from
local history (the extension already keeps it locally) or from the bounded, assignment-scoped data the server already has; a new
per-person reading-history table is not allowed without the owner changing that invariant.

## Stack

React + Vite, plain JS, `react-router-dom`, no UI kit. Tokens/fonts copied from alcoiaConsole (light
theme only for now). Dev port 8082 (8080 console, 8081 marketing default). Session: `localStorage` Bearer token,
`console` kind only (`src/lib/session.js`).

## What exists

- `/sign-in` magic link (`kind: 'console'`), `/auth-verify` confirm-then-verify (token path only).
- `/assignments` from `GET /api/assignments/mine`. An assignment's optional `name` (set in the console) is shown, with the class name beneath; without one the class name is used.
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
- `/analytics` **Learner analytics** (paid, Reader and Student plans): the learner's private learning-state summary from `GET /api/account/learner-analytics` (knowledge overview, reviews due, areas needing work, progress, recent learning). The server decides plan and learning-memory consent; this page only renders the answer: `capability_required` shows a plans notice, `learner_memory_consent_required` (the learner turned memory off) shows a message linking to the console's account-based-learning settings; learning memory is on by default for every account (`VITE_CONSOLE_URL`; the Workspace has no settings page of its own, so the learner signs in there separately), an empty result shows a neutral state. Links go to `/a/<id>` only for assignments the server marks accessible. Nothing about time spent or other learners. Verified in a real browser with the API mocked at 1280, 768 and 375 px (no horizontal scroll), not against a deployed server. The top bar now wraps and hides the email under 560 px (it overflowed before).
- `/lti/join#p=...|#s=...`: finish an LMS launch without the extension (see known gap 3).
- `/invite/accept?token=`: invite page. Previews the class, shows the reporting-mode notice (anonymous or identified wording), asks the student to sign in if needed, then accepts with `acknowledged: true` and goes to their assignments. The console's invite links point here (`VITE_ASSIGNMENTS_URL`).
- **Extension handoff:** `/a/:assignmentId#c=<code>` exchanges the code once (`POST /api/reader/exchange`),
  signs the student in with a `reader` session and strips the fragment, no sign-in screen. A bad, used or
  expired code, or no code at all, falls back to the sign-in page. `ReaderGate`, `src/lib/handoff.js`.
- Sign-in requests the link with `app: 'assignments'` so the emailed link opens this site.
- **Reader pages are full page loads.** Assignment links use `reloadDocument`: the alcoia content script decides
  the assignment (for outcome reporting) once, from the URL `/a/<id>`, when the page loads, so an in-app route
  change would leave it with the wrong or no assignment.
- The extension popup (branch `claude/web-reader-handoff` in alcoia-group/alcoia) now requests the handoff and
  opens this site for PDF, PowerPoint and Word documents; its content script reports outcomes from `/a/<id>`
  pages and feeds PDF text layers to the paragraph tracker.
- Verified with the API mocked in a real browser, not against `alcoiaServer` (branches there unmerged) and not
  in a real browser with the built extension loaded.

## Look and feel

Deliberately plain, like a course site students already know: a dark slate top bar (name left, avatar,
email and Sign out right), white content on light grey, a breadcrumb row on the reader ("Assignments /
class", due date on the right), and the assignment list as an ordinary table (Name, Type, Due, with a
"Due soon" tag inside 48 hours). Sans-serif UI, small 3 px corners, flat borders, one accent colour (the brand
lilac, deepened) for primary buttons and links. No serif headings, tinted cards or decorative copy in the
chrome; Word pages keep a serif because that is how a Word page looks. Plain wording ("Sign in", "Assignments
could not be loaded"), no em dashes. Dates are written the way a course page does ("Dec 4, 2026 at 11:59 PM"),
helpers in `src/lib/format.js`.

**Logo:** `src/components/Logo.jsx`. Two transparent-ground files copied from alcoiaConsole
(`alcoia-wordmark.png` as `alcoia-logo-dark-letters.png`, `alcoia-wordmark-white-letters.png` as
`alcoia-logo-white-letters.png`). The top bar is always dark, so it uses the white-letters one (`onDark`). The
sign-in screens use `adaptive`: black letters in the light scheme, white letters in the dark one, switched by
`prefers-color-scheme`; those screens also get dark colours in the dark scheme so the logo is never on a
clashing ground. The rest of the app is light only. Other repos hold more variants (a cream tile, a lilac mark);
do not swap one in without checking it on both grounds.

## Plans

Pilot (free) has no LMS integration and no teaching recommendations; Teams and Institution have both. The server
enforces it (LTI registration refused for Pilot; the aggregate view returns no recommendation text for Pilot and
says so in `teachingRecommendations`). This app never decides entitlement. Full detail in `README.md`.

## Known gaps (all need `alcoiaServer` work; none are fixable here without inventing a contract)

1. **DOCX, PPTX and PDF render in the page, but need the server branches deployed.** `GET
   /api/assignments/:id/document`, `.../document/asset` and `.../document/file` (server branches
   `claude/document-content-docx`, `...-pptx`, `claude/pdf-and-status-fixes`, stacked on
   `claude/reader-handoff-session`, unmerged). Old uploads keep a stale `unsupported` status until the server
   corrects it on first read or `npm run documents:reconvert` is run there. Entrance animations are not built.
2. ~~Invite disclosure before joining~~ **Built:** `POST /api/invites/preview` (server) returns class name and reporting mode, and `/invite/accept?token=` (`InvitePage`, `src/lib/invites.js`) shows the matching notice before sign-in or join. It then calls accept with `acknowledged: true`. The token never goes in a URL log beyond the link itself; it is sent in the body. Sign-in from this page returns to it (`setReturnPath`/`takeReturnPath`). The extension's join screen does the same through the same preview.
3. **LTI launch landing.** Built: the server's launch redirect carries a one-use reader code for an assignment, and the marketing site's `/lti/launch` page sends a student with no extension to `/lti/join` here (`LtiJoinPage`). The page shows the reporting-mode notice and, on agreeing, calls `POST /api/lti/disclosure/ack`, then opens the assignment (or the list when the launch named none). What was received travels in the URL fragment. Needs `LTI_READER_BASE_URL` pointed here and `READER_URL` set when building alcoiaWeb. Verified in a browser with the ack call mocked; **not** against a real LMS launch.
4. **CORS.** Built in `alcoiaServer` branch `claude/reader-handoff-session` (`READER_ORIGIN`, dev :8082);
   not live until merged, deployed and `READER_ORIGIN` is set in production.
5. **Magic link host.** Built in the same server branch (`app: 'assignments'`); same merge/deploy caveat.
6. LTI-joined seats have `seatId: null` in the extension (ack response omits it); not this repo.

## Deploying (Cloudflare)

Build variable `VITE_API_BASE_URL=https://server.alcoia.app` (baked in at build time, like the console's).
Deep links such as `/a/<id>` and `/auth-verify` load the app through `wrangler.jsonc` (`assets.not_found_handling: single-page-application`), deployed with `npx wrangler deploy`. A `public/_redirects` file with `/* /index.html 200` must NOT exist: Workers assets rejects it as an infinite loop (error 100324) and the deploy fails. The server needs `READER_ORIGIN=https://workspace.alcoia.app`.
Reader sessions slide while the student is active: the server extends one on use (8 h idle window, 7 day cap,
placeholders), and `src/lib/keepalive.js` pings `POST /api/reader/keepalive` every 5 minutes while the tab is
visible and something was touched in the last 10 minutes. An idle tab still ends after the idle window; a reload
after that goes through sign-in. (Sessions from an emailed link are `console` kind and do not slide.)

## Branches

`main` is the default and merged by the owner via PRs. Agents work on `claude/*` branches only, never on `main`.

## Design

See `SERVER-DESIGN.md` for the planned server, extension and reader work (design only, unbuilt).

## Working agreement

One item per session. Report what was verified with real output. No new runtime dependency without asking.
Commits/pushes only when the owner directs it in that session.

---

## Exam Mode (`/exam`)

`ExamPage` (`src/pages/ExamPage.jsx`, `src/lib/exam.js`), nav link "Exam Mode". Reader and Student plans only; the **server decides** everything (capability, access, questions, correctness, whether memory is used). Flow: tick one or several (up to six) of `GET /api/assignments/mine`, then `POST /api/exam/sessions` with `assignmentIds`; each question shows its source and paragraph, answer (free text or skip), feedback with a model answer, next, end any time, summary. A 403 `capability_required` shows the plan notice; 503 shows a retry message (your typed answer stays); 422 `no_examinable_material` and 404 have their own copy; a memory-off note links to the console's account-based-learning settings. No score, ranking or prediction is shown. Sessions are not resumed after a reload. **Verified:** build clean and a Playwright pass with the API mocked (start, answer, feedback, next, end, summary, upgrade state, no horizontal overflow at 375 px); not against a real server or model. No test runner exists here and none was added.


**Legal pages:** the workspace has none of its own. One set covers every alcoia app and lives on the marketing site (`alcoia.app/legal/terms`, `/privacy-policy`, `/cookies`). `LegalLinks` links to them from the sign-in and invite screens (`VITE_MARKETING_URL`, default https://alcoia.app). The "By signing in / joining you agree to" wording is legal-adjacent and awaiting owner review.


---

## My files and personal-file Exam Mode

`/files` (`FilesPage`, `src/lib/personalDocuments.js`): the user's own PDF, Word and PowerPoint files. Upload by picker or drag-and-drop (raw bytes with progress, `apiUploadWithProgress`), usage bar against the quota the server reports (250 MB to start), delete with an inline confirm. `/f/:id` (`PersonalFilePage`) shows a file with the same viewers as an assigned reading; the viewers take `asset={{ personalId }}` instead of `assignmentId` (`assetBase()` in `lib/assets.js` builds `/api/personal-documents/<id>` or `/api/assignments/<id>`). Exam Mode lists accepted files beside assigned readings and sends `personalDocumentIds` (up to six sources in all). **The server decides everything** (plan: `canUpload` / 403 `capability_required` on upload only, quota 413, ownership 404, per-file ceiling 413 `file_too_large`); a free user sees the plan notice and can still open and delete files. Practice on a personal file is not added to learning memory (memory is keyed by assignment). Personal-file pages are ordinary pages to the alcoia extension (it only treats `/a/<id>` as a class reading, so no outcomes are reported). **Verified:** build and lint clean; My files page in a real browser with the API mocked (list, usage, delete confirm, no horizontal scroll at 375 px). **Not verified:** uploads or the viewers against a real server, Exam Mode with a file, the extension on `/f/:id`.

## Wording, receipts notice and Exam Mode early stop
Visible text says "Material(s)" instead of "Assignment(s)" (routes and API unchanged). The anonymous-class notice no longer promises a receipt exception, because the server refuses receipts for anonymous classes. Exam Mode handles two server responses added in Stage B: `422 nothing_needs_practice` on start (friendly message) and a `next` response that ends the session early with a summary (`stoppedEarly`). Verified by lint and build only; no test runner here.

## Passages you met again
`/analytics` shows `revisited` from the learner-analytics response (counts only: passages met again, hard the first time, correct since, still worth another look). Server decides plan and consent. Verified by lint and build only.
