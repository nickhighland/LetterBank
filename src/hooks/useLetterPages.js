import { useMemo } from 'react';
import { paginateDocument } from '../utils/documentPaginator';
import { useFontsReady } from './useFontsReady';
import { resolveLetterhead } from '../utils/storage';
import { fillableArea } from '../constants/page';

/**
 * Paginates the active letter once, for everyone.
 *
 * Preview, print and PDF all consume this same array, so what's on screen is
 * what comes out of the printer. Pagination is deferred until webfonts are
 * ready, otherwise the first pass measures fallback metrics.
 */
export function useLetterPages({
  renderedBody,
  letterhead: rawLetterhead,
  signature,
  clinician,
  clientName,
}) {
  const fontsReady = useFontsReady();

  const letterhead = resolveLetterhead(rawLetterhead);
  const { width: fillableWidth, height: fillableHeight } = fillableArea(letterhead);

  return useMemo(() => {
    if (!fontsReady) return [];

    return paginateDocument({
      renderedBody,
      fillableWidth,
      fillableHeight,
      fontSize: letterhead.fontSize,
      lineHeight: letterhead.lineHeight,
      fontFamily: letterhead.fontFamily,
      paragraphSpacing: letterhead.paragraphSpacing,
      bodyAlignment: letterhead.bodyAlignment,
      showDate: letterhead.showDate,
      // Reserve what the date actually occupies, so changing its size or
      // spacing repaginates instead of silently overflowing.
      dateBlockHeight:
        (letterhead.fontSize + letterhead.dateSize) * 1.6 +
        letterhead.dateSpaceBefore +
        letterhead.dateSpaceAfter,
      showContinuationHeader: letterhead.showContinuationHeader,
      signatureConfig: signature,
      clinician,
      clientName,
    });
  }, [
    fontsReady,
    renderedBody,
    fillableWidth,
    fillableHeight,
    letterhead.fontSize,
    letterhead.lineHeight,
    letterhead.fontFamily,
    letterhead.paragraphSpacing,
    letterhead.bodyAlignment,
    letterhead.showDate,
    letterhead.dateSize,
    letterhead.dateSpaceBefore,
    letterhead.dateSpaceAfter,
    letterhead.showContinuationHeader,
    signature,
    clinician,
    clientName,
  ]);
}
