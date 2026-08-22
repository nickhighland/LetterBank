import React from 'react';
import { ArrowDownToLine, X } from 'lucide-react';

/**
 * A quiet strip under the header when a newer version is published.
 *
 * Not a modal: a clinician mid-letter should not be interrupted, and the
 * download is a manual step anyway while the build is unsigned.
 */
export function UpdateBanner({ update, onDownload, onDismiss }) {
  if (!update) return null;

  return (
    <div
      className="shrink-0 border-b flex items-center gap-3 px-5 py-2 border-line bg-accent-soft"
      role="status"
    >
      <ArrowDownToLine className="w-4 h-4 shrink-0 text-accent-ink" />
      <span className="text-[13px] text-accent-ink">
        <strong className="font-semibold">LetterBank {update.version}</strong> is available
        {update.currentVersion && (
          <span className="text-ink-muted"> — you have {update.currentVersion}</span>
        )}
      </span>

      <button
        type="button"
        onClick={onDownload}
        className="h-7 px-3 text-[12px] font-semibold rounded-lg cursor-pointer transition-colors
                   bg-accent text-white hover:bg-accent-hover"
      >
        {update.canAutoInstall ? 'Install' : 'Download'}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss update notice"
        className="ml-auto grid place-items-center w-7 h-7 rounded-md shrink-0 cursor-pointer
                   text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
