import { describe, it, expect } from 'vitest';
import { categoriesInUse, categoryChoices, renameCategory } from '../categories';

const letters = [
  { id: 'a', category: 'Legal & Court' },
  { id: 'b', category: 'School Letters ' },
  { id: 'c', category: 'Intake & Orientation' },
  { id: 'd', category: 'Legal & Court' },
];

describe('letter categories', () => {
  it('lists the ones in use, standard ones first in their usual order', () => {
    expect(categoriesInUse(letters)).toEqual(['Intake & Orientation', 'Legal & Court', 'School Letters']);
  });

  it('offers every standard category and the clinician’s own', () => {
    const choices = categoryChoices(letters);
    expect(choices).toContain('Administrative & Billing');
    expect(choices[choices.length - 1]).toBe('School Letters');
  });

  it('renames a category on every letter in it', () => {
    const renamed = renameCategory(letters, 'Legal & Court', '  Court ');
    expect(renamed.map((t) => t.category)).toEqual(['Court', 'School Letters ', 'Intake & Orientation', 'Court']);
    expect(renamed[2]).toBe(letters[2]);
    expect(renameCategory(letters, 'Legal & Court', '   ')).toBe(letters);
  });
});
