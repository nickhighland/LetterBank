const { app, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

/**
 * Update checking against the GitHub releases feed.
 *
 * Deliberately check-and-notify rather than download-and-install.
 *
 * Squirrel.Mac — what electron-updater drives on macOS, and the same mechanism
 * Sparkle-style updating relies on — refuses to apply an update unless both the
 * running app and the replacement are signed with a Developer ID. This build is
 * unsigned (electron-builder reports "0 valid identities found"), so a silent
 * download would fetch ~100MB and then fail at the install step with nothing to
 * show for it.
 *
 * So: compare versions, tell the renderer, and send the clinician to the
 * release page to download. When a Developer ID is available, set
 * AUTO_DOWNLOAD to true and wire `quitAndInstall` to the renderer's prompt —
 * the feed and the version comparison already work.
 */
const AUTO_DOWNLOAD = false;
const RELEASES_URL = 'https://github.com/nickhighland/LetterBank/releases/latest';

// Check shortly after launch so it never competes with first paint, then daily
// for a long-running window.
const INITIAL_DELAY_MS = 8000;
const REPEAT_MS = 24 * 60 * 60 * 1000;

function registerUpdater(getWindow) {
  autoUpdater.autoDownload = AUTO_DOWNLOAD;
  autoUpdater.autoInstallOnAppQuit = AUTO_DOWNLOAD;
  autoUpdater.allowPrerelease = false;

  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  autoUpdater.on('update-available', (info) => {
    send('update:available', {
      version: info.version,
      currentVersion: app.getVersion(),
      releaseDate: info.releaseDate,
      url: RELEASES_URL,
      canAutoInstall: AUTO_DOWNLOAD,
    });
  });

  autoUpdater.on('update-not-available', () => {
    send('update:none', { currentVersion: app.getVersion() });
  });

  autoUpdater.on('error', (err) => {
    // A failed check is not worth interrupting the clinician over; surface it
    // only when they asked by pressing "Check for updates".
    send('update:error', { message: String(err?.message || err) });
  });

  // Renderer-initiated check, from the menu or a button.
  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        ok: true,
        currentVersion: app.getVersion(),
        latestVersion: result?.updateInfo?.version || app.getVersion(),
      };
    } catch (e) {
      return { ok: false, message: String(e?.message || e) };
    }
  });

  ipcMain.handle('update:open', async () => {
    await shell.openExternal(RELEASES_URL);
    return { opened: true };
  });

  // Updating a dev checkout has no meaning — there is no packaged app to replace.
  if (!app.isPackaged) return;

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), INITIAL_DELAY_MS);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), REPEAT_MS);
}

module.exports = { registerUpdater, RELEASES_URL };
