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
/**
 * Saved settings, read once before the page's scripts run so the first render
 * already has them. Client details are never part of this.
 */
let snapshot = null;
const loadSnapshot = () => {
  if (!snapshot) snapshot = ipcRenderer.sendSync('store:load');
  return snapshot;
};

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Read by index.html to paint the right theme before React loads.
  initialTheme: loadSnapshot()?.values?.theme || null,

  store: {
    snapshot: () => loadSnapshot(),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    replaceAll: (values) => ipcRenderer.invoke('store:replaceAll', values),
    saveAsset: (bytes, type) => ipcRenderer.invoke('store:saveAsset', bytes, type),
    finishMigration: () => ipcRenderer.invoke('store:finishMigration'),
  },

  // Remembered so quitting can clear a copied letter off the clipboard.
  noteCopied: (text) => ipcRenderer.send('clipboard:copied', text),

  // Unsaved Editor changes, so closing the window can offer to save them.
  setUnsavedDrafts: (count) => ipcRenderer.send('drafts:unsaved', count),
  onSaveDraftsRequested: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:save-drafts', handler);
    return () => ipcRenderer.removeListener('app:save-drafts', handler);
  },
  draftsSaved: (ok) => ipcRenderer.send('drafts:saved', ok),

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
  onExportWord: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:export-word', handler);
    return () => ipcRenderer.removeListener('app:export-word', handler);
  },
  onSaveLetter: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:save-letter', handler);
    return () => ipcRenderer.removeListener('app:save-letter', handler);
  },

  // Returns the current print-root as a PDF byte array (for batch/ZIP).
  renderPdf: () => ipcRenderer.invoke('pdf:render'),

  // Renders and opens a native Save dialog.
  savePdf: (suggestedName) => ipcRenderer.invoke('pdf:save', { suggestedName }),

  // Writes an already-built ZIP via a native Save dialog.
  saveZip: (suggestedName, buffer) =>
    ipcRenderer.invoke('pdf:saveZip', { suggestedName, buffer }),

  // Writes an already-built Word document via a native Save dialog.
  saveDocx: (suggestedName, buffer) =>
    ipcRenderer.invoke('docx:save', { suggestedName, buffer }),

  // Native print dialog.
  printLetter: () => ipcRenderer.invoke('print:letter'),

  // After an export: show the saved file, or attach it to a new Mail message.
  // Only files saved this session; resolves false otherwise.
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  mailFile: (filePath) => ipcRenderer.invoke('file:mail', filePath),

  // --- Updates -------------------------------------------------------------
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  openReleasesPage: () => ipcRenderer.invoke('update:open'),
  installUpdate: () => ipcRenderer.invoke('update:install'),

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
