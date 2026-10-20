import React, { useEffect, useRef, useState } from 'react';
import { Check, Info, AlertTriangle } from 'lucide-react';

const TONES = {
  success: { Icon: Check, chip: 'bg-success-soft text-success' },
  info: { Icon: Info, chip: 'bg-accent-soft text-accent' },
  error: { Icon: AlertTriangle, chip: 'bg-danger-soft text-danger' },
};

/**
 * Quiet, accessible confirmation of what just happened.
 *
 * Replaces canvas-confetti, which fired on every export and copy. Celebrating
 * the generation of a treatment-termination or bereavement letter is the wrong
 * register for a clinical tool, and it cost a dependency to do it.
 */
export function Toast({ toast, onDismiss }) {
  // Keyed on the toast itself: App re-renders on every keystroke and passes a
  // new onDismiss each time, which used to restart the timer indefinitely.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  // Held open while the pointer is on it, so a button doesn't vanish on the
  // way. Kept per toast: one that closes under the pointer gets no mouseleave.
  const [hoveredId, setHoveredId] = useState(null);
  const hovered = Boolean(toast) && hoveredId === toast.id;

  // `action` is one button ({ label, run }) or a list of them.
  const actions = toast ? [].concat(toast.action || []) : [];

  useEffect(() => {
    if (!toast || hovered) return;
    // A toast with an action (Undo, Show in Finder) stays long enough to reach for it.
    const delay = actions.length || toast.tone === 'error' ? 6000 : 3000;
    const timer = setTimeout(() => dismiss.current(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, hovered]);

  if (!toast) return null;

  const { Icon, chip } = TONES[toast.tone] || TONES.info;

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-100 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl border pointer-events-auto
                   bg-surface-raised border-line shadow-token-md"
        onMouseEnter={() => setHoveredId(toast.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <span className={`grid place-items-center w-6 h-6 rounded-full shrink-0 ${chip}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-[13px] font-medium text-ink">{toast.message}</span>
        {actions.length > 0 && (
          <span className="flex items-center gap-0.5 ml-1 -mr-1">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  action.run();
                  dismiss.current();
                }}
                className="px-2 py-1 rounded-md text-[12px] font-semibold cursor-pointer whitespace-nowrap
                           text-accent hover:bg-accent-soft transition-colors"
              >
                {action.label}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
