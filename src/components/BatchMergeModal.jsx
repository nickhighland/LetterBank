import React, { useState } from 'react';
import {
  Upload,
  Users,
  FileSpreadsheet,
  AlertCircle,
  FileArchive,
  ArrowRight,
  Download,
  Loader2,
} from 'lucide-react';
import { parseCsvFile, downloadSampleCsv } from '../utils/csvParser';
import { Modal, Button, Badge } from './ui';

export function BatchMergeModal({
  isOpen,
  onClose,
  template,
  variables,
  onApplyCsvBatch,
  onBatchExportZip,
  isBatchExporting,
  batchProgress,
  canBatchExport,
}) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const result = await parseCsvFile(file, variables);
      if (!result.records.length) throw new Error('That file had no data rows.');
      setParsed(result);
    } catch (err) {
      setParsed(null);
      setError(err.message || 'Could not read that CSV.');
    }
    e.target.value = '';
  };

  const mapped = parsed
    ? variables.filter((v) => parsed.columnMapping[v] !== undefined)
    : [];
  const unmapped = parsed
    ? variables.filter((v) => parsed.columnMapping[v] === undefined)
    : [];

  const progressPct = batchProgress.total
    ? (batchProgress.current / batchProgress.total) * 100
    : 0;

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
              onClick={() => onBatchExportZip(parsed.records)}
              disabled={!canBatchExport}
              title={
                canBatchExport
                  ? undefined
                  : 'Batch ZIP export needs the desktop app'
              }
            >
              <FileArchive className="w-3.5 h-3.5" />
              Export {parsed.records.length} PDFs
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
                  One row per client. Column headers map to fields automatically.
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
                  {mapped.length} of {variables.length} fields matched to columns
                </div>
              </div>
              <Button variant="ghost" onClick={() => setParsed(null)}>
                Change file
              </Button>
            </div>

            {unmapped.length > 0 && (
              <div
                className="p-4 rounded-lg space-y-2.5 bg-warning-soft"
              >
                <div
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-warning"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  No column found for these fields
                </div>
                <div className="flex flex-wrap gap-1">
                  {unmapped.map((v) => (
                    <Badge key={v} tone="warning">
                      {v}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-ink-secondary">
                  They'll fall back to your presets, or show as placeholders.
                </p>
              </div>
            )}

            {/* Preview table */}
            <div
              className="rounded-xl border overflow-hidden border-line"
            >
              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-[12px] border-collapse">
                  <thead className="sticky top-0">
                    <tr className="bg-surface-sunken">
                      {mapped.slice(0, 5).map((v) => (
                        <th
                          key={v}
                          className="text-left font-semibold px-3 py-2.5 whitespace-nowrap text-ink-secondary"
                        >
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.records.slice(0, 8).map((rec, i) => (
                      <tr key={i} className="border-t border-line-soft">
                        {mapped.slice(0, 5).map((v) => (
                          <td
                            key={v}
                            className="px-3 py-2 truncate max-w-[160px] text-ink-muted"
                          >
                            {rec.values[v] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.records.length > 8 && (
                <div
                  className="px-2.5 py-1.5 text-[11px] border-t text-ink-faint border-line"
                >
                  + {parsed.records.length - 8} more
                </div>
              )}
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
