import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { EditorContent } from '@tiptap/react';
import { useLetterEditor } from './useLetterEditor';
import { LetterToolbar } from './LetterToolbar';
import { ChipContext } from './chips';
import { insertField, wrapOptional } from './commands';
import { FieldMenu } from '../components/FieldMenu';

/**
 * The letter editor opened on the page, in place of the paragraph that was
 * clicked. It edits that part of the letter's source (fields as chips showing
 * their values, optional wording with its markers), and hands the new text
 * back when the clinician clicks anywhere else or presses Done. Escape puts
 * the paragraph back as it was.
 *
 * The formatting toolbar is drawn into the preview's toolbar (`toolbarSlot`),
 * outside the zoomed page, so it stays full size at any zoom.
 */
export function PageBlockEditor({
  markup,
  point,
  toolbarSlot,
  chips,
  fieldMenu,
  paragraphSpacing = 0.9,
  onDone,
  onCancel,
}) {
  const wrapper = useRef(null);
  const latest = useRef(markup);
  const finish = useRef({ onDone, onCancel });
  finish.current = { onDone, onCancel };
  // { x, y, optional? } while the field menu is open.
  const [menu, setMenu] = useState(null);

  const editor = useLetterEditor({
    markup,
    onChange: (next) => {
      latest.current = next;
    },
    onContextMenu: (e) => setMenu({ x: e.clientX, y: e.clientY }),
  });

  // Put the caret where the paragraph was clicked.
  useEffect(() => {
    if (!editor) return undefined;
    const frame = requestAnimationFrame(() => {
      const hit = point && editor.view.posAtCoords({ left: point.x, top: point.y });
      editor.chain().focus(hit ? hit.pos : 'end').run();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // A click anywhere else finishes the edit.
  useEffect(() => {
    const onDown = (e) => {
      if (wrapper.current?.contains(e.target)) return;
      if (e.target.closest?.('[data-keeps-editor-open]')) return;
      finish.current.onDone(latest.current);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && !menu) {
      e.preventDefault();
      finish.current.onCancel();
    }
  };

  const insert = (def, opts = {}) => {
    setMenu(null);
    fieldMenu?.onInsert?.(def, opts);
    insertField(editor, def.name);
  };

  const toolbar = (
    <div data-keeps-editor-open="" className="flex items-center gap-2 min-w-0">
      <LetterToolbar
        editor={editor}
        onField={(r) => setMenu({ x: r.left, y: r.bottom + 4 })}
        onOptional={(r) => setMenu({ x: r.left, y: r.bottom + 4, optional: true })}
        wrap={false}
        className="min-w-0 overflow-x-auto"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => finish.current.onDone(latest.current)}
        className="ml-auto shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-md text-[12px] font-semibold cursor-pointer
                   bg-accent text-white hover:bg-accent-hover"
      >
        <Check className="w-3.5 h-3.5" />
        Done
      </button>
    </div>
  );

  return (
    <div
      ref={wrapper}
      className="lb-page-editor"
      onKeyDown={onKeyDown}
      style={{
        '--lb-paragraph-space': `${paragraphSpacing}em`,
        margin: `-4px -6px calc(${paragraphSpacing}em - 4px)`,
      }}
    >
      <ChipContext.Provider value={chips}>
        <EditorContent editor={editor} />
      </ChipContext.Provider>

      {toolbarSlot && createPortal(toolbar, toolbarSlot)}

      {menu && (
        <FieldMenu
          position={menu}
          existing={fieldMenu?.existing || []}
          defs={fieldMenu?.defs || {}}
          library={fieldMenu?.library || []}
          onInsert={insert}
          onOptional={(name) => {
            setMenu(null);
            wrapOptional(editor, name);
          }}
          startOptional={Boolean(menu.optional)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
