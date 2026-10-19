/**
 * Lightweight markup for letter bodies.
 *
 * The body stays plain text. That keeps templates portable through JSON
 * backup/restore and CSV merge, and keeps the paginator measuring the same
 * thing the printer renders — the parser below produces a block model, and
 * both the React renderer and the paginator's measuring pass build from it.
 * A rich-text/HTML body would have put arbitrary markup through the verified
 * print pipeline.
 *
 * Block level (start of line):
 *   - item        bullet list
 *   * item        bullet list
 *   1. item       numbered list
 *   > text        indent one level (repeatable: >>, >>>)
 *   [center] …    align this block: [left] [center] [right] [justify]
 *
 * Inline (anywhere):
 *   **bold**      bold
 *   *italic*      italic
 *   __underline__ underline
 *   ***both***    marks combine, and nest: **bold with *italic* inside**
 *
 * Blocks are separated by a blank line. Markers are stripped before the text
 * is measured or drawn.
 *
 * Single `_` is deliberately NOT an italic marker: variable values routinely
 * contain underscores, and treating them as formatting would mangle merged
 * content.
 *
 * Escapes, written by the rich text editor so what was typed prints as typed:
 *   \*  \_  \\    a literal *, _ or \
 *   \ at the start of a line (after any [align] or >) keeps the line's text
 *                 from being read as a list, indent or alignment marker.
 */

const ALIGN_TOKENS = {
  left: 'left',
  center: 'center',
  centre: 'center',
  right: 'right',
  justify: 'justify',
};

/** px of indent per `>` level. */
export const INDENT_STEP = 32;

export const BULLET_RE = /^\s*[-*]\s+/;
export const NUMBER_RE = /^\s*\d+[.)]\s+/;
export const ALIGN_RE = /^\s*\[(left|center|centre|right|justify)\]\s*/i;
export const INDENT_RE = /^(\s*>+)\s?/;
/** A backslash that is not escaping *, _ or another backslash. */
export const LINE_ESCAPE_RE = /^\\(?![*_\\])/;

function stripAlign(line) {
  const m = line.match(ALIGN_RE);
  if (!m) return { align: null, rest: line };
  return { align: ALIGN_TOKENS[m[1].toLowerCase()], rest: line.slice(m[0].length) };
}

function stripIndent(line) {
  const m = line.match(INDENT_RE);
  if (!m) return { indent: 0, rest: line };
  const depth = (m[1].match(/>/g) || []).length;
  return { indent: depth, rest: line.slice(m[0].length) };
}

/**
 * Parse a rendered letter body into blocks.
 * Returns [{ kind, align, indent, items }] where `items` are plain strings.
 */
export function parseBlocks(text) {
  if (!text) return [];

  return text.split('\n\n').map((raw) => {
    const rawLines = raw.split('\n');

    let blockAlign = null;
    let blockIndent = 0;
    const items = [];
    let kind = 'paragraph';

    rawLines.forEach((original, i) => {
      let line = original;

      const a = stripAlign(line);
      // An alignment token anywhere in the block applies to the whole block;
      // in practice it is written on the first line.
      if (a.align) blockAlign = a.align;
      line = a.rest;

      const ind = stripIndent(line);
      if (ind.indent) blockIndent = Math.max(blockIndent, ind.indent);
      line = ind.rest;

      // "\- not a list": the rest of the line is text, as typed.
      const escaped = LINE_ESCAPE_RE.test(line);
      if (escaped) line = line.slice(1);

      if (i === 0 && !escaped) {
        if (BULLET_RE.test(line)) kind = 'bullets';
        else if (NUMBER_RE.test(line)) kind = 'numbers';
      }

      if (!escaped && kind === 'bullets') line = line.replace(BULLET_RE, '');
      else if (!escaped && kind === 'numbers') line = line.replace(NUMBER_RE, '');

      items.push(line);
    });

    return { kind, align: blockAlign, indent: blockIndent, items };
  });
}

const FIELD_RE = /^\{\{([a-zA-Z0-9_-]+)\}\}/;
const CONDITION_RE = /^\[\[\s*(if\s+[^\]]*?|else|end)\s*\]\]/i;

/**
 * A line as tokens: text, runs of * or __, and (with `atoms`) {{fields}} and
 * [[conditions]], which the editor shows as chips. Escaped characters are
 * text.
 */
function tokenize(line, atoms) {
  const tokens = [];
  let text = '';
  const flush = () => {
    if (text) tokens.push({ text });
    text = '';
  };

  for (let i = 0; i < line.length; ) {
    const c = line[i];
    if (c === '\\' && '*_\\'.includes(line[i + 1] ?? '')) {
      text += line[i + 1];
      i += 2;
      continue;
    }
    if (atoms && (c === '{' || c === '[')) {
      const rest = line.slice(i);
      const m = c === '{' ? FIELD_RE.exec(rest) : CONDITION_RE.exec(rest);
      if (m) {
        flush();
        tokens.push(c === '{' ? { field: m[1] } : { condition: m[1].trim().replace(/\s+/g, ' ') });
        i += m[0].length;
        continue;
      }
    }
    if (c === '*' || c === '_') {
      let n = 1;
      while (line[i + n] === c) n++;
      // Two underscores underline; one, or a row of them (a blank to write
      // on by hand: "________"), are just underscores.
      if (c === '_' && n !== 2) text += c.repeat(n);
      else {
        flush();
        tokens.push({ delim: c, n });
      }
      i += n;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return tokens;
}

/**
 * A line as runs of text, each with the marks it carries:
 * [{ text, bold, italic, underline }], or, with `atoms`, also
 * { field, bold, italic, underline } and { condition }.
 *
 * Stars: one opens or closes italic, two bold, three both. A marker with no
 * partner later in the line is printed as typed, so "5 * 3" stays as it is.
 */
export function parseInline(text, { atoms = false } = {}) {
  const tokens = tokenize(String(text ?? ''), atoms);
  const later = (k, delim, n) =>
    tokens.some((t, j) => j > k && t.delim === delim && (delim === '_' ? t.n === 2 : t.n >= n));

  const runs = [];
  const marks = { bold: false, italic: false, underline: false };
  const flags = () => ({ bold: marks.bold, italic: marks.italic, underline: marks.underline });
  const push = (str) => {
    if (!str) return;
    const prev = runs[runs.length - 1];
    const f = flags();
    if (
      prev &&
      prev.text !== undefined &&
      prev.bold === f.bold &&
      prev.italic === f.italic &&
      prev.underline === f.underline
    ) {
      prev.text += str;
    } else runs.push({ text: str, ...f });
  };

  tokens.forEach((tok, k) => {
    if (tok.text !== undefined) return push(tok.text);
    if (tok.field) return runs.push({ field: tok.field, ...flags() });
    if (tok.condition) return runs.push({ condition: tok.condition });

    if (tok.delim === '_') {
      if (marks.underline) marks.underline = false;
      else if (later(k, '_', 2)) marks.underline = true;
      else push('__');
      return;
    }

    const { n } = tok;
    if (n > 3) return push('*'.repeat(n));
    let left = n;
    if (n === 3 && marks.bold && marks.italic) {
      marks.bold = marks.italic = false;
      return;
    }
    let closedItalic = false;
    if (n >= 2 && marks.bold) {
      marks.bold = false;
      left -= 2;
    } else if (n !== 2 && marks.italic) {
      marks.italic = false;
      closedItalic = true;
      left -= 1;
    }
    if (left >= 2 && !marks.bold && later(k, '*', 2)) {
      marks.bold = true;
      left -= 2;
    }
    if (left >= 1 && !marks.italic && !closedItalic && later(k, '*', 1)) {
      marks.italic = true;
      left -= 1;
    }
    if (left === 2 && marks.italic && !closedItalic) {
      // "*a**": the italic closes and a star is left over.
      marks.italic = false;
      left -= 1;
    }
    push('*'.repeat(left));
  });

  return runs;
}

/** The text of a line without its formatting. */
export const plainInline = (text) =>
  parseInline(text)
    .map((r) => r.text)
    .join('');

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline runs as HTML, for the paginator's measuring pass. */
export function inlineToHtml(text) {
  return parseInline(text)
    .map(({ text: t, bold, italic, underline }) => {
      let html = escapeHtml(t);
      if (underline) html = `<u>${html}</u>`;
      if (italic) html = `<em>${html}</em>`;
      if (bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join('');
}

/**
 * Render blocks to HTML. Used by the paginator's off-screen measuring element,
 * and mirrors what LetterDocument draws with React.
 */
export function blocksToHtml(blocks, { paragraphSpacing = 0.9, bodyAlignment = 'left' } = {}) {
  return blocks
    .filter((block) => block.kind !== 'pagebreak')
    .map((block) => {
      const align = block.align || bodyAlignment;
      const pad = block.indent * INDENT_STEP;
      const base = `margin-bottom:${paragraphSpacing}em;text-align:${align};${
        pad ? `padding-left:${pad}px;` : ''
      }`;

      if (block.kind === 'paragraph') {
        return `<p style="${base}">${block.items.map(inlineToHtml).join('<br/>')}</p>`;
      }

      const tag = block.kind === 'numbers' ? 'ol' : 'ul';
      // The measuring element lives outside .letter-body-text, so state the
      // marker style explicitly rather than relying on the document stylesheet.
      const marker = block.kind === 'numbers' ? 'decimal' : 'disc';
      const lis = block.items
        .filter((t) => t.trim() !== '')
        .map((t) => `<li style="margin-bottom:0.25em;">${inlineToHtml(t)}</li>`)
        .join('');
      return `<${tag} style="${base}padding-left:${pad + 24}px;list-style:${marker} outside;">${lis}</${tag}>`;
    })
    .join('');
}

/**
 * A rendered letter body as plain text, for the clipboard: list markers kept,
 * formatting and alignment dropped.
 */
export function markupToPlainText(text) {
  return String(text ?? '')
    .split(/\n?(?:---pagebreak---|\[\[page\]\])\n?/i)
    .map((section) =>
      parseBlocks(section)
        .map((block) =>
          block.items
            .filter((item) => block.kind === 'paragraph' || item.trim() !== '')
            .map((item, i) => {
              const marker =
                block.kind === 'bullets' ? '• ' : block.kind === 'numbers' ? `${i + 1}. ` : '';
              return marker + plainInline(item);
            })
            .join('\n')
        )
        .join('\n\n')
    )
    .join('\n\n');
}
