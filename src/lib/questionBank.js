import { apiPost, API_BASE_URL } from './api.js';

// The question bank of an assigned reading (server: questions are written once per document).
//   GET  /api/assignments/:id/question-bank -> 200 { items: [{ id, paragraph, question, choices: [{id, text}] }] }
//                                              202 { status: 'preparing' }   422 { error: 'no_questions' }
//   POST .../question-bank/answer { itemId, choiceId } -> { correct, correctChoiceId, explanation, span }
// The answers never travel with the questions; each is checked by the server. Checking records nothing.
export async function fetchQuestionBank(assignmentId, sessionToken, { attempts = 8, delayMs = 2500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments/${encodeURIComponent(assignmentId)}/question-bank`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.status === 200) return await res.json();
      if (res.status !== 202) return null; // 404 / 422 / anything else: no questions to offer
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export const checkBankAnswer = (assignmentId, itemId, choiceId, sessionToken) =>
  apiPost(`/api/assignments/${encodeURIComponent(assignmentId)}/question-bank/answer`, { itemId, choiceId }, { sessionToken });

// Up to `n` items spread across the document, so the warm-up samples its breadth.
export function pickWarmup(items, n = 3) {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)]);
}

// A plain outline from the structure the file itself has: Word headings, slide titles. No AI, no
// guessing: a PDF (no structure in the model) yields nothing and the outline is simply not shown.
const text = (runs) => (runs ?? []).map((r) => r.text ?? '').join('').replace(/\s+/g, ' ').trim();
export function outlineOf(content) {
  const out = [];
  if (content?.format === 'pptx') {
    (content.slides ?? []).forEach((slide, i) => {
      const first = (slide.shapes ?? []).find((s) => s.kind === 'text' && (s.paragraphs ?? []).some((p) => text(p.runs)));
      const title = first ? text(first.paragraphs.find((p) => text(p.runs)).runs) : '';
      if (title) out.push({ level: 1, text: title.slice(0, 120), where: `Slide ${i + 1}` });
    });
  } else if (content?.pages) {
    content.pages.forEach((page, p) => {
      for (const b of page.blocks ?? []) {
        if (b.type === 'heading' && text(b.runs)) out.push({ level: Math.min(Number(b.level) || 1, 3), text: text(b.runs).slice(0, 120), where: `Page ${p + 1}` });
      }
    });
  }
  return out.slice(0, 40);
}
