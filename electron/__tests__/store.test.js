import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createStore } = require('../store.cjs');
const { removeBrowserStorage } = require('../privacy.cjs');

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

describe('settings store', () => {
  let base;
  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'letterbank-store-'));
  });

  it('keeps settings across a restart', async () => {
    const store = createStore(base);
    store.load();
    await store.set('theme', 'dark');
    const again = createStore(base);
    again.load();
    expect(again.snapshot().values.theme).toBe('dark');
  });

  it('saves an image whole, once, and hands its bytes back on load', async () => {
    const store = createStore(base);
    store.load();
    const big = new Uint8Array(25 * 1024 * 1024).fill(7); // larger than localStorage ever allowed
    const ref = await store.saveAsset(big, 'image/png');
    expect(ref).toMatch(/^asset:[a-f0-9]{24}\.png$/);
    expect(await store.saveAsset(big, 'image/png')).toBe(ref);
    await store.set('letterhead', { url: ref, showLetterhead: true });

    const again = createStore(base);
    again.load();
    const asset = again.snapshot().assets[ref];
    expect(asset.type).toBe('image/png');
    expect(asset.bytes.length).toBe(big.length);
  });

  it('refuses anything that is not an image', async () => {
    const store = createStore(base);
    store.load();
    await expect(store.saveAsset(PNG, 'text/html')).rejects.toThrow(/Unsupported/);
  });

  it('deletes images no setting uses any more', async () => {
    const store = createStore(base);
    store.load();
    const keep = await store.saveAsset(PNG, 'image/png');
    await store.saveAsset(new Uint8Array([9, 9, 9]), 'image/jpeg');
    await store.set('signature', { url: keep });
    expect(store.pruneAssets()).toBe(1);
    expect(fs.readdirSync(store.assetsDir)).toEqual([keep.slice('asset:'.length)]);
  });

  it('sets an unreadable settings file aside instead of overwriting it', async () => {
    fs.mkdirSync(path.join(base, 'LetterBank Data'), { recursive: true });
    fs.writeFileSync(path.join(base, 'LetterBank Data', 'settings.json'), '{not json');
    const store = createStore(base);
    store.load();
    await store.set('theme', 'light');
    const names = fs.readdirSync(path.join(base, 'LetterBank Data'));
    expect(names.some((n) => n.startsWith('settings.json.unreadable-'))).toBe(true);
  });
});

describe('removeBrowserStorage', () => {
  it('deletes Chromium storage folders and crash reports, and nothing else', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'letterbank-privacy-'));
    const crash = path.join(base, 'Crashpad');
    for (const dir of ['Local Storage/leveldb', 'IndexedDB', 'LetterBank Data', 'Crashpad/completed']) {
      fs.mkdirSync(path.join(base, dir), { recursive: true });
    }
    removeBrowserStorage(base, crash);
    expect(fs.existsSync(path.join(base, 'Local Storage'))).toBe(false);
    expect(fs.existsSync(path.join(base, 'IndexedDB'))).toBe(false);
    expect(fs.existsSync(path.join(crash, 'completed'))).toBe(false);
    expect(fs.existsSync(path.join(base, 'LetterBank Data'))).toBe(true);
  });
});
