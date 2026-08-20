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

export function renderTemplate(templateText, values = {}) {
  if (!templateText) return '';
  return templateText.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (match, varName) => {
    const val = values[varName];
    if (val !== undefined && val !== null && val !== '') {
      // Date inputs hand back ISO (2026-08-25). A clinical letter must never
      // read "scheduled for 2026-08-25" — render it as prose.
      if (inferFieldType(varName) === 'date') {
        return formatDateForDisplay(String(val));
      }
      return val;
    }
    // Return subtle placeholder if empty
    return `[${formatLabel(varName)}]`;
  });
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
