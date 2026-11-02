import { chat, listModels, isProvider, PROVIDERS, AiError } from './providers.js';

/**
 * The AI letter writer's side of the bridge. The page sends what to write
 * and which service to use; the request goes out from here, with the key
 * read from the keychain, and only the reply's text comes back.
 *
 * Results are { ok: true, … } or { ok: false, error } rather than thrown, so
 * the page shows the message itself instead of Electron's wrapper around it.
 */

const failure = (err) => ({
  ok: false,
  error: err instanceof AiError ? err.message : `Something went wrong: ${err?.message || err}`,
  aborted: err?.status === 'aborted',
});

export function registerAiIpc(ipcMain, keyStore, { fetchImpl } = {}) {
  const running = new Map(); // request id -> AbortController

  /** The key for a request: one typed but not yet saved, else the saved one. */
  const keyFor = (provider, typedKey) => {
    if (PROVIDERS[provider].key === 'none') return '';
    return typeof typedKey === 'string' && typedKey.trim() ? typedKey.trim() : keyStore.get(provider);
  };

  ipcMain.handle('ai:keys', () => keyStore.status());

  ipcMain.handle('ai:setKey', async (_e, provider, key) => {
    if (!isProvider(provider)) return { ok: false, error: 'Unknown AI service.' };
    try {
      return { ok: true, keys: await keyStore.set(provider, key) };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('ai:generate', async (_e, requestId, request = {}) => {
    const { provider, model, baseUrl, system, prompt, schema, apiKey } = request;
    if (!isProvider(provider)) return failure(new AiError('Choose an AI service in Settings › AI writer.'));
    const key = keyFor(provider, apiKey);
    if (PROVIDERS[provider].key === 'required' && !key) {
      return failure(new AiError(`Add your ${PROVIDERS[provider].label} API key in Settings › AI writer.`));
    }

    const controller = new AbortController();
    running.set(requestId, controller);
    try {
      const reply = await chat(
        provider,
        { model, baseUrl, apiKey: key, system, prompt, schema },
        { signal: controller.signal, fetchImpl }
      );
      return { ok: true, ...reply };
    } catch (err) {
      return failure(err);
    } finally {
      running.delete(requestId);
    }
  });

  ipcMain.handle('ai:cancel', (_e, requestId) => {
    running.get(requestId)?.abort();
    return true;
  });

  ipcMain.handle('ai:models', async (_e, request = {}) => {
    const { provider, baseUrl, apiKey } = request;
    if (!isProvider(provider)) return failure(new AiError('Choose an AI service first.'));
    const key = keyFor(provider, apiKey);
    if (PROVIDERS[provider].key === 'required' && !key) {
      return failure(new AiError(`Add your ${PROVIDERS[provider].label} API key first.`));
    }
    try {
      return { ok: true, models: await listModels(provider, { baseUrl, apiKey: key }, { fetchImpl }) };
    } catch (err) {
      return failure(err);
    }
  });
}
