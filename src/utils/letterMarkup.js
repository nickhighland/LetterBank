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
 *
 * Blocks are separated by a blank line. Markers are stripped before the text
 * is measured or drawn.
 *
 * Single `_` is deliberately NOT an italic marker: variable values routinely
 * contain underscores, and treating them as formatting would mangle merged
 * content.
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
const ALIGN_RE = /^\s*\[(left|center|centre|right|justify)\]\s*/i;
const INDENT_RE = /^(\s*>+)\s?/;

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

      if (i === 0) {
        if (BULLET_RE.test(line)) kind = 'bullets';
        else if (NUMBER_RE.test(line)) kind = 'numbers';
      }

      if (kind === 'bullets') line = line.replace(BULLET_RE, '');
      else if (kind === 'numbers') line = line.replace(NUMBER_RE, '');

      items.push(line);
    });

    return { kind, align: blockAlign, indent: blockIndent, items };
  });
}

/**
 * Split a line into inline-formatted runs. Non-nested by design — flat runs
 * cover the formatting a clinical letter needs without an HTML parser.
 */
const INLINE_RE = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|\*[\s\S]+?\*)/g;

export function parseInline(text) {
  const runs = [];
  let last = 0;

  for (const m of String(text).matchAll(INLINE_RE)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) runs.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith('__')) runs.push({ text: tok.slice(2, -2), underline: true });
    else runs.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }

  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

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
      const escaped = escapeHtml(t);
      if (bold) return `<strong>${escaped}</strong>`;
      if (italic) return `<em>${escaped}</em>`;
      if (underline) return `<u>${escaped}</u>`;
      return escaped;
    })
    .join('');
}

/**
 * Render blocks to HTML. Used by the paginator's off-screen measuring element,
 * and mirrors what LetterDocument draws with React.
 */
export function blocksToHtml(blocks, { paragraphSpacing = 0.9, bodyAlignment = 'left' } = {}) {
  return blocks
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

/** Join blocks back into their plain-text source (used when splitting pages). */
export function blocksToText(blocks) {
  return blocks
    .map((block) => {
      const prefix = '>'.repeat(block.indent);
      const alignTag = block.align ? `[${block.align}] ` : '';
      return block.items
        .map((item, i) => {
          const marker =
            block.kind === 'bullets' ? '- ' : block.kind === 'numbers' ? `${i + 1}. ` : '';
          const lead = i === 0 ? alignTag : '';
          return `${prefix}${lead}${marker}${item}`;
        })
        .join('\n');
    })
    .join('\n\n');
}
