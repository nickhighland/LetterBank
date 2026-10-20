import { useEffect, useMemo, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { letterExtensions } from './extensions';
import { docToMarkup, markupToDoc, normaliseMarkup } from './markupDoc';

/**
 * A rich text editor over letter markup. `markup` in, `onChange(markup)` out
 * on every edit. When `markup` changes from outside (another letter, a
 * discard, an edit made on the page), the editor reloads it.
 *
 * Opening a letter and changing nothing leaves its markup exactly as saved:
 * the editor may write some markup differently ("* item" as "- item"), so an
 * edit that leaves the letter as it started hands back the original text.
 */
export function useLetterEditor({ markup, onChange, onContextMenu, autofocus = false, editorClass = '' }) {
  const callbacks = useRef({ onChange, onContextMenu });
  callbacks.current = { onChange, onContextMenu };

  const written = useRef(markup); // the markup the editor last loaded or wrote
  const original = useRef(null);
  if (!original.current) original.current = { markup, normal: normaliseMarkup(markup) };

  // Read once: later changes arrive through the effect below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => markupToDoc(markup), []);
  const extensions = useMemo(() => letterExtensions(), []);

  const editor = useEditor({
    extensions,
    content: initialContent,
    autofocus,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: `lb-editor ${editorClass}`.trim(), spellcheck: 'true' },
      handleDOMEvents: {
        // A right-click places the caret where it lands (macOS would select
        // the word, and the field would replace it), unless it lands on the
        // selection, which the field then replaces.
        mousedown: (view, event) => {
          if (event.button !== 2 || !callbacks.current.onContextMenu) return false;
          const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const { from, to } = view.state.selection;
          if (hit && !(from !== to && hit.pos >= from && hit.pos <= to)) {
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, hit.pos)));
          }
          view.focus();
          event.preventDefault();
          return true;
        },
        contextmenu: (view, event) => {
          if (!callbacks.current.onContextMenu) return false;
          event.preventDefault();
          callbacks.current.onContextMenu(event);
          return true;
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      let next = docToMarkup(ed.getJSON());
      if (next === original.current.normal) next = original.current.markup;
      if (next === written.current) return;
      written.current = next;
      callbacks.current.onChange?.(next);
    },
  });

  useEffect(() => {
    if (!editor || markup === written.current) return;
    written.current = markup;
    original.current = { markup, normal: normaliseMarkup(markup) };
    editor.commands.setContent(markupToDoc(markup), { emitUpdate: false });
  }, [editor, markup]);

  return editor;
}
