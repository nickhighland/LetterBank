import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Image as ImageIcon, Ruler, FileText, Maximize2 } from 'lucide-react';
import { LetterDocument } from './LetterDocument';
import { PAGE_WIDTH, PAGE_HEIGHT, PAGE_GAP } from '../constants/page';

const MAT = 40; // breathing room between the page edge and the panel edge

/**
 * The on-screen document stage.
 *
 * Purely presentational — pagination lives in App via useLetterPages, so
 * preview, print and PDF all consume the same page array and cannot disagree.
 *
 * Zoom fits the page to the available width by default and follows the window
 * as panels open or the window resizes. At a fixed 80% the letter was wider
 * than the stage on a 1120px window, so the page ran under the panel edge and
 * had to be scrolled sideways to read. Any manual zoom takes over; the
 * percentage button hands control back to fit.
 */
export function LetterPreview({
  pages,
  letterhead,
  signature,
  clinician,
  clientName,
  letterDate,
  onToggleLetterhead,
}) {
  const stageRef = useRef(null);
  const [fitZoom, setFitZoom] = useState(0.8);
  const [manualZoom, setManualZoom] = useState(null);
  const [showMarginGuides, setShowMarginGuides] = useState(false);

  const zoom = manualZoom ?? fitZoom;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      const available = el.clientWidth - MAT * 2;
      setFitZoom(Math.max(0.4, Math.min(1, available / PAGE_WIDTH)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nudge = useCallback(
    (delta) => setManualZoom((z) => {
      const base = z ?? fitZoom;
      return Math.max(0.4, Math.min(1.5, +(base + delta).toFixed(2)));
    }),
    [fitZoom]
  );

  const chip = (active) =>
    `flex items-center gap-1.5 h-8 px-3 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
      active ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
    }`;

  return (
    <main
      className="flex-1 flex flex-col min-h-0 min-w-0 relative bg-surface-deep"
    >
      {/* Toolbar */}
      <div className="h-12 shrink-0 border-b flex items-center gap-1.5 px-4 text-[12px] font-medium bg-surface-raised border-line">
        <button
          onClick={onToggleLetterhead}
          className={chip(letterhead.showLetterhead)}
          title="Show or hide the letterhead artwork"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Letterhead {letterhead.showLetterhead ? 'on' : 'off'}
        </button>

        <button
          onClick={() => setShowMarginGuides((v) => !v)}
          className={chip(showMarginGuides)}
          title="Show the fillable boundary"
        >
          <Ruler className="w-3.5 h-3.5" />
          Margins
        </button>

        <div className="flex-1" />

        <span className="flex items-center gap-1.5 px-2 tabular-nums whitespace-nowrap text-ink-muted">
          <FileText className="w-3.5 h-3.5" />
          {pages.length || '—'} {pages.length === 1 ? 'page' : 'pages'}
        </span>

        <div className="w-px h-5 mx-1.5 shrink-0 bg-line" />

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => nudge(-0.1)}
            aria-label="Zoom out"
            className="grid place-items-center w-8 h-8 rounded-lg cursor-pointer text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setManualZoom(null)}
            title={manualZoom === null ? 'Fitting to width' : 'Fit to width'}
            className={`flex items-center justify-center gap-1 w-16 h-8 rounded-lg tabular-nums text-[11px]
                        cursor-pointer transition-colors ${
                          manualZoom === null
                            ? 'bg-accent-soft text-accent-ink'
                            : 'text-ink-secondary hover:bg-surface-hover'
                        }`}
          >
            {manualZoom !== null && <Maximize2 className="w-3 h-3" />}
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => nudge(0.1)}
            aria-label="Zoom in"
            className="grid place-items-center w-8 h-8 rounded-lg cursor-pointer text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="flex-1 overflow-auto min-h-0">
        <div
          className="flex justify-center"
          style={{ padding: MAT, minWidth: `${PAGE_WIDTH * zoom + MAT * 2}px` }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              width: PAGE_WIDTH,
              // Size the scroll area to the *scaled* document so zooming out
              // doesn't leave a tall empty gutter below the last page.
              height: pages.length
                ? `${(pages.length * (PAGE_HEIGHT + PAGE_GAP) - PAGE_GAP) * zoom}px`
                : 0,
            }}
          >
            {pages.length === 0 ? (
              <div className="letter-page-canvas grid place-items-center text-ink-faint">
                <span className="text-sm">Preparing document…</span>
              </div>
            ) : (
              <LetterDocument
                pages={pages}
                letterhead={letterhead}
                signature={signature}
                clinician={clinician}
                clientName={clientName}
                letterDate={letterDate}
                showMarginGuides={showMarginGuides}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
