import React, { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Modal, Button } from './ui';
import { FieldForm, isFieldDefComplete } from './FieldForm';
import { normaliseFieldDef } from '../utils/fieldDefs';

/**
 * Edit one field of the open letter: label, type, choices, help text. A field
 * from My fields is changed there, for every letter that uses it; any other
 * field is changed for this letter, and can be added to My fields.
 */
export function FieldSettingsModal({ field, onClose, onSave }) {
  const [draft, setDraft] = useState(field);
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  useEffect(() => {
    setDraft(field);
    setSaveToLibrary(false);
  }, [field]);

  if (!field || !draft) return null;
  const inLibrary = field.source === 'library';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Field settings"
      subtitle={
        inLibrary
          ? 'From My fields: changes apply to every letter that uses it.'
          : 'Changes apply to this letter.'
      }
      icon={Settings2}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!isFieldDefComplete(draft)}
            onClick={() => onSave(normaliseFieldDef(draft), { inLibrary, saveToLibrary })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <FieldForm value={draft} onChange={setDraft} nameLocked />
        {!inLibrary && (
          <label className="flex items-center gap-2 text-[12px] text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
              className="w-3.5 h-3.5 accent-accent"
            />
            Also add to My fields, for other letters
          </label>
        )}
      </div>
    </Modal>
  );
}
