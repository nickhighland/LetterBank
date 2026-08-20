import { useEffect, useRef } from 'react';

/**
 * Wires the macOS menu accelerators to the app.
 *
 * electron/main.js has always sent `app:new-letter`, `app:export-pdf` and
 * `app:print`, and preload.js has always exposed listeners for them — but
 * nothing in the renderer ever subscribed. So ⌘N, ⌘E and ⌘P were dead in the
 * desktop build, and ⌘P was worse than dead: the accelerator swallowed the
 * native print shortcut and dispatched an event into the void.
 *
 * Handlers are held in a ref so the IPC subscription is set up once and never
 * torn down on re-render, while still always invoking the latest closure.
 */
export function useElectronMenu({ onNewLetter, onExportPdf, onPrint }) {
  const handlers = useRef({});
  handlers.current = { onNewLetter, onExportPdf, onPrint };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isElectron) return;

    const unsubscribes = [
      api.onNewLetter?.(() => handlers.current.onNewLetter?.()),
      api.onExportPdf?.(() => handlers.current.onExportPdf?.()),
      api.onPrint?.(() => handlers.current.onPrint?.()),
    ].filter((fn) => typeof fn === 'function');

    return () => unsubscribes.forEach((fn) => fn());
  }, []);
}
