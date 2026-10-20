/**
 * One Pronouns field drives every pronoun in a letter:
 *
 *   {{they}} {{them}} {{their}} {{theirs}} {{themselves}}
 *   {{they_are}} {{they_were}} {{they_have}}     (verb agrees: "she is")
 *
 * Capitalised at the start of a sentence: {{They}}, {{Their}}, {{They_are}}…
 * These are not fields of their own; Quick Fill shows the one Pronouns field.
 *
 * A letter about more than one person, or a client who uses she/they, can
 * set any single pronoun apart from the letter's choice. Those overrides are
 * kept by position ("body:2" is the third pronoun in the body) and, like
 * every client detail, live only in memory.
 */

export const PRONOUN_FIELD = 'pronouns';
/** Where Quick Fill keeps a letter's single-pronoun overrides, beside its values. */
export const PRONOUN_OVERRIDES = '@pronouns';
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

/** The word a pronoun placeholder prints for one set: ('Their', 'she') -> 'Her'. */
export function pronounWord(token, set) {
  const base = token.toLowerCase();
  const word = SETS[set]?.[base];
  if (!word) return '';
  return token === base ? word : capitalise(word);
}

/** The set a pronoun choice stands for: 'she', 'he' or 'they'. */
export const pronounSet = (value) => setFor(value);

const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

/** Every pronoun placeholder in `text`, in order: [{ key, token, start, end }]. */
export function pronounSpots(text, part) {
  const spots = [];
  for (const match of String(text ?? '').matchAll(PLACEHOLDER_RE)) {
    if (!isPronounToken(match[1])) continue;
    spots.push({
      key: `${part}:${spots.length}`,
      token: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spots;
}

/** `text` with each overridden pronoun written out in its own set. */
export function applyPronounOverrides(text, overrides, part) {
  const source = String(text ?? '');
  if (!overrides || !Object.keys(overrides).length) return source;
  let out = '';
  let at = 0;
  for (const spot of pronounSpots(source, part)) {
    const word = pronounWord(spot.token, overrides[spot.key]);
    if (!word) continue;
    out += source.slice(at, spot.start) + word;
    at = spot.end;
  }
  return out + source.slice(at);
}
