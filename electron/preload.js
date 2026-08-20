import { contextBridge, ipcRenderer } from 'electron';

/**
 * The renderer never touches Node. Everything crosses this bridge.
 * All PDF work happens in-process via Chromium's print engine — no network,
 * no third-party service, no bundled rasteriser.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Menu accelerators. Each returns an unsubscribe function so React effects
  // can clean up instead of stacking duplicate listeners on every re-render.
  onNewLetter: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:new-letter', handler);
    return () => ipcRenderer.removeListener('app:new-letter', handler);
  },
  onExportPdf: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:export-pdf', handler);
    return () => ipcRenderer.removeListener('app:export-pdf', handler);
  },
  onPrint: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:print', handler);
    return () => ipcRenderer.removeListener('app:print', handler);
  },

  // Returns the current print-root as a PDF byte array (for batch/ZIP).
  renderPdf: () => ipcRenderer.invoke('pdf:render'),

  // Renders and opens a native Save dialog.
  savePdf: (suggestedName) => ipcRenderer.invoke('pdf:save', { suggestedName }),

  // Writes an already-built ZIP via a native Save dialog.
  saveZip: (suggestedName, buffer) =>
    ipcRenderer.invoke('pdf:saveZip', { suggestedName, buffer }),

  // Native print dialog.
  printLetter: () => ipcRenderer.invoke('print:letter'),
});
