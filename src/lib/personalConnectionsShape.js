// Pure shaping of the connections answer, kept apart from the fetch so it can be tested without the app's build setup.
const TYPE_TEXT = { same_concept: 'looks like the same idea as', related_concept: 'looks related to' };

export function shapePersonalConnections(body, max = 6) {
  const links = Array.isArray(body?.connections) ? body.connections : [];
  const items = links
    .filter((c) => typeof c?.relatedDocument?.id === 'string' && c.concept?.label && c.relatedConcept?.label)
    .slice(0, max)
    .map((c) => ({
      key: `${c.relatedDocument.id}|${c.concept.label}|${c.relatedConcept.label}`,
      documentId: c.relatedDocument.id,
      documentName: c.relatedDocument.name || 'another file',
      here: c.concept.label,
      there: c.relatedConcept.label,
      relation: TYPE_TEXT[c.type] ?? 'looks related to',
      likely: c.confidence === 'likely',
    }));
  if (items.length === 0) return null;
  return { items, note: typeof body?.status?.note === 'string' ? body.status.note : 'Suggestions only. Not checked.' };
}
