import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal, Button } from './ui';

const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl+';

/**
 * How to write a letter in the editor: keys, fields, optional wording,
 * pronouns, and editing on the page. Each row is [what to press or type,
 * what it does].
 */
const SECTIONS = [
  {
    title: 'Formatting',
    rows: [
      [`${MOD}B  ${MOD}I  ${MOD}U`, 'Bold, italic, underline'],
      [`${MOD}⇧L  ${MOD}⇧E  ${MOD}⇧R  ${MOD}⇧J`, 'Align left, centre, right, justify'],
      ['Tab  ⇧Tab', 'Indent the paragraph, or take the indent back out'],
      ['- or 1. then a space', 'Start a bulleted or numbered list'],
      ['Return', 'New paragraph. Return twice leaves a list.'],
      ['⇧Return', 'New line in the same paragraph, as in an address'],
      [`${MOD}Return`, 'Start a new page'],
      [`${MOD}S`, 'Save the letter'],
    ],
  },
  {
    title: 'Fields',
    rows: [
      ['Right-click, or Field', 'Insert a field at the cursor: one already in the letter, one of My fields, or a new one'],
      ['{{client_name}}', 'Typing a placeholder makes it a field too'],
      ['Double-click a field', 'Change its label, type, choices or help text'],
    ],
  },
  {
    title: 'Optional wording',
    rows: [
      ['Select, then Optional', 'Prints only when a box is ticked in Quick Fill'],
      ['[[if telehealth]] … [[end]]', 'The same, typed: prints when Telehealth is ticked'],
      ['[[if telehealth]] … [[else]] … [[end]]', 'The second part prints when it is not ticked'],
      ['[[if platform = Zoom]] … [[end]]', 'Prints when a field reads Zoom'],
      ['[[if not telehealth]] … [[end]]', 'Prints when it is not ticked'],
    ],
  },
  {
    title: 'Pronouns, set once with the Pronouns field',
    rows: [
      ['{{they}} {{them}} {{their}}', 'she, her, her (or he, him, his; they, them, their)'],
      ['{{they_are}} {{they_were}} {{they_have}}', 'The verb agrees: she is, she was, she has'],
      ['{{They}} {{Their}} {{They_are}}', 'Capitalised, to start a sentence'],
    ],
  },
  {
    title: 'On the page',
    rows: [
      ['Click a paragraph', 'Edit it right on the letter. Click elsewhere or press Done to finish; Esc puts it back.'],
      ['In the Editor', 'Changes the letter template, like typing in the Editor pane'],
      ['In Quick Fill', 'Changes this letter only. The template stays as it is, and the change is erased when LetterBank closes.'],
    ],
  },
];

export function MarkupHelpModal({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Writing letters"
      subtitle="Keys and shortcuts for the editor"
      icon={HelpCircle}
      width="max-w-2xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className="p-6 space-y-6">
        {SECTIONS.map(({ title, rows }) => (
          <section key={title} className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-[12px] border-collapse">
                <tbody>
                  {rows.map(([keys, what], i) => (
                    <tr key={keys} className={i > 0 ? 'border-t border-line-soft' : undefined}>
                      <td className="px-3 py-2 align-top w-[40%]">
                        <code className="font-mono text-[11px] text-accent-ink bg-accent-soft rounded px-1.5 py-0.5 whitespace-pre-wrap">
                          {keys}
                        </code>
                      </td>
                      <td className="px-3 py-2 align-top text-ink-secondary">{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
