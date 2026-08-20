import Papa from 'papaparse';

/**
 * Parses CSV file and auto-maps columns to template variables
 */
export function parseCsvFile(file, variables = []) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const columnMapping = autoMapHeaders(headers, variables);
        const records = generateMergedRecords(results.data, columnMapping);

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

export function parseCsvString(csvText, variables = []) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const columnMapping = autoMapHeaders(headers, variables);
        const records = generateMergedRecords(results.data, columnMapping);

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

export function autoMapHeaders(headers, templateVariables) {
  const mapping = {};

  templateVariables.forEach((variable) => {
    const cleanVar = variable.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Try exact or close match
    const exactMatch = headers.find(
      (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanVar
    );

    if (exactMatch) {
      mapping[variable] = exactMatch;
      return;
    }

    // Try fuzzy match
    const fuzzyMatch = headers.find((h) => {
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanH.includes(cleanVar) || cleanVar.includes(cleanH);
    });

    if (fuzzyMatch) {
      mapping[variable] = fuzzyMatch;
    } else {
      mapping[variable] = ''; // unmapped
    }
  });

  return mapping;
}

export function generateMergedRecords(csvRows, columnMapping) {
  return csvRows.map((row, index) => {
    const recordValues = {};
    Object.entries(columnMapping).forEach(([templateVar, csvCol]) => {
      if (csvCol && row[csvCol] !== undefined) {
        recordValues[templateVar] = String(row[csvCol]).trim();
      }
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
