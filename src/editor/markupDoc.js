import {
  ALIGN_RE,
  BULLET_RE,
  INDENT_RE,
  NUMBER_RE,
  parseBlocks,
  parseInline,
} from '../utils/letterMarkup';

/**
 * Letter markup to and from the rich text editor's document.
 *
 * Letters are still saved as markup (see utils/letterMarkup), so the
 * paginator, Word export, backups and CSV merge are unchanged; the editor
 * reads the markup into a document and writes it back on every change.
 *
 *   a block (blank-line separated)   paragraph, bullet list or numbered list,
 *                                    with its alignment and indent
 *   a line within a paragraph        a line break (Shift-Return)
 *   ---pagebreak--- / [[page]]       a page break
 *   {{field}}                        a field chip
 *   [[if …]] [[else]] [[end]]        an optional-wording chip
 *
 * Text is escaped as it is written, so a * or __ typed in the editor prints
 * as typed instead of turning into formatting.
 */

const PAGE_BREAK_LINE = /^\s*(?:---pagebreak---|\[\[page\]\])\s*$/i;
const MARKS = ['bold', 'italic', 'underline'];
const EMPTY_BLOCK = { kind: 'paragraph', align: null, indent: 0, items: [''] };

// ---- Markup -> document -----------------------------------------------------

function inlineNodes(line) {
  return parseInline(line, { atoms: true }).flatMap((run) => {
    if (run.condition) return [{ type: 'condition', attrs: { expr: run.condition } }];
    const marks = MARKS.filter((m) => run[m]).map((type) => ({ type }));
    const withMarks = marks.length ? { marks } : {};
    if (run.field) return [{ type: 'field', attrs: { name: run.field }, ...withMarks }];
    return run.text ? [{ type: 'text', text: run.text, ...withMarks }] : [];
  });
}

const withContent = (node, content) => (content.length ? { ...node, content } : node);

function blockNode(block) {
  const attrs = { align: block.align || null, indent: block.indent || 0 };

  if (block.kind === 'paragraph') {
    const content = block.items.flatMap((line, i) => [
      ...(i > 0 ? [{ type: 'hardBreak' }] : []),
      ...inlineNodes(line),
    ]);
    return withContent({ type: 'paragraph', attrs }, content);
  }

  // Blank items never print, so the editor doesn't show them either.
  const items = block.items.filter((item) => item.trim() !== '');
  return {
    type: block.kind === 'numbers' ? 'orderedList' : 'bulletList',
    attrs,
    content: (items.length ? items : ['']).map((item) => ({
      type: 'listItem',
      content: [withContent({ type: 'paragraph', attrs: { align: null, indent: 0 } }, inlineNodes(item))],
    })),
  };
}

const parseBlock = (text) => blockNode(parseBlocks(text)[0] || EMPTY_BLOCK);

/** Letter markup as an editor document (ProseMirror JSON). */
export function markupToDoc(markup) {
  const content = [];

  String(markup ?? '')
    .split('\n\n')
    .forEach((raw) => {
      const lines = raw.split('\n');
      if (!lines.some((line) => PAGE_BREAK_LINE.test(line))) {
        content.push(parseBlock(raw));
        return;
      }
      let chunk = [];
      const flush = () => {
        if (chunk.length) content.push(parseBlock(chunk.join('\n')));
        chunk = [];
      };
      lines.forEach((line) => {
        if (PAGE_BREAK_LINE.test(line)) {
          flush();
          content.push({ type: 'pageBreak' });
        } else chunk.push(line);
      });
      flush();
    });

  return { type: 'doc', content: content.length ? content : [blockNode(EMPTY_BLOCK)] };
}

// ---- Document -> markup -----------------------------------------------------

/** Text as markup that reads back as the same text: \, * and __ escaped. */
function escapeText(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' || c === '*') out += `\\${c}`;
    else if (c === '_' && (i === 0 || i === text.length - 1 || text[i - 1] === '_' || text[i + 1] === '_')) {
      out += '\\_';
    } else out += c;
  }
  return out;
}

/** One line of inline nodes as markup, with every mark closed at its end. */
function lineMarkup(nodes) {
  const open = { bold: false, italic: false, underline: false };
  let out = '';

  const moveTo = (want) => {
    let close = '';
    let start = '';
    if (open.bold && !want.bold) close += '**';
    if (open.italic && !want.italic) close += '*';
    if (open.underline && !want.underline) close += '__';
    if (!open.underline && want.underline) start += '__';
    if (!open.bold && want.bold) start += '**';
    if (!open.italic && want.italic) start += '*';
    Object.assign(open, want);
    return close + start;
  };

  nodes.forEach((node) => {
    // Conditions sit outside formatting: "**[[if x]]**" would leave stray
    // stars behind when the condition is decided.
    if (node.type === 'condition') {
      out += `[[${node.attrs?.expr ?? ''}]]`;
      return;
    }
    const has = new Set((node.marks || []).map((m) => m.type));
    out += moveTo({ bold: has.has('bold'), italic: has.has('italic'), underline: has.has('underline') });
    if (node.type === 'field') out += `{{${node.attrs?.name ?? ''}}}`;
    else if (node.type === 'text') out += escapeText(node.text || '');
  });

  return out + moveTo({ bold: false, italic: false, underline: false });
}

/** A paragraph's inline content split at its line breaks. */
function splitLines(content = []) {
  const lines = [[]];
  content.forEach((node) => {
    if (node.type === 'hardBreak') lines.push([]);
    else lines[lines.length - 1].push(node);
  });
  return lines;
}

/** Keep a line of text from being read as a list, indent or alignment marker. */
function guardLineStart(line, first) {
  const risky =
    ALIGN_RE.test(line) || INDENT_RE.test(line) || (first && (BULLET_RE.test(line) || NUMBER_RE.test(line)));
  return risky ? `\\${line}` : line;
}

function prefix(attrs = {}) {
  const align = attrs.align ? `[${attrs.align}] ` : '';
  const indent = attrs.indent > 0 ? `${'>'.repeat(attrs.indent)} ` : '';
  return align + indent;
}

/** Every line of a list, flattening anything nested or pasted into it. */
function listLines(list) {
  return (list.content || []).flatMap((item) =>
    (item.content || []).flatMap((child) =>
      child.type === 'paragraph' ? splitLines(child.content) : listLines(child)
    )
  );
}

function blockMarkup(node) {
  if (node.type === 'pageBreak') return '---pagebreak---';

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return listLines(node)
      .map((line, i) => {
        const marker = node.type === 'orderedList' ? `${i + 1}. ` : '- ';
        return `${i === 0 ? prefix(node.attrs) : ''}${marker}${lineMarkup(line)}`;
      })
      .join('\n');
  }

  return splitLines(node.content)
    .map((line, i) => `${i === 0 ? prefix(node.attrs) : ''}${guardLineStart(lineMarkup(line), i === 0)}`)
    .join('\n');
}

const isEmptyParagraph = (node) => node.type === 'paragraph' && !(node.content || []).length;

/**
 * An editor document (ProseMirror JSON) as letter markup. Empty paragraphs
 * left at the end (Return pressed once too often) are not kept: they would
 * print as space above the signature.
 */
export function docToMarkup(doc) {
  const blocks = [...(doc?.content || [])];
  while (blocks.length && isEmptyParagraph(blocks[blocks.length - 1])) blocks.pop();
  return blocks.map(blockMarkup).join('\n\n');
}

/** Markup as the editor will write it back, for telling a real change from a reformat. */
export const normaliseMarkup = (markup) => docToMarkup(markupToDoc(markup));
