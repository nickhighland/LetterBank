/**
 * CSV mail merge: turning a spreadsheet row into a letter's values.
 */

const isBlank = (value) => String(value ?? '').trim() === '';

/**
 * The values one row's letter is written with.
 *
 * A row only carries the columns the spreadsheet had, so on its own it left
 * every practice field empty and batch letters printed "[Practice Name]".
 * The active practice's presets go underneath, and the row's own non-empty
 * cells win over them.
 */
export function mergeRecordValues(rowValues = {}, presets = {}, variables = []) {
  const merged = {};
  variables.forEach((name) => {
    if (!isBlank(presets?.[name])) merged[name] = presets[name];
  });
  Object.entries(rowValues || {}).forEach(([name, value]) => {
    if (!isBlank(value)) merged[name] = value;
  });
  return merged;
}

/** Fields a letter uses that have no value. */
export function missingFields(variables = [], values = {}) {
  return variables.filter((name) => isBlank(values?.[name]));
}

/**
 * Rows whose letters would print placeholders, for the check before a batch
 * export: [{ index, label, missing: [field names] }].
 *
 * `fieldsFor(values)` names the fields one row's letter uses, since optional
 * wording can differ row to row; `isMissing(name, value)` decides whether a
 * value counts as filled in (an unticked Yes/No does).
 */
export function findBatchGaps(records = [], variables = [], presets = {}, options = {}) {
  const { fieldsFor = () => variables, isMissing = (_name, value) => isBlank(value) } = options;
  return records
    .map((record, index) => {
      const values = mergeRecordValues(record.values, presets, variables);
      return {
        index,
        label: values.client_name || `Row ${index + 1}`,
        missing: fieldsFor(values).filter((name) => isMissing(name, values[name])),
      };
    })
    .filter((row) => row.missing.length > 0);
}
