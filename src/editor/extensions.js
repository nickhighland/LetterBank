import { Extension, InputRule, Node, mergeAttributes, nodePasteRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { INDENT_STEP } from '../utils/letterMarkup';
import { ConditionChip, FieldChip } from './chips';

/**
 * The rich text editor's document: only what letter markup can hold, so
 * everything typed or pasted can be saved and printed. Headings, quotes,
 * links, code and the like are left out; pasting them gives plain paragraphs.
 */

const MAX_INDENT = 4;
const ALIGNMENTS = ['left', 'center', 'right', 'justify'];
const LIST_PAD = 24; // the list marker's room, as LetterDocument draws it

const normaliseAlign = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'start') return 'left';
  if (v === 'end') return 'right';
  return ALIGNMENTS.includes(v) ? v : null;
};

const alignAttr = {
  default: null,
  parseHTML: (el) => normaliseAlign(el.style.textAlign || el.getAttribute('align')),
  renderHTML: ({ align }) => (align ? { style: `text-align: ${align}` } : {}),
};

const indentAttr = (base) => ({
  default: 0,
  parseHTML: (el) => Math.min(MAX_INDENT, Number(el.getAttribute('data-indent')) || 0),
  renderHTML: ({ indent }) =>
    indent || base
      ? { 'data-indent': indent || undefined, style: `padding-left: ${base + (indent || 0) * INDENT_STEP}px` }
      : {},
});

/** The top-level blocks the selection touches: alignment and indent belong to them. */
function selectedBlocks(state) {
  const { from, to } = state.selection;
  const found = [];
  state.doc.forEach((node, offset) => {
    if (offset + node.nodeSize > from && offset < to) found.push({ node, pos: offset });
  });
  if (!found.length) {
    const pos = state.selection.$from.before(1);
    found.push({ node: state.doc.nodeAt(pos), pos });
  }
  return found.filter(({ node }) => node && 'align' in node.attrs);
}

/** Alignment and indent for paragraphs and lists, as `[center]` and `>` in markup. */
export const BlockFormat = Extension.create({
  name: 'blockFormat',
  // Ahead of the list and line-break keys, so Tab indents and Mod-Enter breaks the page.
  priority: 1000,

  addGlobalAttributes() {
    return [
      { types: ['paragraph'], attributes: { align: alignAttr, indent: indentAttr(0) } },
      { types: ['bulletList', 'orderedList'], attributes: { align: alignAttr, indent: indentAttr(LIST_PAD) } },
    ];
  },

  addCommands() {
    return {
      setBlockAlign:
        (align) =>
        ({ state, tr, dispatch }) => {
          const blocks = selectedBlocks(state);
          if (!blocks.length) return false;
          if (dispatch) {
            blocks.forEach(({ node, pos }) =>
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, align: align === 'left' ? null : align })
            );
          }
          return true;
        },
      changeIndent:
        (delta) =>
        ({ state, tr, dispatch }) => {
          const blocks = selectedBlocks(state);
          if (!blocks.length) return false;
          if (dispatch) {
            blocks.forEach(({ node, pos }) => {
              const indent = Math.max(0, Math.min(MAX_INDENT, (node.attrs.indent || 0) + delta));
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
            });
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.changeIndent(1),
      'Shift-Tab': () => this.editor.commands.changeIndent(-1),
      'Mod-Shift-l': () => this.editor.commands.setBlockAlign('left'),
      'Mod-Shift-e': () => this.editor.commands.setBlockAlign('center'),
      'Mod-Shift-r': () => this.editor.commands.setBlockAlign('right'),
      'Mod-Shift-j': () => this.editor.commands.setBlockAlign('justify'),
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
    };
  },
});

/** A {{field}}: filled in from Quick Fill. */
export const FieldNode = Node.create({
  name: 'field',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-field'),
        renderHTML: ({ name }) => ({ 'data-field': name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-field]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'lb-chip' }), `{{${node.attrs.name}}}`];
  },

  renderText({ node }) {
    return `{{${node.attrs.name}}}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(FieldChip, { as: 'span' });
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\{\{([a-zA-Z0-9_-]+)\}\}$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ name: match[1] }));
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\{\{([a-zA-Z0-9_-]+)\}\}/g,
        type: this.type,
        getAttributes: (match) => ({ name: match[1] }),
      }),
    ];
  },
});

const CONDITION_FIND = String.raw`\[\[\s*(if\s+[^\]]*?|else|end)\s*\]\]`;

/** [[if …]], [[else]] or [[end]]: where optional wording starts and stops. */
export const ConditionNode = Node.create({
  name: 'condition',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  marks: '',

  addAttributes() {
    return {
      expr: {
        default: 'end',
        parseHTML: (el) => el.getAttribute('data-condition'),
        renderHTML: ({ expr }) => ({ 'data-condition': expr }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-condition]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'lb-chip' }), `[[${node.attrs.expr}]]`];
  },

  renderText({ node }) {
    return `[[${node.attrs.expr}]]`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ConditionChip, { as: 'span' });
  },

  addInputRules() {
    return [
      new InputRule({
        find: new RegExp(`${CONDITION_FIND}$`, 'i'),
        handler: ({ state, range, match }) => {
          const expr = match[1].trim().replace(/\s+/g, ' ');
          state.tr.replaceWith(range.from, range.to, this.type.create({ expr }));
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: new RegExp(CONDITION_FIND, 'gi'),
        type: this.type,
        getAttributes: (match) => ({ expr: match[1].trim().replace(/\s+/g, ' ') }),
      }),
    ];
  },
});

/** ---pagebreak---: the rest of the letter starts on a new page. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML() {
    return ['div', { 'data-page-break': '', class: 'lb-page-break', contenteditable: 'false' }];
  },

  renderText() {
    return '\n---pagebreak---\n';
  },

  addCommands() {
    return {
      // At the very end there is nowhere to type after a page break, so a
      // paragraph comes with it there.
      insertPageBreak:
        () =>
        ({ chain, state }) => {
          const { $to } = state.selection;
          const atEnd = !$to.depth || $to.after(1) === state.doc.content.size;
          return chain()
            .insertContent(atEnd ? [{ type: 'pageBreak' }, { type: 'paragraph' }] : { type: 'pageBreak' })
            .run();
        },
    };
  },
});

/** Everything the letter editor needs, in one list. */
export function letterExtensions(extra = []) {
  return [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      link: false,
      strike: false,
      // A trailing empty paragraph would be saved as a blank block.
      trailingNode: false,
    }),
    BlockFormat,
    FieldNode,
    ConditionNode,
    PageBreak,
    ...extra,
  ];
}
