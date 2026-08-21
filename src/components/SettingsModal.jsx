import React, { useRef, useState, useEffect } from 'react';
import {
  Sliders,
  Bookmark,
  FileText,
  PenTool,
  Image as ImageIcon,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  DEFAULT_PRESETS,
  DEFAULT_LETTERHEAD,
  DEFAULT_SIGNATURE,
  DEFAULT_CLINICIAN,
} from '../utils/storage';
import { DATE_FORMATS } from '../utils/variableParser';
import { fillableArea, pxToInches } from '../constants/page';
import { Modal, Button, Field, TextInput, SegmentedControl } from './ui';
import { resolveSignatureTokens } from './LetterDocument';

// ---- Letterhead Constants ----
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

// ---- Presets Constants ----
const STANDARD_PRESET_FIELDS = [
  ['practice_name', 'Practice name', 'Hope Counseling & Wellness', 'text'],
  ['clinician_name', 'Clinician name', 'Dr. Jane Smith', 'text'],
  ['clinician_credentials', 'Credentials', 'LMHC', 'text'],
  ['license_title', 'License title & number', 'Licensed Mental Health Counselor #000000', 'text'],
  ['practice_email', 'Email', 'contact@example.com', 'email'],
  ['practice_phone', 'Phone', '(555) 000-0000', 'text'],
  ['practice_website', 'Website', 'https://example.com', 'text'],
  ['cancellation_notice_hours', 'Cancellation notice (hours)', '24', 'text'],
];

const STANDARD_PRESET_KEYS = [
  ...STANDARD_PRESET_FIELDS.map(([k]) => k),
  'telehealth_url',
  'session_modality_details',
  'practice_address',
];

// ---- Signature Constants ----
const SIGNATURE_TOKENS = [
  '{{signature_image}}',
  '{{clinician_name}}',
  '{{clinician_credentials}}',
  '{{license_title}}',
  '{{practice_name}}',
  '{{practice_phone}}',
  '{{practice_email}}',
  '{{practice_website}}',
];

const CLINICIAN_FIELDS = [
  ['name', 'Name'],
  ['credentials', 'Credentials'],
  ['title', 'License title & number'],
  ['practiceName', 'Practice name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
];

const SIGNATURE_ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

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

/** Drawing pad with device-pixel-ratio correction. */
function SignaturePad({ onCommit }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onCommit(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="w-full h-36 rounded-xl border cursor-crosshair touch-none bg-paper border-line-strong"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-ink-faint">
          Draw with a trackpad, mouse or stylus.
        </p>
        <Button variant="ghost" onClick={clear}>
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}

export function SettingsModal({
  isOpen,
  initialTab = 'presets',
  onClose,
  letterhead,
  onSaveLetterhead,
  presets,
  onSavePresets,
  onApplyPresetsToCurrentLetter,
  signature,
  onSaveSignature,
  clinician,
  onSaveClinician,
}) {
  // Main settings tab: 'presets' | 'letterhead' | 'signature'
  const [mainTab, setMainTab] = useState(initialTab);

  // Sub-tabs
  const [lhTab, setLhTab] = useState('page'); // 'page' | 'type' | 'furniture'
  const [sigTab, setSigTab] = useState('block'); // 'block' | 'image' | 'credentials'

  // Local state for edits
  const [currentPresets, setCurrentPresets] = useState(presets);
  const [currentLh, setCurrentLh] = useState(letterhead);
  const [currentSig, setCurrentSig] = useState(signature);
  const [currentClin, setCurrentClin] = useState(clinician);

  // Presets custom fields state
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const blockRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMainTab(initialTab || 'presets');
      setCurrentPresets(presets || DEFAULT_PRESETS);
      setCurrentLh({ ...DEFAULT_LETTERHEAD, ...letterhead });
      setCurrentSig(signature || DEFAULT_SIGNATURE);
      setCurrentClin(clinician || DEFAULT_CLINICIAN);
    }
  }, [isOpen, initialTab, presets, letterhead, signature, clinician]);

  const setLh = (patch) => setCurrentLh((prev) => ({ ...prev, ...patch }));
  const setSigField = (patch) => setCurrentSig((prev) => ({ ...prev, ...patch }));
  const setPresetField = (key, val) =>
    setCurrentPresets((prev) => ({ ...prev, [key]: val }));

  const handleLetterheadUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => ev.target?.result && setLh({ url: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addCustomPreset = () => {
    const key = customKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key) return;
    setPresetField(key, customVal.trim());
    setCustomKey('');
    setCustomVal('');
  };

  const removeCustomPreset = (key) =>
    setCurrentPresets((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const insertSigToken = (token) => {
    const el = blockRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = currentSig.customBlockText || '';
    const next = text.slice(0, start) + token + text.slice(end);
    setSigField({ customBlockText: next });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const handleResetCurrentTab = () => {
    if (mainTab === 'presets') {
      setCurrentPresets(DEFAULT_PRESETS);
    } else if (mainTab === 'letterhead') {
      setCurrentLh(DEFAULT_LETTERHEAD);
    } else if (mainTab === 'signature') {
      setCurrentSig(DEFAULT_SIGNATURE);
      setCurrentClin(DEFAULT_CLINICIAN);
    }
  };

  const handleSaveAll = () => {
    onSavePresets(currentPresets);
    onSaveLetterhead(currentLh);
    onSaveSignature(currentSig);
    onSaveClinician(currentClin);
    onApplyPresetsToCurrentLetter?.(currentPresets);
    onClose();
  };

  const { width: fillW, height: fillH } = fillableArea(currentLh);
  const customPresetKeys = Object.keys(currentPresets).filter(
    (k) => !STANDARD_PRESET_KEYS.includes(k)
  );

  const previewLines = (currentSig.customBlockText || '').split('\n');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings & Defaults"
      subtitle="Configure practice presets, letterhead layout, and digital signatures."
      icon={Sliders}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={handleResetCurrentTab} className="mr-auto">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset {mainTab === 'presets' ? 'presets' : mainTab === 'letterhead' ? 'letterhead' : 'signature'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveAll}>
            Save all changes
          </Button>
        </>
      }
    >
      {/* Top-Level Settings Tabs */}
      <div className="px-6 pt-5 pb-3 border-b border-line bg-surface-raised">
        <SegmentedControl
          value={mainTab}
          onChange={setMainTab}
          options={[
            { value: 'presets', label: 'Presets', Icon: Bookmark },
            { value: 'letterhead', label: 'Letterhead', Icon: ImageIcon },
            { value: 'signature', label: 'Signature', Icon: PenTool },
          ]}
        />
      </div>

      <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        {/* ======================= TAB 1: PRESETS ======================= */}
        {mainTab === 'presets' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">Practice & Clinician Profile</h3>
              <p className="text-[11px] text-ink-muted">
                These values automatically fill matching fields across all templates.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {STANDARD_PRESET_FIELDS.map(([key, label, placeholder, type]) => (
                <Field key={key} label={label}>
                  <TextInput
                    type={type}
                    value={currentPresets[key] || ''}
                    onChange={(e) => setPresetField(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </Field>
              ))}
            </div>

            <Field label="Telehealth portal link">
              <TextInput
                value={currentPresets.telehealth_url || ''}
                onChange={(e) => setPresetField('telehealth_url', e.target.value)}
                placeholder="https://telehealth.example.com/room"
              />
            </Field>

            <Field label="Default session modality details">
              <TextInput
                as="textarea"
                rows={3}
                value={currentPresets.session_modality_details || ''}
                onChange={(e) => setPresetField('session_modality_details', e.target.value)}
                placeholder="Describe how and where sessions take place..."
              />
            </Field>

            {/* Custom Presets */}
            <div className="rounded-xl border p-4 space-y-3.5 bg-surface-sunken border-line">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-[12px] font-semibold text-ink-secondary">
                  Custom variable presets
                </h4>
                <span className="text-[11px] text-ink-faint">
                  Matched to {'{{variable_name}}'} automatically
                </span>
              </div>

              {customPresetKeys.length > 0 && (
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                  {customPresetKeys.map((key) => (
                    <li
                      key={key}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-surface-raised border-line"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="block text-[11px] font-semibold truncate font-mono text-warning">
                          {`{{${key}}}`}
                        </code>
                        <span className="block text-[12px] truncate text-ink-secondary">
                          {currentPresets[key] || <em className="text-ink-faint">empty</em>}
                        </span>
                      </div>
                      <button
                        onClick={() => removeCustomPreset(key)}
                        aria-label={`Remove ${key}`}
                        className="grid place-items-center w-7 h-7 rounded cursor-pointer shrink-0 text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2.5">
                <TextInput
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomPreset()}
                  placeholder="field_name"
                  className="font-mono"
                />
                <TextInput
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomPreset()}
                  placeholder="Value"
                />
                <Button onClick={addCustomPreset} disabled={!customKey.trim()} className="shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 2: LETTERHEAD ======================= */}
        {mainTab === 'letterhead' && (
          <div className="space-y-5">
            <SegmentedControl
              value={lhTab}
              onChange={setLhTab}
              options={[
                { value: 'page', label: 'Page & Margins' },
                { value: 'type', label: 'Typography' },
                { value: 'furniture', label: 'Date & Numbering' },
              ]}
            />

            {lhTab === 'page' && (
              <div className="space-y-5 pt-2">
                <Toggle
                  checked={currentLh.showLetterhead}
                  onChange={(v) => setLh({ showLetterhead: v })}
                  label="Print the letterhead artwork"
                  hint="Turn off if printing directly onto physical pre-printed stationery."
                >
                  <div className="flex items-center gap-4 pt-3">
                    <div
                      className="w-12 shrink-0 rounded overflow-hidden border bg-white border-line-strong flex items-center justify-center"
                      style={{ aspectRatio: '8.5 / 11' }}
                    >
                      {currentLh.url ? (
                        <img src={currentLh.url} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-[9px] text-ink-muted text-center px-1">None</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink">Letterhead Graphic</div>
                      <div className="text-[11px] text-ink-muted">
                        Scaled to standard 8.5″ × 11″ paper. PNG, JPG or SVG.
                      </div>
                    </div>
                    <label className="shrink-0">
                      <span
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-semibold
                                   rounded-lg border cursor-pointer transition-colors
                                   bg-surface-raised border-line text-ink-secondary hover:bg-surface-hover"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {currentLh.url ? 'Replace' : 'Upload'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={handleLetterheadUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </Toggle>

                <Field
                  label="Fillable letter margins"
                  hint={`Text boundary: ${pxToInches(fillW)}″ × ${pxToInches(fillH)}″ on 8.5″ × 11″ paper`}
                  action={
                    <span className="flex items-center gap-1">
                      {MARGIN_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => setLh(p.value)}
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
                    {[['topMargin', 'Top'], ['bottomMargin', 'Bottom'], ['leftMargin', 'Left'], ['rightMargin', 'Right']].map(
                      ([key, label]) => (
                        <div key={key} className="space-y-1">
                          <span className="block text-[11px] font-medium text-ink-muted">{label} (in)</span>
                          <TextInput
                            type="number"
                            step="0.05"
                            min="0.25"
                            max="3.5"
                            value={pxToInches(currentLh[key])}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setLh({ [key]: Math.round(val * 96) });
                            }}
                            className="font-mono text-center"
                          />
                        </div>
                      )
                    )}
                  </div>
                </Field>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentLh.verticalCenterSinglePage}
                    onChange={(e) => setLh({ verticalCenterSinglePage: e.target.checked })}
                    className="w-4 h-4 cursor-pointer accent-accent"
                  />
                  <span className="text-[13px] text-ink-secondary">
                    Center single-page letters vertically on the letterhead
                  </span>
                </label>
              </div>
            )}

            {lhTab === 'type' && (
              <div className="space-y-5 pt-2">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Body font">
                    <TextInput
                      as="select"
                      value={currentLh.fontFamily}
                      onChange={(e) => setLh({ fontFamily: e.target.value })}
                    >
                      <option value="Source Serif 4">Source Serif 4</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Inter">Inter</option>
                    </TextInput>
                  </Field>
                  <Field label="Font size (pt)">
                    <TextInput
                      type="number"
                      step="0.5"
                      min="8"
                      max="18"
                      value={currentLh.fontSize}
                      onChange={(e) =>
                        setLh({ fontSize: parseFloat(e.target.value) || DEFAULT_LETTERHEAD.fontSize })
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
                      value={currentLh.lineHeight}
                      onChange={(e) =>
                        setLh({ lineHeight: parseFloat(e.target.value) || DEFAULT_LETTERHEAD.lineHeight })
                      }
                      className="font-mono"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Body alignment">
                    <SegmentedControl
                      value={currentLh.bodyAlignment}
                      onChange={(v) => setLh({ bodyAlignment: v })}
                      options={[
                        { value: 'left', label: 'Ragged right' },
                        { value: 'justify', label: 'Justified' },
                      ]}
                    />
                  </Field>
                  <Field label="Paragraph spacing" hint="Space between paragraphs in ems.">
                    <TextInput
                      type="number"
                      step="0.1"
                      min="0"
                      max="3"
                      value={currentLh.paragraphSpacing}
                      onChange={(e) =>
                        setLh({
                          paragraphSpacing:
                            parseFloat(e.target.value) || DEFAULT_LETTERHEAD.paragraphSpacing,
                        })
                      }
                      className="font-mono"
                    />
                  </Field>
                </div>
              </div>
            )}

            {lhTab === 'furniture' && (
              <div className="space-y-4 pt-2">
                <Toggle
                  checked={currentLh.showDate}
                  onChange={(v) => setLh({ showDate: v })}
                  label="Show the date"
                  hint="The date each letter is addressed is set per letter in Quick Fill."
                >
                  <div className="space-y-4 pt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Alignment">
                        <SegmentedControl
                          value={currentLh.dateAlignment}
                          onChange={(v) => setLh({ dateAlignment: v })}
                          options={ALIGNMENTS}
                          compact
                        />
                      </Field>
                      <Field label="Format">
                        <TextInput
                          as="select"
                          value={currentLh.dateFormat}
                          onChange={(e) => setLh({ dateFormat: e.target.value })}
                        >
                          {Object.entries(DATE_FORMATS).map(([key, { label }]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </TextInput>
                      </Field>
                    </div>
                  </div>
                </Toggle>

                <Toggle
                  checked={currentLh.showContinuationHeader}
                  onChange={(v) => setLh({ showContinuationHeader: v })}
                  label="Continuation header on page 2 and beyond"
                  hint="Identifies the letter if printed pages are separated."
                >
                  <div className="space-y-4 pt-3">
                    <Field label="Header text" hint="Use {{client_name}} to insert the client's name.">
                      <TextInput
                        value={currentLh.continuationText}
                        onChange={(e) => setLh({ continuationText: e.target.value })}
                        placeholder="Re: {{client_name}}"
                      />
                    </Field>
                  </div>
                </Toggle>

                <Toggle
                  checked={currentLh.showPageNumbers}
                  onChange={(v) => setLh({ showPageNumbers: v })}
                  label="Page numbering"
                  hint="Prints “Page 1 of 2” at the bottom of the page."
                >
                  <div className="space-y-4 pt-3">
                    <Field label="Position">
                      <SegmentedControl
                        value={currentLh.pageNumberPosition}
                        onChange={(v) => setLh({ pageNumberPosition: v })}
                        options={FOLIO_POSITIONS}
                        compact
                      />
                    </Field>
                  </div>
                </Toggle>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 3: SIGNATURE ======================= */}
        {mainTab === 'signature' && (
          <div className="space-y-5">
            <SegmentedControl
              value={sigTab}
              onChange={setSigTab}
              options={[
                { value: 'block', label: 'Sign-Off Block' },
                { value: 'image', label: 'Signature Graphic' },
                { value: 'credentials', label: 'Clinician Credentials' },
              ]}
            />

            {sigTab === 'block' && (
              <div className="grid grid-cols-2 gap-5 pt-2">
                <div className="space-y-3">
                  <Field
                    label="Sign-off template text"
                    hint="Tokens resolve from your credentials when the letter renders."
                  >
                    <TextInput
                      as="textarea"
                      ref={blockRef}
                      rows={10}
                      value={currentSig.customBlockText || ''}
                      onChange={(e) => setSigField({ customBlockText: e.target.value })}
                      className="font-mono !text-[12px] leading-relaxed"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-1.5">
                    {SIGNATURE_TOKENS.map((t) => (
                      <button
                        key={t}
                        onClick={() => insertSigToken(t)}
                        className="px-2 py-1 rounded-md text-[10px] cursor-pointer font-mono transition-colors
                                   bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-hover"
                      >
                        {t.replace(/[{}]/g, '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paper Preview */}
                <div className="space-y-2">
                  <span className="text-[12px] font-semibold text-ink-secondary">Live Paper Preview</span>
                  <div
                    className="rounded-xl border p-5 min-h-[220px] font-serif text-[12px] leading-snug
                               bg-paper border-line-strong text-paper-ink"
                    style={{ textAlign: currentSig.alignment || 'left' }}
                  >
                    {previewLines.map((line, i) => {
                      if (line.includes('{{signature_image}}') || line.includes('[SIGNATURE_IMAGE]')) {
                        if (!currentSig.showSignature || !currentSig.url) return <div key={i} style={{ height: 8 }} />;
                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              margin: '4px 0',
                              justifyContent:
                                currentSig.alignment === 'center'
                                  ? 'center'
                                  : currentSig.alignment === 'right'
                                  ? 'flex-end'
                                  : 'flex-start',
                            }}
                          >
                            <img
                              src={currentSig.url}
                              alt=""
                              style={{
                                width: currentSig.width || 180,
                                maxHeight: 70,
                                objectFit: 'contain',
                              }}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={i} style={{ minHeight: '1.2em' }}>
                          {resolveSignatureTokens(line, currentClin)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {sigTab === 'image' && (
              <div className="grid grid-cols-2 gap-5 pt-2">
                <div className="space-y-4">
                  <Field label="Upload signature file" hint="PNG with transparent background works best.">
                    <label className="block">
                      <span
                        className="flex items-center justify-center gap-2 h-20 rounded-xl border border-dashed
                                   cursor-pointer text-[13px] font-medium border-line-strong text-ink-muted bg-surface-sunken"
                      >
                        <Upload className="w-4 h-4" />
                        Choose image file
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) =>
                            ev.target?.result && setSigField({ url: ev.target.result });
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </Field>

                  <Field label="Or draw your signature">
                    <SignaturePad onCommit={(url) => setSigField({ url })} />
                  </Field>
                </div>

                <div className="space-y-4">
                  <Field label={`Signature Width — ${currentSig.width || 180}px`}>
                    <input
                      type="range"
                      min="100"
                      max="320"
                      value={currentSig.width || 180}
                      onChange={(e) => setSigField({ width: parseInt(e.target.value, 10) })}
                      className="w-full cursor-pointer accent-accent"
                    />
                  </Field>

                  <Field label="Alignment">
                    <div className="flex gap-1">
                      {['left', 'center', 'right'].map((a) => {
                        const Icon = SIGNATURE_ALIGN_ICONS[a];
                        const isActive = (currentSig.alignment || 'left') === a;
                        return (
                          <button
                            key={a}
                            onClick={() => setSigField({ alignment: a })}
                            aria-label={a}
                            className={`grid place-items-center flex-1 h-9 rounded-lg border cursor-pointer transition-colors ${
                              isActive
                                ? 'bg-accent-soft border-accent text-accent-ink'
                                : 'bg-surface-raised border-line text-ink-muted hover:bg-surface-hover'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSig.showSignature}
                      onChange={(e) => setSigField({ showSignature: e.target.checked })}
                      className="w-4 h-4 cursor-pointer accent-accent"
                    />
                    <span className="text-[13px] text-ink-secondary">
                      Show signature image on documents
                    </span>
                  </label>

                  {currentSig.url && (
                    <div className="rounded-xl border p-3 grid place-items-center bg-paper border-line-strong">
                      <img
                        src={currentSig.url}
                        alt="Current signature"
                        style={{ width: currentSig.width || 180, maxHeight: 75, objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {sigTab === 'credentials' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                {CLINICIAN_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label}>
                    <TextInput
                      value={currentClin[key] || ''}
                      onChange={(e) => setCurrentClin((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </Field>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
