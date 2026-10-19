import React from 'react';
import { Sparkles, RotateCcw, User, ChevronLeft, ChevronRight, Bookmark, CalendarDays, Heading, Lock, PencilLine } from 'lucide-react';
import { formatLabel, fieldTypeFor, formatLetterDate, toIsoDate } from '../utils/variableParser';
import { IconButton, TextInput, Field, Badge } from './ui';
import { isYes } from '../utils/conditions';
import { PRONOUN_FIELD, PRONOUN_OPTIONS } from '../utils/pronouns';

const CHIP =
  'px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors';

export function QuickFillPanel({
  variables,
  fieldTypes = {},
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
  subjectSource = '',
  subjectOverridden = false,
  continuationLine = '',
  onChangeSubject,
  onResetSubject,
  hasUnsavedEdits = false,
  onOpenEditor,
  fieldDefs = {},
}) {
  const dateShortcut = (varName, daysToAdd) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    onChangeValue(varName, toIsoDate(d));
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

        <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Lock className="w-3 h-3 shrink-0" />
          Client details are never saved. Closing LetterBank erases them.
        </p>

        {hasUnsavedEdits && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[12px] bg-warning-soft text-warning">
            <span className="flex items-center gap-1.5 min-w-0">
              <PencilLine className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Showing unsaved Editor changes</span>
            </span>
            <button
              onClick={onOpenEditor}
              className="shrink-0 px-1.5 py-0.5 rounded font-semibold cursor-pointer hover:underline"
            >
              Open Editor
            </button>
          </div>
        )}

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

        <Field
          label={
            <>
              <Heading className="w-3.5 h-3.5" />
              Subject
            </>
          }
          hint={
            letterhead?.showContinuationHeader
              ? `Page 2 onward reads “${continuationLine}”`
              : 'Page 2 header is off — turn it on in Document setup.'
          }
          action={
            subjectOverridden && (
              <button
                onClick={onResetSubject}
                title="Go back to the template's subject"
                className={`${CHIP} bg-surface-sunken text-ink-muted hover:text-ink`}
              >
                Reset
              </button>
            )
          }
        >
          <TextInput
            value={subjectSource}
            onChange={(e) => onChangeSubject(e.target.value)}
            placeholder="e.g. Medical Leave for {{client_name}}"
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
            const def = fieldDefs[varName] || { name: varName, label: formatLabel(varName), type: fieldTypeFor(varName, fieldTypes), help: '', options: [] };
            const { label, type } = def;
            const val = values[varName] ?? '';
            const hasPreset = presets?.[varName] !== undefined;
            const presetDiffers = hasPreset && val !== presets[varName];
            const isEmpty = incomplete.has(varName);
            const isFirstEmpty = isEmpty && incompleteFields[0] === varName;

            // Optional wording is a checkbox: tick it and the paragraph appears.
            if (type === 'yesno') {
              return (
                <label key={varName} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isYes(val)}
                    onChange={(e) => onChangeValue(varName, e.target.checked ? 'yes' : 'no')}
                    className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-ink-secondary">{label}</span>
                    {def.help && <span className="block text-[11px] text-ink-faint">{def.help}</span>}
                  </span>
                </label>
              );
            }

            const inputProps = {
              value: val,
              onChange: (e) => onChangeValue(varName, e.target.value),
              'data-empty-field': isFirstEmpty ? 'true' : undefined,
              className: isEmpty ? '!border-warning' : '',
            };

            return (
              <Field
                key={varName}
                hint={def.help || undefined}
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
                  <TextInput as="textarea" rows={3} placeholder={`Enter ${label.toLowerCase()}…`} {...inputProps} />
                ) : type === 'select' ? (
                  <TextInput
                    as="select"
                    {...inputProps}
                    value={varName === PRONOUN_FIELD ? val || PRONOUN_OPTIONS[0] : val}
                    aria-label={label}
                  >
                    {varName !== PRONOUN_FIELD && <option value="">Choose…</option>}
                    {def.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    {val && !def.options.includes(val) && <option value={val}>{val}</option>}
                  </TextInput>
                ) : (
                  <TextInput
                    type={type === 'date' || type === 'time' ? type : type === 'number' ? 'number' : 'text'}
                    inputMode={type === 'number' ? 'decimal' : undefined}
                    placeholder={type === 'date' || type === 'time' ? undefined : `Enter ${label.toLowerCase()}…`}
                    aria-label={label}
                    {...inputProps}
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
