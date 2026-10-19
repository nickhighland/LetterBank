import React from 'react';
import { Plus, Trash2, Braces } from 'lucide-react';
import { Button } from './ui';
import { FieldForm, TYPE_ICONS, newFieldDef, fieldLabel } from './FieldForm';
import { FIELD_TYPES, toFieldName } from '../utils/variableParser';

const TYPE_LABELS = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label]));

/**
 * Settings › My fields: fields defined once and offered in every letter's
 * Insert field menu, with the same label, type, choices and help text
 * everywhere. Changing one here changes it in every letter that uses it.
 *
 * `fields` is the list being edited; `savedNames` are the names already saved,
 * whose placeholder can no longer change because letters refer to it.
 */
export function FieldLibraryPanel({ fields, onChange, selected, onSelect, savedNames }) {
  const current = selected === null ? null : fields[selected];

  const update = (def) => onChange(fields.map((f, i) => (i === selected ? def : f)));

  const add = () => {
    onChange([...fields, newFieldDef('')]);
    onSelect(fields.length);
  };

  const remove = (index) => {
    onChange(fields.filter((_, i) => i !== index));
    onSelect(null);
  };

  const name = toFieldName(current?.name);
  const duplicate = current && fields.some((f, i) => i !== selected && toFieldName(f.name) === name);

  return (
    <div className="grid grid-cols-[220px_1fr] gap-5 min-h-[340px]">
      <div className="space-y-2">
        <Button onClick={add} className="w-full">
          <Plus className="w-3.5 h-3.5" />
          New field
        </Button>
        {fields.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-ink-muted px-1 pt-2">
            Fields saved here appear under My fields when you insert a field in the Editor, with
            the same label, type and choices in every letter.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {fields.map((f, i) => {
              const Icon = TYPE_ICONS[f.type] || Braces;
              const active = i === selected;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-current={active ? 'true' : undefined}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left cursor-pointer border
                      ${active ? 'bg-surface-active border-accent' : 'border-transparent hover:bg-surface-hover'}`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] font-medium truncate text-ink">
                        {fieldLabel(f) || 'Untitled field'}
                      </span>
                      <span className="block text-[11px] truncate text-ink-faint">{TYPE_LABELS[f.type]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line p-4">
        {current ? (
          <div className="space-y-4">
            <FieldForm
              value={current}
              onChange={update}
              nameLocked={savedNames.includes(current.name)}
            />
            {duplicate && (
              <p className="text-[12px] text-danger">Another field already uses {`{{${name}}}`}.</p>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => remove(selected)}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete field
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-ink-muted">
            Choose a field to change it, or make a new one. Letters that already use a deleted field
            keep working with their own copy of it.
          </p>
        )}
      </div>
    </div>
  );
}
