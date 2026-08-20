import React from 'react';
import { Sparkles, RotateCcw, User, ChevronLeft, ChevronRight, Bookmark, CalendarDays } from 'lucide-react';
import { formatLabel, inferFieldType, formatLetterDate, toIsoDate } from '../utils/variableParser';
import { IconButton, TextInput, Field, Badge } from './ui';

const CHIP =
  'px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors';

export function QuickFillPanel({
  variables,
  values,
  onChangeValue,
  onResetValues,
  onFillSampleData,
  presets,
  onApplyPresets,
  csvBatchInfo,
  onCsvPrevRecord,
  onCsvNextRecord,
  letterDate,
  onChangeLetterDate,
  letterhead,
  incompleteFields = [],
}) {
  const dateShortcut = (varName, daysToAdd) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    onChangeValue(varName, d.toISOString().slice(0, 10));
  };

  const incomplete = new Set(incompleteFields);
  const filled = variables.length - incomplete.size;

  return (
    <div className="w-[316px] xl:w-[368px] shrink-0 border-r flex flex-col min-h-0 select-none bg-surface-base border-line">
      {/* Header */}
      <div className="px-4 py-3.5 border-b shrink-0 space-y-3 border-line">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Quick Fill
          </h2>
          <div className="flex items-center gap-0.5">
            <IconButton onClick={() => onApplyPresets()} label="Apply saved presets">
              <Bookmark className="w-3.5 h-3.5" />
              Presets
            </IconButton>
            <IconButton onClick={onFillSampleData} label="Fill with sample data">
              <Sparkles className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton onClick={onResetValues} label="Clear all fields" danger>
              <RotateCcw className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>

        {csvBatchInfo && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-accent-soft">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold truncate text-accent-ink">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {values.client_name || `Record ${csvBatchInfo.currentIndex + 1}`}
              </span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <button
                onClick={onCsvPrevRecord}
                disabled={csvBatchInfo.currentIndex === 0}
                aria-label="Previous record"
                className="grid place-items-center w-6 h-6 rounded cursor-pointer disabled:opacity-30
                           bg-surface-raised text-ink-secondary"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold tabular-nums px-1 text-accent-ink">
                {csvBatchInfo.currentIndex + 1}/{csvBatchInfo.total}
              </span>
              <button
                onClick={onCsvNextRecord}
                disabled={csvBatchInfo.currentIndex === csvBatchInfo.total - 1}
                aria-label="Next record"
                className="grid place-items-center w-6 h-6 rounded cursor-pointer disabled:opacity-30
                           bg-surface-raised text-ink-secondary"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 scroll-pane pl-4 pr-2 py-4 space-y-5 min-h-0">
        <Field
          label={
            <>
              <CalendarDays className="w-3.5 h-3.5" />
              Letter date
            </>
          }
          hint={
            letterhead?.showDate
              ? `Prints as “${formatLetterDate(letterDate, letterhead?.dateFormat)}”`
              : 'Hidden on the letter — turn it on in Document setup.'
          }
          action={
            <span className="flex items-center gap-1">
              <button
                onClick={() => onChangeLetterDate(toIsoDate(new Date()))}
                className={`${CHIP} bg-surface-sunken text-ink-muted hover:text-ink`}
              >
                Today
              </button>
              {letterDate && (
                <button
                  onClick={() => onChangeLetterDate('')}
                  title="Clear the override and use today's date"
                  className={`${CHIP} bg-surface-sunken text-ink-muted hover:text-ink`}
                >
                  Clear
                </button>
              )}
            </span>
          }
        >
          <TextInput
            type="date"
            value={letterDate || ''}
            onChange={(e) => onChangeLetterDate(e.target.value)}
          />
        </Field>

        <div className="h-px bg-line" />

        {variables.length === 0 ? (
          <div className="text-center py-14 px-5 space-y-1.5">
            <p className="text-[13px] text-ink-muted">This letter has no variables.</p>
            <p className="text-[11px] text-ink-faint">
              Add <code>{'{{client_name}}'}</code> in the Editor to create a field.
            </p>
          </div>
        ) : (
          variables.map((varName) => {
            const label = formatLabel(varName);
            const type = inferFieldType(varName);
            const val = values[varName] ?? '';
            const hasPreset = presets?.[varName] !== undefined;
            const presetDiffers = hasPreset && val !== presets[varName];
            const isEmpty = incomplete.has(varName);
            const isFirstEmpty = isEmpty && incompleteFields[0] === varName;

            return (
              <Field
                key={varName}
                label={
                  <>
                    <span className={isEmpty ? 'text-warning' : undefined}>{label}</span>
                    {isEmpty && <span className="text-warning" aria-label="required">•</span>}
                    {hasPreset && <Badge tone="warning">Preset</Badge>}
                  </>
                }
                action={
                  <span className="flex items-center gap-1">
                    {presetDiffers && (
                      <button
                        onClick={() => onChangeValue(varName, presets[varName])}
                        title={`Use preset: ${presets[varName]}`}
                        className={`${CHIP} bg-warning-soft text-warning hover:brightness-95`}
                      >
                        Use preset
                      </button>
                    )}
                    {type === 'date' && (
                      <>
                        <button
                          onClick={() => dateShortcut(varName, 0)}
                          className={`${CHIP} bg-surface-sunken text-ink-muted hover:text-ink`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => dateShortcut(varName, 7)}
                          className={`${CHIP} bg-surface-sunken text-ink-muted hover:text-ink`}
                        >
                          +7d
                        </button>
                      </>
                    )}
                  </span>
                }
              >
                {type === 'textarea' ? (
                  <TextInput
                    as="textarea"
                    rows={3}
                    value={val}
                    onChange={(e) => onChangeValue(varName, e.target.value)}
                    placeholder={`Enter ${label.toLowerCase()}…`}
                    data-empty-field={isFirstEmpty ? 'true' : undefined}
                    className={isEmpty ? '!border-warning' : ''}
                  />
                ) : (
                  <TextInput
                    type={type === 'date' ? 'date' : 'text'}
                    value={val}
                    onChange={(e) => onChangeValue(varName, e.target.value)}
                    placeholder={type === 'date' ? undefined : `Enter ${label.toLowerCase()}…`}
                    data-empty-field={isFirstEmpty ? 'true' : undefined}
                    className={isEmpty ? '!border-warning' : ''}
                  />
                )}
              </Field>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t shrink-0 flex items-center gap-3 text-[11px] border-line">
        <span
          className={`tabular-nums whitespace-nowrap font-medium ${
            incomplete.size ? 'text-warning' : 'text-success'
          }`}
        >
          {incomplete.size === 0
            ? 'Ready to send'
            : `${incomplete.size} field${incomplete.size === 1 ? '' : 's'} empty`}
        </span>
        <span className="h-1 flex-1 rounded-full overflow-hidden bg-surface-deep">
          <span
            className={`block h-full rounded-full transition-all duration-300 ${
              incomplete.size ? 'bg-warning' : 'bg-success'
            }`}
            style={{ width: variables.length ? `${(filled / variables.length) * 100}%` : '100%' }}
          />
        </span>
        <span className="tabular-nums text-ink-muted whitespace-nowrap">
          {filled}/{variables.length}
        </span>
      </div>
    </div>
  );
}
