import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  HelpCircle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
} from 'lucide-react';

/**
 * Applies letter markup to the selected lines of a plain-text body.
 *
 * Everything works on whole lines, because the markup is line-oriented — you
 * cannot half-bullet a line. With no selection it acts on the line holding the
 * caret. Selection is restored afterwards so a run of clicks (bullets, then
 * indent) stays on the same lines.
 */

const ALIGN_RE = /^(\s*)\[(?:left|center|centre|right|justify)\]\s*/i;
const BULLET_RE = /^(\s*>*\s*)[-*]\s+/;
const NUMBER_RE = /^(\s*>*\s*)\d+[.)]\s+/;
const INDENT_RE = /^(\s*)(>+)\s?/;

function lineRange(text, start, end) {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  let to = text.indexOf('\n', end);
  if (to === -1) to = text.length;
  return [from, to];
}

const transforms = {
  align: (lines, value) =>
    lines.map((line, i) => {
      const bare = line.replace(ALIGN_RE, '$1');
      if (i !== 0) return bare; // one token per block, on its first line
      return value === 'left' ? bare : bare.replace(/^(\s*)/, `$1[${value}] `);
    }),

  bullets: (lines) => {
    const alreadyBullets = lines.every((l) => !l.trim() || BULLET_RE.test(l));
    return lines.map((line) => {
      if (!line.trim()) return line;
      const stripped = line.replace(BULLET_RE, '$1').replace(NUMBER_RE, '$1');
      if (alreadyBullets) return stripped;
      return stripped.replace(/^(\s*>*\s*)/, '$1- ');
    });
  },

  numbers: (lines) => {
    const alreadyNumbers = lines.every((l) => !l.trim() || NUMBER_RE.test(l));
    let n = 0;
    return lines.map((line) => {
      if (!line.trim()) return line;
      const stripped = line.replace(BULLET_RE, '$1').replace(NUMBER_RE, '$1');
      if (alreadyNumbers) return stripped;
      n += 1;
      return stripped.replace(/^(\s*>*\s*)/, `$1${n}. `);
    });
  },

  indent: (lines, dir) =>
    lines.map((line) => {
      if (!line.trim()) return line;
      const m = line.match(INDENT_RE);
      const depth = m ? (m[2].match(/>/g) || []).length : 0;
      const next = Math.max(0, Math.min(4, depth + dir));
      const bare = m ? line.slice(m[0].length) : line;
      return next === 0 ? bare : `${'>'.repeat(next)} ${bare}`;
    }),
};

const WRAPPERS = { bold: '**', italic: '*', underline: '__' };

/**
 * Wrap (or unwrap) the current selection in an inline marker.
 * With nothing selected, inserts the pair and puts the caret between them.
 */
export function applyInline(textarea, action) {
  const mark = WRAPPERS[action];
  if (!mark) return null;

  const text = textarea.value;
  const { selectionStart: a, selectionEnd: b } = textarea;
  const selected = text.slice(a, b);
  const n = mark.length;

  // Already wrapped? Toggle it off.
  const wrappedInside = selected.startsWith(mark) && selected.endsWith(mark) && selected.length > n * 2;
  const wrappedOutside = text.slice(a - n, a) === mark && text.slice(b, b + n) === mark;

  if (wrappedInside) {
    const bare = selected.slice(n, -n);
    return { next: text.slice(0, a) + bare + text.slice(b), selection: [a, a + bare.length] };
  }
  if (wrappedOutside) {
    return {
      next: text.slice(0, a - n) + selected + text.slice(b + n),
      selection: [a - n, b - n],
    };
  }

  const next = text.slice(0, a) + mark + selected + mark + text.slice(b);
  return { next, selection: [a + n, a + n + selected.length] };
}

export function applyFormat(textarea, action, value) {
  const text = textarea.value;
  const [from, to] = lineRange(text, textarea.selectionStart, textarea.selectionEnd);
  const lines = text.slice(from, to).split('\n');

  const fn = transforms[action];
  if (!fn) return null;

  const replaced = fn(lines, value).join('\n');
  const next = text.slice(0, from) + replaced + text.slice(to);
  return { next, selection: [from, from + replaced.length] };
}

const GROUPS = [
  [
    { action: 'bold', inline: true, Icon: Bold, label: 'Bold  **text**' },
    { action: 'italic', inline: true, Icon: Italic, label: 'Italic  *text*' },
    { action: 'underline', inline: true, Icon: Underline, label: 'Underline  __text__' },
  ],
  [
    { action: 'align', value: 'left', Icon: AlignLeft, label: 'Align left' },
    { action: 'align', value: 'center', Icon: AlignCenter, label: 'Centre' },
    { action: 'align', value: 'right', Icon: AlignRight, label: 'Align right' },
    { action: 'align', value: 'justify', Icon: AlignJustify, label: 'Justify' },
  ],
  [
    { action: 'bullets', Icon: List, label: 'Bullet list' },
    { action: 'numbers', Icon: ListOrdered, label: 'Numbered list' },
  ],
  [
    { action: 'indent', value: -1, Icon: IndentDecrease, label: 'Decrease indent' },
    { action: 'indent', value: 1, Icon: IndentIncrease, label: 'Increase indent' },
  ],
];

export function FormatToolbar({ targetRef, onChange, onShowHelp }) {
  const run = (action, value, inline) => {
    const el = targetRef.current;
    if (!el) return;
    const result = inline ? applyInline(el, action) : applyFormat(el, action, value);
    if (!result) return;

    onChange(result.next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selection[0], result.selection[1]);
    });
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <span className="w-px h-5 mx-0.5 bg-line" />}
          {group.map(({ action, value, Icon, label, inline }) => (
            <button
              key={label}
              type="button"
              onClick={() => run(action, value, inline)}
              title={label}
              aria-label={label}
              className="grid place-items-center w-7 h-7 rounded-md cursor-pointer transition-colors
                         text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </React.Fragment>
      ))}

      <span className="w-px h-5 mx-0.5 bg-line" />
      <button
        type="button"
        onClick={onShowHelp}
        title="Formatting cheat sheet"
        aria-label="Formatting cheat sheet"
        className="grid place-items-center w-7 h-7 rounded-md cursor-pointer transition-colors
                   text-accent hover:bg-accent-soft"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
