import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

/**
 * API keys for the AI letter writer.
 *
 * Kept apart from settings.json, encrypted with macOS's keychain through
 * Electron's safeStorage, and never handed back to the page: the page can
 * only ask which services have a key, save a new one, or remove one. The main
 * process reads a key when it sends a request to that service, and only then
 * (so macOS asks about the keychain, if it asks at all, when the writer is
 * used rather than at every launch).
 *
 * Keys are settings, not client information, but they are never part of a
 * backup either: a backup file is meant to be carried around.
 */

const FILE = 'ai-keys.json';

export function createKeyStore(dir, safeStorage) {
  const file = path.join(dir, FILE);

  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return parsed && typeof parsed.keys === 'object' && parsed.keys ? parsed.keys : {};
    } catch {
      return {};
    }
  }

  async function write(keys) {
    await fsp.mkdir(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify({ version: 1, keys }, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fsp.rename(tmp, file);
  }

  return {
    file,

    /** { anthropic: true, … } for every service with a saved key. */
    status() {
      return Object.fromEntries(Object.keys(read()).map((id) => [id, true]));
    },

    /** The key for `provider`, or '' when there is none or it can't be read. */
    get(provider) {
      const saved = read()[provider];
      if (!saved?.encrypted) return '';
      try {
        return safeStorage.decryptString(Buffer.from(saved.encrypted, 'base64'));
      } catch {
        return '';
      }
    },

    /** Save (or, with an empty key, remove) the key for `provider`. */
    async set(provider, key) {
      const keys = read();
      const value = String(key || '').trim();
      if (!value) {
        delete keys[provider];
      } else {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('This Mac can’t keep the key safely right now, so it wasn’t saved.');
        }
        keys[provider] = { encrypted: safeStorage.encryptString(value).toString('base64') };
      }
      await write(keys);
      return this.status();
    },
  };
}
