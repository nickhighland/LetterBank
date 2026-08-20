import React, { useState, useEffect } from 'react';
import { Bookmark, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_PRESETS } from '../utils/storage';
import { Modal, Button, Field, TextInput } from './ui';

const STANDARD_FIELDS = [
  ['practice_name', 'Practice name', 'Hope Counseling & Wellness', 'text'],
  ['clinician_name', 'Clinician name', 'Dr. Jane Smith', 'text'],
  ['clinician_credentials', 'Credentials', 'LMHC', 'text'],
  ['license_title', 'License title & number', 'Licensed Mental Health Counselor #000000', 'text'],
  ['practice_email', 'Email', 'contact@example.com', 'email'],
  ['practice_phone', 'Phone', '(000) 000-0000', 'text'],
  ['practice_website', 'Website', 'https://example.com', 'text'],
  ['cancellation_notice_hours', 'Cancellation notice (hours)', '24', 'text'],
];

const STANDARD_KEYS = [
  ...STANDARD_FIELDS.map(([k]) => k),
  'telehealth_url',
  'session_modality_details',
  'practice_address',
];

export function PresetsModal({
  isOpen,
  onClose,
  presets,
  onSavePresets,
  onApplyPresetsToCurrentLetter,
}) {
  const [current, setCurrent] = useState(presets);
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');

  useEffect(() => {
    if (isOpen) setCurrent(presets);
  }, [presets, isOpen]);

  const set = (key, val) => setCurrent((prev) => ({ ...prev, [key]: val }));

  const addCustom = () => {
    const key = customKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key) return;
    set(key, customVal.trim());
    setCustomKey('');
    setCustomVal('');
  };

  const removeCustom = (key) =>
    setCurrent((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const customKeys = Object.keys(current).filter((k) => !STANDARD_KEYS.includes(k));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Practice presets"
      subtitle="Values that auto-fill matching fields across every letter."
      icon={Bookmark}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => setCurrent(DEFAULT_PRESETS)}
            className="mr-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset defaults
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onSavePresets(current);
              onApplyPresetsToCurrentLetter?.(current);
              onClose();
            }}
          >
            Save & apply
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {STANDARD_FIELDS.map(([key, label, placeholder, type]) => (
            <Field key={key} label={label}>
              <TextInput
                type={type}
                value={current[key] || ''}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
              />
            </Field>
          ))}
        </div>

        <Field label="Telehealth link">
          <TextInput
            value={current.telehealth_url || ''}
            onChange={(e) => set('telehealth_url', e.target.value)}
            placeholder="https://…"
          />
        </Field>

        <Field label="Default session modality text">
          <TextInput
            as="textarea"
            rows={3}
            value={current.session_modality_details || ''}
            onChange={(e) => set('session_modality_details', e.target.value)}
            placeholder="How and where sessions take place…"
          />
        </Field>

        {/* Custom presets */}
        <div
          className="rounded-xl border p-4 space-y-3.5 bg-surface-sunken border-line"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[12px] font-semibold text-ink-secondary">
              Custom presets
            </h3>
            <span className="text-[11px] text-ink-faint">
              Matched to {'{{variable_name}}'} automatically
            </span>
          </div>

          {customKeys.length > 0 && (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {customKeys.map((key) => (
                <li
                  key={key}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-surface-raised border-line"
                >
                  <div className="min-w-0 flex-1">
                    <code
                      className="block text-[11px] font-semibold truncate font-mono text-warning"
                    >
                      {`{{${key}}}`}
                    </code>
                    <span
                      className="block text-[12px] truncate text-ink-secondary"
                    >
                      {current[key] || <em className="text-ink-faint">empty</em>}
                    </span>
                  </div>
                  <button
                    onClick={() => removeCustom(key)}
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
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              placeholder="field_name"
              className="font-mono"
            />
            <TextInput
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              placeholder="Value"
            />
            <Button onClick={addCustom} disabled={!customKey.trim()} className="shrink-0">
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
