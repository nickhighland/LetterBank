const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

/**
 * Settings and images, kept as files in the app's data folder.
 *
 * Everything used to live in the renderer's localStorage, which Chromium caps
 * at about 5 million characters per origin. A full-resolution letterhead
 * stored there as a data URL could exceed that on its own; the save failed
 * with nothing but a console error, the letterhead vanished on the next
 * launch, and every later save (typed letter values included) failed too.
 *
 * Now `settings.json` holds the settings and each image is written once, at
 * full size, to `assets/` under a name taken from its contents. Settings refer
 * to an image as "asset:<name>". There is no size limit beyond the disk.
 *
 * Client details never come here. They live only in the renderer's memory.
 */

const DATA_DIR = 'LetterBank Data';
const ASSET_PREFIX = 'asset:';
const WRITE_DELAY_MS = 120;

const IMAGE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const IMAGE_TYPES = Object.fromEntries(
  Object.entries(IMAGE_EXTENSIONS).map(([type, ext]) => [ext, type])
);

const ASSET_NAME_RE = /^[a-f0-9]{24}\.(png|jpg|svg|webp|gif)$/;

/** Every "asset:<name>" string anywhere inside `value`. */
function collectAssetRefs(value, found = new Set()) {
  if (typeof value === 'string') {
    if (value.startsWith(ASSET_PREFIX)) found.add(value.slice(ASSET_PREFIX.length));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectAssetRefs(v, found));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectAssetRefs(v, found));
  }
  return found;
}

function createStore(baseDir) {
  const dir = path.join(baseDir, DATA_DIR);
  const file = path.join(dir, 'settings.json');
  const assetsDir = path.join(dir, 'assets');

  let state = { version: 1, meta: {}, values: {} };
  let writeTimer = null;
  let waiters = [];

  function load() {
    fs.mkdirSync(assetsDir, { recursive: true });
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        state = {
          version: 1,
          meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
          values: parsed.values && typeof parsed.values === 'object' ? parsed.values : {},
        };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Keep the unreadable file for recovery rather than overwriting it.
        try {
          fs.renameSync(file, `${file}.unreadable-${Date.now()}`);
        } catch {}
      }
    }
    return state;
  }

  function readAsset(name) {
    if (!ASSET_NAME_RE.test(name)) return null;
    try {
      const bytes = fs.readFileSync(path.join(assetsDir, name));
      return { bytes, type: IMAGE_TYPES[path.extname(name).slice(1)] };
    } catch {
      return null;
    }
  }

  /** Settings plus the bytes of every image they refer to. */
  function snapshot() {
    const assets = {};
    collectAssetRefs(state.values).forEach((name) => {
      const asset = readAsset(name);
      if (asset) assets[`${ASSET_PREFIX}${name}`] = asset;
    });
    return { meta: state.meta, values: state.values, assets };
  }

  async function writeNow() {
    const data = JSON.stringify(state, null, 2);
    const tmp = `${file}.tmp`;
    await fsp.writeFile(tmp, data, 'utf8');
    await fsp.rename(tmp, file);
  }

  function scheduleWrite() {
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
      clearTimeout(writeTimer);
      writeTimer = setTimeout(flush, WRITE_DELAY_MS);
    });
  }

  /** Write any pending change now. Resolves once it is on disk. */
  async function flush() {
    clearTimeout(writeTimer);
    writeTimer = null;
    const pending = waiters;
    waiters = [];
    try {
      await writeNow();
      pending.forEach((w) => w.resolve(true));
    } catch (err) {
      pending.forEach((w) => w.reject(err));
      if (!pending.length) throw err;
    }
  }

  function set(key, value) {
    if (value === undefined) delete state.values[key];
    else state.values[key] = value;
    return scheduleWrite();
  }

  /** Replace every setting at once (a restored backup). */
  function replaceAll(values) {
    state.values = values && typeof values === 'object' ? { ...values } : {};
    return scheduleWrite();
  }

  function setMeta(key, value) {
    state.meta[key] = value;
    return scheduleWrite();
  }

  /** Save image bytes at full size; returns the "asset:<name>" reference. */
  async function saveAsset(bytes, type) {
    const ext = IMAGE_EXTENSIONS[type];
    if (!ext) throw new Error(`Unsupported image type: ${type || 'unknown'}`);
    const buffer = Buffer.from(bytes);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24);
    const name = `${hash}.${ext}`;
    const target = path.join(assetsDir, name);
    if (!fs.existsSync(target)) {
      const tmp = `${target}.tmp`;
      await fsp.writeFile(tmp, buffer);
      await fsp.rename(tmp, target);
    }
    return `${ASSET_PREFIX}${name}`;
  }

  /** Delete images no setting refers to any more. */
  function pruneAssets() {
    const keep = collectAssetRefs(state.values);
    let removed = 0;
    for (const name of fs.readdirSync(assetsDir)) {
      if (!keep.has(name)) {
        try {
          fs.rmSync(path.join(assetsDir, name), { force: true });
          removed += 1;
        } catch {}
      }
    }
    return removed;
  }

  return {
    dir,
    file,
    assetsDir,
    load,
    snapshot,
    set,
    replaceAll,
    setMeta,
    saveAsset,
    readAsset,
    pruneAssets,
    flush,
    get meta() {
      return state.meta;
    },
  };
}

/** Wire the store to the renderer. */
function registerStoreIpc(ipcMain, store) {
  // Read once, synchronously, by the preload before the page's own scripts run,
  // so the first render already has the clinician's settings.
  ipcMain.on('store:load', (event) => {
    event.returnValue = store.snapshot();
  });
  ipcMain.handle('store:set', (_e, key, value) => store.set(key, value));
  ipcMain.handle('store:replaceAll', (_e, values) => store.replaceAll(values));
  ipcMain.handle('store:saveAsset', (_e, bytes, type) => store.saveAsset(bytes, type));
}

module.exports = { createStore, registerStoreIpc, collectAssetRefs, ASSET_PREFIX, DATA_DIR };
