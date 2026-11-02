import { chat, listModels as listModelsDirect, AiError } from '../../electron/ai/providers.js';

/**
 * The page's way to reach the AI services.
 *
 * In the desktop app every request is made by the main process, which holds
 * the API keys (see electron/ai/ipc.js). The browser build used for
 * development makes the request itself, with keys kept in memory only.
 */

const bridge = () => (typeof window !== 'undefined' ? window.electronAPI?.ai : null);

// Browser build only: keys typed this session. Never written anywhere.
const memoryKeys = new Map();

/** { anthropic: true, … } for every service with a saved key. */
export async function keyStatus() {
  const api = bridge();
  if (api) {
    try {
      return (await api.keyStatus()) || {};
    } catch {
      return {};
    }
  }
  return Object.fromEntries([...memoryKeys.keys()].map((id) => [id, true]));
}

/** Save a key, or remove it with ''. Resolves the new key status. */
export async function saveKey(provider, key) {
  const api = bridge();
  if (api) {
    const result = await api.setKey(provider, key);
    if (!result?.ok) throw new Error(result?.error || 'The key wasn’t saved.');
    return result.keys || {};
  }
  if (String(key || '').trim()) memoryKeys.set(provider, String(key).trim());
  else memoryKeys.delete(provider);
  return keyStatus();
}

let nextId = 0;
const requestId = () => `ai-${Date.now()}-${(nextId += 1)}`;

/**
 * Ask the chosen service to write. `request` is { provider, model, baseUrl,
 * system, prompt, schema, apiKey? } (apiKey only when testing a key that
 * isn't saved yet). Resolves { text, truncated }; rejects with an AiError
 * whose message is meant for the clinician. Aborting `signal` stops it.
 */
export async function generate(request, { signal } = {}) {
  const api = bridge();
  if (!api) {
    const apiKey = request.apiKey || memoryKeys.get(request.provider) || '';
    return chat(request.provider, { ...request, apiKey, browser: true }, { signal });
  }

  const id = requestId();
  const onAbort = () => api.cancel(id);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const result = await api.generate(id, request);
    if (!result?.ok) throw new AiError(result?.error || 'Something went wrong.', { status: result?.aborted ? 'aborted' : undefined });
    return { text: result.text || '', truncated: Boolean(result.truncated) };
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/** The models a service offers: [{ id, label }]. Also how a connection is tested. */
export async function listModels({ provider, baseUrl, apiKey }) {
  const api = bridge();
  if (!api) {
    const key = apiKey || memoryKeys.get(provider) || '';
    return listModelsDirect(provider, { baseUrl, apiKey: key, browser: true });
  }
  const result = await api.listModels({ provider, baseUrl, apiKey });
  if (!result?.ok) throw new AiError(result?.error || 'Couldn’t load the models.');
  return result.models || [];
}

export { AiError };
