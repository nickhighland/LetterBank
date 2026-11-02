import { toFieldName, startsWithClosing } from '../utils/variableParser';
import { normaliseFieldDef, withFieldDef, allLetterFields } from '../utils/fieldDefs';
import { isPronounToken, PRONOUN_FIELD } from '../utils/pronouns';

/**
 * Turn what the AI wrote into a LetterBank template.
 *
 * Big cloud models return exactly the JSON asked for. Small local models
 * wrap it in a code fence, think aloud first, put raw line breaks inside
 * strings, or write {{she}} for a pronoun; all of that is tidied here, so
 * every service ends up with the same kind of letter.
 */

/** Strings with raw line breaks or tabs inside them, made valid JSON. */
function escapeControlCharsInStrings(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      else if (ch === '\n') {
        out += '\\n';
        continue;
      } else if (ch === '\r') continue;
      else if (ch === '\t') {
        out += '\\t';
        continue;
      }
    } else if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
}

/** The JSON object in a reply, however it was wrapped. Throws if there is none. */
export function extractJson(text) {
  let s = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fenced && fenced[1].includes('{')) s = fenced[1];
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON');
  const candidate = s.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(escapeControlCharsInStrings(candidate));
  }
}

// What a model writes when it forgets the pronoun placeholders.
const PRONOUN_FIXES = {
  she: 'they',
  he: 'they',
  her: 'their',
  his: 'their',
  him: 'them',
  hers: 'theirs',
  herself: 'themselves',
  himself: 'themselves',
  she_is: 'they_are',
  he_is: 'they_are',
  she_was: 'they_were',
  he_was: 'they_were',
  she_has: 'they_have',
  he_has: 'they_have',
};

/** "{{ Client Name }}" -> "{{client_name}}"; pronouns keep their capital. */
function cleanPlaceholder(raw) {
  const inner = String(raw).trim();
  if (isPronounToken(inner)) return inner;
  const lower = inner.toLowerCase().replace(/\s+/g, '_');
  const capital = /^[A-Z]/.test(inner);
  const pronoun = isPronounToken(lower) ? lower : PRONOUN_FIXES[lower];
  if (pronoun) return capital ? pronoun.charAt(0).toUpperCase() + pronoun.slice(1) : pronoun;
  return toFieldName(inner);
}

export function cleanPlaceholders(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, inner) => {
      const name = cleanPlaceholder(inner);
      return name ? `{{${name}}}` : match;
    });
}

const ONLY_FIELDS_RE = /^\s*(\{\{[a-zA-Z0-9_-]+\}\}[\s,.•|-]*)+$/;

/**
 * The body without what LetterBank prints by itself: a date line at the top,
 * and a signature block under the closing ("Sincerely," then
 * {{clinician_name}}…), which would otherwise print twice.
 */
export function tidyBody(body) {
  const lines = cleanPlaceholders(body).trim().split('\n');

  if (lines.length > 1 && /^\s*\{\{[a-z0-9_]*date[a-z0-9_]*\}\}\s*$/i.test(lines[0])) {
    lines.shift();
    while (lines.length && !lines[0].trim()) lines.shift();
  }

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 8); i--) {
    if (!startsWithClosing(lines[i])) continue;
    const after = lines.slice(i + 1);
    if (after.length && after.every((l) => !l.trim() || ONLY_FIELDS_RE.test(l))) {
      lines.length = i + 1;
    }
    break;
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * A template from the AI's reply. `base` is the letter being rewritten, if
 * any: its id stays, and its field definitions are kept unless the AI
 * redefined them. Throws with a message for the clinician when the reply has
 * no letter in it.
 */
export function letterFromReply(text, { base = null, truncated = false, makeId } = {}) {
  let parsed;
  try {
    parsed = extractJson(text);
  } catch {
    throw new Error(
      truncated
        ? 'The AI stopped before it finished the letter. Try again, or ask for a shorter letter.'
        : 'The AI’s reply wasn’t a letter LetterBank could read. Try again, or try another model.'
    );
  }
  const body = tidyBody(str(parsed?.body));
  if (!body) {
    throw new Error(
      truncated
        ? 'The AI stopped before it finished the letter. Try again, or ask for a shorter letter.'
        : 'The AI’s reply had no letter in it. Try again, or describe the letter differently.'
    );
  }

  const subject = cleanPlaceholders(str(parsed.subject)).replace(/\n+/g, ' ');
  const recipient = cleanPlaceholders(str(parsed.recipient));
  const used = new Set(allLetterFields(`${recipient}\n\n${body}\n\n${subject}`));

  // Field definitions: the letter's own, then the AI's, for fields in use.
  let fields = (base?.fields || []).filter((f) => used.has(f.name));
  const defs = Array.isArray(parsed.fields) ? parsed.fields : [];
  for (const raw of defs) {
    const def = normaliseFieldDef(raw);
    if (!def || !used.has(def.name) || def.name === PRONOUN_FIELD || isPronounToken(def.name)) continue;
    if (def.type === 'select' && !def.options.length) def.type = 'text';
    fields = withFieldDef(fields, def);
  }

  return {
    ...(base || {}),
    id: base?.id || (makeId ? makeId() : `custom-${Date.now()}`),
    title: str(parsed.title) || base?.title || 'Untitled letter',
    category: str(parsed.category) || base?.category || 'General',
    description: str(parsed.description) || base?.description || '',
    subject,
    recipient,
    body,
    fields,
    icon: base?.icon || 'Sparkles',
    isCustom: true,
    note: str(parsed.note),
  };
}
