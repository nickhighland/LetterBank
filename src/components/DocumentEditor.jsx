import React, { useState, useEffect, useRef } from 'react';
import { Save, Copy, RotateCcw } from 'lucide-react';
import { extractVariables } from '../utils/variableParser';
import { TEMPLATE_CATEGORIES } from '../data/defaultTemplates';
import { Button, TextInput, Field, Badge } from './ui';
import { FormatToolbar } from './FormatToolbar';
import { MarkupHelpModal } from './MarkupHelpModal';

export function DocumentEditor({ template, onSaveTemplate, onSaveAsNew }) {
  const [draft, setDraft] = useState(() => ({
    title: template?.title || '',
    category: template?.category || 'General',
    subject: template?.subject || '',
    body: template?.body || '',
    description: template?.description || '',
  }));
  const bodyRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!template) return;
    setDraft({
      title: template.title || '',
      category: template.category || 'General',
      subject: template.subject || '',
      body: template.body || '',
      description: template.description || '',
    });
  }, [template?.id]);

  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const variables = extractVariables(`${draft.subject} ${draft.body}`);

  const isDirty =
    template &&
    (draft.title !== (template.title || '') ||
      draft.category !== (template.category || 'General') ||
      draft.subject !== (template.subject || '') ||
      draft.body !== (template.body || '') ||
      draft.description !== (template.description || ''));

  /** Insert at the caret, not blindly at the end. */
  const insertVariable = (name) => {
    const token = `{{${name}}}`;
    const el = bodyRef.current;
    setDraft((prev) => {
      if (!el) return { ...prev, body: `${prev.body}${token}` };
      const start = el.selectionStart ?? prev.body.length;
      const end = el.selectionEnd ?? prev.body.length;
      const next = prev.body.slice(0, start) + token + prev.body.slice(end);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
      return { ...prev, body: next };
    });
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
            <TextInput value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />
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
          hint="Formatting applies to the selected lines. ---pagebreak--- forces a new page."
          action={
            <FormatToolbar
              targetRef={bodyRef}
              onChange={(body) => set({ body })}
              onShowHelp={() => setShowHelp(true)}
            />
          }
        >
          <TextInput
            as="textarea"
            ref={bodyRef}
            rows={18}
            value={draft.body}
            onChange={(e) => set({ body: e.target.value })}
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
          onClick={() =>
            setDraft({
              title: template?.title || '',
              category: template?.category || 'General',
              subject: template?.subject || '',
              body: template?.body || '',
              description: template?.description || '',
            })
          }
          disabled={!isDirty}
          title="Discard changes"
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
    </div>
  );
}
