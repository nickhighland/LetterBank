import {
  BUILT_IN_FIELDS,
  FIELD_TYPES,
  extractVariables,
  formatLabel,
  inferFieldType,
  normalizeDate,
  normalizeTime,
  renderTemplate,
  toFieldName,
} from './variableParser';
import { describeConditions, evaluateConditions, isYes } from './conditions';
import { PRONOUN_FIELD, PRONOUN_OPTIONS, isPronounToken, normalisePronouns, pronounValues } from './pronouns';

/**
 * What each field in a letter is: its label, type, help text and, for a
 * dropdown, its choices.
 *
 * A field's definition comes from, in order:
 *   1. the clinician's field library (Settings › My fields), so changing a
 *      library field changes it in every letter;
 *   2. the letter's own `fields` list (fields made for one letter, and a copy
 *      of each library field it uses, in case that is later deleted);
 *   3. the built-in fields offered in the Insert field menu;
 *   4. a guess from the name and from how the letter uses it: a field only
 *      ever tested in [[if …]] is a Yes/No, or a Dropdown of the values it is
 *      compared with.
 */

const TYPE_VALUES = new Set(FIELD_TYPES.map((t) => t.value));

const PRONOUN_DEF = {
  ...BUILT_IN_FIELDS.find((f) => f.name === PRONOUN_FIELD),
  options: PRONOUN_OPTIONS,
};

const cleanOptions = (options) => {
  const list = Array.isArray(options) ? options : String(options || '').split('\n');
  const seen = new Set();
  return list
    .map((o) => String(o ?? '').trim())
    .filter((o) => o && !seen.has(o.toLowerCase()) && seen.add(o.toLowerCase()));
};

/** A field definition with every property present and valid, or null. */
export function normaliseFieldDef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = toFieldName(raw.name);
  if (!name) return null;
  const type = TYPE_VALUES.has(raw.type) ? raw.type : 'text';
  const def = {
    name,
    label: String(raw.label || '').trim() || formatLabel(name),
    type,
    help: String(raw.help || '').trim(),
    options: type === 'select' ? cleanOptions(raw.options) : [],
  };
  if (raw.defaultValue !== undefined && raw.defaultValue !== '') def.defaultValue = raw.defaultValue;
  return def;
}

/** The saved field library: valid, one entry per name, no reserved names. */
export function normaliseFieldLibrary(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .map(normaliseFieldDef)
    .filter((def) => {
      if (!def || seen.has(def.name)) return false;
      if (def.name === PRONOUN_FIELD || isPronounToken(def.name)) return false;
      seen.add(def.name);
      return true;
    });
}

/** The field a placeholder belongs to: {{their}} belongs to Pronouns. */
export const fieldNameFor = (name) => (isPronounToken(name) ? PRONOUN_FIELD : name);

const unique = (names) => [...new Set(names.map(fieldNameFor))];

/**
 * Every field `text` can ask for, whichever way its conditions go, in order of
 * appearance. Used to match CSV columns, where each row decides differently.
 */
export function allLetterFields(text) {
  const names = [];
  const re = /\{\{([a-zA-Z0-9_-]+)\}\}|\[\[\s*if\s+(?:not\s+)?([a-zA-Z0-9_-]+)/gi;
  for (const m of String(text || '').matchAll(re)) names.push(m[1] || m[2]);
  return unique(names);
}

/** The fields `text` uses with these values: what Quick Fill shows. */
export function letterFieldsInUse(text, values = {}) {
  return unique(evaluateConditions(text, values).names);
}

/** Definitions for `names`, as described at the top of this file. */
export function resolveFieldDefs(names, { text = '', library = [], templateFields = [] } = {}) {
  const byName = (list) => new Map((list || []).filter((f) => f?.name).map((f) => [f.name, f]));
  const lib = byName(library);
  const own = byName(templateFields);
  const builtIn = byName(BUILT_IN_FIELDS);
  const conditions = describeConditions(text);
  const printed = new Set(extractVariables(text));

  const defs = {};
  for (const name of names) {
    if (name === PRONOUN_FIELD) {
      defs[name] = { ...PRONOUN_DEF, source: 'built-in' };
      continue;
    }
    const source = lib.has(name) ? 'library' : own.has(name) ? 'letter' : builtIn.has(name) ? 'built-in' : 'auto';
    const base = lib.get(name) || own.get(name) || builtIn.get(name) || {};
    const tested = conditions.get(name);

    let type = TYPE_VALUES.has(base.type) ? base.type : null;
    if (!type && tested && !printed.has(name)) type = tested.values.length ? 'select' : 'yesno';
    if (!type) type = inferFieldType(name);

    let options = cleanOptions(base.options);
    if (type === 'select' && !options.length && tested) options = tested.values;

    defs[name] = {
      name,
      label: base.label || formatLabel(name),
      type,
      help: base.help || '',
      options,
      defaultValue: base.defaultValue,
      source,
    };
  }
  return defs;
}

/**
 * A letter's own field list with `def` recorded in it. A definition is kept
 * when a guess from the name would get the field wrong ("return_to_work"
 * taken for a Date), and as a copy of a My fields entry, so the letter still
 * works if that is later deleted. A field the guess gets right is left out.
 */
export function withFieldDef(fields = [], def) {
  const plain =
    def.type === inferFieldType(def.name) &&
    def.label === formatLabel(def.name) &&
    !def.help &&
    !(def.options || []).length;
  const known = fields.find((f) => f.name === def.name);
  if (plain && !known) return fields;
  const others = fields.filter((f) => f.name !== def.name);
  const entry = { ...def, defaultValue: known?.defaultValue ?? def.defaultValue ?? '' };
  delete entry.source;
  return plain ? others : [...others, entry];
}

/** name -> type, for renderTemplate and the CSV reader. */
export function typesOf(defs) {
  const types = {};
  Object.values(defs).forEach((def) => {
    types[def.name] = def.type;
  });
  return types;
}

/** name -> label, for the placeholder an empty field prints: "[Client legal name]". */
export function labelsOf(defs) {
  const labels = {};
  Object.values(defs).forEach((def) => {
    labels[def.name] = def.label;
  });
  return labels;
}

/**
 * True when a field still needs filling in before the letter goes out. A
 * Yes/No left unticked is a No, and Pronouns defaults to they/them.
 */
export function needsValue(def, value) {
  if (def?.type === 'yesno' || def?.name === PRONOUN_FIELD) return false;
  return !String(value ?? '').trim();
}

/** A value typed in a spreadsheet, as the field's own picker would hold it. */
export function normaliseFieldValue(value, type, name) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (name === PRONOUN_FIELD) return normalisePronouns(text);
  if (type === 'date') return normalizeDate(text);
  if (type === 'time') return normalizeTime(text);
  if (type === 'yesno') return isYes(text) ? 'yes' : 'no';
  return text;
}

/** Values as the letter prints them, with every pronoun filled in. */
export function letterValues(values = {}) {
  return { ...values, ...pronounValues(values[PRONOUN_FIELD]) };
}

/** Template text with its conditions decided and its fields filled in. */
export function renderLetter(text, values = {}, types = {}, labels = {}) {
  const chosen = evaluateConditions(text, values).text;
  return renderTemplate(chosen, letterValues(values), types, labels);
}
