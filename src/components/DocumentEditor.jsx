import React, { useState, useEffect, useRef } from 'react';
import { Save, Copy, RotateCcw, Braces } from 'lucide-react';
import { inferFieldType, formatLabel } from '../utils/variableParser';
import { allLetterFields, resolveFieldDefs } from '../utils/fieldDefs';
import { FieldSettingsModal } from './FieldSettingsModal';
import { TYPE_ICONS } from './FieldForm';
import { TEMPLATE_CATEGORIES } from '../data/defaultTemplates';
import { Button, TextInput, Field } from './ui';
import { FormatToolbar } from './FormatToolbar';
import { MarkupHelpModal } from './MarkupHelpModal';
import { FieldMenu } from './FieldMenu';

/**
 * The draft lives in App (see utils/templateDraft), not here. When it lived
 * here, switching to Quick Fill unmounted the editor and threw unsaved edits
 * away without asking, and the preview never showed them until Save.
 */
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
  const bodyRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);

  const subjectRef = useRef(null);
  // { x, y, target: 'body' | 'subject' } while the Insert field menu is open.
  const [fieldMenu, setFieldMenu] = useState(null);
  const [editingField, setEditingField] = useState(null);

  useEffect(() => {
    setFieldMenu(null);
  }, [template?.id]);

  const set = (patch) => onChangeDraft((prev) => ({ ...prev, ...patch }));
  const setDraft = onChangeDraft;

  const letterText = `${draft.body}\n\n${draft.subject}`;
  const variables = allLetterFields(letterText);
  const defs = resolveFieldDefs(variables, {
    text: letterText,
    library: fieldLibrary,
    templateFields: draft.fields,
  });

  /** Keep a field's definition on the letter (or drop it when a guess would do). */
  const recordField = (def) =>
    setDraft((prev) => {
      const plain =
        def.type === inferFieldType(def.name) &&
        def.label === formatLabel(def.name) &&
        !def.help &&
        !(def.options || []).length;
      const others = prev.fields.filter((f) => f.name !== def.name);
      const known = prev.fields.find((f) => f.name === def.name);
      if (plain && !known) return prev;
      const entry = { ...def, defaultValue: known?.defaultValue ?? def.defaultValue ?? '' };
      delete entry.source;
      return { ...prev, fields: plain ? others : [...others, entry] };
    });

  /** Insert at the caret, not blindly at the end. */
  const insertVariable = (name, target = 'body') => {
    const token = `{{${name}}}`;
    const el = target === 'subject' ? subjectRef.current : bodyRef.current;
    setDraft((prev) => {
      const text = prev[target];
      if (!el) return { ...prev, [target]: `${text}${token}` };
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const next = text.slice(0, start) + token + text.slice(end);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
      return { ...prev, [target]: next };
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
    const el = bodyRef.current;
    setDraft((prev) => {
      const text = prev.body;
      const start = el?.selectionStart ?? text.length;
      const end = el?.selectionEnd ?? text.length;
      const selected = text.slice(start, end);
      const lineStart = start === 0 || text[start - 1] === '\n';
      const lineEnd = end === text.length || text[end] === '\n';
      // Whole lines get markers on lines of their own; part of a line, inline.
      const wrapped =
        selected && !(lineStart && lineEnd) && !selected.includes('\n')
          ? `[[if ${name}]]${selected}[[end]]`
          : `${lineStart ? '' : '\n'}[[if ${name}]]\n${selected || 'Optional wording.'}\n[[end]]${lineEnd ? '' : '\n'}`;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start, start + wrapped.length);
      });
      return { ...prev, body: text.slice(0, start) + wrapped + text.slice(end) };
    });
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

        <Field label="Description">
          <TextInput
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>

        <Field
          label="Body"
          hint="Right-click to insert a field. Formatting applies to the selected lines. ---pagebreak--- forces a new page."
          action={
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setFieldMenu({ x: r.left, y: r.bottom + 4, target: 'body' });
                }}
                title="Insert a fillable field at the cursor"
                className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium cursor-pointer
                           text-ink-secondary hover:bg-surface-hover"
              >
                <Braces className="w-3.5 h-3.5" />
                Field
              </button>
              <FormatToolbar
                targetRef={bodyRef}
                onChange={(body) => set({ body })}
                onShowHelp={() => setShowHelp(true)}
              />
            </span>
          }
        >
          <TextInput
            as="textarea"
            ref={bodyRef}
            rows={18}
            value={draft.body}
            onChange={(e) => set({ body: e.target.value })}
            onContextMenu={openFieldMenu('body')}
            className="font-serif !text-[13px] leading-relaxed"
          />
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
          onClose={() => setFieldMenu(null)}
        />
      )}
    </div>
  );
}
