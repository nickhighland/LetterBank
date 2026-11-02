import { PRONOUN_OPTIONS } from '../utils/pronouns';

/**
 * Before a description goes to an AI service off this computer, look for
 * what reads like a client's details in it: anything typed into a letter in
 * Quick Fill this session, and email addresses, phone numbers, Social
 * Security numbers and full dates. The clinician is asked before it is sent.
 *
 * Practice details are not client details, so the clinician's own presets
 * never count.
 */

const PATTERNS = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, // email
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /(?:\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g, // phone
  /\b\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2})\b/g, // 3/14/1990
  /\b\d{4}-\d{2}-\d{2}\b/g, // 1990-03-14
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi, // March 14, 1990
];

const IGNORED_VALUES = new Set(['yes', 'no', 'true', 'false', ...PRONOUN_OPTIONS]);

const lower = (s) => String(s ?? '').toLowerCase();

/** Every value typed into any open letter, minus the clinician's own presets. */
function typedValues(valuesCache = {}, presets = {}) {
  const presetValues = new Set(Object.values(presets || {}).map((v) => lower(v).trim()).filter(Boolean));
  const found = [];
  for (const values of Object.values(valuesCache || {})) {
    for (const [name, value] of Object.entries(values || {})) {
      if (name.startsWith('@') || typeof value !== 'string') continue;
      const text = value.trim();
      if (text.length < 3 || IGNORED_VALUES.has(lower(text)) || presetValues.has(lower(text))) continue;
      found.push({ name, text });
    }
  }
  return found;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsWord = (haystack, needle) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}($|[^\\p{L}\\p{N}])`, 'iu').test(haystack);

/**
 * What in `text` looks like a client's details: a list of the words found,
 * at most `limit` of them, or [] when nothing does.
 */
export function clientDetailsIn(text, { valuesCache = {}, presets = {}, limit = 5 } = {}) {
  const source = String(text || '');
  if (!source.trim()) return [];
  const presetText = Object.values(presets || {}).map(lower).join('\n');
  const found = new Map();
  const add = (s) => {
    const key = lower(s);
    if (!found.has(key) && !presetText.includes(key)) found.set(key, s);
  };

  for (const { name, text: value } of typedValues(valuesCache, presets)) {
    if (containsWord(source, value)) add(value);
    // A name is often given in part: "a letter for Jordan".
    else if (name.includes('name')) {
      value
        .split(/\s+/)
        .filter((w) => w.length >= 3 && /^\p{Lu}/u.test(w))
        .forEach((w) => containsWord(source, w) && add(w));
    }
  }
  for (const re of PATTERNS) {
    for (const m of source.matchAll(re)) add(m[0]);
  }
  return [...found.values()].slice(0, limit);
}
