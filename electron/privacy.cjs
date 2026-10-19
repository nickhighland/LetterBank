const fs = require('fs');
const path = require('path');

/**
 * LetterBank keeps no client information once it closes.
 *
 * Client details only ever live in the renderer's memory, but Chromium has its
 * own places a page can leave data behind: localStorage (where older versions
 * kept every letter's values), session storage, IndexedDB, and blob storage
 * spilled to disk. The app no longer uses any of them, so they are emptied
 * when the app quits, and their folders are deleted on the next launch in case
 * it did not quit cleanly.
 */

// Chromium's per-profile storage folders under userData.
const BROWSER_STORAGE_DIRS = [
  'Local Storage',
  'Session Storage',
  'IndexedDB',
  'WebStorage',
  'blob_storage',
  'databases',
  'File System',
  'Service Worker',
  'Shared Dictionary',
];

// Crash reports are memory snapshots, and a renderer's memory holds the
// letter being written. Nothing uploads them; delete any that were written.
const CRASH_REPORT_DIRS = ['completed', 'pending', 'new', 'reports', 'attachments'];

function removeBrowserStorage(userDataDir, crashDumpsDir) {
  for (const name of BROWSER_STORAGE_DIRS) {
    try {
      fs.rmSync(path.join(userDataDir, name), { recursive: true, force: true });
    } catch {}
  }
  if (!crashDumpsDir) return;
  for (const name of CRASH_REPORT_DIRS) {
    try {
      fs.rmSync(path.join(crashDumpsDir, name), { recursive: true, force: true });
    } catch {}
  }
}

async function clearSessionData(session) {
  await session.clearStorageData();
  await session.clearCache();
}

/**
 * Text the app last put on the clipboard. Cleared at quit if it is still
 * there, so a copied letter body does not outlive the app.
 */
let lastCopied = '';

function registerPrivacy({ app, ipcMain, clipboard, session, store }) {
  ipcMain.on('clipboard:copied', (_e, text) => {
    lastCopied = typeof text === 'string' ? text : '';
  });

  ipcMain.handle('store:finishMigration', async () => {
    await store.setMeta('localStorageMigrated', Date.now());
    return true;
  });

  // Before any window opens, remove whatever a previous run left behind —
  // but only once settings have been carried over from localStorage.
  if (store.meta.localStorageMigrated) {
    removeBrowserStorage(app.getPath('userData'), app.getPath('crashDumps'));
  }

  let finished = false;
  app.on('before-quit', (event) => {
    if (finished) return;
    event.preventDefault();

    const tidy = async () => {
      await store.flush().catch(() => {});
      if (lastCopied && clipboard.readText() === lastCopied) clipboard.clear();
      lastCopied = '';
      if (store.meta.localStorageMigrated) await clearSessionData(session.defaultSession);
    };

    // Never let tidying up stop the app from quitting.
    Promise.race([tidy(), new Promise((r) => setTimeout(r, 4000))])
      .catch(() => {})
      .finally(() => {
        finished = true;
        app.quit();
      });
  });
}

module.exports = { registerPrivacy, removeBrowserStorage, BROWSER_STORAGE_DIRS };
