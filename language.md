# Writing Guide: Avoiding AI-Sounding Language

This guide applies to all user-facing and reader-facing text in this project: interface copy, onboarding, empty states, tooltips, notifications, errors, emails, help content, marketing pages, and documentation.

It is a guide for editing language, not a reason to rewrite working code or make every sentence sound the same.

## Goal

Write like a competent person who understands the product and respects the reader's time.

- Say the useful thing first.
- Use ordinary words when they are accurate.
- Keep the amount of explanation proportional to the situation.
- Prefer concrete details over polished-sounding claims.
- Let the product's purpose and audience determine the voice.
- Preserve technical accuracy, accessibility, and necessary legal or safety information.

Do not try to imitate typos, slang, or a fictional "human voice." Human writing varies by context. The aim is specific, direct, unforced writing.

## 1. The highest-priority patterns

### A. The "not X, but Y" pivot

Watch for

- "It's not just X. It's Y."
- "This isn't about X; it's about Y."
- "Not X, but Y."
- "More than X, it's Y."
- "X, not Y."
- "Don't just X. Y."
- "Rather than X, do Y." when the contrast adds no useful information.

These constructions are legitimate when a real distinction needs correcting. They become an AI tell when used to manufacture emphasis or reframe ordinary points.

Rewrite by stating the actual point.

- AI-sounding: "Alcoia isn't just a summarizer. It's a complete learning experience."
- Better: "Alcoia helps you understand a document and remember what you learn."
- AI-sounding: "You're not reading more. You're getting more from every page."
- Better: "Get more from what you read."
- AI-sounding: "This isn't a failure. It's an opportunity to learn."
- Better: "You missed this question. Review the explanation and try again."

Do not mechanically ban every use of "not" or "instead." Keep contrast when it prevents a real misunderstanding.

### B. Explaining more than the moment requires

AI often turns a small interaction into a mini-essay.

- AI-sounding: "Your document has been successfully uploaded and is now ready for you to begin exploring its contents and discovering key insights."
- Better: "Document uploaded."
- AI-sounding: "You haven't added any documents yet. Once you upload a document, Alcoia will be able to help you understand its key ideas and retain the information more effectively."
- Better: "No documents yet. Upload a PDF to get started."

Match the length to the task. A confirmation usually needs a confirmation. An error needs the problem and the next useful action. A complex learning explanation may need more.

### C. Generic claims instead of specific facts

Avoid language that sounds impressive but does not tell the reader what happens.

Watch for: "seamless," "powerful," "intuitive," "robust," "transformative," "cutting-edge," "next-generation," "revolutionary," "unlock," "elevate," "empower," "streamline," "leverage," "delve into," "game-changing," and metaphorical "landscape" or "journey."

These words are not forbidden. Keep one only when it communicates something precise that a plain description cannot.

- Vague: "Unlock deeper insights with our powerful AI."
- Specific: "Ask questions about the PDF and get answers grounded in its text."
- Vague: "A seamless learning experience."
- Specific: "Pick up where you left off, with your previous answers saved."

### D. The unnecessary three-part list

AI frequently forces ideas into threes: "clear, engaging, and effective"; "learn, grow, and succeed"; or three sentences with identical structure.

Use a list when the items are genuinely distinct and useful. Do not add a third item just to make a sentence feel complete.

- Padded: "Understand concepts, strengthen retention, and build lasting confidence."
- Better: "Understand the material and remember it later."

### E. The filler introduction or transition

Remove phrases that announce the sentence instead of adding meaning:

- "It's important to note that..."
- "It's worth mentioning that..."
- "In today's fast-paced world..."
- "At its core..."
- "When it comes to..."
- "In order to..." (usually use "to")
- "Furthermore," "Moreover," "Additionally," when "and" or no transition works
- "That said," when the next sentence can stand on its own
- "Let's dive in," "Let's explore," or "Here's the thing" when no conversational setup is needed
- "In conclusion" when the conclusion can simply be stated

Delete the introduction and keep the point.

### F. The trailing "without X" flourish

AI often adds a neat negative ending after the point is already clear: "with no hassle," "without the guesswork," "without wasting time," "no friction, no distractions," or "all in one place."

Keep it only if the absence of that thing is a real, relevant product benefit. Do not append a slogan to every sentence.

### G. Repeatedly correcting an imaginary misconception

Do not keep telling readers what the product is not, what they do not need to do, or what they should stop thinking. Explain the actual behaviour and address a misconception only when users are likely to have it.

## 2. Sentence and paragraph habits

### Prefer direct subjects and verbs

- Wordy: "The ability to review your saved answers is provided by the dashboard."
- Direct: "Review your saved answers on the dashboard."
- Wordy: "A notification will be displayed when processing has been completed."
- Direct: "We'll notify you when processing finishes."

Use "we" only if that matches the product's established voice.

### Vary sentence length naturally

Do not make every sentence short. Do not make every sentence balanced and polished either. A short label, a longer explanation, and a blunt warning can sit together when the task calls for them.

### Avoid fake emphasis

Use bold text, exclamation marks, rhetorical questions, sentence fragments, and em dashes sparingly. Don't turn every feature into a reveal.

### Avoid synonym cycling

Use the same clear term for the same concept. If the interface calls it a "document," do not call it a "resource," "file," "reading," and "material" in adjacent paragraphs unless those terms mean different things.

### Avoid empty participle endings

Watch for clauses such as "..., helping you unlock your potential," "..., ensuring a seamless experience," or "..., highlighting the importance of..." If the clause does not add a concrete result, delete it.

### Avoid over-hedging

Do not stack "may," "might," "can potentially," and "could possibly." State what is known. Keep uncertainty where it is real, especially in AI-generated answers, predictions, and learning-state estimates.

## 3. Write for the surface

Different parts of a product need different language. Do not apply marketing-copy rules to every screen.

### Buttons and labels

- Use short, familiar action words: "Upload PDF", "Save", "Try again", "View results".
- Name the action or destination.
- Avoid vague labels such as "Continue your journey", "Unlock insights", or "Discover more" when a concrete label fits.

### Empty states

- Say what is empty and how to proceed.
- One short explanation is usually enough.
- Do not use an empty state as a place for a brand manifesto.

### Success messages

- Confirm what happened.
- Mention the next step only when it is useful.
- Avoid "successfully" unless the distinction matters.

### Errors

- State what failed in terms the user can understand.
- Give a safe, actionable next step when possible.
- Do not blame the user.
- Do not claim data is safe, saved, deleted, or recoverable unless the system confirms it.

### Learning feedback

- Be specific about the answer or concept.
- Do not praise every action ("Great job!", "Excellent work!", "You're on your way!") by default.
- Do not treat slow reading, a wrong answer, or a pause as proof that the learner is struggling.
- Distinguish evidence from inference. If the system is uncertain, express that uncertainty plainly.
- Avoid motivational filler. Help the learner understand what to do next.

### Onboarding

- Explain one useful thing at a time.
- Show the next action.
- Do not describe every feature before the user has a reason to care.

### Marketing

- Lead with a real user problem or concrete product capability.
- Avoid inflated claims, generic AI language, and unsupported promises.
- Do not say "revolutionary," "game-changing," or "the future of..." as substitutes for evidence.
- Do not force every headline into a slogan-plus-subheadline-plus-three-benefits formula.

### Documentation and technical explanations

- Put the answer, command, or requirement first.
- Include context needed to use it correctly.
- Prefer exact behaviour, constraints, examples, and failure cases over grand introductions.
- Avoid repetitive "This allows you to..." descriptions when the preceding sentence already explains the capability.

## 4. Vocabulary watchlist

These are review flags, not an automatic ban list. Context matters.

| Watch for | Usually prefer |
|---|---|
| delve into | examine, read, inspect, or delete |
| leverage | use |
| utilize | use |
| facilitate | help, let, enable (only if accurate) |
| empower | give, help, let |
| streamline | simplify, reduce steps |
| unlock | access, find, use, learn |
| robust | name the actual property: reliable, tested, handles X |
| seamless | describe what works and how |
| intuitive | explain how it works |
| cutting-edge / next-generation | state the actual capability |
| in today's world | delete |
| at its core | delete or state the core fact |
| it is important to note | delete |
| furthermore / moreover / additionally | and, but, or nothing |
| journey | process, course, session, or delete |
| landscape | field, market, area, or delete |
| foster | build, support, encourage, or delete |
| underscore / highlight the importance | state the point directly |
| comprehensive | list the actual scope |
| tailored / personalized | say what adapts to the user |
| powerful AI | state what the AI does |
| insights | findings, answers, patterns, or the specific result |

## 5. What human writing does differently

Do not replace AI polish with forced casualness. Aim for the following:

- Specificity: refer to the actual screen, action, document, limitation, or result.
- Economy: stop once the reader has what they need.
- Unevenness where appropriate: not every sentence needs the same cadence or length.
- A point of view: make a clear statement when the evidence supports one.
- Context sensitivity: an error, a product page, a study prompt, and a developer guide should not sound alike.
- Concrete verbs: say what the user can do and what the system does.
- Honest limits: say when a feature is unavailable or an estimate is uncertain.
- Useful detail: preserve detail that changes a decision; remove detail that only makes the writing sound complete.
- Natural repetition: repeating the same precise term is often clearer than finding a new synonym every time.

Human writing is not always shorter. A technical explanation may need several paragraphs. The test is whether each part earns its place.

## 6. Before-and-after examples

| AI-sounding | Prefer |
|---|---|
| "Let's dive into your document and uncover its key insights." | "Ask a question about the document." |
| "Alcoia empowers you to take your learning to the next level." | "Alcoia helps you understand what you read and remember it later." |
| "This feature is designed to provide a seamless and intuitive experience." | Describe what the feature actually does. |
| "Your progress is more than a number. It's a reflection of your growth." | "You've answered 8 of 12 questions correctly." |
| "No worries! Simply try again." | "Try again." |
| "We couldn't process your document, but don't worry, we're here to help." | "We couldn't read this PDF. Try uploading it again." |
| "By combining retrieval practice, adaptive learning, and personalized insights, Alcoia helps..." | Name the user benefit, then explain the relevant mechanism if needed. |
| "It's not about reading more; it's about remembering more." | "Remember more of what you read." |
| "This helps ensure that your learning experience remains engaging and effective." | State the observable result, or delete the sentence. |
| "Whether you're a student, researcher, or professional..." | Name the audience only when the distinction matters to the page. |

Examples are patterns, not fixed replacements. Do not copy a suggested sentence if it does not match the feature's real behaviour.

## 7. Editing checklist

For every meaningful block of copy, ask:

1. What does the reader need to know or do here?
2. Is that point in the first sentence?
3. Can I remove a phrase without losing information?
4. Am I explaining a contrast that nobody raised?
5. Did I add a generic benefit instead of a concrete fact?
6. Is this an unnecessary list of three?
7. Does the tone fit this exact surface?
8. Are the claims accurate and supported by the product?
9. Is uncertainty represented honestly?
10. Would a person on the team actually say this to a user in this situation?

If the copy is clear, specific, and appropriately brief, leave it alone. Do not rewrite text solely to make it different.

## 8. Guidance for AI coding agents

When editing copy in this repository:

1. Search broadly for user-visible strings, including frontend components, extension UI, notifications, emails, onboarding, empty states, tooltips, error messages, and marketing pages.
2. Separate user-facing text from internal identifiers, protocol strings, logs, test fixtures, API contracts, and generated files. Do not change those just because they contain flagged phrases.
3. Inspect each match in context. A phrase match is a review candidate, not proof of bad writing.
4. Rewrite in small, reviewable batches grouped by surface or feature.
5. Preserve meaning, product behaviour, accessibility labels, localization keys, placeholders, interpolation tokens, Markdown structure, and links.
6. Do not alter business logic, API behaviour, tests, or technical terminology as part of a copy pass.
7. Do not add claims about learning outcomes, AI accuracy, privacy, security, or saved data unless the implementation supports them.
8. Add or update tests only where copy is intentionally asserted; do not weaken tests to make a rewrite pass.
9. Run the relevant tests and inspect the diff for accidental code changes.
10. Report what was changed, what was left alone, and any ambiguous wording that needs product-owner input.

### Suggested workflow

- Pass 1: Inventory. Find likely user-facing text and group it by surface.
- Pass 2: Prioritize. Start with high-visibility text: landing pages, onboarding, primary workflows, empty states, and repeated feedback.
- Pass 3: Edit. Apply this guide with minimal semantic changes.
- Pass 4: Review. Check the surrounding flow as a user would experience it.
- Pass 5: Verify. Run tests, inspect diffs, and check placeholders and accessibility text.

Do not perform a blind global replacement. The same phrase may be appropriate in one context and awkward in another.

## 9. Keep the guide from becoming another formula

This document is a set of editing principles, not a rigid template.

- Do not ban a word merely because AI sometimes uses it.
- Do not make every sentence blunt or tiny.
- Do not remove useful explanations, warmth, humour, or personality where the context calls for them.
- Do not introduce slang to prove that a human wrote the text.
- Do not optimize for AI detectors. They are unreliable indicators of authorship.
- Do not treat "sounds human" as more important than being clear, accurate, accessible, and useful.

The target is writing that feels specific to this product and situation, with no unnecessary performance of intelligence.

## Further reading

These sources discuss recurring patterns in AI-generated writing and comparisons with human-written text. Treat lists of "AI tells" as heuristics, not universal laws.

- A linguistic study comparing AI-generated and human-authored texts
- A corpus-driven analysis of AI and academic discourse
- A survey of linguistic characteristics of AI-generated text
- AI Writing Tells reference
