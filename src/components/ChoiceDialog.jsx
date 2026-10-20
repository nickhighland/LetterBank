import React, { useCallback, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal, Button } from './ui';

/**
 * A question with two or three answers, asked from anywhere with
 * `await ask({...})`. Replaces window.confirm, which can only say OK or
 * Cancel and cannot offer "Save", "Discard" or "Add to library".
 *
 *   const [dialog, ask] = useChoiceDialog();
 *   const answer = await ask({
 *     title: 'Save changes?',
 *     message: '…',
 *     choices: [{ value: 'discard', label: 'Discard' }, { value: 'save', label: 'Save', primary: true }],
 *   });
 *   // answer is a choice's value, or null if the dialog was dismissed.
 */
export function useChoiceDialog() {
  const [question, setQuestion] = useState(null);
  const resolver = useRef(null);

  const ask = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current?.(null);
        resolver.current = resolve;
        setQuestion(options);
      }),
    []
  );

  const answer = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setQuestion(null);
  }, []);

  const dialog = (
    <Modal
      isOpen={Boolean(question)}
      onClose={() => answer(null)}
      title={question?.title || ''}
      icon={question?.icon || HelpCircle}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={() => answer(null)} className="mr-auto">
            {question?.cancelLabel || 'Cancel'}
          </Button>
          {(question?.choices || []).map((choice) => (
            <Button
              key={choice.value}
              variant={choice.primary ? 'primary' : choice.danger ? 'danger' : 'secondary'}
              onClick={() => answer(choice.value)}
            >
              {choice.label}
            </Button>
          ))}
        </>
      }
    >
      <div className="p-6 text-[13px] leading-relaxed text-ink-secondary whitespace-pre-line">
        {question?.message}
      </div>
    </Modal>
  );

  return [dialog, ask];
}
