import { describe, it, expect } from 'vitest';
import { draftFrom, isDraftDirty, withDraft, dirtyTemplateIds } from '../templateDraft';

const template = { id: 't', title: 'Letter', category: 'General', subject: 'Re', body: 'Hello', fields: [], isCustom: true };

describe('template drafts', () => {
  it('is clean until something changes', () => {
    expect(isDraftDirty(template, draftFrom(template))).toBe(false);
    expect(isDraftDirty(template, undefined)).toBe(false);
    expect(isDraftDirty(template, { ...draftFrom(template), body: 'Hello there' })).toBe(true);
  });

  it('shows the draft in place of the saved letter, keeping its id', () => {
    const draft = { ...draftFrom(template), body: 'Edited' };
    expect(withDraft(template, draft)).toMatchObject({ id: 't', body: 'Edited', isCustom: true });
    expect(withDraft(template, draftFrom(template))).toBe(template);
  });

  it('lists the letters with unsaved changes', () => {
    const other = { ...template, id: 'u' };
    const drafts = { t: { ...draftFrom(template), title: 'Renamed' }, u: draftFrom(other) };
    expect(dirtyTemplateIds([template, other], drafts)).toEqual(['t']);
  });
});
