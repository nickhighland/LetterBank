/**
 * Where settings are kept.
 *
 * Desktop: files in the app's data folder, through the preload bridge (see
 * electron/store.cjs). Images are stored there at full size and shown here
 * through blob: URLs, so a high-resolution letterhead costs nothing in storage
 * limits and never travels as a multi-megabyte string.
 *
 * Browser (the dev server): localStorage, as before.
 *
 * Client details are never persisted by either. They live in React state only
 * and are gone when the window closes.
 */

const ASSET_PREFIX = 'asset:';

const bridge = () => (typeof window !== 'undefined' ? window.electronAPI?.store : null);
export const hasFileStore = () => Boolean(bridge());

// ---- Save errors -------------------------------------------------------------

const errorListeners = new Set();

/** Subscribe to save failures: (key, error) => void. Returns an unsubscribe. */
export function onSaveError(listener) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function reportSaveError(key, error) {
  console.error(`LetterBank: could not save ${key}`, error);
  errorListeners.forEach((listener) => {
    try {
      listener(key, error);
    } catch {}
  });
}

// ---- Snapshot ---------------------------------------------------------------

let snapshot = null;

/** The settings saved on disk, read once at startup. */
export function getSnapshot() {
  if (snapshot) return snapshot;
  const api = bridge();
  try {
    snapshot = api ? api.snapshot() : null;
  } catch (err) {
    console.error('LetterBank: could not read saved settings', err);
    snapshot = null;
  }
  if (!snapshot) snapshot = { meta: {}, values: {}, assets: {} };
  return snapshot;
}

// ---- Images -----------------------------------------------------------------

const refToUrl = new Map(); // "asset:<name>" -> blob: URL
const urlToRef = new Map(); // blob: or data: URL -> "asset:<name>"

/** A displayable URL for a stored image reference. Other URLs pass through. */
export function resolveImageUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(ASSET_PREFIX)) return url;
  if (refToUrl.has(url)) return refToUrl.get(url);
  const asset = getSnapshot().assets?.[url];
  if (!asset) {
    console.warn(`LetterBank: image ${url} is missing from the data folder`);
    return '';
  }
  const blobUrl = URL.createObjectURL(new Blob([asset.bytes], { type: asset.type }));
  refToUrl.set(url, blobUrl);
  urlToRef.set(blobUrl, url);
  return blobUrl;
}

function dataUrlToBytes(dataUrl) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Unreadable image data');
  const [, type, isBase64, payload] = match;
  if (!isBase64) return { type, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { type, bytes };
}

/** Save image bytes to the data folder; returns a blob: URL for display. */
async function storeImageBytes(bytes, type) {
  const ref = await bridge().saveAsset(bytes, type);
  const existing = refToUrl.get(ref);
  if (existing) return existing;
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type }));
  refToUrl.set(ref, blobUrl);
  urlToRef.set(blobUrl, ref);
  return blobUrl;
}

/**
 * Take an image the clinician chose and return a URL for it. Desktop saves it
 * full size to the data folder straight away; the browser keeps a data URL.
 */
export async function importImageFile(file) {
  if (hasFileStore()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return storeImageBytes(bytes, file.type || 'image/png');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Same as importImageFile, for an image that is already a data URL. */
export async function importImageDataUrl(dataUrl) {
  if (!hasFileStore() || !String(dataUrl).startsWith('data:')) return dataUrl;
  const { bytes, type } = dataUrlToBytes(dataUrl);
  return storeImageBytes(bytes, type);
}

/** The bytes behind any image URL, as a data URL (for backups). */
export async function imageUrlToDataUrl(url) {
  if (!url || url.startsWith('data:')) return url;
  const blob = await (await fetch(resolveImageUrl(url))).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The reference to keep on disk for a displayed image URL. */
async function toStoredImage(url) {
  if (typeof url !== 'string') return url;
  if (urlToRef.has(url)) return urlToRef.get(url);
  if (url.startsWith('data:')) {
    const { bytes, type } = dataUrlToBytes(url);
    const ref = await bridge().saveAsset(bytes, type);
    urlToRef.set(url, ref);
    return ref;
  }
  if (url.startsWith('blob:')) throw new Error('Image is no longer available');
  return url;
}

/** Objects whose `url` is an image: letterhead and signature. */
const IMAGE_KEYS = new Set(['letterhead', 'signature']);

// ---- Reading and writing ----------------------------------------------------

/**
 * localStorage names, used by the browser build and to carry an existing
 * install's settings over to the data folder. `raw` values are plain strings,
 * not JSON (the theme is read by index.html before any script loads).
 */
const LOCAL_KEYS = {
  templates: { name: 'letterbank_templates_v2' },
  presetProfiles: { name: 'letterbank_preset_profiles_v1' },
  presets: { name: 'letterbank_presets_v2' },
  clinician: { name: 'letterbank_clinician_v2' },
  signature: { name: 'letterbank_signature_v2' },
  letterhead: { name: 'letterbank_letterhead_v2' },
  theme: { name: 'letterbank_theme_v2', raw: true },
  activeTemplateId: { name: 'letterbank_active_template_id_v2', raw: true },
};

const localKey = (key) => LOCAL_KEYS[key] || { name: `letterbank_${key}_v1` };

/** Read a setting from localStorage, also trying the pre-rename CareVault name. */
export function readLocal(key) {
  const { name, raw } = localKey(key);
  try {
    for (const candidate of [name, name.replace(/^letterbank_/, 'carevault_')]) {
      const stored = localStorage.getItem(candidate);
      if (stored !== null) return raw ? stored : JSON.parse(stored);
    }
  } catch {}
  return undefined;
}

function writeLocal(key, value) {
  const { name, raw } = localKey(key);
  localStorage.setItem(name, raw ? String(value) : JSON.stringify(value));
}

/** The settings keys an older install may have in localStorage. */
export const LEGACY_SETTING_KEYS = Object.keys(LOCAL_KEYS);

/** True when settings have been carried over from localStorage already. */
export const isMigrated = () => !hasFileStore() || Boolean(getSnapshot().meta?.localStorageMigrated);

/** A saved setting, with stored image references turned into displayable URLs. */
export function readSetting(key) {
  if (!hasFileStore() || !isMigrated()) return readLocal(key);
  const value = getSnapshot().values?.[key];
  if (IMAGE_KEYS.has(key) && value && typeof value === 'object' && value.url) {
    return { ...value, url: resolveImageUrl(value.url) };
  }
  return value;
}

const chains = {};
const latest = {};

/**
 * Save one setting. Saves of the same key run in order, and a save that has
 * been overtaken by a newer one is skipped. Resolves true when it reached the
 * disk; failures resolve false and are reported to onSaveError listeners, so
 * the clinician hears about them instead of finding out on the next launch.
 */
export function saveSetting(key, value) {
  const seq = (latest[key] = (latest[key] || 0) + 1);

  const run = async () => {
    if (seq !== latest[key]) return true;
    if (!hasFileStore()) {
      writeLocal(key, value);
      return true;
    }
    let stored = value;
    if (IMAGE_KEYS.has(key) && value && typeof value === 'object' && value.url) {
      stored = { ...value, url: await toStoredImage(value.url) };
    }
    if (seq !== latest[key]) return true;
    await bridge().set(key, stored);
    return true;
  };

  const result = (chains[key] || Promise.resolve()).then(run).catch((err) => {
    reportSaveError(key, err);
    return false;
  });
  chains[key] = result;
  return result;
}

/** Replace every setting at once, from a backup. */
export async function replaceAllSettings(values) {
  if (!hasFileStore()) {
    Object.entries(values).forEach(([key, value]) => writeLocal(key, value));
    return;
  }
  const stored = { ...values };
  for (const key of IMAGE_KEYS) {
    if (stored[key]?.url) stored[key] = { ...stored[key], url: await toStoredImage(stored[key].url) };
  }
  await bridge().replaceAll(stored);
}

/** Record that localStorage has been carried over, then empty it. */
export async function finishMigration() {
  await window.electronAPI.store.finishMigration();
  try {
    localStorage.clear();
  } catch {}
}
