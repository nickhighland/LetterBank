import { createPortal } from 'react-dom';
import { LetterDocument } from './LetterDocument';

/**
 * Stages the document for print/PDF as a direct child of <body>.
 *
 * This placement is the whole point. The old print path left the letter buried
 * under `main.h-[calc(100vh-4rem)]` and `div.flex-1.flex.overflow-hidden` —
 * two fixed-height `overflow: hidden` ancestors the print stylesheet never
 * reset — so a 2176px document was cropped to 836px and only part of page one
 * ever reached the printer.
 *
 * With the document mounted at body level, the print stylesheet needs exactly
 * one structural rule (`body > *:not(#print-root) { display: none }`) and
 * cannot be broken by future layout changes.
 */
export function PrintPortal({
  pages,
  letterhead,
  signature,
  clinician,
  clientName,
  letterDate,
}) {
  if (!pages || pages.length === 0) return null;

  return createPortal(
    <div id="print-root" aria-hidden="true">
      <LetterDocument
        pages={pages}
        letterhead={letterhead}
        signature={signature}
        clinician={clinician}
        clientName={clientName}
        letterDate={letterDate}
        showMarginGuides={false}
      />
    </div>,
    document.body
  );
}
