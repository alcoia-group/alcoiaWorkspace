# Licensing notice

`LICENSE` (AGPL-3.0) covers the code written for this app. The following are included under their own terms.

| Component | Licence | Notes |
|---|---|---|
| `public/detection/` (except `src/libs/`) | AGPL-3.0 | Copied from the alcoia browser extension, which has the same owner. The copy is made by `scripts/sync-detection.mjs`; each file's first line names its source. |
| `pdfjs-dist` (npm dependency) | Apache-2.0 | Mozilla Foundation. Used to draw PDFs. |
| `react`, `react-dom`, `react-router-dom` (npm dependencies) | MIT | |
| `public/assets/fonts/literata-*`, `public/detection/src/libs/fonts/literata-*` | SIL OFL 1.1 | The Literata Project Authors. Licence text in `OFL-Literata.txt` beside the files. |
| `public/assets/fonts/plus-jakarta-sans-*`, `public/detection/src/libs/fonts/plus-jakarta-sans-*` | SIL OFL 1.1 | The Plus Jakarta Sans Project Authors. Licence text in `OFL-PlusJakartaSans.txt` beside the files. |
| `public/detection/src/libs/wordfreq/common-words.js` | Public domain source texts | English word frequencies counted from public-domain books. |
| `public/detection/src/libs/wordfreq/common-words-{fr,es,de,pt,it}.js` | CC BY-SA 4.0 | Top 5,000 words per language from [FrequencyWords](https://github.com/hermitdave/FrequencyWords) by Hermit Dave (2018), counted over OpenSubtitles. Share-alike: the lists stay CC BY-SA 4.0. The code that reads them is not affected. |

Open question for the owner: whether shipping the CC BY-SA 4.0 word lists inside an AGPL-3.0 package is clean. If it is not, replace the five lists with ones computed from public-domain texts. They are used only to estimate how long a paragraph should take to read.
