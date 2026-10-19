import { app, BrowserWindow, Menu, shell, ipcMain, dialog, clipboard, session } from 'electron';
import fs from 'fs/promises';
import { createRequire } from 'module';

// main.js is ESM; the updater is CommonJS because electron-updater is.
const require = createRequire(import.meta.url);
const { registerUpdater } = require('./updater.cjs');
const { createStore, registerStoreIpc } = require('./store.cjs');
const { registerPrivacy } = require('./privacy.cjs');
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The dev server only when asked for (npm run electron:dev); `electron .`
// after a build runs the built app.
const isDev = process.env.ELECTRON_DEV === 'true';

// A separate data folder, for trying the app without touching real settings.
if (process.env.LETTERBANK_USER_DATA) app.setPath('userData', process.env.LETTERBANK_USER_DATA);

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#0f172a',
    title: 'LetterBank',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true
    },
    icon: path.join(__dirname, 'icon.png')
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Letter',
          accelerator: 'CmdOrCtrl+N',
          click: (menuItem, browserWindow) => {
            if (browserWindow) browserWindow.webContents.send('app:new-letter');
          }
        },
        {
          label: 'Export PDF',
          accelerator: 'CmdOrCtrl+E',
          click: (menuItem, browserWindow) => {
            if (browserWindow) browserWindow.webContents.send('app:export-pdf');
          }
        },
        {
          label: 'Check for Updates…',
          click: (menuItem, browserWindow) => {
            if (browserWindow) browserWindow.webContents.send('app:check-updates');
          }
        },
        { type: 'separator' },
        {
          label: 'Print Letter',
          accelerator: 'CmdOrCtrl+P',
          click: (menuItem, browserWindow) => {
            if (browserWindow) browserWindow.webContents.send('app:print');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        // Reloading erases the letter being written, since client details
        // are never saved. Keep it to development builds, where it is useful.
        ...(isDev
          ? [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }]
          : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Native, fully-offline PDF generation.
 *
 * Replaces the html2canvas + jsPDF pipeline, which rasterised the page at
 * 192 DPI and crashed outright on Tailwind v4's oklch() colours. Chromium's
 * own print engine emits real vector text: selectable, searchable, sharp at
 * any zoom, and with no third-party dependency.
 */
const PDF_OPTIONS = {
  pageSize: 'Letter',
  printBackground: true,
  landscape: false,
  margins: { marginType: 'none' },
  preferCSSPageSize: true,
};

function registerIpcHandlers() {
  // Render the current print-root to a PDF buffer.
  ipcMain.handle('pdf:render', async (event) => {
    const wc = event.sender;
    const data = await wc.printToPDF(PDF_OPTIONS);
    return data;
  });

  // Render and immediately prompt for a save location.
  ipcMain.handle('pdf:save', async (event, { suggestedName }) => {
    const wc = event.sender;
    const win = BrowserWindow.fromWebContents(wc);
    const data = await wc.printToPDF(PDF_OPTIONS);

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Letter as PDF',
      defaultPath: suggestedName,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) return { saved: false };

    await fs.writeFile(filePath, data);
    return { saved: true, filePath };
  });

  // Ask the user where to drop a batch archive.
  ipcMain.handle('pdf:saveZip', async (event, { suggestedName, buffer }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Batch Archive',
      defaultPath: suggestedName,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });

    if (canceled || !filePath) return { saved: false };

    await fs.writeFile(filePath, Buffer.from(buffer));
    return { saved: true, filePath };
  });

  // Ask where to save an exported Word document.
  ipcMain.handle('docx:save', async (event, { suggestedName, buffer }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Letter as Word Document',
      defaultPath: suggestedName,
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });

    if (canceled || !filePath) return { saved: false };

    await fs.writeFile(filePath, Buffer.from(buffer));
    return { saved: true, filePath };
  });

  // Native print dialog, driven by the same @media print stylesheet.
  ipcMain.handle('print:letter', async (event) => {
    const wc = event.sender;
    return new Promise((resolve) => {
      wc.print(
        { silent: false, printBackground: true, pageSize: 'Letter' },
        (success, failureReason) => resolve({ success, failureReason })
      );
    });
  });
}

app.whenReady().then(() => {
  const store = createStore(app.getPath('userData'));
  store.load();
  store.pruneAssets();
  registerStoreIpc(ipcMain, store);
  registerPrivacy({ app, ipcMain, clipboard, session, store });

  registerIpcHandlers();
  registerUpdater(() => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
