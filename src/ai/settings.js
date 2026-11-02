import { PROVIDERS, PROVIDER_IDS, isProvider, cleanBaseUrl, sendsOffComputer, serviceUrl } from '../../electron/ai/providers.js';
import { readSetting, saveSetting } from '../utils/persist';

/**
 * Which AI service writes letters, and with which model. API keys are not
 * here: the desktop app keeps them in the keychain (electron/ai/keys.js).
 */

export const DEFAULT_AI = {
  provider: 'anthropic',
  models: Object.fromEntries(PROVIDER_IDS.map((id) => [id, PROVIDERS[id].defaultModel || ''])),
  baseUrls: Object.fromEntries(
    PROVIDER_IDS.filter((id) => PROVIDERS[id].defaultBaseUrl).map((id) => [id, PROVIDERS[id].defaultBaseUrl])
  ),
};

const strings = (value) =>
  value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([k, v]) => isProvider(k) && typeof v === 'string'))
    : {};

export function normaliseAiSettings(raw) {
  return {
    provider: isProvider(raw?.provider) ? raw.provider : DEFAULT_AI.provider,
    models: { ...DEFAULT_AI.models, ...strings(raw?.models) },
    baseUrls: { ...DEFAULT_AI.baseUrls, ...strings(raw?.baseUrls) },
  };
}

export const loadAiSettings = () => normaliseAiSettings(readSetting('ai'));
export const saveAiSettings = (settings) => saveSetting('ai', settings);

/** The chosen service, model and address: what a request needs, keys aside. */
export function activeAi(settings) {
  const provider = settings.provider;
  const info = PROVIDERS[provider];
  const saved = settings.baseUrls[provider];
  return {
    provider,
    model: String(settings.models[provider] || '').trim(),
    // A server's own address, or the region an online service is reached in.
    baseUrl: info.defaultBaseUrl ? cleanBaseUrl(saved) : info.regions ? serviceUrl(provider, saved) : '',
    info,
    offComputer: sendsOffComputer(provider, settings.baseUrls[provider]),
  };
}

/**
 * What still has to be set before the writer can be used, as a sentence, or
 * '' when it is ready. `keys` says which services have a saved key.
 */
export function aiSetupNeeded(settings, keys = {}) {
  const { provider, model, baseUrl, info } = activeAi(settings);
  if (info.key === 'required' && !keys[provider]) return `Add your ${info.label} API key.`;
  if (info.defaultBaseUrl && !baseUrl) return `Enter the address of your ${info.label} server.`;
  if (!model) return `Choose a ${info.label} model.`;
  return '';
}
