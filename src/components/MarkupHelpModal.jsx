import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal, Button } from './ui';

/**
 * The formatting cheat sheet.
 *
 * Every row is rendered from the same markup it documents, so the "Result"
 * column cannot drift out of date the way a hand-written screenshot would.
 */
const SECTIONS = [
  {
    title: 'Inline — anywhere in a line',
    rows: [
      ['**bold text**', <strong key="b">bold text</strong>, 'Bold'],
      ['*italic text*', <em key="i">italic text</em>, 'Italic'],
      ['__underlined__', <u key="u">underlined</u>, 'Underline'],
    ],
  },
  {
    title: 'Lists — at the start of a line',
    rows: [
      ['- First point', <span key="l1">• First point</span>, 'Bullet list'],
      ['* First point', <span key="l2">• First point</span>, 'Bullet list (alternative)'],
      ['1. First step', <span key="l3">1. First step</span>, 'Numbered list'],
    ],
  },
  {
    title: 'Alignment — at the start of a paragraph',
    rows: [
      ['[left] text', <span key="a1">text</span>, 'Align left (the default)'],
      ['[center] text', <span key="a2">text</span>, 'Centre the paragraph'],
      ['[right] text', <span key="a3">text</span>, 'Align right'],
      ['[justify] text', <span key="a4">text</span>, 'Justify both edges'],
    ],
  },
  {
    title: 'Indent — at the start of a line',
    rows: [
      ['> text', <span key="i1">text</span>, 'Indent one level'],
      ['>> text', <span key="i2">text</span>, 'Indent two levels (up to four)'],
    ],
  },
  {
    title: 'Structure',
    rows: [
      ['(blank line)', <span key="s1">—</span>, 'Starts a new paragraph'],
      ['---pagebreak---', <span key="s2">—</span>, 'Forces a new page'],
      ['{{client_name}}', <span key="s3">Alex Morgan</span>, 'Becomes a Quick Fill field'],
    ],
  },
];

export function MarkupHelpModal({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Formatting cheat sheet"
      subtitle="The body is plain text. These markers style it on the printed letter."
      icon={HelpCircle}
      width="max-w-2xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className="p-6 space-y-6">
        <p className="text-[12px] text-ink-muted">
          Select some text and use the toolbar, or type the markers yourself — they do the
          same thing. Markers never appear on the letter.
        </p>

        {SECTIONS.map(({ title, rows }) => (
          <section key={title} className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              {title}
            </h3>
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-[12px] border-collapse">
                <tbody>
                  {rows.map(([markup, result, note], i) => (
                    <tr
                      key={markup}
                      className={i > 0 ? 'border-t border-line-soft' : undefined}
                    >
                      <td className="px-3 py-2 align-top w-[38%]">
                        <code className="font-mono text-[11px] text-accent-ink bg-accent-soft rounded px-1.5 py-0.5">
                          {markup}
                        </code>
                      </td>
                      <td className="px-3 py-2 align-top w-[26%] font-serif text-ink">
                        {result}
                      </td>
                      <td className="px-3 py-2 align-top text-ink-muted">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="text-[11px] text-ink-faint">
          A single underscore is not a formatting marker, so underscores inside merged
          values — <code className="font-mono">client_name</code> and the like — are left
          alone.
        </p>
      </div>
    </Modal>
  );
}
