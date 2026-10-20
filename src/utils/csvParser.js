import Papa from 'papaparse';
import { fieldTypeFor } from './variableParser';
import { normaliseFieldValue } from './fieldDefs';

/**
 * Parses CSV file and auto-maps columns to template variables
 */
export function parseCsvFile(file, variables = [], types = {}) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const columnMapping = autoMapHeaders(headers, variables);
        const records = generateMergedRecords(results.data, columnMapping, types);

        resolve({
          data: results.data,
          headers,
          columnMapping,
          records,
          errors: results.errors,
        });
      },
      error: (err) => reject(err),
    });
  });
}

export function parseCsvString(csvText, variables = [], types = {}) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const columnMapping = autoMapHeaders(headers, variables);
        const records = generateMergedRecords(results.data, columnMapping, types);

        resolve({
          data: results.data,
          headers,
          columnMapping,
          records,
          errors: results.errors,
        });
      },
      error: (err) => reject(err),
    });
  });
}

/** "Date of Birth" -> "dateofbirth", for comparing headers with field names. */
export const normalizeHeader = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Other names an EHR or spreadsheet export uses for a field.
 *
 * Matching used to accept any header that contained the field name or was
 * contained by it, so a client list with Client, DOB, Email and Phone columns
 * printed the client's name as their date of birth and replaced the practice's
 * phone and email with the client's. Matches are now exact, after removing
 * case and punctuation, or one of these aliases. Practice fields have no
 * aliases on purpose: a "Phone" column in a client list is the client's phone.
 */
export const HEADER_ALIASES = {
  client_name: ['client', 'name', 'fullname', 'clientfullname', 'patient', 'patientname', 'patientfullname'],
  client_first_name: ['firstname', 'first', 'givenname', 'clientfirstname', 'patientfirstname'],
  client_last_name: ['lastname', 'last', 'surname', 'familyname', 'clientlastname', 'patientlastname'],
  client_dob: ['dob', 'dateofbirth', 'birthdate', 'birthday', 'clientdateofbirth', 'patientdob'],
  client_email: ['email', 'emailaddress', 'clientemailaddress'],
  client_phone: ['phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'mobilephone'],
  client_address: ['address', 'streetaddress', 'mailingaddress'],
  client_pronouns: ['pronouns', 'pronoun'],
  pronouns: ['pronoun', 'clientpronouns'],
};

/** Mapping value that joins a first-name and a last-name column. */
export const COMBINE_PREFIX = 'combine:';
const FIRST_NAME = ['firstname', 'first', 'givenname', 'clientfirstname', 'patientfirstname'];
const LAST_NAME = ['lastname', 'last', 'surname', 'familyname', 'clientlastname', 'patientlastname'];

/** "First Name" + "Last Name" columns, when a letter wants one full name. */
export function findNameColumns(headers) {
  const first = headers.find((h) => FIRST_NAME.includes(normalizeHeader(h)));
  const last = headers.find((h) => LAST_NAME.includes(normalizeHeader(h)));
  return first && last ? `${COMBINE_PREFIX}${first}|${last}` : '';
}

export function describeMapping(mapping) {
  if (!mapping) return '';
  if (mapping.startsWith(COMBINE_PREFIX)) return mapping.slice(COMBINE_PREFIX.length).split('|').join(' + ');
  return mapping;
}

/**
 * Map each template field to a CSV column: field -> header, or '' when no
 * column matches. A column is used for at most one field.
 */
export function autoMapHeaders(headers, templateVariables) {
  const mapping = {};
  const used = new Set();
  const byName = new Map(headers.map((h) => [normalizeHeader(h), h]));

  const take = (variable, header) => {
    mapping[variable] = header;
    used.add(header);
  };

  // Exact names first, so an alias never takes a column another field names exactly.
  templateVariables.forEach((variable) => {
    const exact = byName.get(normalizeHeader(variable));
    if (exact && !used.has(exact)) take(variable, exact);
  });

  templateVariables.forEach((variable) => {
    if (mapping[variable]) return;
    const alias = (HEADER_ALIASES[variable] || [])
      .map((name) => byName.get(name))
      .find((header) => header && !used.has(header));
    if (alias) {
      take(variable, alias);
    } else if (variable === 'client_name' && findNameColumns(headers)) {
      mapping[variable] = findNameColumns(headers);
    } else {
      mapping[variable] = '';
    }
  });

  return mapping;
}

/** A cell's value for one field under the current mapping. */
export function readMappedValue(row, mapping) {
  if (!mapping) return undefined;
  if (mapping.startsWith(COMBINE_PREFIX)) {
    const parts = mapping
      .slice(COMBINE_PREFIX.length)
      .split('|')
      .map((col) => String(row[col] ?? '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(' ') : undefined;
  }
  return row[mapping] === undefined ? undefined : String(row[mapping]).trim();
}

/**
 * One record per row. Values are normalised to what the pickers use: dates
 * and times (2026-10-22, 14:30), so "10/22/2026" prints as "October 22, 2026"
 * like a date picked by hand; Yes/No answers ("TRUE", "Y"); pronouns.
 */
export function generateMergedRecords(csvRows, columnMapping, types = {}) {
  return csvRows.map((row, index) => {
    const recordValues = {};
    Object.entries(columnMapping).forEach(([templateVar, csvCol]) => {
      const value = readMappedValue(row, csvCol);
      if (value === undefined) return;
      recordValues[templateVar] = normaliseFieldValue(value, fieldTypeFor(templateVar, types), templateVar);
    });
    return {
      _rowIndex: index + 1,
      _originalRow: row,
      values: recordValues,
    };
  });
}

export function generateSampleCsv(template, variables = []) {
  const headers = variables.length > 0 ? variables : ['client_name', 'intake_date', 'practice_name'];
  const row1 = headers.map((h) => {
    if (h.includes('name')) return 'Jordan Taylor';
    if (h.includes('date')) return '2026-08-25';
    if (h.includes('email')) return 'jordan.taylor@example.com';
    if (h.includes('phone')) return '(555) 234-5678';
    return 'Sample Value';
  });
  const row2 = headers.map((h) => {
    if (h.includes('name')) return 'Alex Morgan';
    if (h.includes('date')) return '2026-08-28';
    if (h.includes('email')) return 'alex.morgan@example.com';
    if (h.includes('phone')) return '(555) 876-5432';
    return 'Sample Value';
  });

  return [headers.join(','), row1.join(','), row2.join(',')].join('\n');
}

export function downloadSampleCsv(template, variables = []) {
  const csvContent = generateSampleCsv(template, variables);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${(template?.title || 'template').replace(/[^a-zA-Z0-9_-]/g, '_')}_sample.csv`);
  link.click();
  URL.revokeObjectURL(url);
}
