const { contextBridge, ipcRenderer } = require('electron');

/**
 * The renderer never touches Node. Everything crosses this bridge.
 *
 * CommonJS, and named .cjs on purpose. Electron loads a `.js` preload as
 * CommonJS regardless of `"type": "module"` in package.json, so the previous
 * ESM `import` threw `Cannot use import statement outside a module` and the
 * bridge never attached. window.electronAPI was undefined in the packaged app,
 * which silently disabled every desktop feature: native PDF save, native
 * print, batch ZIP export, the Cmd+N/E/P menu accelerators, and the macOS
 * traffic-light padding that keeps the logo clear of the window controls.
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

  // --- Updates -------------------------------------------------------------
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  openReleasesPage: () => ipcRenderer.invoke('update:open'),

  onUpdateAvailable: (cb) => {
    const handler = (_e, info) => cb(info);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  onUpdateNone: (cb) => {
    const handler = (_e, info) => cb(info);
    ipcRenderer.on('update:none', handler);
    return () => ipcRenderer.removeListener('update:none', handler);
  },
  onUpdateError: (cb) => {
    const handler = (_e, info) => cb(info);
    ipcRenderer.on('update:error', handler);
    return () => ipcRenderer.removeListener('update:error', handler);
  },
  onCheckUpdatesRequested: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:check-updates', handler);
    return () => ipcRenderer.removeListener('app:check-updates', handler);
  },
});

window.addEventListener("DOMContentLoaded", () => {
  if (process.platform === "darwin") {
    document.documentElement.classList.add("is-mac-electron");
  }
});
