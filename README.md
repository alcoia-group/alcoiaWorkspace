# alcoia workspace (`workspace.alcoia.app`)

The workspace: where students, and later any general user, open readings. Today that is instructor-assigned readings, the user's own files (My files), Exam Mode and learner analytics (the last three for Reader and Student plans). A student opens an assignment, the server checks who
they are and whether they belong to the class, and the document is shown as a real web page that
looks like a file reader (Word pages, PowerPoint slides with their transitions, PDF pages). The alcoia
browser extension runs on that page exactly as it runs on any article, so reading signals and
retrieval-question outcomes flow back to the instructor's console.

**Where the workspace is headed (direction, not a commitment).** "Workspace" was chosen over "reader" because it is a place to work, not only a document viewer, so it has room to grow. **Supported today:** assigned readings, several documents and assignments per user (the assignment list), class invites and the LTI landing. **Also built since this paragraph was first written:** My files, Exam Mode and learner analytics (Reader and Student plans). **Possible later, none of it built:** notes, discussions, exercises and saved material. Each needs its own design and privacy review before it ships (anything stored per user is new account-linked data; see the server's CLAUDE.md, section 2 invariants and section 12). Keep this paragraph honest: move an item up only when it exists.

**Reading detection runs here too.** On assigned readings and your own files the workspace runs the same detection code as the browser extension, copied into `public/detection` by `scripts/sync-detection.mjs` (never edited by hand), so students need no install. Questions and explanations go to the server with the student's session, and settings and usual reading speed follow the account. On these pages the extension steps back, so there is one detector per page. Not carried over: colour highlights, receipts and the reading map (the workspace has its own marks). Phones are not tuned yet: scrolling on a touch screen differs from a laptop, and that is on the roadmap as exploration, not built.

**How the workspace behaves.** A reading assigned to you opens directly in the document view (`/a/:id`). The rest of the workspace is reserved to people with the Reader or Student plan (a seat that gives the Reader plan counts): **My files** (uploading your own PDF, Word and PowerPoint files, `/files`), **Exam Mode** (`/exam`) and **learner analytics** (`/analytics`). Free accounts can open assigned readings. The server decides plan, consent and access on every call (server invariant 8); this app only shows the answer. Analytics are computed on request from the learner's own private learner memory (`knowledge_state` rows keyed to the account, switched on by default and clearable by the learner), not from a log of what was read; see the server's CLAUDE.md for the data rules and the open legal questions.

This file explains what the app is for, how it works, what it connects to, what is built, what is not,
and the decisions behind it. `CLAUDE.md` is the shorter, agent-facing "what exists" file and
`SERVER-DESIGN.md` is the original design. If they disagree with this file, `CLAUDE.md` describes
the code as it is.

---

## 1. Why it exists

Before this app, an assigned reading went from the instructor's upload straight into the extension's
own sandboxed PDF viewer. That has limits:

- alcoia works best on **live web content**: scroll events, reading time and paragraph boundaries are
  cleaner on a real page than inside a PDF viewer, and the aggregate data is richer.
- **PowerPoint and Word could not be shown at all.** Students got a "download instead" button, which
  defeats the purpose of an assigned reading.
- A document hosted as a web page gets a proper URL per assignment, and a student on a phone can read
  without the extension (retrieval and review stay extension-only until a mobile app exists).

So assigned readings moved to the web. The extension's own PDF viewer stays for **personal documents
a reader opens themselves**; the assignment reader lives here.

## 2. The two entry points, one assignment

| Entry | Who | How it arrives |
|---|---|---|
| **Direct link / invite / extension** | Instructors without an LMS, or students outside one | The student opens `workspace.alcoia.app/a/<assignmentId>`, via the extension popup (signed in automatically), a shared link, or an invite code. |
| **LTI launch** | Instructors who use Canvas, Moodle, Blackboard (LTI 1.3) | The student clicks the reading inside the LMS; the server validates the launch and lands them on the same page. |

Either way it is the **same assignment record, the same outcomes endpoint and the same console view**.
The console has no concept of how a student arrived; it only sees outcomes against an assignment.
The LMS is the door students walk through; the console is where the data lives.

## 3. Rules the app has to satisfy

1. From the extension, an assignment opens **already signed in**, with no sign-in click-through.
2. With nothing (no extension, no code), the app keeps its default: the sign-in page.
3. An assignment is visible only to an account holding an active seat in its class (or an instructor who
   manages it), or someone who joined with a valid invite code. **A guessed URL reveals nothing**, not
   even that the assignment exists: a non-member, a nonexistent id and a malformed id all get the
   identical 404.
4. The reader is a **normal web page** (real DOM text, real paragraphs) so the extension works on it
   unmodified, yet it **looks like a file reader** for each format.
5. Both entry points feed the same assignment and console.
6. The app holds **no business logic**. The server decides membership, entitlement and reporting mode.
   Product rules match the console: no leaderboards, no rankings, no class average presented as a
   grade, no accuracy claims, receipts say "unaltered since issued".

## 4. How it works

### 4.1 Sign-in and sessions

- **Sign-in page** (`/sign-in`): email in, magic link out (`kind: 'console'`, `app: 'workspace'` so the
  emailed link opens this site). `/auth-verify` shows a confirm button and only verifies on click, so a
  mail client's link prescan cannot burn the single-use token.
- **Extension handoff** (the no-click-through path): the popup calls
  `POST /api/assignments/:id/reader-handoff` with its own extension session. The server checks the seat
  and mints a single-use code (60 s). The popup opens `/a/<id>#c=<code>`; the code is in the URL
  **fragment** so it never reaches a server log or `Referer`. This app trades it once at
  `POST /api/reader/exchange` for a `reader` session and strips the fragment. Every failure (unknown,
  used, expired, wrong assignment, seat since released) is one `401 invalid_code`. A bad or missing code
  falls back to the sign-in page.
- **`reader` session kind**: scoped to reading, rejected by every console route, so the web page never holds
  the extension's 90-day credential.
- **Sliding sessions**: a reader session lasts 8 hours of idle time and slides while the student is
  active (hard cap 7 days from creation). A page that is only being read makes few requests, so
  `src/lib/keepalive.js` pings `POST /api/reader/keepalive` every 5 minutes while the tab is visible and
  something was touched in the last 10 minutes. An idle tab still ends; a reload then goes through sign-in.
  A 401 mid-session clears the session and sends the student to sign in, then back to the same assignment.
  (Sessions from an emailed link are `console` kind and do not slide.) The numbers are approved placeholders.
- **Invite code**: "a code is generated by an assignment session, a fallback if the link does not work
  for someone" is built as the **existing invite token**. Using it creates a seat after the
  reporting-mode disclosure. No new credential type: outcomes, the pseudonym and the disclosure all need
  a seat, so a seatless read-only code would produce a reader whose reading cannot be recorded and who
  was never told the reporting mode. `/invite/accept` is built: it previews the class and its reporting mode, then joins with `acknowledged: true`.

### 4.2 Showing each document type

The server converts documents to **structured JSON models, never HTML**. The app renders them through
React, so nothing an instructor typed can become markup. Conversion happens on first read and is cached
next to the original in object storage; it is deleted with the document.

- **Word (`DocxViewer`)**: page frames on a neutral ground, headings, bold/italic/underline/strike,
  links (http/https/mailto only), bullet and numbered lists with nesting, tables with column spans,
  tracked insertions, "Page n of N", zoom, download. Real `<h*>/<p>/<ul>/<table>` DOM. Not carried:
  headers/footers, footnotes, text boxes, comments, charts, SmartArt, shapes.
- **PowerPoint (`SlideViewer`)**: the file's own aspect ratio; positioned text boxes with the file's sizes
  (scaled with the slide), colours, fonts, bullets, tables, pictures; slide list with **real
  miniature previews**; previous/next, arrow/PageUp/PageDown/Space/Enter/Home/End/F keys and swipe;
  full-screen slideshow. Layout and master inheritance, theme colours, autofit and group transforms are
  resolved. Slides that advance by timer do so. Not shown: entrance/emphasis animations, charts,
  SmartArt, video (labelled placeholders).
- **Transitions come only from the file.** There are no hard-coded transitions. The server reports the
  file's transition name, every option on it (`dir`, `orient`, ...) and the file's own fallback;
  `src/lib/transitions.js` draws the names it knows (fade incl. through black, push, wipe, split, cover,
  pull, zoom, circle, diamond, cut). A name it does not know uses the file's fallback if that is known,
  otherwise the slide changes instantly and a note says so; never a look-alike. A transition belongs to
  the slide being entered; going back plays the leaving slide's transition in reverse; reduced-motion
  skips them.
- **PDF (`PdfViewer`)**: the original file is fetched with the session header and drawn by pdf.js (the
  **legacy** build, on purpose: the standard one needs very recent browser features) as a canvas with
  pdf.js's transparent text layer on top, so the words are real DOM text for the extension. Pages draw
  only near the screen; page thumbnails, zoom, "Page n of N", download. pdf.js loads only for a PDF.
  A scanned PDF with no text layer is not readable by the extension, so it is marked unsupported and
  falls back to a download.
- **Pictures** inside Word and PowerPoint files load through an authenticated fetch (`lib/assets.js`),
  because an `<img src>` cannot send the session header; they are shown as blob URLs, fetched once and
  shared between a slide and its thumbnail, with a labelled placeholder on failure.
- **Full screen** works in every viewer and fullscreens the whole page (`<html>`), not one element, so the
  extension's own UI stays visible; where the Fullscreen API is missing (iPhone Safari) the same layout
  fills the window. PowerPoint becomes a slideshow on black (largest slide that fits, click or right
  third advances, left third goes back, controls fade when the pointer is still). Word and PDF fill the
  screen with the same fading toolbar.
- Anything the server cannot render (a scanned PDF, a failed conversion, a pending deploy) shows the
  assignment with a plain "this file cannot be shown here" and a download button.

### 4.3 How the extension works on this page

- The popup's Open button now requests the handoff and opens this site for PDF, PowerPoint and Word. If
  the handoff fails (server unreachable, reader not deployed) a PDF falls back to the extension's own
  viewer; other formats say so. The popup does not check document status before opening, so an old
  upload with a stale "unsupported" label still opens and gets repaired by the server.
- On `/a/<assignmentId>` pages **at this app's exact origin only**, the extension's content script takes
  the assignment from the URL, so outcomes, interventions, scroll kinematics, explanation events and
  retention are reported against it with the student's extension session. PDF text layers are fed to the
  paragraph tracker (one source serves every format; it answers "scan the DOM" for Word and PowerPoint).
- The extension decides the assignment once per page load, so assignment links here use full page loads
  (`reloadDocument`), not in-app route changes.
- Outcomes go to `POST /api/assignments/:id/outcomes`, pseudonymous (`HMAC(assignment.salt, account_id)`
  derived server-side). The class view is anonymous by default and needs at least 5 distinct readers
  before showing a figure.

### 4.4 What the instructor sees, and where

Everything is in the **console** (`console.alcoia.app`): heatmap, confidence quadrant, hard vs
confidently-wrong passages, completion beside comprehension, receipt submissions, aggregate stats. This
app shows students nothing about the class. alcoia **does not write grades back to the LMS**
(Assignment and Grade Services is refused, decided and recorded in the server): a grade tied to
alcoia's numbers would teach students to perform the signal, and a receipt proves only "unaltered since
issued". From the LMS's point of view the assignment simply has no grade. The LMS onboarding copy should
say so: "alcoia doesn't write grades to your LMS. Your students' reading data and class insights are in
your alcoia Console."

## 5. LMS (LTI) flow

- **One-time setup**: an instructor or institution admin registers alcoia as an external tool in the LMS
  (tool URL, client id, public key), once per institution. The tool URL points at this app's domain.
- **Creating an assignment**: the LMS's deep-linking flow opens a picker; the instructor attaches an
  existing alcoia assignment. The assignment already exists in alcoia's database, tied to the
  instructor's org and class **at creation, not lazily on first student visit**, so an instructor must
  have done the org and class setup in the console once. After that they can stay inside the LMS.
- **Student launch**: the LMS sends a signed launch; the server validates state, signature (RS256, pinned)
  and nonce, resolves the class and assignment, and checks the reporting-mode disclosure. If the student
  has not acknowledged it, the disclosure handoff runs; otherwise they go straight to the document. After
  the acknowledgement they land on `/a/<id>` here.
- **Status**: the server's LTI plumbing is built and unit-tested, and the landing page here (`/lti/join`)
  is built. Nothing has been tested against a real Canvas or Moodle.
- Canvas first; Moodle supports LTI 1.3 as well and should work the same way, but nothing is claimed for
  any LMS until it is tested against one.
- **Not built, deliberately**: an embedded class dashboard inside the LMS (iframe). Recommended only after
  real instructors ask; the console is one tab away. A native LMS plugin only if an institution pays for it.

## 6. Plans and gating

Pricing as shown on the marketing site: Free $0, Reader $59/year, Student $29/year (a price, not a
capability), Pilot $0 (classes under 25 students, one term), Teams $4/seat/month (25-seat minimum,
annual only, instructor seat free), Institution on request.

The line, decided with the owner:

- **Free Pilot**: console with full aggregate data, heatmap, confidence quadrant, receipts, assigned
  readings on this web app, basic class management, SSO and DPA excluded. **No LMS integration. No
  teaching recommendations.**
- **Teams and Institution**: everything in Pilot, plus **LTI / LMS integration** and **teaching
  recommendations** (written suggestions on top of the data), SSO and DPA, larger classes, more storage.
  Institution adds the self-hosted option, procurement and onboarding.
- **Raw data stays free**: the heatmap and confidence quadrant are pure aggregation, and they are what
  proves value to an instructor trying the product. The written interpretation is what is gated, because
  it has real marginal cost and is what justifies paying. The marketing copy says "teaching
  recommendations", not "AI recommendations".

Enforced on the server, never in this app:

- LTI platform registration is refused for a Pilot org (`422 lti_requires_teams_or_institution`, plus a
  database trigger, SQLSTATE ALC04). A class cannot be LTI-launched without a registered platform, so
  launch, deep linking and roster sync are closed to Pilot through that one gate.
- `GET /api/assignments/:id/aggregate` reads the org's tier on each request. For Pilot, the recommendation
  text is `null`, `advice` is empty and no inference is run; counts, heatmap and classifications are
  unchanged, and `teachingRecommendations.available` is `false` so the console can say why.
- The extension and this app **never decide entitlement**; they ask the server.

## 7. Connections

| Piece | Repo | Relationship |
|---|---|---|
| **alcoiaServer** | private | Sessions, handoff, document models and files, access checks, outcomes, aggregates, LTI, billing. Source of truth for every contract. |
| **alcoia extension** | `alcoia-group/alcoia` (public, AGPL) | Popup requests the handoff and opens this app; content script reports outcomes from `/a/<id>`. |
| **alcoiaConsole** | private | Where instructors create orgs, classes, assignments and invites, upload documents, and read the class view. Also holds the logo files this app copied. |
| **alcoiaWeb** | marketing site | Pricing and explanation. Its magic-link page is separate from this app's sign-in. |
| **Object storage (R2)** | | Original documents and the derived content cache, served only behind the access check. |

Server routes this app calls (all with the session as `Authorization: Bearer`):

| Route | Purpose |
|---|---|
| `POST /api/auth/magic-link`, `/verify` | Sign in (`app: 'workspace'`) |
| `POST /api/invites/preview`, `/api/invites/accept` | The invite page |
| `POST /api/lti/disclosure/ack` | The LTI landing page (`/lti/join`) |
| `GET /api/entitlements`, `GET /api/account/learner-analytics` | Plan, and the analytics page |
| `/api/personal-documents...` | My files and the viewers for a personal file |
| `/api/exam/sessions...` | Exam Mode |
| other `/api/assignments/:id/...` reads | Question bank, section marks, explain-it-back and similar; `src/lib/*.js` has each call |
| `POST /api/reader/exchange` | Trade the handoff code for a `reader` session |
| `POST /api/reader/keepalive` | Slide the reader session while the student is active |
| `GET /api/assignments/mine` | The student's active assignments |
| `GET /api/assignments/:id/document` | Content model, or `content: null` for a download fallback |
| `GET /api/assignments/:id/document/asset?path=` | A picture from inside the document (raster only) |
| `GET /api/assignments/:id/document/file` | The original PDF bytes |
| `GET /api/documents/:id/download-url` | Short-lived signed download URL |

CORS is granted to this app's origin (`WORKSPACE_ORIGIN` on the server; old name `READER_ORIGIN`) on the
routes it calls and nowhere else; the server's `src/app.js` is the list.

## 8. Look and feel

Deliberately plain, like a course site students already know: a dark slate top bar with the alcoia logo
(white letters), the student's avatar, email and Sign out; white content on light grey; a breadcrumb row
on the reader ("Assignments / class", due date on the right); the assignment list as an ordinary table
(Name, Type, Due, "Due soon" inside 48 hours). Sans-serif UI, small corners, flat borders, one accent
colour, plain wording and no em dashes. Word pages keep a serif because that is how a Word page looks.
The sign-in screens follow the system colour scheme (black logo letters on light, white on dark); the
rest of the app is light only. Dates are written the way a course page does ("Dec 4, 2026 at 11:59 PM").
The two logo files are transparent-ground wordmarks copied from alcoiaConsole; do not swap in another
variant without checking it on both light and dark grounds.

## 9. Status: what is built, what is not

**Built, tested with the API mocked in a real browser, and unit-tested on the server and extension:**
sign-in, extension handoff, reader sessions that slide, assignment list, Word / PowerPoint / PDF viewers,
file-driven transitions, thumbnails, full screen for every viewer, authenticated pictures, 401 handling,
the popup change and outcome reporting from reader pages, Pilot gating on the server.

**Not verified against anything real:** a deployed server, the real extension loaded in a browser,
a real storage bucket, decks saved by PowerPoint itself (only python-pptx and hand-built files were used),
or any LMS.

*Update:* later work built the invite preview and accept page, the LTI landing (`/lti/join`), My files,
Exam Mode and learner analytics; see `CLAUDE.md` for what was verified. `LTI_READER_BASE_URL` on the server
still has to point at this app.

**Not built yet:**

1. **Console LMS onboarding**: a one-time screen on first class creation ("Do you use a learning
   management system?"). LMS path shows platform-specific setup steps (Canvas, Moodle, Blackboard);
   no-LMS path goes to the invite flow and explains students use this app. Both end with the
   "no grades written back" message. Console work, not built.
2. PowerPoint entrance and emphasis animations.
3. The LTI acknowledgement response now carries `seatId`; an older server leaves it null.

## 10. Deploying

- **This app (Cloudflare)**: build variables `VITE_API_BASE_URL=https://server.alcoia.app`,
  `VITE_CONSOLE_URL` (where the account-based-learning setting lives) and `VITE_MARKETING_URL`
  (legal links, default `https://alcoia.app`), all baked in at build time. `wrangler.jsonc` sets
  `assets.not_found_handling: single-page-application` so deep links like `/a/<id>` and `/auth-verify`
  load the app. Do not add a `public/_redirects` file with `/* /index.html 200`: Workers assets rejects it
  as a redirect loop and the deploy fails.
- **Server (Render)**: `WORKSPACE_ORIGIN=https://workspace.alcoia.app` (old name `READER_ORIGIN` still read;
  fails closed in production if unset), then `npm run documents:reconvert` once so old uploads stuck on "unsupported" are repaired.
  Placeholders, all approved as placeholders: `SESSION_TTL_READER_MS` (8 h), `SESSION_MAX_READER_MS`
  (7 d), `READER_HANDOFF_TTL_MS` (60 s), and the exchange rate limit.
- **Extension**: its workspace-origin constant (named `READER_ORIGIN` in the code) (`https://workspace.alcoia.app`) must match the real domain.
- Dev: `npm install`, `npm run dev` (port 8082; console 8080). `npm run lint`, `npm run build`.

**Merge order (historical).** These stacked branches were the original rollout order and are merged or superseded; agents push only `claude/*` branches and the owner merges:

- Server: `claude/reader-handoff-session`, `claude/document-content-docx`, `claude/document-content-pptx`,
  `claude/pdf-and-status-fixes`, `claude/pilot-gating`.
- This app: `claude/scaffold-assignments-app`, `claude/reader-handoff-client`, `claude/docx-viewer`,
  `claude/pptx-viewer`, `claude/viewer-fullscreen-pdf`.
- Extension: `claude/web-reader-handoff`.
- Console: `claude/document-status-copy`, `claude/pilot-gating-console`.
- Marketing: `claude/pricing-teams-features`.

## 11. Code map

```
src/
  App.jsx                 routes: /sign-in, /auth-verify, /invite/accept, /lti/join, /a/:id, /assignments,
                          /analytics, /analytics/subjects, /files, /f/:id, /exam
  components/
    AppLayout.jsx         top bar, session keep-alive
    ReaderGate.jsx        exchanges the handoff code, else falls back to sign-in
    Logo.jsx              the two transparent logo variants
    viewers/              DocxViewer, SlideViewer, PdfViewer, AssetImage
  pages/                  AssignmentsPage, ReaderPage, SignInPage, VerifyPage, InvitePage, LtiJoinPage,
                          AnalyticsPage, SubjectsPage, FilesPage, PersonalFilePage, ExamPage
  lib/
    api.js                fetch wrapper
    session.js            localStorage session
    handoff.js            #c=<code> capture and exchange
    keepalive.js          reader-session keep-alive
    assignments.js        list, document, file, download calls
    assets.js             authenticated picture fetch with a shared cache
    transitions.js        draws only the transition names the file states
    fullscreen.js         page-level full screen and idle controls
    format.js             dates, type labels
```

## 12. Decisions already made

- Assigned readings live on the web; the extension's PDF viewer stays for personal documents.
- Access is session + class membership on every request; a guessed URL reveals nothing.
- The code is the existing invite token (creates a seat after the disclosure).
- LMS integration and teaching recommendations are Teams and Institution; Pilot has neither. Heatmap and
  confidence quadrant stay free.
- No grade passback to any LMS, ever.
- The reader renders structured models, never server-made HTML.
- Transitions come only from the file.
- The reading-mode disclosure (anonymous or identified) is shown before joining; the mode locks once
  students have joined.
- No accuracy claims, leaderboards or rankings, and receipts say "unaltered since issued".
