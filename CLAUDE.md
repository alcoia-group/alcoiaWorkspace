
## 14 November 2026
Overview shows "Ready to check again" (review queue, `KeptAndReviews.jsx`) and "Kept", both hidden when empty or when learner memory is off. Layout pass at the end of `index.css`: spacing scale, page padding by width, stacked tables and 2 x 2 stats on phones. Colours, fonts and controls unchanged. Detection copy re-synced.
Detection synced: cards back off within a reading (fewer, then none on that page) and the "how often" beta question.

## 18 November 2026
EPUB books open like Word documents (the server converts them; one chapter per page). Own files accept `.epub` (sent once to `convert`, not kept); pictures are read from the book in the browser (`localAssets.js`, any plain in-archive path, raster only). (The "Beta" badge next to the logo stays; only the marketing site lost its label.)
Links in documents (`src/lib/docLinks.js`): PDF pages get a link layer from pdf.js annotations (web links open in a new tab, http/https/mailto only; jumps to a place or page in the file, named Next/Prev/First/Last page); Word and EPUB links to a place in the document scroll there; slide links open a web page or go to a slide. After a jump the toolbar offers "Back to where you were" / "Back to page N". Also fixed: the PDF thumbnail list scrolled the whole window to keep the current thumbnail visible, which undid jumps; it now scrolls only the list.
