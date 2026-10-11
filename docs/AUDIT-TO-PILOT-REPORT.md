# From the readiness audit to the pilot: what changed and why

Scope: everything done in this repository from the read-only intelligence-readiness audit (which found that several things the product said or measured were not true or not measured) through Stage A (correct what is false), Stage B (use the learner's evidence to decide what to do), privacy hardening of the instructor views, and Stage C (verification). Dates are 2026-10-09 to 2026-10-11, branch `claude/community-mvp-6dq9qd`.

The audit itself produced no code. Its findings drove the commits below: wrong claims about question levels and participation, answers after an explanation being counted as independent success, exact small counts that could identify students, receipts visible or stored where the class promised anonymity, and no protection against a retry double-counting.

## Commits in this repository (alcoiaWorkspace), oldest first

This repository had no change for the audit, Stage A, or Stage B, because it does not decide anything about evidence: it shows what the server returns. Checking it against the server changes found two real mismatches, fixed now:

| Change | Goal |
|---|---|
| Reporting notice (`ReportingNotice.jsx`) | The anonymous-class notice still promised "the one exception: if you submit a receipt, your instructor sees it". The server now refuses receipts for anonymous classes, so the promise was false. It now says receipts are not used in that class. |
| Exam Mode early stop (`ExamPage.jsx`) | The server can now end a session early when nothing further needs practice. The page did not handle that response and would have shown a blank question. It now shows the summary with a short explanation. |
| Exam Mode nothing to practise (`lib/exam.js`, `ExamPage.jsx`) | Starting a session can now return "nothing needs practice". That used to appear as "Something went wrong"; it now says what happened. |

Verified: lint (one older warning) and production build pass. There are no automated tests in this repository, and the pages were not exercised in a browser against a live server.
## What these changes mean for the philosophy of the software

Alcoia's stated purpose is that a reader should need it *less* over time, and that it is a formative tool, never a surveillance or grading tool. This body of work moved the software closer to that purpose in six ways.

1. **Say only what the evidence supports.** Before, the software could present a guess as a fact (a "level" it could not actually deliver, a "participant" count that really meant "people who left a trace", a "correct" answer that came straight after being shown the explanation). Now each of those is either measured honestly or labelled as unknown. Missing evidence is never read as mastery, and never as failure.
2. **An answer after help is not proof of understanding.** A correct answer given right after an explanation, a repeated question, or an answer whose history is unknown is recorded as an attempt, not as independent success. Only an unaided answer, ideally confirmed after a delay, counts as evidence the reader can do it alone. This is the "need it less" principle made concrete.
3. **Interrupt less, and only for a reason.** The software now uses what it already knows about the reader (per reading, per paragraph) to stay quiet when a question would add no information, to explain instead of asking a third time, and to repair after a real miss. The random "extra question" on readers who were reading fine was removed.
4. **Privacy by structure, not by promise.** In anonymous classes the instructor can no longer subtract small numbers, watch a count tick up, or read a receipt, a content graph, or generated advice that only makes sense for a handful of people. Exact small figures are replaced by plain bands ("a few", "some", "most") or are withheld, and the server, not the screen, enforces it. This does not make re-identification impossible; the documents say so.
5. **Private learning memory stays private.** What a reader has learned is theirs; instructors see only cohort-level, banded signals, and a reader who turns memory off is not counted.
6. **Reliability over cleverness.** Saving an answer and updating the reader's memory now succeed or fail together, a retry can never double-count, and failures degrade quietly instead of breaking the page.

### Honest limits (nothing here proves the product improves learning)
- All numeric thresholds (one-day confirmation, 14-day staleness, the review ladder, the floor of five, the band cut-points) are provisional placeholders.
- Nothing was evaluated with real learners or against a real AI provider (no key or network access was available). Passing tests show the rules behave as designed, not that the questions and explanations are good.
- Learner memory and instructor retention statistics are ON by default. The legal basis, treatment of minors, and the public legal wording are not settled and need owner and counsel decisions.
- A meaningful "apply" intervention (using knowledge in a new situation) does not exist; the loop is Orient, Understand, Retrieve, Repair, Retrieve again later.
- Several jobs (document cleanup, salt deletion, billing notices) exist as commands but nothing in the repositories schedules them. The host must.
