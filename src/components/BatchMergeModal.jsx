import React, { useEffect, useMemo, useState } from 'react';
import {
  Upload,
  Users,
  FileSpreadsheet,
  AlertCircle,
  FileArchive,
  ArrowRight,
  Download,
  Loader2,
  Check,
  Bookmark,
} from 'lucide-react';
import {
  parseCsvFile,
  downloadSampleCsv,
  generateMergedRecords,
  findNameColumns,
  describeMapping,
  readMappedValue,
} from '../utils/csvParser';
import { findBatchGaps } from '../utils/batch';
import { needsValue } from '../utils/fieldDefs';
import { formatLabel } from '../utils/variableParser';
import { Modal, Button, SegmentedControl } from './ui';

const FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'both', label: 'Both' },
];

const SELECT =
  'w-full h-8 px-2 rounded-md border text-[12px] bg-surface-raised border-line text-ink outline-none ' +
  'focus:border-accent cursor-pointer';

export function BatchMergeModal({
  isOpen,
  onClose,
  template,
  variables,
  fieldTypes = {},
  fieldDefs = {},
  fieldsFor,
  presets,
  onApplyCsvBatch,
  onBatchExportZip,
  isBatchExporting,
  batchProgress,
  canBatchExport,
}) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [format, setFormat] = useState('pdf');
  const [withSummary, setWithSummary] = useState(true);

  // A CSV is matched to one letter's fields; another letter starts over.
  useEffect(() => {
    setParsed(null);
    setError('');
  }, [template?.id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const result = await parseCsvFile(file, variables, fieldTypes);
      if (!result.records.length) throw new Error('That file had no data rows.');
      setParsed(result);
    } catch (err) {
      setParsed(null);
      setError(err.message || 'Could not read that CSV.');
    }
    e.target.value = '';
  };

  /** Choose which column fills a field; '' leaves it to presets. */
  const setColumn = (variable, column) =>
    setParsed((prev) => {
      const columnMapping = { ...prev.columnMapping, [variable]: column };
      return {
        ...prev,
        columnMapping,
        records: generateMergedRecords(prev.data, columnMapping, fieldTypes),
      };
    });

  const combinedName = parsed ? findNameColumns(parsed.headers) : '';
  const hasColumn = (v) => Boolean(parsed?.columnMapping[v]);
  const hasPreset = (v) => String(presets?.[v] ?? '').trim() !== '';
  const matched = parsed ? variables.filter(hasColumn) : [];
  const unmatched = parsed ? variables.filter((v) => !hasColumn(v) && !hasPreset(v)) : [];

  // Rows whose letters would print placeholders such as "[Intake Date]".
  // Single letters ask before they leave the app; a batch lists them here.
  const gaps = useMemo(
    () =>
      parsed
        ? findBatchGaps(parsed.records, variables, presets, {
            fieldsFor,
            isMissing: (name, value) => needsValue(fieldDefs[name], value),
          })
        : [],
    // fieldsFor is rebuilt on every render; the letter it reads is in `variables`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, variables, presets, fieldDefs]
  );

  const labelOf = (name) => fieldDefs[name]?.label || formatLabel(name);

  const exportBatch = () => {
    const missing = new Map(gaps.map((row) => [row.index, row.missing.map(labelOf)]));
    onBatchExportZip(parsed.records, {
      formats: { pdf: format !== 'docx', docx: format !== 'pdf' },
      summary: withSummary,
      missingFor: (index) => missing.get(index) || [],
    });
  };
  const count = parsed?.records.length || 0;
  const exportLabel =
    format === 'docx'
      ? `Export ${count} Word files`
      : format === 'both'
        ? `Export ${count} PDFs and Word files`
        : `Export ${count} PDFs`;

  const progressPct = batchProgress.total
    ? (batchProgress.current / batchProgress.total) * 100
    : 0;

  const firstRow = parsed?.data?.[0] || {};

  return (
    <Modal
      isOpen={isOpen}
      onClose={isBatchExporting ? () => {} : onClose}
      title="CSV mail merge"
      subtitle={`Generate “${template?.title}” for a list of clients.`}
      icon={Users}
      width="max-w-2xl"
      footer={
        parsed && !isBatchExporting ? (
          <>
            <Button variant="ghost" onClick={onClose} className="mr-auto">
              Cancel
            </Button>
            <Button
              onClick={() => {
                onApplyCsvBatch(parsed.records);
                onClose();
              }}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Review in Quick Fill
            </Button>
            <Button
              variant="primary"
              onClick={exportBatch}
              disabled={!canBatchExport}
              title={
                canBatchExport
                  ? undefined
                  : 'Batch ZIP export needs the desktop app'
              }
            >
              <FileArchive className="w-3.5 h-3.5" />
              {exportLabel}
              {gaps.length > 0 ? ' anyway' : ''}
            </Button>
          </>
        ) : null
      }
    >
      <div className="p-6 space-y-5">
        {isBatchExporting ? (
          <div className="py-10 space-y-4 text-center">
            <Loader2
              className="w-7 h-7 mx-auto animate-spin text-accent"
            />
            <div className="text-[13px] font-medium text-ink">
              {batchProgress.message || 'Preparing…'}
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden mx-auto max-w-sm bg-surface-deep"
            >
              <div
                className="h-full rounded-full transition-all duration-200 bg-accent"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[11px] tabular-nums text-ink-muted">
              {batchProgress.current} of {batchProgress.total}
            </div>
          </div>
        ) : !parsed ? (
          <>
            <label className="block">
              <span
                className="flex flex-col items-center justify-center gap-2 h-40 rounded-xl
                           border border-dashed cursor-pointer border-line-strong bg-surface-sunken"
              >
                <Upload className="w-6 h-6 text-ink-faint" />
                <span className="text-[13px] font-semibold text-ink">
                  Choose a CSV file
                </span>
                <span className="text-[11px] text-ink-muted">
                  One row per client. You can check which column fills each field next.
                </span>
              </span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
            </label>

            {error && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-lg text-[12px] bg-danger-soft text-danger"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                {error}
              </div>
            )}

            <div
              className="flex items-center justify-between gap-4 p-4 rounded-xl border border-line"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink">
                  Need the right shape?
                </div>
                <div className="text-[11px] text-ink-muted">
                  Download a starter CSV with a column for each field in this letter.
                </div>
              </div>
              <Button onClick={() => downloadSampleCsv(template, variables)}>
                <Download className="w-3.5 h-3.5" />
                Sample CSV
              </Button>
            </div>
          </>
        ) : (
          <>
            <div
              className="flex items-center gap-3.5 p-4 rounded-xl bg-success-soft"
            >
              <FileSpreadsheet className="w-5 h-5 shrink-0 text-success" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink">
                  {parsed.records.length} records ready
                </div>
                <div className="text-[11px] text-ink-secondary">
                  {matched.length} of {variables.length} fields matched to columns
                </div>
              </div>
              <Button variant="ghost" onClick={() => setParsed(null)}>
                Change file
              </Button>
            </div>

            {unmatched.length > 0 && (
              <div className="flex items-start gap-2 p-3.5 rounded-lg text-[12px] bg-warning-soft text-warning">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>
                  <strong className="font-semibold">No column found for </strong>
                  {unmatched.map(labelOf).join(', ')}. Pick a column below, or these print as
                  placeholders.
                </span>
              </div>
            )}

            {/* Which column fills each field. Automatic matches are exact
                names or common aliases only, and every one can be changed. */}
            <div className="rounded-xl border overflow-hidden border-line">
              <div className="grid grid-cols-[1fr_1.1fr_1fr] gap-3 px-3 py-2 text-[11px] font-semibold bg-surface-sunken text-ink-secondary">
                <span>Field</span>
                <span>CSV column</span>
                <span>First row</span>
              </div>
              <ul className="max-h-60 overflow-y-auto">
                {variables.map((v) => {
                  const column = parsed.columnMapping[v] || '';
                  const sample = readMappedValue(firstRow, column);
                  return (
                    <li
                      key={v}
                      className="grid grid-cols-[1fr_1.1fr_1fr] gap-3 items-center px-3 py-1.5 border-t border-line-soft"
                    >
                      <span className="flex items-center gap-1.5 min-w-0 text-[12px] text-ink">
                        {column ? (
                          <Check className="w-3.5 h-3.5 shrink-0 text-success" />
                        ) : hasPreset(v) ? (
                          <Bookmark className="w-3.5 h-3.5 shrink-0 text-ink-faint" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-warning" />
                        )}
                        <span className="truncate">{labelOf(v)}</span>
                      </span>
                      <select
                        aria-label={`Column for ${labelOf(v)}`}
                        value={column}
                        onChange={(e) => setColumn(v, e.target.value)}
                        className={SELECT}
                      >
                        <option value="">
                          {hasPreset(v) ? 'None — use my preset' : 'None'}
                        </option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                        {combinedName && (
                          <option value={combinedName}>{describeMapping(combinedName)}</option>
                        )}
                      </select>
                      <span className="truncate text-[12px] text-ink-muted">
                        {column ? sample || '—' : hasPreset(v) ? presets[v] : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {gaps.length > 0 && (
              <div className="p-4 rounded-lg space-y-2.5 bg-warning-soft">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-warning">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {gaps.length} of {parsed.records.length} letters have empty fields
                </div>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {gaps.map((row) => (
                    <li key={row.index} className="text-[12px] text-ink-secondary">
                      <span className="font-semibold text-ink">{row.label}</span>
                      {' — '}
                      {row.missing.map(labelOf).join(', ')}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-ink-secondary">
                  These print as placeholders such as “[{formatLabel(gaps[0].missing[0])}]”. Add
                  the values to the CSV, or use Review in Quick Fill to fill them one letter at a time.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-line">
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] font-semibold text-ink-secondary">Save each letter as</span>
                <SegmentedControl value={format} onChange={setFormat} options={FORMATS} compact />
              </div>
              <label className="flex items-center gap-2 text-[12px] text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={withSummary}
                  onChange={(e) => setWithSummary(e.target.checked)}
                  className="w-3.5 h-3.5 accent-accent"
                />
                Include a summary (summary.csv)
              </label>
            </div>

            {!canBatchExport && (
              <p
                className="text-[11px] p-2.5 rounded-lg bg-surface-sunken text-ink-muted"
              >
                Batch ZIP export needs the LetterBank desktop app, which can write PDFs
                directly. In the browser, use <strong>Review in Quick Fill</strong> and
                export each letter individually.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
