import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, Copy, RotateCcw, Plus } from 'lucide-react';
import { EditorContent } from '@tiptap/react';
import { formatLabel } from '../utils/variableParser';
import { allLetterFields, resolveFieldDefs, withFieldDef } from '../utils/fieldDefs';
import { isPronounToken } from '../utils/pronouns';
import { FieldSettingsModal } from './FieldSettingsModal';
import { TYPE_ICONS } from './FieldForm';
import { TEMPLATE_CATEGORIES } from '../data/defaultTemplates';
import { Button, TextInput, Field } from './ui';
import { MarkupHelpModal } from './MarkupHelpModal';
import { FieldMenu } from './FieldMenu';
import { useLetterEditor } from '../editor/useLetterEditor';
import { LetterToolbar } from '../editor/LetterToolbar';
import { ChipContext } from '../editor/chips';
import { insertField as insertFieldInEditor, wrapOptional } from '../editor/commands';

/**
 * The draft lives in App (see utils/templateDraft), not here. When it lived
 * here, switching to Quick Fill unmounted the editor and threw unsaved edits
 * away without asking, and the preview never showed them until Save.
 */
/** Starting points for a letter's recipient address. */
const ADDRESSES = [
  { label: 'Client’s address', text: '{{client_name}}\n{{client_address}}' },
  {
    label: 'Someone else’s',
    text: '{{recipient_name}}\n{{recipient_organization}}\n{{recipient_address}}',
  },
];

/** How a placeholder reads in the editor: its field's label, or the pronoun it stands for. */
const chipText = (name, defs) =>
  isPronounToken(name) ? name.replace(/_/g, ' ') : defs[name]?.label || formatLabel(name);

export function DocumentEditor({
  template,
  draft,
  isDirty,
  onChangeDraft,
  onSaveTemplate,
  onSaveAsNew,
  onDiscard,
  fieldLibrary = [],
  onSaveLibraryField,
}) {
  const [showHelp, setShowHelp] = useState(false);

  const subjectRef = useRef(null);
  const recipientRef = useRef(null);
  // { x, y, target: 'body' | 'subject' | 'recipient', optional? } while the Insert field menu is open.
  const [fieldMenu, setFieldMenu] = useState(null);
  const [editingField, setEditingField] = useState(null);

  useEffect(() => {
    setFieldMenu(null);
  }, [template?.id]);

  const set = (patch) => onChangeDraft((prev) => ({ ...prev, ...patch }));
  const setDraft = onChangeDraft;

  const editor = useLetterEditor({
    markup: draft.body,
    onChange: (body) => set({ body }),
    onContextMenu: (e) => setFieldMenu({ x: e.clientX, y: e.clientY, target: 'body' }),
    editorClass: 'lb-pane-editor',
  });

  const letterText = `${draft.recipient || ''}\n\n${draft.body}\n\n${draft.subject}`;
  const variables = allLetterFields(letterText);
  const defs = resolveFieldDefs(variables, {
    text: letterText,
    library: fieldLibrary,
    templateFields: draft.fields,
  });

  /** Keep a field's definition on the letter (or drop it when a guess would do). */
  const recordField = (def) =>
    setDraft((prev) => {
      const fields = withFieldDef(prev.fields, def);
      return fields === prev.fields ? prev : { ...prev, fields };
    });

  /** Insert at the caret, not blindly at the end. */
  const insertVariable = (name, target = 'body') => {
    if (target === 'body') {
      insertFieldInEditor(editor, name);
      return;
    }
    const token = `{{${name}}}`;
    const el = (target === 'recipient' ? recipientRef : subjectRef).current;
    setDraft((prev) => {
      const text = prev[target] || '';
      if (!el) return { ...prev, [target]: `${text}${token}` };
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
      return { ...prev, [target]: text.slice(0, start) + token + text.slice(end) };
    });
  };

  /**
   * Insert from the field menu. The field's definition is kept on the letter
   * when a guess from its name would get it wrong ("return_to_work" picked as
   * a Date), and as a copy when it comes from My fields, so the letter still
   * works if that field is later deleted.
   */
  const insertField = (def, { saveToLibrary = false, pronoun = false } = {}) => {
    const target = fieldMenu?.target || 'body';
    setFieldMenu(null);
    if (!pronoun) {
      if (saveToLibrary) onSaveLibraryField?.(def);
      recordField(def);
    }
    insertVariable(def.name, target);
  };

  /** Wrap the selection in [[if name]] … [[end]], so it prints only when ticked. */
  const makeOptional = (name) => {
    setFieldMenu(null);
    wrapOptional(editor, name);
  };

  /** Saved from the field settings dialog. */
  const saveFieldSettings = (def, { inLibrary, saveToLibrary }) => {
    setEditingField(null);
    if (inLibrary || saveToLibrary) onSaveLibraryField?.(def);
    if (!inLibrary) recordField(def);
  };

  const openFieldMenu = (target) => (e) => {
    e.preventDefault();
    setFieldMenu({ x: e.clientX, y: e.clientY, target });
  };

  const chips = useMemo(
    () => ({
      field: (name) => ({ text: chipText(name, defs), title: `{{${name}}}` }),
      label: (name) => defs[name]?.label || formatLabel(name),
      onOpenField: (name) => defs[name] && !isPronounToken(name) && setEditingField(defs[name]),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(defs)]
  );

  return (
    <div
      className="w-[380px] xl:w-[440px] shrink-0 border-r flex flex-col min-h-0 select-none bg-surface-base border-line"
    >
      <div className="px-4 py-3.5 border-b shrink-0 flex items-center justify-between border-line">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          Editor
          {isDirty && (
            <span className="ml-2 normal-case tracking-normal text-warning">• unsaved</span>
          )}
        </h2>
      </div>

      <div className="flex-1 scroll-pane pl-4 pr-2 py-4 space-y-5 min-h-0">
        <Field label="Title">
          <TextInput value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <TextInput
              as="select"
              value={draft.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {TEMPLATE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </TextInput>
          </Field>
          <Field label="Subject">
            <TextInput
              ref={subjectRef}
              value={draft.subject}
              onChange={(e) => set({ subject: e.target.value })}
              onContextMenu={openFieldMenu('subject')}
            />
          </Field>
        </div>

        <Field
          label="Recipient address"
          hint={
            draft.recipient
              ? 'Printed on page 1, above the letter or in a window envelope (Settings › Letterhead). Right-click to insert a field.'
              : 'For letters that are mailed. Leave it off for the rest.'
          }
          action={
            draft.recipient ? (
              <button
                type="button"
                onClick={() => set({ recipient: '' })}
                className="text-[11px] font-medium cursor-pointer text-ink-muted hover:text-danger"
              >
                Remove
              </button>
            ) : null
          }
        >
          {draft.recipient ? (
            <TextInput
              as="textarea"
              rows={3}
              ref={recipientRef}
              aria-label="Recipient address"
              value={draft.recipient}
              onChange={(e) => set({ recipient: e.target.value })}
              onContextMenu={openFieldMenu('recipient')}
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ADDRESSES.map(({ label, text }) => (
                <Button key={label} onClick={() => set({ recipient: text })} className="!h-8 !px-3 !text-[12px]">
                  <Plus className="w-3.5 h-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Description">
          <TextInput
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>

        <Field
          label="Letter"
          hint="Right-click to insert a field. Return starts a new paragraph; Shift-Return a new line."
        >
          <div className="rounded-lg border border-line bg-surface-base focus-within:border-accent">
            <div className="sticky top-0 z-10 px-1.5 py-1 border-b rounded-t-lg border-line bg-surface-raised">
              <LetterToolbar
                editor={editor}
                onField={(r) => setFieldMenu({ x: r.left, y: r.bottom + 4, target: 'body' })}
                onOptional={(r) => setFieldMenu({ x: r.left, y: r.bottom + 4, target: 'body', optional: true })}
                onHelp={() => setShowHelp(true)}
              />
            </div>
            <ChipContext.Provider value={chips}>
              <EditorContent editor={editor} className="select-text" />
            </ChipContext.Provider>
          </div>
        </Field>

        {variables.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[12px] font-semibold text-ink-secondary">
              {variables.length} field{variables.length === 1 ? '' : 's'} in this letter
            </span>
            <div className="flex flex-wrap gap-1">
              {variables.map((v) => {
                const Icon = TYPE_ICONS[defs[v]?.type] || TYPE_ICONS.text;
                return (
                  <button
                    key={v}
                    onClick={() => v !== 'pronouns' && setEditingField(defs[v])}
                    title={v === 'pronouns' ? 'Pronouns are chosen in Quick Fill' : `Field settings for {{${v}}}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium cursor-pointer
                               bg-accent-soft text-accent-ink hover:brightness-95"
                  >
                    <Icon className="w-3 h-3" />
                    {defs[v]?.label || v}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-faint">Click a field to change its label, type or choices.</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3.5 border-t shrink-0 flex items-center gap-2 border-line">
        <Button
          variant="ghost"
          onClick={onDiscard}
          disabled={!isDirty}
          title="Discard unsaved changes"
          aria-label="Discard unsaved changes"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>

        <Button
          onClick={() =>
            onSaveAsNew({
              ...template,
              ...draft,
              id: `custom-${Date.now()}`,
              title: `${draft.title} (Copy)`,
              isCustom: true,
            })
          }
          className="flex-1"
        >
          <Copy className="w-3.5 h-3.5" />
          Save as new
        </Button>

        <Button
          variant="primary"
          onClick={() => onSaveTemplate({ ...template, ...draft })}
          disabled={!isDirty}
          className="flex-1"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>
      </div>

      <MarkupHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <FieldSettingsModal
        field={editingField}
        onClose={() => setEditingField(null)}
        onSave={saveFieldSettings}
      />

      {fieldMenu && (
        <FieldMenu
          position={fieldMenu}
          existing={variables}
          defs={defs}
          library={fieldLibrary}
          onInsert={insertField}
          onOptional={fieldMenu.target === 'body' ? makeOptional : undefined}
          startOptional={Boolean(fieldMenu.optional)}
          onClose={() => setFieldMenu(null)}
        />
      )}
    </div>
  );
}
