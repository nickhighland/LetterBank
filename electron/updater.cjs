const { app, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process');
const path = require('path');

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
 * So an unsigned build compares versions, tells the renderer, and sends the
 * clinician to the release page to download. A build signed with a Developer
 * ID (see SIGNING.md) is detected at launch and updates itself instead: it
 * downloads in the background and offers "Restart to update".
 */
const RELEASES_URL = 'https://github.com/nickhighland/LetterBank/releases/latest';

// Check shortly after launch so it never competes with first paint, then daily
// for a long-running window.
const INITIAL_DELAY_MS = 8000;
const REPEAT_MS = 24 * 60 * 60 * 1000;

/** True when this copy of the app is signed with a Developer ID. */
function isDeveloperIdSigned() {
  if (process.platform !== 'darwin' || !app.isPackaged) return Promise.resolve(false);
  // .../LetterBank.app/Contents/MacOS/LetterBank -> .../LetterBank.app
  const bundle = path.resolve(process.execPath, '..', '..', '..');
  return new Promise((resolve) => {
    execFile('/usr/bin/codesign', ['-dv', '--verbose=2', bundle], (err, _out, details) => {
      resolve(!err && /Authority=Developer ID Application/.test(String(details)));
    });
  });
}

function registerUpdater(getWindow) {
  let canAutoInstall = false;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  const announce = (info) =>
    send('update:available', {
      version: info.version,
      currentVersion: app.getVersion(),
      releaseDate: info.releaseDate,
      url: RELEASES_URL,
      canAutoInstall,
    });

  // A signed build says nothing until the update is downloaded and ready.
  autoUpdater.on('update-available', (info) => {
    if (!canAutoInstall) announce(info);
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (canAutoInstall) announce(info);
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

  // Closing asks about unsaved changes and clears client details as usual
  // (see main.js and privacy.cjs) before the new version starts.
  ipcMain.handle('update:install', () => {
    if (canAutoInstall) autoUpdater.quitAndInstall();
    return { installing: canAutoInstall };
  });

  // Updating a dev checkout has no meaning — there is no packaged app to replace.
  if (!app.isPackaged) return;

  isDeveloperIdSigned().then((signed) => {
    canAutoInstall = signed;
    autoUpdater.autoDownload = signed;
    autoUpdater.autoInstallOnAppQuit = signed;
  });

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), INITIAL_DELAY_MS);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), REPEAT_MS);
}

module.exports = { registerUpdater, RELEASES_URL };
