import { TEMPLATE_CATEGORIES } from '../data/defaultTemplates';

/**
 * Letter categories. The standard ones come with LetterBank; a clinician can
 * file a letter under any name of their own (Editor › Category) and rename a
 * category everywhere at once (double-click it in the sidebar).
 */

const STANDARD = TEMPLATE_CATEGORIES.filter((c) => c !== 'All');

const categoryOf = (template) => String(template?.category || '').trim();

/** The categories letters are filed under: standard ones in their usual order, then the clinician's own. */
export function categoriesInUse(templates) {
  const used = new Set(templates.map(categoryOf).filter(Boolean));
  return [...STANDARD.filter((c) => used.has(c)), ...[...used].filter((c) => !STANDARD.includes(c))];
}

/** What to offer when choosing a letter's category: every standard one and the clinician's own. */
export function categoryChoices(templates) {
  return [...STANDARD, ...categoriesInUse(templates).filter((c) => !STANDARD.includes(c))];
}

/** Every letter filed under `from`, filed under `to` instead. Unchanged letters keep their identity. */
export function renameCategory(templates, from, to) {
  const name = String(to || '').trim();
  if (!name || name === from) return templates;
  return templates.map((t) => (categoryOf(t) === from ? { ...t, category: name } : t));
}
