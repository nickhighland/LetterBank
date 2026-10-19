import { useMemo } from 'react';
import { paginateLetter } from '../utils/documentPaginator';
import { useFontsReady } from './useFontsReady';

/**
 * Paginates the active letter once, for everyone.
 *
 * Preview, print and PDF all consume this same array, so what's on screen is
 * what comes out of the printer. Pagination is deferred until webfonts are
 * ready, otherwise the first pass measures fallback metrics.
 */
export function useLetterPages({ renderedBody, letterhead, signature, clinician, clientName }) {
  const fontsReady = useFontsReady();

  return useMemo(() => {
    if (!fontsReady) return [];
    return paginateLetter({ renderedBody, letterhead, signature, clinician, clientName });
  }, [fontsReady, renderedBody, letterhead, signature, clinician, clientName]);
}
