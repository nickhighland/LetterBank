/**
 * One Pronouns field drives every pronoun in a letter:
 *
 *   {{they}} {{them}} {{their}} {{theirs}} {{themselves}}
 *   {{they_are}} {{they_were}} {{they_have}}     (verb agrees: "she is")
 *
 * Capitalised at the start of a sentence: {{They}}, {{Their}}, {{They_are}}…
 * These are not fields of their own; Quick Fill shows the one Pronouns field.
 */

export const PRONOUN_FIELD = 'pronouns';
export const PRONOUN_OPTIONS = ['they/them', 'she/her', 'he/him'];

const SETS = {
  they: {
    they: 'they',
    them: 'them',
    their: 'their',
    theirs: 'theirs',
    themselves: 'themselves',
    they_are: 'they are',
    they_were: 'they were',
    they_have: 'they have',
  },
  she: {
    they: 'she',
    them: 'her',
    their: 'her',
    theirs: 'hers',
    themselves: 'herself',
    they_are: 'she is',
    they_were: 'she was',
    they_have: 'she has',
  },
  he: {
    they: 'he',
    them: 'him',
    their: 'his',
    theirs: 'his',
    themselves: 'himself',
    they_are: 'he is',
    they_were: 'he was',
    they_have: 'he has',
  },
};

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const BASE_TOKENS = Object.keys(SETS.they);

/** Every placeholder the Pronouns field fills. */
export const PRONOUN_TOKENS = new Set([...BASE_TOKENS, ...BASE_TOKENS.map(capitalise)]);

export const isPronounToken = (name) => PRONOUN_TOKENS.has(name);

/** "She/Her", "she", "her" -> 'she'; anything unrecognised is they/them. */
function setFor(value) {
  const v = String(value || '').trim().toLowerCase();
  if (/^(she|her|hers)\b/.test(v)) return 'she';
  if (/^(he|him|his)\b/.test(v)) return 'he';
  return 'they';
}

/** The Pronouns value as Quick Fill offers it: "she/her", "he/him" or "they/them". */
export function normalisePronouns(value) {
  if (!String(value || '').trim()) return '';
  return PRONOUN_OPTIONS[['they', 'she', 'he'].indexOf(setFor(value))];
}

/** Values for every pronoun placeholder, from the Pronouns field. */
export function pronounValues(value) {
  const set = SETS[setFor(value)];
  const out = { [PRONOUN_FIELD]: normalisePronouns(value) || PRONOUN_OPTIONS[0] };
  for (const [token, word] of Object.entries(set)) {
    out[token] = word;
    out[capitalise(token)] = capitalise(word);
  }
  return out;
}
