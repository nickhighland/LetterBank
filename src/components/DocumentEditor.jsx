import React, { useState, useEffect, useRef } from 'react';
import { Save, Copy, RotateCcw, Braces } from 'lucide-react';
import { extractVariables, fieldTypeMap, inferFieldType, formatLabel } from '../utils/variableParser';
import { TEMPLATE_CATEGORIES } from '../data/defaultTemplates';
import { Button, TextInput, Field, Badge } from './ui';
import { FormatToolbar } from './FormatToolbar';
import { MarkupHelpModal } from './MarkupHelpModal';
import { FieldMenu } from './FieldMenu';

/**
 * The draft lives in App (see utils/templateDraft), not here. When it lived
 * here, switching to Quick Fill unmounted the editor and threw unsaved edits
 * away without asking, and the preview never showed them until Save.
 */
export function DocumentEditor({ template, draft, isDirty, onChangeDraft, onSaveTemplate, onSaveAsNew, onDiscard }) {
  const bodyRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);

  const subjectRef = useRef(null);
  // { x, y, target: 'body' | 'subject' } while the Insert field menu is open.
  const [fieldMenu, setFieldMenu] = useState(null);

  useEffect(() => {
    setFieldMenu(null);
  }, [template?.id]);

  const set = (patch) => onChangeDraft((prev) => ({ ...prev, ...patch }));
  const setDraft = onChangeDraft;

  const variables = extractVariables(`${draft.subject} ${draft.body}`);

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
   * Insert from the field menu. A type that differs from what the name alone
   * would suggest is recorded on the template, so Quick Fill offers the right
   * picker — "return_to_work" picked as a Date gets a date picker.
   */
  const insertField = (name, type) => {
    const target = fieldMenu?.target || 'body';
    setFieldMenu(null);
    setDraft((prev) => {
      const known = prev.fields.find((f) => f.name === name);
      if (known ? known.type === type : inferFieldType(name) === type) return prev;
      const fields = known
        ? prev.fields.map((f) => (f.name === name ? { ...f, type } : f))
        : [...prev.fields, { name, label: formatLabel(name), type, defaultValue: '' }];
      return { ...prev, fields };
    });
    insertVariable(name, target);
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
              {variables.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  title={`Insert {{${v}}} at the cursor`}
                  className="cursor-pointer"
                >
                  <Badge tone="accent">{v}</Badge>
                </button>
              ))}
            </div>
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

      {fieldMenu && (
        <FieldMenu
          position={fieldMenu}
          existing={variables}
          types={fieldTypeMap(draft.fields)}
          onInsert={insertField}
          onClose={() => setFieldMenu(null)}
        />
      )}
    </div>
  );
}
