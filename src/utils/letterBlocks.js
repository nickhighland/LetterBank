import { evaluateConditions } from './conditions';
import { renderTemplate, stripTrailingClosing } from './variableParser';
import { letterValues } from './fieldDefs';
import { parseBlocks } from './letterMarkup';

/**
 * A letter as the blocks its pages show, each carrying `origin`: the blocks
 * of the template it came from ({ from, to }, counted by blank lines). A click
 * on a paragraph in the preview uses it to edit that part of the template.
 *
 * Gives the same blocks as rendering the whole body and parsing the result,
 * which is what the pages showed before they could be edited.
 */

export const PAGE_BREAK_RE = /---pagebreak---|\[\[page\]\]/i;

/** For each line of `text`, the blank-line-separated block it belongs to. */
function blockOfEachLine(text) {
  const starts = [];
  let pos = 0;
  text.split('\n\n').forEach((block) => {
    starts.push(pos);
    pos += block.length + 2;
  });

  const result = [];
  let block = 0;
  pos = 0;
  text.split('\n').forEach((line) => {
    while (block + 1 < starts.length && starts[block + 1] <= pos) block++;
    result.push(block);
    pos += line.length + 1;
  });
  return result;
}

/** `lines.join('\n').split('\n\n')`, with the lines each piece holds. */
function splitOnBlankLines(lines) {
  const text = lines.join('\n');
  const lineStarts = [];
  let pos = 0;
  lines.forEach((line) => {
    lineStarts.push(pos);
    pos += line.length + 1;
  });

  const pieces = [];
  let start = 0;
  for (;;) {
    const sep = text.indexOf('\n\n', start);
    const end = sep === -1 ? text.length : sep;
    const held = [];
    lineStarts.forEach((s, i) => {
      if (s >= start && (s < end || (s === start && start === end))) held.push(i);
    });
    pieces.push({ text: text.slice(start, end), lines: held });
    if (sep === -1) break;
    start = sep + 2;
  }
  return pieces;
}

/** Drop the body's own sign-off when the signature block brings one. */
function stripClosingFrom(entries) {
  let last = entries.length - 1;
  while (last >= 0 && !entries[last].pageBreak && entries[last].text.trim() === '') last--;
  if (last < 0 || entries[last].pageBreak) return entries;

  const stripped = stripTrailingClosing(entries[last].text);
  if (stripped === entries[last].text) return entries;

  const kept = entries.slice(0, last);
  if (stripped) kept.push({ ...entries[last], text: stripped });
  while (kept.length && !kept[kept.length - 1].pageBreak && kept[kept.length - 1].text.trim() === '') {
    kept.pop();
  }
  return kept;
}

/**
 * Template text with its conditions decided and its fields filled in, as
 * blocks: [{ kind, align, indent, items, origin }] and { kind: 'pagebreak' }.
 */
export function renderLetterBlocks(body, values = {}, types = {}, labels = {}, { stripClosing = false } = {}) {
  const source = String(body ?? '');
  const sourceBlock = blockOfEachLine(source);
  const { lines, origins } = evaluateConditions(source, values);
  if (!lines.join('\n')) return [];

  const filled = letterValues(values);
  let entries = [];

  for (const piece of splitOnBlankLines(lines)) {
    const written = piece.lines.filter((i) => lines[i].trim() !== '');
    const from = (written.length ? written : piece.lines).map((i) => sourceBlock[origins[i]]);
    const origin = from.length
      ? { from: Math.min(...from), to: Math.max(...from) }
      : null;

    // A Long text answer can hold paragraphs of its own.
    renderTemplate(piece.text, filled, types, labels)
      .split('\n\n')
      .forEach((text) => {
        const parts = text.split(PAGE_BREAK_RE);
        if (parts.length === 1) {
          entries.push({ text, origin });
          return;
        }
        // Each page starts and ends without the blank space around the break.
        parts.forEach((part, i) => {
          if (i > 0) entries.push({ pageBreak: true });
          let trimmed = part;
          if (i > 0) trimmed = trimmed.replace(/^\s+/, '');
          if (i < parts.length - 1) trimmed = trimmed.replace(/\s+$/, '');
          if (trimmed) entries.push({ text: trimmed, origin });
        });
      });
  }

  if (stripClosing) entries = stripClosingFrom(entries);

  return entries.map((entry) => {
    if (entry.pageBreak) return { kind: 'pagebreak' };
    const [block] = parseBlocks(entry.text);
    return {
      ...(block || { kind: 'paragraph', align: null, indent: 0, items: [''] }),
      origin: entry.origin,
    };
  });
}

/** The blocks `body` is made of, as the editor and the page count them. */
export const splitBody = (body) => String(body ?? '').split('\n\n');

/** `body` with blocks `from`..`to` replaced by `markup` (removed when empty). */
export function replaceBlocks(body, { from, to }, markup) {
  const blocks = splitBody(body);
  const middle = markup === '' ? [] : [markup];
  return [...blocks.slice(0, from), ...middle, ...blocks.slice(to + 1)].join('\n\n');
}

/** True when two origins share a template block. */
export const overlaps = (a, b) => Boolean(a && b) && a.from <= b.to && b.from <= a.to;
