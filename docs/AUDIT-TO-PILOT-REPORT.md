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

---

# Part 2 (after the first report): clearer help, quick checks for fluent readers, "material" wording

These changes follow the owner's review of the first report. Same branch, 2026-10-11.

Decisions taken with the owner:
- Explanations must be understandable by anyone, not just a "plain rewrite".
- A "relationship guide" ("Look at how X and Y are connected") is a real kind of help, not only questions.
- Readers who are doing fine get a short **quick check** now and then (this reverses the earlier removal of random extra questions, but in a different form: scheduled by amount read, only in assigned readings, only when nothing else is going on, separately labelled so it never distorts the "struggle" figures). A "you read smoothly, no help needed" note was considered and rejected as pointless.
- Instructor statistics built from students' private learner memory are **off by default for the pilot**.
- "Assignment" is replaced by **"material"** wherever people read it (routes, file names and the API keep the old word).

## Part 2 commits in this repository (alcoiaWorkspace)

| Commit | Goal |
|---|---|
| `d609844` | "Materials" instead of "Assignments" in the list, reader, invite and Exam Mode screens. |

Verified: lint (one older warning) and build pass. No automated tests exist in this repository.

## What Part 2 means for the philosophy

- **Teach, don't only test.** Help now comes in several honest forms (explain, repair, show how ideas connect, ask), chosen from evidence. Questions are not the only tool.
- **See the whole class, not just the strugglers.** Until now the instructor only learned from students who struggled or answered a question. The quick check gives the other half: evidence from students who read smoothly. It is labelled separately in the data, it never takes the last free slot reserved for real help, and it follows the same limits as every other question.
- **Private stays private.** Anything built from a student's private learning memory no longer reaches the instructor by default.
- **Plain words for people who read.** Anyone should understand an explanation, and people reading course material should see the word "material", not homework vocabulary.

## Part 3 - quick-check spacing and reassigned material

Owner asked for: (1) quick checks for fluent readers must never appear within 30 seconds of a normal card, and a normal card wins if both are due; (2) improvement on reassigned material, seen by the instructor in the console and by the learner (paid analytics) as a different use.

Commits in alcoiaworkspace:
- `74b43d1`: Learner analytics shows 'Passages you met again': how many came up in more than one reading, how many were hard the first time, how many have been answered correctly since and how many are still worth another look. Counts from the learner's own answers only; the server decides plan and learning-memory consent as before.

Philosophy: a comparison is for noticing, not for judging. It uses the same coarse bands and small-group rules as everything else, says plainly that the two runs are different students, and shows learners only their own history.

## Agreed but not built yet (so nothing is claimed that does not exist)
- A struggle profile that carries *how* a student struggles across readings, and a concept layer that links ideas between readings.
- A passive "drifting" signal (private to the policy, never shown to an instructor).
- Scenario or application questions inline (they need a new validity rule that is not a quote).
- Making the teaching-recommendations switch follow the instructor's account instead of one browser.

## Part 4 - struggle profile and concept layer (workspace)
`/analytics` renders two new cards from the server: "How you tend to struggle" (five counts, a plain sentence only when one kind clearly leads, a note that it is private and a count not a score) and "Ideas that come up in more than one reading". Nothing is computed here. Verified by lint and build only, not in a browser or against a deployed server.
