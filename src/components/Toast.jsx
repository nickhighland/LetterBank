import React, { useEffect } from 'react';
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
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.tone === 'error' ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

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
      >
        <span className={`grid place-items-center w-6 h-6 rounded-full shrink-0 ${chip}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-[13px] font-medium text-ink">{toast.message}</span>
      </div>
    </div>
  );
}
