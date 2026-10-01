# Assignments web app: server, extension and app design

Status: **design only, nothing here is built.** Grounded in `alcoiaServer` (`lti.js`, `invites.js`,
`documents.js`, `assignments.js`, `session.js`, `extract-docx.js`, `entitlements/resolve.js`) and the
extension (`background.js`, `src/popup/assignments.js`). Items marked **DECIDE** need an owner answer
before they are built.

## 1. Rules this has to satisfy

1. From the extension, an assignment opens **already signed in**, no sign-in click-through.
2. With nothing (no extension, no code), `assignments.alcoia.app` keeps its default: sign-in page.
3. An assignment is visible only to (a) an account holding an active seat in its class, or (b) someone
   holding a valid code. A guessed URL reveals nothing, not even that the assignment exists.
4. The reader is a **normal web page** (real DOM text, paragraphs) so the extension works on it
   unmodified, but looks like a **file reader** for PDF, PPTX and DOCX.
5. Both entry points (direct/invite, LTI) feed the same assignment, outcomes and console.
6. LMS integration is a paid feature: Teams and Institution yes, Pilot no. AI teaching
   recommendations are paid; raw aggregates (heatmap, confidence quadrant) stay free.

## 2. Access model

- Every reader endpoint answers **404 `assignment_not_found`** for a non-member and for a nonexistent
  id alike. No 403 (the existing `download-url` route's 403-vs-404 is an existence oracle; the new
  routes do not copy it). The id is a random UUID, but access never relies on it being secret.
- Membership check = the same one `download-url` uses: `findActiveSeatForAccountInClass` or
  `canManageClass`.
- **DECIDE (code semantics).** Recommended: a "code" is the existing **invite token**, and using it
  creates a seat (after the reporting-mode disclosure). Reason: outcomes, the pseudonym and the
  disclosure all require a seat, so a seatless read-only code would produce a reader whose reading
  can't be recorded and who was never told the reporting mode. The alternative (a per-assignment
  read-only code) is a new credential type and is not recommended.

## 3. Extension to web app, no click-through

Today the extension holds a 90-day `extension` session and opens its own PDF viewer. New flow:

1. Popup "Open" calls `POST /api/assignments/:id/reader-handoff` with the extension session.
   Server checks the seat (404 otherwise), mints a single-use code (60 s placeholder TTL, hashed at
   rest, new `reader_handoff_codes` table, same shape as `extension_handoff_codes`) and returns it.
2. Extension opens `https://assignments.alcoia.app/a/<id>#c=<code>`. The code is in the **fragment**
   so it never reaches server logs, `Referer`, or history sync as a request.
3. The app calls `POST /api/reader/exchange { code, assignmentId }`, receives a session, strips the
   fragment, and renders. No sign-in screen is shown.
4. Without a code and without a session the app shows sign-in (rule 2). A code that is expired,
   used or for another assignment falls back to sign-in; it never shows an error that leaks why.

**New session kind `reader`** (CHECK-constraint migration, same pattern as the `lti` kind). Reason: the
page must not hold the extension's 90-day credential, and a `reader` session must not reach
`requireSession({kind:'console'})` management routes. It may call the student routes that take any
kind (`assignments/mine`, document content, outcomes). TTL **DECIDE** (placeholder 8 h).

The extension keeps using its own session for outcomes; the page's session is only for fetching
content. The extension recognises an assignment page by URL (`assignments.alcoia.app/a/<uuid>`),
no page script, and sets `assignmentId` for `host.js` from the path. The extension's PDF viewer stays
for readers' own documents; assignments move to the web.

## 4. Document to web page

**Endpoint:** `GET /api/assignments/:id/document` (any session kind with a seat) returns structured
JSON, not an HTML string:

```
{ format, pages: [ { blocks: [ {type:'heading', level, runs}, {type:'paragraph', runs},
  {type:'list', ordered, items}, {type:'table', rows}, {type:'image', assetId, alt} ] } ] }
```
`runs` = `[{text, bold?, italic?, href?}]`. The web app renders this as real `<h*>`/`<p>`/`<table>`
inside page frames. Real DOM text and paragraph boundaries are what the extension instruments, and
rendering JSON through React means **no instructor-supplied HTML ever reaches the page** (XSS safe by
construction; `href` limited to `http(s)`/`mailto`, `rel=noopener`).

**File-reader look (app side):** toolbar (title, page n of N, zoom, fit width), page frames on a
neutral ground, PPTX slides as 16:9 frames, thumbnail rail on wide screens. Light theme first.

**Conversion at upload,** in `documents.js`, stored as `documents/<id>/content.json` in object storage
(never the database, CLAUDE.md §9). `documents.status` becomes earned: `accepted` only if content was
extracted. Deleting a document deletes the derived file too (genuine deletion). Counts toward org
quota. Size, page and block limits plus a zip-inflate cap. Existing documents convert lazily on first
read, or via a one-off script.

| Format | Method | Notes |
|---|---|---|
| DOCX | extend `extract-docx.js`: heading styles, lists (`numPr`), tables, bold/italic, hyperlinks (rels) | no new dependency |
| PPTX | `ppt/presentation.xml` order, `slides/slideN.xml` `a:t`, title placeholder as heading | speaker notes excluded; one page per slide |
| PDF | server-side text extraction, paragraphs from line gaps | **DECIDE: needs a new dependency** (`pdfjs-dist`); scanned PDFs with no text layer stay `unsupported`, no OCR |
| images (all) | phase 2, served via gated `GET .../document/assets/:id` | text-only first |

## 5. Invite preview and disclosure

- `POST /api/invites/preview { token }` (POST so the token stays out of URLs and logs) returns
  `{ className, reportingMode }` or the same error codes as accept (`invalid_invite`, `invite_revoked`,
  `invite_expired`). IP rate-limited, no session required.
- `/invite/accept` shows the reporting-mode promise in plain words, requires an explicit confirm, then
  signs in (if needed) and calls `POST /api/invites/accept` with `acknowledged: true`, which sets
  `seats.disclosure_ack_at` (today only the LTI ack sets it). Optional for now so the extension is not
  broken; make it required once the extension sends it.

## 6. LTI landing and redirect

- Launch lands on **this app** (`/lti/launch?code=`), not the marketing page: the app calls
  `POST /api/lti/launch/exchange`, shows the disclosure itself if required, calls
  `POST /api/lti/disclosure/ack`, then moves to the assignment. Students without the extension work.
- The "already acknowledged" payload and the ack response return `redirectTo =
  <reader>/a/<id>#c=<code>` using the section 3 code, so the session reaches the app (today
  `redirectTo` carries no session). Config `LTI_READER_BASE_URL` points here.
- Canvas/Moodle may open the tool in an iframe, where `localStorage` is partitioned. Instructions in
  the console's LMS setup must say "open in a new tab".
- Deep linking picker also served from this app, console-session instructor only.

## 7. Plan gating

- **LMS: Teams and Institution, not Pilot.** Conflict to resolve: `ALCOIA-PLATFORM-SPEC.md` §5 table
  and §10, server `CLAUDE.md` §11 and the DB trigger `lti_platforms_institution_tier_check` (ALC04)
  all say **Institution only**. Following your instruction means a migration relaxing the trigger to
  `teams` + `institution`, and updating those lines. Launch, deep-link, roster-sync and platform
  registration all re-check the org tier at read time. `GET /api/entitlements` gains a
  `lmsIntegration` feature so the console asks rather than infers.
- **AI recommendations: Pilot excluded.** `aggregate.js` currently calls `recommendationFor` and
  `generateAdvice` for every org. Gate on the resolved entitlement before any provider call (also
  saves Groq cost) and return `recommendationsLocked: true` instead of an empty list so the console can
  show an honest upgrade note. Heatmap, confidence quadrant and all counts stay free.

## 8. CORS and magic-link host

- New config `READER_ORIGIN` (a fourth origin value; collapsing the existing three is a separate
  cleanup). Granted, with exact methods: `POST /api/auth/magic-link` and `/verify` (array form already
  supported), `GET /api/assignments/mine`, `GET /api/assignments/:id/document`, `POST
  /api/reader/exchange`, `POST /api/invites/preview` and `/accept`, `GET /api/documents/:id/download-url`,
  `POST /api/lti/launch/exchange` and `/disclosure/ack`. Nothing else.
- Magic link: request body gains `app: 'assignments'`, validated against an allowlist, picking the
  verify base from server config (`READER_ORIGIN/auth-verify`). The client never supplies a URL.

## 9. Build order (one item per session)

1. Server: `reader` kind, handoff + exchange, uniform-404 membership helper, CORS, magic-link app base.
2. Server: invite preview + acknowledged accept.
3. Server: DOCX then PPTX to `content.json` (+ document endpoint), then PDF once approved.
4. App: reader (page frames, toolbar), handoff landing, invite page, real `/assignments`.
5. Extension: popup opens the web reader with the handoff; page recognition by URL.
6. Server + app: LTI landing/redirect handoff.
7. Server: LMS tier gating (Teams + Institution) and `lmsIntegration` feature.
8. Server + console: AI recommendation gating, console LMS onboarding screen.

## 10. Decisions needed

1. Code = invite token that creates a seat (recommended) or a separate read-only code?
2. Approve `pdfjs-dist` for server-side PDF text extraction?
3. `reader` session kind and its TTL (8 h placeholder), handoff TTL (60 s placeholder).
4. Confirm LMS = Teams + Institution, overriding the current Institution-only spec and trigger.
