
## 14 November 2026
Overview shows "Ready to check again" (review queue, `KeptAndReviews.jsx`) and "Kept", both hidden when empty or when learner memory is off. Layout pass at the end of `index.css`: spacing scale, page padding by width, stacked tables and 2 x 2 stats on phones. Colours, fonts and controls unchanged. Detection copy re-synced.
Detection synced: cards back off within a reading (fewer, then none on that page) and the "how often" beta question.

## 18 November 2026
EPUB books open like Word documents (the server converts them; one chapter per page). Own files accept `.epub` (sent once to `convert`, not kept); pictures are read from the book in the browser (`localAssets.js`, any plain in-archive path, raster only). (The "Beta" badge next to the logo stays; only the marketing site lost its label.)
Links in documents (`src/lib/docLinks.js`): PDF pages get a link layer from pdf.js annotations (web links open in a new tab, http/https/mailto only; jumps to a place or page in the file, named Next/Prev/First/Last page); Word and EPUB links to a place in the document scroll there; slide links open a web page or go to a slide. Links in Word, EPUB and slides are blue and underlined (#0563c1, Word's own). After a jump a small "Back to where you were" / "Back to page N" / "Back to slide N" pill sits in the bottom-left corner (`src/lib/returnPoint.js`, `viewers/ReturnButton.jsx`; under 700 px only its arrow shows, the text stays as its label); it stays until the reader scrolls one screen away from where the link landed (slides: leaves that slide) or uses it, with no timer. Also fixed: the PDF thumbnail list scrolled the whole window to keep the current thumbnail visible, which undid jumps; it now scrolls only the list.
Word files show their own fonts and text colours (`content.defaults` on the page, `run.font` / `run.color` on runs; `fontStack` and `readableColor` in `src/lib/docLinks.js`): the file's font first, a free stand-in (Calibri -> Carlito, Cambria -> Caladea, Arial, Times New Roman, Courier New), then Alcoia's serif or sans; a colour too pale for the white page is ignored. Headings inherit the file's look (`.has-own-look`). Sizes and alignment stay Alcoia's.

Detection copy re-synced (19 November): challenge questions for readers doing well, explanation cards end with a check against the text.

## 20 November 2026
Full screen for Word and PDF: the reading area (`.annotator`) is a fixed box that scrolls on its own, so the window never fired `scroll` and the detection only moved to the next paragraph on its 5-second tick (and read scroll speed as 0). `detection/boot.js` now passes `scrollRoot` (the `.annotator` while `is-fullscreen` is on) to the orchestrator, which listens to that box too (extension commit 0ab7d7d, synced). Checked in Chromium that such a box fires no window scroll and is heard by a capture listener; not checked on the full app in full screen.

## 20 November 2026 (later)
- Detection on slides and pictures (`src/detection/documentBlocks.js`): a slide is one block whose text is built like
  the server's slide passage, so its hash matches the deck; a slide with a picture, chart or under 20 words is media
  (followed, not judged on pace). A Word or EPUB picture of at least 64 x 64 px is its own media block.
- "Explain this picture" (`viewers/ExplainPicture.jsx`, `lib/pictures.js`), assigned readings only, nothing sent until
  the reader presses it: under each Word and EPUB picture, under a slide (one button per picture), and on a PDF page that
  pdf.js says paints an image (the page as drawn, scaled to 1600 px, sent as a JPEG). The answer always says it was
  written by AI from the picture and may be wrong. The panel is `data-anno-skip` and `annotator-ui`, so highlights and
  detection never count its text.
- Speaker notes under a slide (folded), when the server sends them: instructor's switch for assigned decks, always for
  the reader's own decks.
- PowerPoint is closed for the beta (owner decision): own files accept PDF, Word and EPUB only, copy updated, the
  PowerPoint lines kept in comments. The server refuses new decks (`format_closed_for_beta`). Decks already here still open.
- Verified in Chromium against the built app with the API mocked (Word picture, PDF page with and without a picture,
  slide picture and notes); detection unit tests. Not verified against a real server or the vision model.

## 20 November 2026 (colour control)
The row of six colour dots in the reading tools is gone. Highlight is now a highlighter icon with the current colour under it, and a small arrow beside it opens a menu (`components/ColorMenu.jsx`): the six preset colours, "Your colours" (up to six custom colours made before), and a custom colour (native colour picker plus a hex box, "Use"). The colour applies to highlight, underline, wavy, strike, pen and sticky notes. A colour is a preset name or `#rrggbb` (`resolveColor`, `colorToken`, `registerColor` in `lib/annotations.js`); a custom colour gets its own `::highlight` rules written into one style element the first time it is used, only from a validated hex. Marks made before keep their preset names; anything unreadable falls back to yellow. The choice and the recent colours are kept on this device (`alcoia_highlight_color`, `alcoia_recent_colors`). The small colour rows in the sticky-note, selection and edit-mark popups show the presets plus recent custom colours. Escape and a click outside close the menu; on touch screens every target is 44 px. Verified in Chromium against the built app (menu, preset, custom colour, highlight drawn, kept after reload, redrawn from storage) and `tests/colors.test.mjs`. Not verified: Safari or Firefox, a real phone.

## 22 November 2026
Detection re-synced (extension commit below): up to 3 automatic cards on one paragraph, each a different style of help, and a self-report overrides the limits on automatic cards (gap, "fewer/no more cards", back-offs, held-back kinds, paragraph cap). See the extension's CLAUDE.md. Workspace build and 40 unit tests pass; not checked in a browser.

## 25 November 2026
A reading's own due checks ("Ready to check again") now also appear above the document when it is reopened (`KeptAndReviews` with `assignmentId`: only that reading, no Kept list). Checks are only due a day or more after help or an answer, so this shows after time away. The overview card still lists every reading. Build passes; not checked in a browser.

## 25 November 2026 (plainer cards)
Detection re-synced: the second explanation or repair card on a paragraph asks for plainer wording, the third for the smallest steps (see the extension's CLAUDE.md). Build passes; not checked in a browser.

## 26 November 2026
The own-file message for a PDF with no selectable text now says to run OCR first and add it again. Copy only.
Update, same day: adding your own PDF with no selectable text is refused (`no_selectable_text`, nothing kept on the device) with the run-OCR message. An already stored scan in an assigned reading shows "ask your instructor for a text version". 40 unit tests pass (`node --test tests/*.test.mjs`; the workspace has no npm test script).

## 26 November 2026 (own files closed for the beta)
"My files" shows a "not available during the beta" notice and the Add a file button is commented out (`OWN FILES CLOSED FOR THE BETA`); `VITE_OWN_FILES=on` at build time brings it back (the server also needs `FEATURE_OWN_FILES=on`). Build and 40 tests pass; not checked in a browser.

## 26 November 2026 (questions found in the document)
`components/FoundQuestions.jsx` (assigned readings only) asks the server for the reading's own questions (`GET /api/assignments/:id/document/questions`) and, when there are any, shows a banner above the document and a one-at-a-time card carousel (choices as radio buttons, otherwise a text box), with the answers listed at the end. Answers stay on the page: nothing graded, nothing sent (no answer key exists yet). First slice: it is offered at the top, not when the reader reaches the questions. Build and 40 tests pass; not checked in a browser.
