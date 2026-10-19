/**
 * Variable parser and template replacement engine
 */

export function extractVariables(text) {
  if (!text) return [];
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

export function formatLabel(varName) {
  return varName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bDob\b/g, 'DOB')
    .replace(/\bPcp\b/g, 'PCP')
    .replace(/\bCpt\b/g, 'CPT')
    .replace(/\bFmla\b/g, 'FMLA')
    .replace(/\bEsa\b/g, 'ESA');
}

export function inferFieldType(varName) {
  const lower = varName.toLowerCase();
  if (lower.includes('date') || lower.includes('dob') || lower.includes('deadline')) {
    return 'date';
  }
  if (
    lower.includes('details') ||
    lower.includes('summary') ||
    lower.includes('progress') ||
    lower.includes('notes') ||
    lower.includes('statement') ||
    lower.includes('referrals') ||
    lower.includes('reasons') ||
    lower.includes('observations') ||
    lower.includes('accommodations') ||
    lower.includes('resources')
  ) {
    return 'textarea';
  }
  return 'text';
}

/**
 * Field types a placeholder can take. `inferFieldType` guesses from the name;
 * a template's own `fields` list overrides the guess, which is how a custom
 * field picks its type when added from the editor's right-click menu.
 */
export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'textarea', label: 'Long text' },
];

/** Common fields offered in the editor's Insert field menu. */
export const BUILT_IN_FIELDS = [
  { name: 'date', type: 'date' },
  { name: 'client_name', type: 'text' },
  { name: 'client_first_name', type: 'text' },
  { name: 'client_dob', type: 'date' },
  { name: 'start_date', type: 'date' },
  { name: 'end_date', type: 'date' },
  { name: 'appointment_date', type: 'date' },
  { name: 'appointment_time', type: 'time' },
  { name: 'recipient_name', type: 'text' },
  { name: 'recipient_organization', type: 'text' },
  { name: 'diagnosis', type: 'text' },
  { name: 'clinical_summary', type: 'textarea' },
  { name: 'clinician_name', type: 'text' },
  { name: 'practice_name', type: 'text' },
  { name: 'practice_phone', type: 'text' },
  { name: 'practice_email', type: 'text' },
];

/** Turn whatever the clinician typed into a valid placeholder name. */
export function toFieldName(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** name -> type, from a template's `fields` list. */
export function fieldTypeMap(fields = []) {
  const map = {};
  (fields || []).forEach((f) => {
    if (f?.name && FIELD_TYPES.some((t) => t.value === f.type)) map[f.name] = f.type;
  });
  return map;
}

/** The declared type if the template has one, otherwise a guess from the name. */
export function fieldTypeFor(varName, types = {}) {
  return types[varName] || inferFieldType(varName);
}

/** "14:30" -> "2:30 PM". Anything else passes through untouched. */
export function formatTimeForDisplay(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!m) return value;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

export function renderTemplate(templateText, values = {}, types = {}) {
  if (!templateText) return '';
  return templateText.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (match, varName) => {
    const val = values[varName];
    if (val !== undefined && val !== null && val !== '') {
      const str = String(val);
      // Date inputs hand back ISO (2026-08-25). A clinical letter must never
      // read "scheduled for 2026-08-25" — render it as prose. Checked on the
      // value as well as the type, so a field whose declared type changed
      // after a date was picked still prints as prose.
      if (fieldTypeFor(varName, types) === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return formatDateForDisplay(str);
      }
      if (fieldTypeFor(varName, types) === 'time') return formatTimeForDisplay(str);
      return str;
    }
    // Return subtle placeholder if empty
    return `[${formatLabel(varName)}]`;
  });
}

/**
 * The header printed on page 2 onward. `{{subject}}` is the letter's subject
 * line; when a letter has none it falls back to the client's name, which is
 * what the header carried before it knew about subjects.
 */
export function renderContinuationHeader(text, { subject = '', clientName = '' } = {}) {
  const resolvedSubject = String(subject || '').trim() || clientName;
  return renderTemplate(text || '', { subject: resolvedSubject, client_name: clientName });
}

/**
 * Date presentation styles offered in document settings.
 * `format` receives a Date and returns the string that appears on the letter.
 */
export const DATE_FORMATS = {
  long: {
    label: 'August 25, 2026',
    format: (d) =>
      d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  },
  medium: {
    label: 'Aug 25, 2026',
    format: (d) =>
      d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  },
  dayFirst: {
    label: '25 August 2026',
    format: (d) =>
      `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getFullYear()}`,
  },
  weekday: {
    label: 'Tuesday, August 25, 2026',
    format: (d) =>
      d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
  },
  numeric: {
    label: '08/25/2026',
    format: (d) =>
      d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
  },
  iso: {
    label: '2026-08-25',
    format: (d) => toIsoDate(d),
  },
};

/** Local-time ISO date (yyyy-mm-dd), avoiding the UTC shift of toISOString. */
export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a yyyy-mm-dd string as a local date (not UTC midnight). */
export function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The date printed at the head of a letter.
 * `isoValue` empty means "today".
 */
export function formatLetterDate(isoValue, formatKey = 'long') {
  const date = parseIsoDate(isoValue) || new Date();
  const fmt = DATE_FORMATS[formatKey] || DATE_FORMATS.long;
  return fmt.format(date);
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function monthIndex(name) {
  const lower = String(name).toLowerCase().replace(/\.$/, '');
  return MONTHS.findIndex((m) => m === lower || (lower.length >= 3 && m.startsWith(lower)));
}

function isoFromParts(y, m, d) {
  let year = Number(y);
  if (String(y).length === 2) year += year >= 70 ? 1900 : 2000;
  const date = new Date(year, Number(m) - 1, Number(d));
  if (date.getFullYear() !== year || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    return null; // 02/31/2026 and the like
  }
  return toIsoDate(date);
}

/**
 * Turn a date as spreadsheets write it into yyyy-mm-dd: 10/22/2026, 10-22-26,
 * 2026/10/22, Oct 22, 2026, 22 October 2026. Slashed dates are read
 * month-first, the US convention. Anything unrecognised is returned unchanged.
 */
export function normalizeDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return text;
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text))) return isoFromParts(m[1], m[2], m[3]) || text;
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text))) return isoFromParts(m[3], m[1], m[2]) || text;
  if ((m = /^([A-Za-z]+\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(text))) {
    const month = monthIndex(m[1]);
    if (month >= 0) return isoFromParts(m[3], month + 1, m[2]) || text;
  }
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+\.?),?\s+(\d{4})$/.exec(text))) {
    const month = monthIndex(m[2]);
    if (month >= 0) return isoFromParts(m[3], month + 1, m[1]) || text;
  }
  return text;
}

/** "2:30 PM" or "2:30pm" -> "14:30", what a time picker holds. Others unchanged. */
export function normalizeTime(value) {
  const text = String(value ?? '').trim();
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i.exec(text);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'p') h += 12;
    return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (h24 && Number(h24[1]) < 24) return `${h24[1].padStart(2, '0')}:${h24[2]}`;
  return text;
}

export function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  // Check if it's YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return dateStr;
}



const CLOSING_SALUTATIONS = [
  'warm regards',
  'warmly',
  'kind regards',
  'best regards',
  'with warm regards',
  'regards',
  'sincerely',
  'respectfully',
  'respectfully submitted',
  'in partnership',
  'gratefully',
  'thank you',
];

/**
 * True if `text` opens with a closing salutation (e.g. a signature block).
 */
export function startsWithClosing(text) {
  const first = (text || '').trim().split('\n')[0].trim().replace(/[,.]$/, '');
  return CLOSING_SALUTATIONS.includes(first.toLowerCase());
}

/**
 * Remove a trailing closing salutation from a letter body.
 *
 * 12 of the 15 default templates end with their own "Sincerely," while the
 * default signature block opens with "Warm regards,". Every one of those
 * letters printed a doubled — and mismatched — sign-off:
 *
 *     ...look forward to working with you.
 *     Sincerely,          <- template body
 *     Warm regards,       <- signature block
 *     [signature]
 *
 * The signature block owns the sign-off, so the body's copy is dropped. Doing
 * it here rather than editing the templates also covers letters the clinician
 * writes or imports themselves.
 */
export function stripTrailingClosing(body) {
  if (!body) return body;
  const lines = body.replace(/\s+$/, '').split('\n');

  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
    const candidate = lines[i].trim().replace(/[,.]$/, '');
    if (!candidate) continue;
    if (CLOSING_SALUTATIONS.includes(candidate.toLowerCase())) {
      return lines.slice(0, i).join('\n').replace(/\s+$/, '');
    }
    break; // only a genuinely trailing salutation counts
  }

  return body;
}
