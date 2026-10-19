import React from 'react';
import { Type, AlignLeft, CalendarDays, Clock, Hash, SquareChevronDown, SquareCheck } from 'lucide-react';
import { FIELD_TYPES, formatLabel, toFieldName } from '../utils/variableParser';

export const TYPE_ICONS = {
  text: Type,
  textarea: AlignLeft,
  date: CalendarDays,
  time: Clock,
  number: Hash,
  select: SquareChevronDown,
  yesno: SquareCheck,
};

const TYPE_HINTS = {
  text: 'A short answer.',
  textarea: 'A paragraph or more.',
  date: 'Opens a date picker; prints as “October 22, 2026”.',
  time: 'Opens a time picker; prints as “2:30 PM”.',
  number: 'Digits only.',
  select: 'Pick one of the choices you list.',
  yesno: 'A checkbox. Prints Yes or No, and can show or hide optional wording.',
};

const INPUT =
  'w-full h-8 px-2.5 rounded-md border text-[12.5px] bg-surface-base border-line text-ink ' +
  'focus:outline-none focus:border-accent';

/** A blank field definition, named after what was typed. */
export const newFieldDef = (label = '', type = 'text') => ({
  name: toFieldName(label),
  label: label.trim(),
  type,
  help: '',
  options: [],
});

/**
 * The parts of a field: label, placeholder name, type, choices and help text.
 * Used to create a field from the Insert field menu, to edit one in the
 * Editor, and in Settings › My fields.
 *
 * The placeholder name follows the label until it is edited by hand, and is
 * fixed once a field exists (`nameLocked`), since letters refer to it.
 */
export function FieldForm({ value, onChange, nameLocked = false, compact = false }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const autoName = !nameLocked && value.name === toFieldName(value.label);

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3.5'}>
      <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-ink-secondary">Label</span>
        <input
          autoFocus
          value={value.label}
          onChange={(e) =>
            set({ label: e.target.value, ...(autoName ? { name: toFieldName(e.target.value) } : {}) })
          }
          placeholder="e.g. Return to work date"
          className={INPUT}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-ink-secondary">Placeholder</span>
        {nameLocked ? (
          <code className="block text-[12px] text-ink-muted">{`{{${value.name}}}`}</code>
        ) : (
          <input
            value={value.name}
            onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_') })}
            placeholder={value.label ? toFieldName(value.label) : 'return_to_work_date'}
            className={`${INPUT} font-mono`}
          />
        )}
      </label>

      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-ink-secondary">Type</span>
        <div className="grid grid-cols-2 gap-1">
          {FIELD_TYPES.map(({ value: type, label }) => {
            const Icon = TYPE_ICONS[type];
            const active = value.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => set({ type })}
                aria-pressed={active}
                className={`flex items-center gap-1.5 h-8 px-2 rounded-md text-[12px] font-medium cursor-pointer border
                  ${
                    active
                      ? 'bg-accent-soft text-accent-ink border-accent'
                      : 'bg-surface-base text-ink-secondary border-line hover:bg-surface-hover'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-faint">{TYPE_HINTS[value.type]}</p>
      </div>

      {value.type === 'select' && (
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-ink-secondary">Choices, one per line</span>
          <textarea
            rows={compact ? 3 : 4}
            value={Array.isArray(value.options) ? value.options.join('\n') : value.options || ''}
            onChange={(e) => set({ options: e.target.value.split('\n') })}
            placeholder={'Zoom\nDoxy.me\nIn person'}
            className={`${INPUT} h-auto py-1.5 leading-snug resize-y`}
          />
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-ink-secondary">Help text (optional)</span>
        <input
          value={value.help || ''}
          onChange={(e) => set({ help: e.target.value })}
          placeholder={`Shown under ${value.label ? `“${value.label}”` : 'the field'} in Quick Fill`}
          className={INPUT}
        />
      </label>
    </div>
  );
}

/** True when the form holds enough to save. */
export const isFieldDefComplete = (def) =>
  Boolean(toFieldName(def?.name)) &&
  (def.type !== 'select' || (def.options || []).some((o) => String(o).trim()));

/** The label a field shows when it has none of its own. */
export const fieldLabel = (def) => def?.label?.trim() || formatLabel(def?.name || '');
