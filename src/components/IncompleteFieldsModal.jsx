import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatLabel } from '../utils/variableParser';
import { Modal, Button } from './ui';

/**
 * Last check before a letter leaves the app.
 *
 * An unfilled variable renders as a visible placeholder — "[Client Name]" —
 * so an incomplete letter is not obviously broken at a glance, and copying or
 * printing one sends a placeholder to a client, an insurer or a court. This
 * names the empty fields and makes continuing a deliberate choice rather than
 * an accident.
 */
export function IncompleteFieldsModal({ pending, fields, onFill, onContinue, onClose }) {
  const count = fields.length;

  return (
    <Modal
      isOpen={Boolean(pending)}
      onClose={onClose}
      title={`${count} field${count === 1 ? '' : 's'} still empty`}
      subtitle={`They will print as placeholders if you ${pending?.label ?? 'continue'}.`}
      icon={AlertTriangle}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Cancel
          </Button>
          <Button onClick={onContinue}>Continue anyway</Button>
          <Button variant="primary" onClick={onFill}>
            Fill them in
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-3">
        <ul className="space-y-1.5">
          {fields.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-warning-soft"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
              <span className="text-[13px] font-medium text-ink">{formatLabel(name)}</span>
              <code className="ml-auto text-[11px] font-mono text-ink-muted">
                {`{{${name}}}`}
              </code>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
