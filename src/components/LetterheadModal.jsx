import React, { useState, useEffect } from 'react';
import { Upload, RotateCcw, FileText } from 'lucide-react';
import { DEFAULT_LETTERHEAD } from '../utils/storage';
import { DATE_FORMATS } from '../utils/variableParser';
import { fillableArea, pxToInches, inchesToPx } from '../constants/page';
import { Modal, Button, Field, TextInput, SegmentedControl } from './ui';

const MARGINS = [
  ['topMargin', 'Top', 'Clears the letterhead logo band'],
  ['bottomMargin', 'Bottom', 'Clears the letterhead contact band'],
  ['leftMargin', 'Left', ''],
  ['rightMargin', 'Right', ''],
];

/** One-click margins clinicians actually ask for. */
const MARGIN_PRESETS = [
  { label: '1″ all round', value: { topMargin: 96, bottomMargin: 96, leftMargin: 96, rightMargin: 96 } },
  { label: '0.75″', value: { topMargin: 72, bottomMargin: 72, leftMargin: 72, rightMargin: 72 } },
  { label: 'Letterhead', value: { topMargin: 155, bottomMargin: 95, leftMargin: 82, rightMargin: 82 } },
];

const ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

const FOLIO_POSITIONS = [
  { value: 'bottom-left', label: 'Left' },
  { value: 'bottom-center', label: 'Centre' },
  { value: 'bottom-right', label: 'Right' },
];

/** A labelled on/off row that also gates the controls it wraps. */
function Toggle({ checked, onChange, label, hint, children }) {
  return (
    <div className="rounded-xl border border-line bg-surface-sunken overflow-hidden">
      <label className="flex items-center gap-3 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 cursor-pointer accent-accent"
        />
        <span className="flex-1">
          <span className="block text-[13px] font-semibold text-ink">{label}</span>
          {hint && <span className="block text-[11px] text-ink-muted">{hint}</span>}
        </span>
      </label>
      {checked && children && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-line">{children}</div>
      )}
    </div>
  );
}

export function LetterheadModal({ isOpen, onClose, letterhead, onSaveLetterhead }) {
  const [tab, setTab] = useState('page');
  const [current, setCurrent] = useState(letterhead);

  useEffect(() => {
    if (isOpen) setCurrent({ ...DEFAULT_LETTERHEAD, ...letterhead });
  }, [letterhead, isOpen]);

  const set = (patch) => setCurrent((prev) => ({ ...prev, ...patch }));

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => ev.target?.result && set({ url: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const { width: fillW, height: fillH } = fillableArea(current);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Document setup"
      subtitle="Letterhead, type, and the furniture around the letter."
      icon={FileText}
      width="max-w-2xl"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => setCurrent(DEFAULT_LETTERHEAD)}
            className="mr-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset all
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onSaveLetterhead(current);
              onClose();
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="px-6 pt-5">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'page', label: 'Page' },
            { value: 'type', label: 'Type' },
            { value: 'furniture', label: 'Date & pages' },
          ]}
        />
      </div>

      <div className="p-6 space-y-6">
        {tab === 'page' && (
          <>
            <Toggle
              checked={current.showLetterhead}
              onChange={(v) => set({ showLetterhead: v })}
              label="Print the letterhead artwork"
              hint="Turn off to print on pre-printed stationery."
            >
              <div className="flex items-center gap-4 pt-3">
                <div
                  className="w-12 shrink-0 rounded overflow-hidden border bg-white border-line-strong"
                  style={{ aspectRatio: '8.5 / 11' }}
                >
                  <img src={current.url} alt="" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink">Practice letterhead</div>
                  <div className="text-[11px] text-ink-muted">
                    Scaled to 8.5″ × 11″. PNG, JPG or SVG.
                  </div>
                </div>
                <label className="shrink-0">
                  <span
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-semibold
                               rounded-lg border cursor-pointer transition-colors
                               bg-surface-raised border-line text-ink-secondary hover:bg-surface-hover"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Replace
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </Toggle>

            <Field
              label="Fillable margins"
              hint={`Text area ${pxToInches(fillW)}″ × ${pxToInches(fillH)}″ on 8.5″ × 11″ paper`}
              action={
                <span className="flex items-center gap-1">
                  {MARGIN_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => set(p.value)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer
                                 transition-colors bg-surface-sunken text-ink-muted hover:text-ink"
                    >
                      {p.label}
                    </button>
                  ))}
                </span>
              }
            >
              <div className="grid grid-cols-4 gap-3">
                {MARGINS.map(([key, label, note]) => (
                  <div key={key}>
                    <label className="block text-[11px] font-medium mb-1 text-ink-muted" title={note}>
                      {label}
                    </label>
                    <div className="relative">
                      <TextInput
                        type="number"
                        step="0.05"
                        min="0"
                        max={key === 'topMargin' || key === 'bottomMargin' ? '5' : '4'}
                        value={pxToInches(current[key])}
                        onChange={(e) =>
                          set({ [key]: inchesToPx(parseFloat(e.target.value) || 0) })
                        }
                        className="font-mono !pr-6"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none text-ink-faint">
                        ″
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Field>

            <Toggle
              checked={current.verticalCenterSinglePage}
              onChange={(v) => set({ verticalCenterSinglePage: v })}
              label="Centre short letters vertically"
              hint="Applies to single-page letters only."
            />
          </>
        )}

        {tab === 'type' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Body font">
                <TextInput
                  as="select"
                  value={current.fontFamily}
                  onChange={(e) => set({ fontFamily: e.target.value })}
                >
                  <option value="Source Serif 4">Source Serif 4</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Inter">Inter</option>
                </TextInput>
              </Field>
              <Field label="Size (pt)">
                <TextInput
                  type="number"
                  step="0.5"
                  min="8"
                  max="18"
                  value={current.fontSize}
                  onChange={(e) =>
                    set({ fontSize: parseFloat(e.target.value) || DEFAULT_LETTERHEAD.fontSize })
                  }
                  className="font-mono"
                />
              </Field>
              <Field label="Line height">
                <TextInput
                  type="number"
                  step="0.02"
                  min="1"
                  max="2.4"
                  value={current.lineHeight}
                  onChange={(e) =>
                    set({ lineHeight: parseFloat(e.target.value) || DEFAULT_LETTERHEAD.lineHeight })
                  }
                  className="font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Body alignment">
                <SegmentedControl
                  value={current.bodyAlignment}
                  onChange={(v) => set({ bodyAlignment: v })}
                  options={[
                    { value: 'left', label: 'Ragged right' },
                    { value: 'justify', label: 'Justified' },
                  ]}
                />
              </Field>
              <Field label="Paragraph spacing" hint="Blank line between paragraphs, in ems.">
                <TextInput
                  type="number"
                  step="0.1"
                  min="0"
                  max="3"
                  value={current.paragraphSpacing}
                  onChange={(e) =>
                    set({
                      paragraphSpacing:
                        parseFloat(e.target.value) || DEFAULT_LETTERHEAD.paragraphSpacing,
                    })
                  }
                  className="font-mono"
                />
              </Field>
            </div>
          </>
        )}

        {tab === 'furniture' && (
          <>
            <Toggle
              checked={current.showDate}
              onChange={(v) => set({ showDate: v })}
              label="Show the date"
              hint="The date each letter is addressed is set per letter, in Quick Fill."
            >
              <div className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Alignment">
                    <SegmentedControl
                      value={current.dateAlignment}
                      onChange={(v) => set({ dateAlignment: v })}
                      options={ALIGNMENTS}
                      compact
                    />
                  </Field>
                  <Field label="Format">
                    <TextInput
                      as="select"
                      value={current.dateFormat}
                      onChange={(e) => set({ dateFormat: e.target.value })}
                    >
                      {Object.entries(DATE_FORMATS).map(([key, { label }]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </TextInput>
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Field label="Size" hint={`${(current.fontSize + current.dateSize).toFixed(1)}pt`}>
                    <TextInput
                      as="select"
                      value={current.dateSize}
                      onChange={(e) => set({ dateSize: parseFloat(e.target.value) })}
                    >
                      <option value="-2">2pt smaller</option>
                      <option value="-1">1pt smaller</option>
                      <option value="0">Match body</option>
                      <option value="1">1pt larger</option>
                      <option value="2">2pt larger</option>
                    </TextInput>
                  </Field>
                  <Field label="Space above">
                    <TextInput
                      type="number"
                      min="0"
                      max="300"
                      step="2"
                      value={current.dateSpaceBefore}
                      onChange={(e) => set({ dateSpaceBefore: parseInt(e.target.value, 10) || 0 })}
                      className="font-mono"
                    />
                  </Field>
                  <Field label="Space below">
                    <TextInput
                      type="number"
                      min="0"
                      max="300"
                      step="2"
                      value={current.dateSpaceAfter}
                      onChange={(e) => set({ dateSpaceAfter: parseInt(e.target.value, 10) || 0 })}
                      className="font-mono"
                    />
                  </Field>
                </div>
              </div>
            </Toggle>

            <Toggle
              checked={current.showContinuationHeader}
              onChange={(v) => set({ showContinuationHeader: v })}
              label="Continuation header on page 2 and beyond"
              hint="Identifies the letter if pages are separated."
            >
              <div className="space-y-4 pt-3">
                <Field label="Header text" hint="Use {{client_name}} to insert the client's name.">
                  <TextInput
                    value={current.continuationText}
                    onChange={(e) => set({ continuationText: e.target.value })}
                    placeholder="Re: {{client_name}}"
                  />
                </Field>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.continuationRule}
                    onChange={(e) => set({ continuationRule: e.target.checked })}
                    className="w-4 h-4 cursor-pointer accent-accent"
                  />
                  <span className="text-[13px] text-ink-secondary">
                    Rule beneath the header
                  </span>
                </label>
              </div>
            </Toggle>

            <Toggle
              checked={current.showPageNumbers}
              onChange={(v) => set({ showPageNumbers: v })}
              label="Page numbers"
              hint="“Page 1 of 2” at the foot of the page."
            >
              <div className="space-y-4 pt-3">
                <Field label="Position">
                  <SegmentedControl
                    value={current.pageNumberPosition}
                    onChange={(v) => set({ pageNumberPosition: v })}
                    options={FOLIO_POSITIONS}
                    compact
                  />
                </Field>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.pageNumbersOnSinglePage}
                    onChange={(e) => set({ pageNumbersOnSinglePage: e.target.checked })}
                    className="w-4 h-4 cursor-pointer accent-accent"
                  />
                  <span className="text-[13px] text-ink-secondary">
                    Also number single-page letters
                  </span>
                </label>
              </div>
            </Toggle>
          </>
        )}
      </div>
    </Modal>
  );
}
