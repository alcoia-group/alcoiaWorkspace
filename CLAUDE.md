# CLAUDE.md

## Writing rule: follow `language.md`

**Every time you write text a person will read, follow `language.md` in this repo's root.** That covers UI strings, page copy, emails, error and notice text, README and docs prose, commit messages and PR descriptions. It lists the patterns that make copy sound machine-written and how to avoid them. Accuracy, accessibility, legal and safety wording still come first: do not edit legal text or pricing figures to satisfy the guide, and do not touch code identifiers, API contracts, placeholders or tests for style. This rule does not apply to the browser extension repo.


Repository context for agents. **Read fully before any task.** Update this file as parts are built;
it describes what exists, not what is intended.

## What this is

`workspace.alcoia.app` (**the workspace**, formerly `assignments.alcoia.app` / "alcoia assignments", then briefly `reader.alcoia.app`): the web app general users, students first, use. It replaces the extension's built-in PDF viewer
for instructor-assigned readings. Planned shape: a student opens `/a/<assignmentId>`, the server checks
session + class membership, the document is shown as a real web page, and the workspace runs the alcoia
extension's own detection code on it (see "Reading detection without the extension" below), so no install is
needed; with the extension installed, the extension steps back on these pages. Outcomes flow to the same `POST /api/assignments/:id/outcomes` and land in the
console. Two entry points, one assignment: a direct link / invite (no LMS), or an LTI launch.

**Why the name changed:** this is the interface every general user will use. Besides assigned readings it lets users with a Reader or Student plan **upload their own documents** (`/files`), practise in **Exam Mode** (`/exam`) and see **learner analytics** (`/analytics`); each is described in a section below. It is called the workspace, not the reader, so it is not confused with the Reader *plan*. Routes (`/a/:id`, `/assignments`, `/invite/accept`, `/lti/join`) were deliberately not renamed: the extension and sent invite links depend on them. The magic-link request sends `app: 'workspace'` (the server still accepts `'reader'` and `'assignments'`). The repository name is unchanged for now.

Holds no business logic. The server decides entitlement, membership and reporting mode. Same product
rules as the console: no leaderboards, no accuracy claims, receipts say "unaltered since issued".
`ALCOIA-PLATFORM-SPEC.md` and `SERVER-ARCHITECTURE.md` (copied from the console) must stay in this root.

**Where the workspace is headed (direction, not a commitment).** "Workspace" was chosen over "reader" because it is a place to work, not only a document viewer, so it has room to grow. **Supported today:** assigned readings, several documents and assignments per user (the assignment list), class invites and the LTI landing. **Built since: My files, Exam Mode, learner analytics. Possible later, none of it built:** notes, discussions, exercises and saved material. Each needs its own design and privacy review before it ships (anything stored per user is new account-linked data; see the server's CLAUDE.md, section 2 invariants and section 12). Keep this paragraph honest: move an item up only when it exists.

**How the workspace behaves.** A reading assigned to you opens directly in the document view (`/a/:id`). The rest of the workspace is reserved to people with the Reader or Student plan (a seat that gives the Reader plan counts): **My files** (uploading your own PDF, Word and PowerPoint files, `/files`), **Exam Mode** (`/exam`) and **learner analytics** (`/analytics`). Free accounts can open assigned readings. The server decides plan, consent and access on every call (server invariant 8); this app only shows the answer. Analytics are computed on request from the learner's own private learner memory (`knowledge_state` rows keyed to the account, switched on by default and clearable by the learner), not from a log of what was read; see the server's CLAUDE.md for the data rules and the open legal questions.

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

1. **DOCX, PPTX and PDF render in the page** through `GET /api/assignments/:id/document`, `.../document/asset` and `.../document/file`, which are on the server's main branch. Old uploads keep a stale `unsupported` status until the server corrects it on first read or `npm run documents:reconvert` is run there. Entrance animations are not built.
2. ~~Invite disclosure before joining~~ **Built:** `POST /api/invites/preview` (server) returns class name and reporting mode, and `/invite/accept?token=` (`InvitePage`, `src/lib/invites.js`) shows the matching notice before sign-in or join. It then calls accept with `acknowledged: true`. The token never goes in a URL log beyond the link itself; it is sent in the body. Sign-in from this page returns to it (`setReturnPath`/`takeReturnPath`). The extension's join screen does the same through the same preview.
3. **LTI launch landing.** Built: the server's launch redirect carries a one-use reader code for an assignment, and the marketing site's `/lti/launch` page sends a student with no extension to `/lti/join` here (`LtiJoinPage`). The page shows the reporting-mode notice and, on agreeing, calls `POST /api/lti/disclosure/ack`, then opens the assignment (or the list when the launch named none). What was received travels in the URL fragment. Needs `LTI_READER_BASE_URL` pointed here and `READER_URL` set when building alcoiaWeb. Verified in a browser with the ack call mocked; **not** against a real LMS launch.
4. **CORS.** Granted by the server for `WORKSPACE_ORIGIN` (dev default :8082; fails closed in production if unset). Set it in production.
5. **Magic link host.** The server sends `app: 'workspace'` links to this site (`'reader'` and `'assignments'` are still accepted).
6. LTI-joined seats: the acknowledgement response now carries `seatId`; an older server leaves it null.

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

See `SERVER-DESIGN.md` for the planned server, extension and reader work (the original design; most of it is built now).

## Working agreement

One item per session. Report what was verified with real output. No new runtime dependency without asking.
Commits/pushes only when the owner directs it in that session.

---

## Exam Mode (`/exam`)

`ExamPage` (`src/pages/ExamPage.jsx`, `src/lib/exam.js`), nav link "Exam Mode". Reader and Student plans only; the **server decides** everything (capability, access, questions, correctness, whether memory is used). Flow: tick one or several (up to six) of `GET /api/assignments/mine`, then `POST /api/exam/sessions` with `assignmentIds`; each question shows its source and paragraph, answer (free text or skip), feedback with a model answer, next, end any time, summary. A 403 `capability_required` shows the plan notice; 503 shows a retry message (your typed answer stays); 422 `no_examinable_material` and 404 have their own copy; a memory-off note links to the console's account-based-learning settings. No score, ranking or prediction is shown. Sessions are not resumed after a reload. **Verified:** build clean and a Playwright pass with the API mocked (start, answer, feedback, next, end, summary, upgrade state, no horizontal overflow at 375 px); not against a real server or model. No test runner exists here and none was added.


**Legal pages:** the workspace has none of its own. One set covers every alcoia app and lives on the marketing site (`alcoia.app/legal/terms`, `/privacy-policy`, `/cookies`). `LegalLinks` links to them from the sign-in and invite screens (`VITE_MARKETING_URL`, default https://alcoia.app). The "By signing in / joining you agree to" wording is legal-adjacent and awaiting owner review.


---

## My files and personal-file Exam Mode

`/files` (`FilesPage`, `src/lib/personalDocuments.js`): the user's own PDF, Word and PowerPoint files. Upload by picker or drag-and-drop (raw bytes with progress, `apiUploadWithProgress`), usage bar against the quota the server reports (250 MB to start), delete with an inline confirm. `/f/:id` (`PersonalFilePage`) shows a file with the same viewers as an assigned reading; the viewers take `asset={{ personalId }}` instead of `assignmentId` (`assetBase()` in `lib/assets.js` builds `/api/personal-documents/<id>` or `/api/assignments/<id>`). Exam Mode lists accepted files beside assigned readings and sends `personalDocumentIds` (up to six sources in all). **The server decides everything** (plan: `canUpload` / 403 `capability_required` on upload only, quota 413, ownership 404, per-file ceiling 413 `file_too_large`); a free user sees the plan notice and can still open and delete files. Practice on a personal file is not added to learning memory (memory is keyed by assignment). Personal-file pages run the workspace's own detection without an assignment (questions and explanations, no class reporting; see below). **Verified:** build and lint clean; My files page in a real browser with the API mocked (list, usage, delete confirm, no horizontal scroll at 375 px). **Not verified:** uploads or the viewers against a real server, Exam Mode with a file, the extension on `/f/:id`.

## Before you read (map and warm-up)

`BeforeYouRead` (`src/components/BeforeYouRead.jsx`, `src/lib/questionBank.js`) sits above the viewer on `/a/:id`. It shows (1) an outline built from the file's own structure (Word headings, slide titles; no AI; a PDF has none, so no outline) and (2) up to three questions from the document's question bank (server writes them once per document, `GET /api/assignments/:id/question-bank`; 202 while it is being prepared, polled up to 8 times, 2.5 s apart). Each answer is checked by the server (`POST .../question-bank/answer`); the answers never travel with the questions. **Nothing is scored, ranked or sent to the instructor, and no outcome is reported**: it is the reader's own warm-up. "Skip" is remembered per reading in `localStorage`. **Verified:** build and lint clean; in a real browser with the API mocked (outline, polling, wrong answer shows the explanation and marks right and wrong, skip). **Not verified:** a real bank from a real model; PDFs and slide decks (only a Word fixture); mobile layout.

## Core / optional marks

`lib/sectionMarks.js`, `components/MarkToggle.jsx`; `ReaderPage` loads `GET /api/assignments/:id/section-marks` and passes `marks` to the viewer. An instructor signed in with a console session sees "Mark optional" / "Optional: make core" (Word: on hover beside each top-level block; PowerPoint: toolbar, per slide; PDF: toolbar, per page) and the change is saved at once with `PUT` (shown immediately, undone with a message if the save fails). Everyone else sees optional parts dimmed and labelled "Optional" (Word, by CSS so the label is not passage text for the extension) or an "Optional" badge in the toolbar. Free on every plan; the server decides who can edit (`canEdit`). Personal files have no marks. **Verified:** build and lint, and Word in a real browser with the API mocked (teacher marks a block, student sees it, no horizontal scroll). **Not verified:** the PowerPoint and PDF toolbars in a browser, mobile layout of the Word button (it drops below the block under 900 px), a real server.

## Reading tools (highlighters, underlines, notes, pen)

`components/Annotator.jsx` wraps the viewer on `/a/:id` and `/f/:id`; `lib/annotations.js` holds the logic. Tools: Select (a menu appears on a text selection), Highlight, Underline, Wavy underline, Strike-through, six colours, Pen (three sizes), Eraser, and a "My marks" panel (jump to a mark, edit its note, delete, download all as Markdown, remove all). Works on Word (per page), PDF (per page, on pdf.js's text layer) and PowerPoint (per slide); each viewer tags what it draws with `data-anno-scope` (`d:<page>`, `f:<page>`, `s:<slide>`). **Marks live only on this device** (localStorage, `alcoia_workspace_marks_<a|f>:<id>`): never sent to the server, which is built not to hold what a person reads or notes. Text marks are anchored by quotation (scope, offsets, quote, 32 characters either side) and drawn with the CSS Custom Highlight API, so the document's DOM text is not touched and the extension reads it as before; browsers without that API (older Firefox) lose the text tools but keep the pen. A mark whose text can no longer be found is kept in the panel as "text moved". Pen strokes are stored as 0 to 1 fractions of the page, so they follow zoom. Marks do not follow a document that is replaced by a new upload. **Not built:** shapes, text boxes, syncing across devices, marks on scanned (image-only) PDFs (those do not open in the viewer at all). **Sticky notes and free notes (built).** Toolbar "Sticky note" pins a small note to the page or slide most in view (then drag it, or use the arrow keys on the focused pin, Shift for bigger steps; Enter or click opens and closes it, Escape closes). Position is stored as fractions of the scope (`x`, `y`, like pen strokes), so it follows zoom. The pin is an empty button drawn by CSS (its name is an `aria-label`), rendered inside the scope by `StickyLayer`, so no text is added to the passage text the detection code reads; the note body opens in a popup outside the document, positioned beside the pin while it is open. "Add note" (and the "Notes" part of My marks) holds free notes about the whole reading. Both live in the same localStorage entry as other marks (`stickies` and `notes` beside `items` and `strokes`, still version 1; older entries load fine), never sent to the server. They appear in My marks (sticky notes with page or slide, jump and delete; notes editable in place), "Remove all" clears them, and the Markdown download lists sticky notes under their page or slide and free notes under "Notes". Also fixed here: at 900 px and below the viewer used to be wider than a 375 px screen (Word toolbar overflow). Not built: click-to-place by tapping the page (placing is by the button, then drag), colour or text formatting in notes beyond six pin colours, notes that follow a replaced document.
**Verified** in a real browser with the API mocked: highlight from the selection menu, wavy underline and a note, panel, Markdown download, pen stroke, eraser, persistence across reload, no change to the page text, slides (jump back from the panel) and a real two-page PDF (highlight on the text layer). **Not verified:** touch devices, a real server, Safari and Firefox.

**Verified (sticky and free notes)** in headless Chromium against a production build with the API mocked, on Word (1280 and 375 px), PowerPoint and a real PDF, with the same script each time (3 runs, all passing): place, type, Done, pin has no text, scope text identical before and after, saved in localStorage, click toggles, drag moves without opening, arrow keys move, Enter and Escape, fraction unchanged and pin follows the page after zoom (Word, PDF), listed in My marks, free note added and persisted, Markdown download contains both, reload keeps them, delete, no horizontal scroll at 375 px, no page errors. Slide viewer no longer also turns the slide on the pin's arrow and Enter keys. **Not verified:** touch devices, Safari and Firefox, a screen reader, `/a/:id` versus `/f/:id` for every format (Word and PowerPoint were run as `/a/`, the PDF as `/f/`; both pages mount the same `Annotator`), the extension running on the page at the same time.

## Explain it back

`components/ExplainBack.jsx`, `lib/explainBack.js`, shown under the viewer on `/a/:id` only when `GET /api/assignments/:id/explain-back` says it is available (the document has key ideas). A textarea (40 to 3000 characters), "Check my explanation", then a list of the key ideas marked covered, partly covered or not mentioned yet, with Try again and Done; "Skip for now" hides it. The text is sent to the server for checking and is never kept anywhere (the last feedback, not the text, is kept in localStorage so a reload shows it). If the check fails (503) or is rate limited (429) the reader sees a plain message, keeps what they typed, and nothing else is blocked. Not shown for personal files (no class behind them). **Verified** in a real browser with the API mocked (short text disabled, 503 keeps the text, feedback, reload shows feedback, text not in storage, Done hides it, no horizontal scroll). **Not verified:** a real server or model.

## Explain it back remembers privately for you

With account-based learning on, the server keeps which key ideas your last explanation covered (never the text) as private learner memory. The panel shows it again after a reload or on another device (`previous` from `GET .../explain-back`), and `/analytics` has an "Explain it back" section (counts per reading, linked only where the reading is still accessible, shown even when there is no other learning state yet). Separate from the class result the instructor sees. Verified: build and lint clean; not in a browser, not against a server.

## Prove it to skip (every format)

`components/ProveSkip.jsx`, `lib/proveSkip.js`, a toolbar button in `PdfViewer`, `SlideViewer` and `DocxViewer`, on assigned readings and My files. From the place in view, a "stretch" runs forward until it holds 3 to 4 question-bank items. Answer them all right and the viewer goes to the next part. No offer when the stretch has fewer than 3 questions or nothing comes after it. Per format (the server places each item: `page`, `block`, `slide`):
- **PDF:** the stretch starts at the page in view and spans up to 6 pages; the skip lands on the page after the last question's page.
- **PowerPoint:** starts at the slide in view, up to 6 slides; lands on the slide after the last question's slide.
- **Word:** a block's place is its index through the whole document (`data-block` on each top-level block, an attribute only); the stretch starts at the block at the top of the screen (found on scroll), up to 40 blocks; lands on the next heading after the last question, or the block after it when no heading follows. This works for a Word file with no recorded page breaks (one long page).

One try per part: a miss closes the whole part on this device (`alcoia_workspace_seen_<id>`, item id -> `c` right, `w` wrong, `x` closed) and the button shows "Tried this part", disabled. **Feeds from "Before you read":** a question answered in the warm-up is remembered the same way; a right answer counts toward the part it belongs to (head start), a wrong one is never asked again and closes a part whose first question it was, and at least one question is always asked fresh, so the warm-up alone never grants a skip. Only the first answer to a question counts (a reload does not reset it). Nothing is hidden, scored, recorded or reported, and it never changes what the instructor marked core or optional. **Verified** in a real browser with the API mocked: Word (4 questions, lands on the next heading; a miss closes the part and survives a reload), slides (lands on slide 5; no offer when fewer than 3 questions remain), PDF on a real 8-page file (lands on page 4), warm-up feed (right counts and is not asked again, wrong is excluded, a miss on the first question closes the part), no page errors. **Not verified:** a real bank on real files, touch, mobile layout, how well the server's paragraph-to-block mapping holds on Word files saved by Word itself.

## Warm-up, explain it back and prove-it-to-skip on slide decks and My files

The server now builds question banks for PowerPoint (one passage per slide) and for personal files. `BeforeYouRead` and `ExplainBack` take a `personal` flag (`lib/questionBank.js` `bankBase`, `lib/explainBack.js`) and are mounted on `/f/:id` (`PersonalFilePage`); `ProveSkip` works on every personal file (`bankId = asset.assignmentId ?? asset.personalId`). On a personal file explain-it-back grades and discards (no class result, no memory). Verified: build and lint clean and a browser pass with the API mocked; not a real model or a real deck.
## Wording, receipts notice and Exam Mode early stop
Visible text says "Material(s)" instead of "Assignment(s)" (routes and API unchanged). The anonymous-class notice no longer promises a receipt exception, because the server refuses receipts for anonymous classes. Exam Mode handles two server responses added in Stage B: `422 nothing_needs_practice` on start (friendly message) and a `next` response that ends the session early with a summary (`stoppedEarly`). Verified by lint and build only; no test runner here.

## Passages you met again
`/analytics` shows `revisited` from the learner-analytics response (counts only: passages met again, hard the first time, correct since, still worth another look). Server decides plan and consent. Verified by lint and build only.

## How you tend to struggle, and ideas across readings
`/analytics` shows two more cards from the learner-analytics response: `strugglePattern` (five counts and, only when one kind clearly leads, a plain sentence; private to the learner, no score) and `concepts` (ideas that appear in more than one of the learner's readings, with passage counts and how many are worth another look). The server decides plan, consent and what is returned; empty results render nothing. Verified by lint and build only; the concept list stays empty until the server has built concept indexes.

## Learner analytics: by subject and by document
`/analytics` now shows "By subject" (each idea across all readings: encounters, understanding, recall, using it in new situations, remembering later, level and a next step) and "By document" (one reading at a time: passages answered, answered correctly with no misses, worth another look, reviews waiting, and its ideas by level). The server computes both (`subjects`, `documents` in `GET /api/account/learner-analytics`); this page only words them. "No answers yet" is never worded as a weakness; no score, ranking or comparison. Plan and consent are decided by the server as before. Checked in a real browser with the API mocked at 1100 and 375 px (no horizontal scroll); not against a deployed server.


## By subject: summary, full page, strengths and needs
`/analytics` shows only a summary of the learner's ideas (counts per level as links, the five that most need a look, and "See all N ideas"). The full list is `/analytics/subjects` (`SubjectsPage`): level filter chips (the level is kept in the URL, `?level=needs_help`), search by name, rows collapsed until opened (`SubjectRow`, a `<details>`), 20 at a time with "Show more". "By document" shows five and a "Show all" button. Each idea also carries `strongAt` and `needsWorkAt` from the server (kinds of evidence that came out positive or negative: understanding, recall, using it in new situations, remembering later). There is no "efficient" or speed reading per idea: the server keeps only the reader's usual overall reading speed (for detection), so the page never claims one. Wording lives in `src/lib/subjects.js`. **Verified** in headless Chromium with the API mocked: 18 ideas at 1100 and 375 px, filter, search, expand, no horizontal scroll. Not against a deployed server. No test runner exists here and none was added.

## Your own files: ideas
`/analytics` shows "Your own files" (`personalFiles` from the learner-analytics response): each uploaded file with the ideas the server found in it and the learner's level on each. The server builds the index asynchronously (`crossdoc:index`), so a new file has no ideas listed at first. Exam Mode on a file now feeds the learner's private concept memory (the server decides, and only with learner memory on). Verified by lint and build only.

## Connections
`components/Connections.jsx`, `lib/connections.js`, shown under the viewer on `/a/:id` (assigned readings only). It calls `GET /api/assignments/:id/cross-document-connections` and lists the other readings the server says share ideas with this one ("Also in <title>", a full-page link to `/a/<id>`, up to three shared ideas). Any non-200 (a free account gets 403), an unindexed reading or an empty list renders nothing. The server decides plan and access. Verified in a real browser with the API mocked (connection shown with its link, 403 and empty show nothing); not against a server with a real index, which needs `npm run crossdoc:index` there.


## Reading detection without the extension (October 2026)

The workspace runs the alcoia extension's own detection code on `/a/:id` (assigned readings) and `/f/:id` (the
user's own files), so a student needs no install. The extension stays for reading elsewhere. Same email, same
account, same learner data and settings everywhere. **The owner holds copyright in both this repository and the
extension (alcoia-group/alcoia); the vendored files are copied, not licensed in.**

- **Vendored, not rewritten.** `scripts/sync-detection.mjs` copies `../alcoia/alcoia/src` (`content/` except
  `content.js`, `shared/`, `styles/`, `libs/fonts/`, `libs/wordfreq/common-words.js`) into `public/detection/src/`
  with each `.js` file headed by its source path and commit; `public/detection/SOURCE.txt` records the commit. Only
  `shared/config.js` changes: the server and workspace origins are read from `self.__ALCOIA_PLATFORM__`. Do not edit
  `public/detection` by hand; change the extension and run `node scripts/sync-detection.mjs` again. Served as static
  files (about 1.6 MB, loaded only on reading pages), so the extension's own loader (`import()` of
  `src/content/host.js` and so on) works unchanged; oxlint ignores the folder (`.oxlintrc.json`).
- **Platform adapter** (`src/detection/platform.js`): the `chrome` surface the modules use, on a web page.
  `chrome.storage.local` is localStorage under `alcoia_detection_` (the key `sra_session` is virtual and reads the
  workspace session); `runtime.getURL` points at `/detection/`; `runtime.sendMessage` does the background script's
  jobs with a direct `fetch`: `apiPost`/`summarize` send the session as `Authorization: Bearer` (the server accepts a
  session on `/api/questions`, `/api/summarize`, `/api/check-answer`), `proxyFetch` passes requests through (the
  install-token request is answered locally with a placeholder; the anonymous pool status answers "off", since pool
  counters are tied to an install, not an account).
- **Boot** (`src/detection/boot.js`, `src/detection/Detection.jsx`, mounted next to the viewer): mirrors only the
  detection part of the extension's `content.js`: overlay styles, ui controller, host, orchestrator, settings,
  Escape and Alt+C. Not here: colour highlights (the workspace has its own marks), receipts, the reading map, test
  shortcuts. PDFs are read through the extension's `reader-blocks.js` (pdf.js text layer). With an assignment:
  outcomes, interventions, review due-list, learner estimates, teaching focus, exposure and kinematics are reported
  for it, as the extension does on `/a/<id>`. Without (personal file): questions, explanations and the policy profile
  only.
- **Settings follow the account.** On each reading page load the extension's `shared/account-sync.js` pulls
  `GET /api/account/settings` and `GET /api/account/reading-baseline` into the adapter's storage and sends local
  changes back. `/settings` (`SettingsPage`, `src/lib/settings.js`) edits the same eleven settings on the account
  (three of them, explain on highlight, colour highlights and document links, only apply in the extension) and has
  the account-based learning card (`/api/account/learning-memory`, on/off; deleting memory stays in the console).
- **One detector per page.** `index.html` carries `<meta name="alcoia-detection" content="workspace">`; on the
  workspace origin the extension's content script then does nothing.
- **Verified:** lint (one pre-existing warning) and build clean; headless Chromium against a production build with
  the API mocked: on `/a/:id` reading with a scroll-back made a real question card appear (the extension's own card
  and styles), `/api/questions` went out with `Authorization: Bearer` and no install token, an intervention and
  struggle outcomes were posted for the assignment; on `/f/:id` a card appeared and nothing was reported against a
  class; `/settings` saved a change with one `PUT` and has no horizontal scroll at 1280 px. **Not verified:** a real
  server or model, `vite dev` (only the built app), the extension and workspace loaded together in a real browser
  (the step-back is unit-tested in the extension), Safari and Firefox, touch devices.

### Detection re-sync, 22 October 2026

`public/detection` was re-synced from the extension at commit `b2cf58dc7287`, and `scripts/sync-detection.mjs` now also copies the five word lists `libs/wordfreq/common-words-{fr,es,de,pt,it}.js` (CC BY-SA 4.0, see the extension's `docs/NOTICE.md`; the owner has to confirm that is acceptable). What the page now does differently, all inside the vendored code and none of it sent to the server: expected paragraph time is a continuous per-reader model instead of grade steps; a reader who moves a screen at a time is timed per screen; one slow paragraph is held until a genuine re-read or a second slow paragraph follows (a self-report, a backtrack and a lone confirmed re-read are unchanged); scheduled quick checks on assigned readings ask about a random earlier paragraph. The files `shared/sensitive-sites.js` and `shared/site-access.js` are copied along (extension-only code, never loaded on the workspace).

**One bug fixed here:** `installPlatform` (`src/detection/platform.js`) used `Object.defineProperty(globalThis, 'chrome', ...)`. Chrome defines `window.chrome` as writable but not configurable, so on a real Chrome build that threw and detection never started (the headless shell used before has no `window.chrome`). It now falls back to plain assignment (`setChrome`).

**Verified:** lint (one pre-existing warning) and build clean; Chromium (full build, not the headless shell) against `vite preview` of the built app with the API mocked: detection starts, the session goes out as `Authorization: Bearer`, steady reading down a 40-paragraph Word page produced a question card and an intervention report. The same check against the previous extension copy gave the same result. **Not verified:** a real server or model, Safari or Firefox, touch devices, the screen-mode and two-evidence behaviour in a real browser (they are unit-tested in the extension repo only).

## Scroll recording
Built and then removed by owner decision (not wanted). Nothing of it remains: no recorder, no chip, no settings section, no listeners and no `alcoia_scroll_recording` key.

## Responsive layout, phones to desktop (October 2026)
Every page and viewer is built to fit from 320 px wide up with no horizontal page scroll; wide things scroll inside their own box (Word tables, the PDF stage when zoomed, the slide strip). `src/index.css` end block holds the rules; `--vh` is `100svh` (100vh where unsupported) so the iOS address bar does not cut fixed or full-height areas; `viewport-fit=cover` plus `env(safe-area-inset-*)` keep bars and the slideshow clear of the notch and home indicator; fullscreen uses `dvh` where available. Touch screens (`pointer: coarse`) get 44 px minimum targets (buttons, links standing alone in rows, swatches, radios and checkboxes through their labels).
- **Word:** the page frame is `width: min(816px*zoom, 100%)`, padding shrinks with the screen, text reflows, images are `max-width: 100%`, a table is its own scrolling box, long words and URLs wrap.
- **PDF:** fit to width at 100% (recomputed on resize and rotation by a ResizeObserver); zoom steps still work and the stage scrolls sideways inside itself. **PowerPoint:** the slide scales to the stage at the file's aspect ratio.
- **Phones (under 600 px wide and touch, or touch and under 500 px tall in landscape; one media query in `src/lib/useEditingTools.js`, no user-agent test):** the whole reading-tools bar (highlighters, underline, pen, eraser, sticky notes, free notes, My marks), the instructor's core/optional switch, and the slide and page thumbnail strip are not shown, and the zoom percentage is hidden; stored marks are still drawn (highlights and pen strokes, read only) and sticky pins are not drawn because opening one is editing. Reasons: the bar took a third of a small screen, drag and pen conflict with scrolling, and marking optional is an instructor's desk task. Tablets (600 px and up, iPad both ways) and desktops keep everything. "Prove it to skip" stays and opens as a bottom sheet under 800 px; Previous/Next, swipe and the page number remain.
- The viewer toolbar now sticks below the tools bar (`--anno-h`, measured) instead of under it.
- Custom Highlight API: `highlightsSupported()` guards every use, and drawing marks is wrapped in try/catch so a partial implementation cannot break reading. Safari before 17.2 simply lacks the text tools and the pen still works.
**Verified:** lint and build clean; Playwright Chromium (full build, API mocked, vite preview) at 320x640, 390x844 (touch, mobile), 768x1024, 1024x768 (touch) and 1280x800 on sign-in, materials, analytics, subjects, exam, files, settings, invite, LTI join, and Word, PowerPoint and PDF viewers for both assignments and personal files: `scrollWidth <= innerWidth` everywhere (85 checks, including the Prove it to skip sheet inside the viewport and full screen), no touch target under 44 px, tools hidden at 320 and 390 and shown at 768 and up, screenshots looked at (phone Word, PDF, slides; tablet slides, PDF). **Not verified:** WebKit/Safari (no WebKit build in /opt/pw-browsers; only Chromium), real devices, landscape phones, the iOS address-bar behaviour, the Fullscreen API on iPhone (the in-window fallback is unchanged), pinch zoom, marks drawn read-only on a phone against real stored marks, sign-in screens signed out in dark mode. Safari risks checked in code only: `100vh` (replaced by the `--vh` fallback), fixed bars and `env()` insets, `touch-action` on drag handles (sticky pins `none`, slide stage `pan-y pinch-zoom`), the missing Fullscreen API.
