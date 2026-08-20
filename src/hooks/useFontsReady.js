import { useEffect, useState } from 'react';

/**
 * True once webfonts have loaded.
 *
 * The paginator measures real DOM to decide where pages break. If it runs
 * before Source Serif 4 is available it measures Georgia's metrics instead,
 * so the page breaks it computes belong to a different font than the one the
 * user ends up looking at. Fonts are declared `font-display: block` and are
 * served locally, so this settles almost immediately.
 */
export function useFontsReady() {
  const [ready, setReady] = useState(() => document.fonts?.status === 'loaded');

  useEffect(() => {
    if (ready || !document.fonts) {
      if (!document.fonts) setReady(true);
      return;
    }

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}
