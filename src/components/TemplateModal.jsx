import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { TEMPLATE_CATEGORIES } from '../data/defaultTemplates';
import { Modal, Button, Field, TextInput } from './ui';

const STARTER_BODY = `Dear {{client_name}},

This is a clinical notice regarding your outpatient mental health care with {{practice_name}}.

Sincerely,`;

/**
 * Hooks run unconditionally — the open/closed gate lives in <Modal>.
 */
export function TemplateModal({ isOpen, onClose, onSaveNewTemplate }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState(STARTER_BODY);

  const reset = () => {
    setTitle('');
    setCategory('General');
    setSubject('');
    setDescription('');
    setBody(STARTER_BODY);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    onSaveNewTemplate({
      id: `custom-${Date.now()}`,
      title: title.trim(),
      category: category || 'General',
      subject: subject.trim(),
      description: description.trim(),
      body: body.trim(),
      icon: 'FileText',
      isCustom: true,
      fields: [
        { name: 'client_name', label: 'Client Full Name', type: 'text', defaultValue: '' },
        { name: 'practice_name', label: 'Practice Name', type: 'text', defaultValue: '' },
      ],
    });

    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New letter"
      subtitle="Use {{double_braces}} to create a fillable field."
      icon={Layers}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!title.trim()}>
            Create letter
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-5">
        <Field label="Title">
          <TextInput
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Insurance Continuation of Care"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <TextInput
              as="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {TEMPLATE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </TextInput>
          </Field>

          <Field label="Subject line" hint="Optional">
            <TextInput
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Continuation of care"
            />
          </Field>
        </div>

        <Field label="Description" hint="Shown under the title in the library">
          <TextInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="When to reach for this letter"
          />
        </Field>

        <Field
          label="Body"
          hint="Every {{variable}} becomes a field in Quick Fill. Use ---pagebreak--- to force a new page."
        >
          <TextInput
            as="textarea"
            rows={11}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-serif !text-[13px] leading-relaxed"
          />
        </Field>
      </div>
    </Modal>
  );
}
