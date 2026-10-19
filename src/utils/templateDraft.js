/**
 * Unsaved edits to a template, kept in App so they survive switching between
 * the Editor and Quick Fill, or to another letter and back. The preview shows
 * the draft, so an edit is visible before it is saved.
 */

export const draftFrom = (template) => ({
  title: template?.title || '',
  category: template?.category || 'General',
  subject: template?.subject || '',
  body: template?.body || '',
  description: template?.description || '',
  fields: template?.fields || [],
});

/** True when `draft` differs from the saved template. */
export function isDraftDirty(template, draft) {
  if (!template || !draft) return false;
  const saved = draftFrom(template);
  return (
    draft.title !== saved.title ||
    draft.category !== saved.category ||
    draft.subject !== saved.subject ||
    draft.body !== saved.body ||
    draft.description !== saved.description ||
    JSON.stringify(draft.fields || []) !== JSON.stringify(saved.fields)
  );
}

/** The template as it currently reads, unsaved edits included. */
export function withDraft(template, draft) {
  return template && isDraftDirty(template, draft) ? { ...template, ...draft } : template;
}

/** Ids of templates with unsaved edits. */
export function dirtyTemplateIds(templates, drafts) {
  return templates.filter((t) => isDraftDirty(t, drafts[t.id])).map((t) => t.id);
}
