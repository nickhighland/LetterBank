/**
 * Editor actions shared by the Editor pane and editing on the page.
 */

const OPTIONAL_PLACEHOLDER = 'Optional wording.';

/** Put a {{field}} at the caret, replacing any selection. */
export function insertField(editor, name) {
  editor?.chain().focus().insertContent({ type: 'field', attrs: { name } }).run();
}

/**
 * Make the selection optional: it prints only when `name` is ticked.
 *
 * Part of a line is wrapped where it stands: "[[if x]]these words[[end]]".
 * Whole paragraphs and lists get "If …" and "End" on lines of their own, above
 * and below. With nothing selected, a new optional paragraph is added after
 * the caret's, with its placeholder wording selected to type over.
 */
export function wrapOptional(editor, name) {
  if (!editor) return;
  const { state } = editor;
  const { from, to, $from, $to, empty } = state.selection;
  const start = { type: 'condition', attrs: { expr: `if ${name}` } };
  const end = { type: 'condition', attrs: { expr: 'end' } };
  const line = (node) => ({ type: 'paragraph', content: [node] });

  if (empty) {
    const after = $from.depth ? $from.after(1) : state.doc.content.size;
    editor
      .chain()
      .focus()
      .insertContentAt(after, [
        line(start),
        { type: 'paragraph', content: [{ type: 'text', text: OPTIONAL_PLACEHOLDER }] },
        line(end),
      ])
      .run();
    // The "If" paragraph is 3 long (open, chip, close); the text starts inside the next.
    const textStart = after + 3 + 1;
    editor.commands.setTextSelection({ from: textStart, to: textStart + OPTIONAL_PLACEHOLDER.length });
    return;
  }

  const oneTextblock = $from.sameParent($to) && $from.parent.isTextblock;
  const wholeTextblock = oneTextblock && from === $from.start() && to === $from.end();

  if (oneTextblock && !wholeTextblock) {
    editor.chain().focus().insertContentAt(to, end).insertContentAt(from, start).run();
    return;
  }

  // Whole paragraphs, or list items: a list item can't hold a line of its own
  // for the chips, so they go around the whole list.
  const blockStart = $from.depth ? $from.before(1) : 0;
  const blockEnd = $to.depth ? $to.after(1) : state.doc.content.size;
  editor.chain().focus().insertContentAt(blockEnd, line(end)).insertContentAt(blockStart, line(start)).run();
}

/** The alignment of the block the caret is in. */
export function currentAlign(editor) {
  const block = editor?.state.selection.$from.node(1);
  return block?.attrs?.align || 'left';
}
