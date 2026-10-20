import { describe, it, expect } from 'vitest';
import { parseBlocks, parseInline, inlineToHtml, markupToPlainText } from '../letterMarkup';
import { renderLetterBlocks, replaceBlocks } from '../letterBlocks';
import { renderLetter } from '../fieldDefs';
import { textToBlocks } from '../documentPaginator';
import { stripTrailingClosing } from '../variableParser';
import { markupToDoc, docToMarkup, normaliseMarkup } from '../../editor/markupDoc';
import { DEFAULT_TEMPLATES } from '../../data/defaultTemplates';

const runs = (text) => parseInline(text).map(({ text: t, bold, italic, underline }) =>
  [t, bold && 'b', italic && 'i', underline && 'u'].filter(Boolean).join(':')
);

/** What a body prints as: each block's kind, alignment, indent and formatted runs. */
const printed = (body) =>
  textToBlocks(renderLetter(body)).map((b) =>
    b.kind === 'pagebreak'
      ? 'pagebreak'
      : { kind: b.kind, align: b.align, indent: b.indent, items: b.items.map(runs) }
  );

describe('parseInline', () => {
  it('reads the formatting letters already use', () => {
    expect(runs('a **bold** b *it* c __under__')).toEqual([
      'a ', 'bold:b', ' b ', 'it:i', ' c ', 'under:u',
    ]);
  });

  it('combines and nests marks', () => {
    expect(runs('***both***')).toEqual(['both:b:i']);
    expect(runs('**bold *and italic* bold**')).toEqual(['bold :b', 'and italic:b:i', ' bold:b']);
    expect(runs('__**under bold**__')).toEqual(['under bold:b:u']);
    expect(runs('*it **then bold***')).toEqual(['it :i', 'then bold:b:i']);
  });

  it('prints unpaired markers and rows of underscores as typed', () => {
    expect(runs('5 * 3 = 15')).toEqual(['5 * 3 = 15']);
    expect(runs('Signature: ________')).toEqual(['Signature: ________']);
    expect(runs('a_b and snake_case')).toEqual(['a_b and snake_case']);
  });

  it('honours escapes', () => {
    expect(runs('\\*not italic\\*')).toEqual(['*not italic*']);
    expect(runs('\\_\\_x\\_\\_ and C:\\\\path')).toEqual(['__x__ and C:\\path']);
  });

  it('nests tags in HTML for the paginator', () => {
    expect(inlineToHtml('***x***')).toBe('<strong><em>x</em></strong>');
  });

  it('finds field and condition chips for the editor', () => {
    expect(parseInline('Hi **{{client_name}}** [[if x]]there[[end]]', { atoms: true })).toEqual([
      { text: 'Hi ', bold: false, italic: false, underline: false },
      { field: 'client_name', bold: true, italic: false, underline: false },
      { text: ' ', bold: false, italic: false, underline: false },
      { condition: 'if x' },
      { text: 'there', bold: false, italic: false, underline: false },
      { condition: 'end' },
    ]);
  });
});

describe('editor document <-> markup', () => {
  it('keeps every default letter as it prints', () => {
    DEFAULT_TEMPLATES.forEach(({ body }) => {
      const again = docToMarkup(markupToDoc(body));
      expect(printed(again)).toEqual(printed(body));
      // Writing it out a second time changes nothing.
      expect(normaliseMarkup(again)).toBe(again);
    });
  });

  it('round-trips formatting, alignment, indent, lists and page breaks', () => {
    const body = [
      '[center] **Title** with *italic*',
      '[right] >> Indented and right\nsecond line',
      '- one **bold**\n- two',
      '[justify] 1. first\n2. second',
      '---pagebreak---',
      'After the break ***both*** __under__',
    ].join('\n\n');
    const doc = markupToDoc(body);
    expect(doc.content.map((n) => n.type)).toEqual([
      'paragraph', 'paragraph', 'bulletList', 'orderedList', 'pageBreak', 'paragraph',
    ]);
    expect(doc.content[1].attrs).toEqual({ align: 'right', indent: 2 });
    expect(docToMarkup(doc)).toBe(body);
  });

  it('turns fields and conditions into chips and back', () => {
    const body = 'Dear **{{client_name}}**,\n[[if telehealth]]\nBy video.\n[[end]]';
    const doc = markupToDoc(body);
    expect(doc.content[0].content.map((n) => n.type)).toEqual([
      'text', 'field', 'text', 'hardBreak', 'condition', 'hardBreak', 'text', 'hardBreak', 'condition',
    ]);
    expect(docToMarkup(doc)).toBe(body);
  });

  it('writes typed characters so they print as typed', () => {
    const typed = (text) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    [
      '5 * 3 * 2',
      '- not a list',
      '1. not a list',
      '> not indented',
      '[center] not centred',
      'Sign here: ________',
      'C:\\Users\\*',
    ].forEach((text) => {
      const markup = docToMarkup(typed(text));
      expect(printed(markup)).toEqual([
        { kind: 'paragraph', align: null, indent: 0, items: [[text]] },
      ]);
      expect(markupToDoc(markup)).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { align: null, indent: 0 }, content: [{ type: 'text', text }] }],
      });
    });
  });

  it('closes and reopens marks across adjacent runs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'i', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'bi', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'text', text: 'u', marks: [{ type: 'underline' }] },
            { type: 'text', text: '_x_', marks: [{ type: 'bold' }, { type: 'underline' }] },
            { type: 'text', text: 'plain' },
          ],
        },
      ],
    };
    const markup = docToMarkup(doc);
    expect(printed(markup)[0].items[0]).toEqual(['b:b', 'i:i', 'bi:b:i', 'u:u', '_x_:b:u', 'plain']);
    expect(markupToDoc(markup).content[0].content).toEqual(doc.content[0].content);
  });

  it('keeps line breaks and empty paragraphs, but not empty ones at the end', () => {
    ['', 'a\n\n\n\nb', 'a\n\n\nb', 'Sincerely,\n'].forEach((body) => {
      expect(docToMarkup(markupToDoc(body))).toBe(body);
    });
    expect(docToMarkup(markupToDoc('a\n\n\n\n'))).toBe('a');
  });
});

describe('renderLetterBlocks', () => {
  const values = { client_name: 'Alex', notes: 'One.\n\nTwo.' };

  it('prints the same blocks as rendering the whole body', () => {
    DEFAULT_TEMPLATES.forEach(({ body }) => {
      const blocks = renderLetterBlocks(body, values).map(({ origin, ...b }) => b);
      expect(blocks).toEqual(textToBlocks(renderLetter(body, values)));
    });
  });

  it('matches stripping the sign-off from the whole body', () => {
    DEFAULT_TEMPLATES.forEach(({ body }) => {
      const blocks = renderLetterBlocks(body, values, {}, {}, { stripClosing: true }).map(
        ({ origin, ...b }) => b
      );
      expect(blocks).toEqual(textToBlocks(stripTrailingClosing(renderLetter(body, values))));
    });
  });

  it('knows which template block each printed block came from', () => {
    const body = [
      'Dear {{client_name}},',
      '[[if telehealth]]\nBy video.',
      'Still optional.\n[[end]]',
      'Notes: {{notes}}',
      'Sincerely,',
    ].join('\n\n');

    const off = renderLetterBlocks(body, values);
    expect(off.map((b) => [b.items.join('|'), b.origin])).toEqual([
      ['Dear Alex,', { from: 0, to: 0 }],
      ['Notes: One.', { from: 3, to: 3 }],
      ['Two.', { from: 3, to: 3 }],
      ['Sincerely,', { from: 4, to: 4 }],
    ]);

    const on = renderLetterBlocks(body, { ...values, telehealth: 'yes' });
    expect(on.slice(1, 3).map((b) => [b.items.join('|'), b.origin])).toEqual([
      ['By video.', { from: 1, to: 1 }],
      ['Still optional.', { from: 2, to: 2 }],
    ]);
  });

  it('turns page breaks into break blocks', () => {
    const blocks = renderLetterBlocks('One\n---pagebreak---\nTwo\n\nThree', {});
    expect(blocks.map((b) => b.kind === 'pagebreak' ? '|' : b.items[0])).toEqual(['One', '|', 'Two', 'Three']);
    expect(blocks[2].origin).toEqual({ from: 0, to: 0 });
  });

  it('replaces the blocks an edit came from', () => {
    expect(replaceBlocks('a\n\nb\n\nc', { from: 1, to: 1 }, 'B')).toBe('a\n\nB\n\nc');
    expect(replaceBlocks('a\n\nb\n\nc', { from: 0, to: 1 }, '')).toBe('c');
  });
});

describe('markupToPlainText', () => {
  it('drops formatting for the clipboard', () => {
    expect(markupToPlainText('[center] **Hi** *there*\n\n- one\n- two\n\n1. a\n2. b')).toBe(
      'Hi there\n\n• one\n• two\n\n1. a\n2. b'
    );
  });

  it('agrees with parseBlocks on escaped lines', () => {
    expect(parseBlocks('\\- not a list')[0]).toEqual({
      kind: 'paragraph', align: null, indent: 0, items: ['- not a list'],
    });
  });
});
