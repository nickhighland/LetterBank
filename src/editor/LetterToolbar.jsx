import React from 'react';
import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
  Braces,
  Split,
  SeparatorHorizontal,
  Undo2,
  Redo2,
  CircleHelp,
} from 'lucide-react';
import { currentAlign } from './commands';

const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl+';

function ToolButton({ icon: Icon, label, shortcut, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      // Keep the caret in the letter while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`flex items-center gap-1 h-7 rounded-md cursor-pointer transition-colors shrink-0
        ${children ? 'px-2 text-[12px] font-medium' : 'w-7 justify-center'}
        ${active ? 'bg-accent-soft text-accent-ink' : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'}
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

const Divider = () => <span className="w-px h-4 mx-0.5 shrink-0 bg-line" />;

/**
 * Formatting for the letter editor, laid out like a word processor's:
 * character formatting, alignment, lists and indent, then the letter's own
 * pieces: fields, optional wording and page breaks.
 *
 * `onField` and `onOptional` receive the button's rectangle, to open the
 * field menu under it.
 */
export function LetterToolbar({ editor, onField, onOptional, onHelp, wrap = true, className = '' }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive('bold'),
            italic: ed.isActive('italic'),
            underline: ed.isActive('underline'),
            bullets: ed.isActive('bulletList'),
            numbers: ed.isActive('orderedList'),
            align: currentAlign(ed),
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
          }
        : null,
  });
  if (!editor || !state) return null;

  const run = (fn) => () => fn(editor.chain().focus()).run();
  const at = (handler) => (e) => handler?.(e.currentTarget.getBoundingClientRect());

  return (
    <div
      className={`flex ${wrap ? 'flex-wrap' : 'flex-nowrap'} items-center gap-0.5 ${className}`}
      role="toolbar"
      aria-label="Formatting"
    >
      <ToolButton icon={Undo2} label="Undo" shortcut={`${MOD}Z`} disabled={!state.canUndo} onClick={run((c) => c.undo())} />
      <ToolButton icon={Redo2} label="Redo" shortcut={`${MOD}⇧Z`} disabled={!state.canRedo} onClick={run((c) => c.redo())} />
      <Divider />
      <ToolButton icon={Bold} label="Bold" shortcut={`${MOD}B`} active={state.bold} onClick={run((c) => c.toggleBold())} />
      <ToolButton icon={Italic} label="Italic" shortcut={`${MOD}I`} active={state.italic} onClick={run((c) => c.toggleItalic())} />
      <ToolButton
        icon={Underline}
        label="Underline"
        shortcut={`${MOD}U`}
        active={state.underline}
        onClick={run((c) => c.toggleUnderline())}
      />
      <Divider />
      {[
        ['left', AlignLeft, 'Align left', 'L'],
        ['center', AlignCenter, 'Centre', 'E'],
        ['right', AlignRight, 'Align right', 'R'],
        ['justify', AlignJustify, 'Justify', 'J'],
      ].map(([align, icon, label, key]) => (
        <ToolButton
          key={align}
          icon={icon}
          label={label}
          shortcut={`${MOD}⇧${key}`}
          active={state.align === align}
          onClick={run((c) => c.setBlockAlign(align))}
        />
      ))}
      <Divider />
      <ToolButton icon={List} label="Bulleted list" active={state.bullets} onClick={run((c) => c.toggleBulletList())} />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.numbers}
        onClick={run((c) => c.toggleOrderedList())}
      />
      <ToolButton icon={IndentDecrease} label="Decrease indent" shortcut="⇧Tab" onClick={run((c) => c.changeIndent(-1))} />
      <ToolButton icon={IndentIncrease} label="Increase indent" shortcut="Tab" onClick={run((c) => c.changeIndent(1))} />
      <Divider />
      {onField && (
        <ToolButton icon={Braces} label="Insert a fillable field" onClick={at(onField)}>
          Field
        </ToolButton>
      )}
      {onOptional && (
        <ToolButton icon={Split} label="Make the selection optional (prints only when ticked)" onClick={at(onOptional)}>
          Optional
        </ToolButton>
      )}
      <ToolButton
        icon={SeparatorHorizontal}
        label="Start a new page"
        shortcut={`${MOD}↩`}
        onClick={run((c) => c.insertPageBreak())}
      />
      {onHelp && <ToolButton icon={CircleHelp} label="Formatting help" onClick={onHelp} />}
    </div>
  );
}
