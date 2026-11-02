/**
 * The AI services the letter writer can use, and how to talk to each one.
 *
 * Shared by the main process, which makes every request in the desktop app
 * (so local servers need no CORS setup and API keys never reach the page),
 * and by the browser build used in development. Nothing here touches Node or
 * the DOM: requests are plain fetch calls.
 *
 * Nothing is logged and nothing is kept. Each request carries only what the
 * page hands it (the writing instructions, the clinician's description and,
 * when rewriting, the letter's wording and field names) and its reply goes
 * straight back to the page.
 */

export const PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    company: 'Anthropic',
    cloud: true,
    key: 'required',
    defaultModel: 'claude-opus-5-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-…',
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT',
    company: 'OpenAI',
    cloud: true,
    key: 'required',
    defaultModel: 'gpt-6-astra',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-…',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    company: 'Google',
    cloud: true,
    key: 'required',
    defaultModel: 'gemini-3.6-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIza…',
  },

  // Online services that speak OpenAI's Chat Completions ("api: 'chat'").
  // `format` is the reply format each one documents: a JSON Schema, or just
  // "a JSON object". `models` are suggestions shown before Load models.
  // Services with a separate site for mainland China list both as `regions`.
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    company: 'DeepSeek',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_object',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-pro',
    models: ['deepseek-v4-pro', 'deepseek-flash'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-…',
  },
  glm: {
    id: 'glm',
    label: 'GLM',
    company: 'Z.ai',
    tagline: 'Z.ai (Zhipu)',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_object',
    regions: [
      { id: 'global', label: 'International', baseUrl: 'https://api.z.ai/api/paas/v4' },
      { id: 'china', label: 'Mainland China', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
    ],
    defaultModel: 'glm-5.3',
    models: ['glm-5.3'],
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi',
    company: 'Moonshot AI',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_object',
    regions: [
      { id: 'global', label: 'International', baseUrl: 'https://api.moonshot.ai/v1' },
      { id: 'china', label: 'Mainland China', baseUrl: 'https://api.moonshot.cn/v1' },
    ],
    defaultModel: 'kimi-k3.1-pro',
    models: ['kimi-k3.1-pro', 'kimi-k3'],
    keyUrl: 'https://platform.kimi.ai/console/api-keys',
    keyPlaceholder: 'sk-…',
  },
  qwen: {
    id: 'qwen',
    label: 'Qwen',
    company: 'Alibaba Cloud',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_object',
    regions: [
      { id: 'global', label: 'International', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
      { id: 'china', label: 'Mainland China', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    ],
    defaultModel: 'qwen3.7-plus',
    models: ['qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-flash'],
    keyUrl: 'https://home.qwencloud.com/api-keys',
    keyPlaceholder: 'sk-…',
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    company: 'MiniMax',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_object',
    regions: [
      { id: 'global', label: 'International', baseUrl: 'https://api.minimax.io/v1' },
      { id: 'china', label: 'Mainland China', baseUrl: 'https://api.minimaxi.com/v1' },
    ],
    defaultModel: 'MiniMax-M3.1-Flash',
    models: ['MiniMax-M3.1-Flash', 'MiniMax-M3'],
    keyUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    company: 'Mistral AI',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_schema',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  xai: {
    id: 'xai',
    label: 'Grok',
    company: 'xAI',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_schema',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4.7',
    models: ['grok-4.7'],
    keyUrl: 'https://console.x.ai',
    keyPlaceholder: 'xai-…',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    company: 'OpenRouter',
    tagline: 'Hundreds of models, one key',
    cloud: true,
    key: 'required',
    api: 'chat',
    format: 'json_schema',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-opus-5.5',
    models: ['anthropic/claude-opus-5.5'],
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyPlaceholder: 'sk-or-…',
  },

  ollama: {
    id: 'ollama',
    label: 'Ollama',
    company: 'Runs on your Mac',
    cloud: false,
    key: 'none',
    defaultBaseUrl: 'http://localhost:11434',
  },
  openwebui: {
    id: 'openwebui',
    label: 'Open WebUI',
    company: 'Your own server',
    cloud: false,
    key: 'required',
    defaultBaseUrl: 'http://localhost:3000',
    keyHint: 'In Open WebUI: Settings › Account › API keys.',
    keyPlaceholder: 'sk-…',
  },
  compatible: {
    id: 'compatible',
    label: 'Other server',
    company: 'LM Studio, vLLM, or any OpenAI-compatible service',
    cloud: false,
    key: 'optional',
    defaultBaseUrl: 'http://localhost:1234/v1',
    keyHint: 'Only if the server or service asks for one.',
    keyPlaceholder: 'Optional',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

export const isProvider = (id) => Object.hasOwn(PROVIDERS, id);

/** Cloud services, and local ones whose key the main process keeps. */
export const KEYED_PROVIDERS = PROVIDER_IDS.filter((id) => PROVIDERS[id].key !== 'none');

// Claude models that take server-side refusal fallbacks ("default" routing).
const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

const ANTHROPIC_VERSION = '2026-10-21';

/** Long enough for a slow local model on a laptop, or a cloud model that thinks first. */
export const TIMEOUT_MS = { cloud: 5 * 60 * 1000, local: 10 * 60 * 1000 };

/** Online services reached through OpenAI's Chat Completions. */
export const isChatService = (provider) => PROVIDERS[provider]?.api === 'chat';

/** The region whose address `baseUrl` is, or the service's first. */
export function regionOf(provider, baseUrl) {
  const regions = PROVIDERS[provider]?.regions;
  if (!regions) return null;
  const wanted = cleanBaseUrl(baseUrl);
  return regions.find((r) => r.baseUrl === wanted) || regions[0];
}

/**
 * Where an online service is reached. Only its own addresses: the saved key
 * goes with every request, so an address from settings that isn't one of
 * them is never used.
 */
export function serviceUrl(provider, baseUrl) {
  return regionOf(provider, baseUrl)?.baseUrl || PROVIDERS[provider]?.baseUrl || '';
}

/** "http://localhost:11434/" -> "http://localhost:11434", or '' if it isn't a web address. */
export function cleanBaseUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `http://${text}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** True when the address is this computer, so nothing typed leaves it. */
export function isOnThisComputer(baseUrl) {
  try {
    const host = new URL(cleanBaseUrl(baseUrl)).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '::1' || /^127\./.test(host) || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

/** True when what the clinician types is sent off this computer. */
export function sendsOffComputer(provider, baseUrl) {
  const p = PROVIDERS[provider];
  if (!p) return true;
  return p.cloud || !isOnThisComputer(baseUrl || p.defaultBaseUrl);
}

/** Who receives the text, for messages: "Claude", "Ollama". */
export const providerName = (provider) => PROVIDERS[provider]?.label || 'The AI';

function baseFor(provider, baseUrl) {
  const base = cleanBaseUrl(baseUrl || PROVIDERS[provider]?.defaultBaseUrl);
  if (!base) throw new AiError(`${providerName(provider)} needs a server address in Settings › AI writer.`);
  return base;
}

/** An error whose message is meant for the clinician. */
export class AiError extends Error {
  constructor(message, { status, retryWithoutSchema = false } = {}) {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.retryWithoutSchema = retryWithoutSchema;
  }
}

const json = (body) => JSON.stringify(body);
const bearer = (key) => (key ? { Authorization: `Bearer ${key}` } : {});

/**
 * The HTTP request that asks `provider` to write. `schema` (a JSON Schema)
 * asks for a reply in that shape where the service supports it; the prompt
 * describes the shape too, so a service that ignores it still answers in it.
 * `plain` leaves out everything optional (the reply format, Claude's refusal
 * fallbacks), for a service or model that turned the full request down.
 */
export function buildChatRequest(provider, { model, baseUrl, apiKey, system, prompt, schema, plain = false, browser = false }) {
  if (!model) throw new AiError(`Choose a model for ${providerName(provider)} in Settings › AI writer.`);
  const headers = { 'Content-Type': 'application/json' };

  switch (provider) {
    case 'anthropic': {
      const body = {
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: prompt }],
      };
      if (schema) body.output_config = { format: { type: 'json_schema', schema } };
      // Re-run a request a safety check declines on the model Anthropic picks
      // for that kind of decline, instead of failing.
      if (FALLBACK_MODELS.has(model) && !plain) {
        body.fallbacks = 'default';
        headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      }
      Object.assign(headers, { 'x-api-key': apiKey || '', 'anthropic-version': ANTHROPIC_VERSION });
      if (browser) headers['anthropic-dangerous-direct-browser-access'] = 'true';
      return { url: 'https://api.anthropic.com/v1/messages', init: { method: 'POST', headers, body: json(body) } };
    }

    case 'openai': {
      const body = {
        model,
        instructions: system,
        input: prompt,
        // OpenAI otherwise keeps each response for 30 days so a later request
        // can refer back to it. Nothing here needs that.
        store: false,
      };
      if (schema) body.text = { format: { type: 'json_schema', name: 'letter', schema, strict: true } };
      Object.assign(headers, bearer(apiKey));
      return { url: 'https://api.openai.com/v1/responses', init: { method: 'POST', headers, body: json(body) } };
    }

    case 'gemini': {
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      };
      if (schema) body.generationConfig.responseJsonSchema = schema;
      headers['x-goog-api-key'] = apiKey || '';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      return { url, init: { method: 'POST', headers, body: json(body) } };
    }

    case 'ollama': {
      const body = {
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        // Ollama's default window is too small for the instructions plus a letter.
        options: { num_ctx: 8192 },
      };
      if (schema) body.format = schema;
      return { url: `${baseFor(provider, baseUrl)}/api/chat`, init: { method: 'POST', headers, body: json(body) } };
    }

    case 'openwebui':
    case 'compatible': {
      const body = {
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      };
      if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'letter', schema, strict: true } };
      Object.assign(headers, bearer(apiKey));
      const path = provider === 'openwebui' ? '/api/chat/completions' : '/chat/completions';
      return { url: `${baseFor(provider, baseUrl)}${path}`, init: { method: 'POST', headers, body: json(body) } };
    }

    default: {
      if (!isChatService(provider)) throw new AiError('Choose an AI service in Settings › AI writer.');
      const p = PROVIDERS[provider];
      const body = {
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      };
      // Some services stop at a few thousand words unless asked for more.
      if (!plain) body.max_tokens = 16000;
      if (schema) {
        body.response_format =
          p.format === 'json_object'
            ? { type: 'json_object' }
            : { type: 'json_schema', json_schema: { name: 'letter', schema, strict: true } };
      }
      // OpenRouter passes the request on to one of the companies that run the
      // model. Only to those that don't keep or train on what they're sent.
      if (provider === 'openrouter') body.provider = { data_collection: 'deny' };
      Object.assign(headers, bearer(apiKey));
      return {
        url: `${serviceUrl(provider, baseUrl)}/chat/completions`,
        init: { method: 'POST', headers, body: json(body) },
      };
    }
  }
}

/** The text of an OpenAI-style Chat Completions reply. */
function readChatCompletion(name, data) {
  const choice = data?.choices?.[0];
  const message = choice?.message;
  if (message?.refusal) throw new AiError(`${name} declined to write this letter: ${message.refusal}`);
  if (choice?.finish_reason === 'content_filter') {
    throw new AiError(`${name} declined to write this letter. Try describing it differently.`);
  }
  const content = message?.content;
  const text = Array.isArray(content) ? textOf(content.map((c) => c?.text)) : content || '';
  return { text, truncated: choice?.finish_reason === 'length' };
}

/** Text and thinking-tag clean-up shared by every reply. */
const textOf = (parts) => parts.filter((t) => typeof t === 'string').join('');

/**
 * The text of a successful reply, and whether it was cut off. Throws an
 * AiError when the service declined or sent nothing back.
 */
export function readChatReply(provider, data) {
  const name = providerName(provider);
  switch (provider) {
    case 'anthropic': {
      if (data?.stop_reason === 'refusal') {
        throw new AiError(`${name} declined to write this letter. Try describing it differently.`);
      }
      const text = textOf((data?.content || []).filter((b) => b?.type === 'text').map((b) => b.text));
      return { text, truncated: data?.stop_reason === 'max_tokens' };
    }
    case 'openai': {
      const parts = [];
      for (const item of data?.output || []) {
        if (item?.type !== 'message') continue;
        for (const c of item.content || []) {
          if (c?.type === 'refusal') throw new AiError(`${name} declined to write this letter: ${c.refusal}`);
          if (c?.type === 'output_text') parts.push(c.text);
        }
      }
      return { text: textOf(parts), truncated: data?.status === 'incomplete' };
    }
    case 'gemini': {
      if (data?.promptFeedback?.blockReason) {
        throw new AiError(`${name} declined to write this letter (${data.promptFeedback.blockReason}).`);
      }
      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
        throw new AiError(`${name} declined to write this letter. Try describing it differently.`);
      }
      const parts = (candidate?.content?.parts || []).filter((p) => !p?.thought).map((p) => p?.text);
      return { text: textOf(parts), truncated: candidate?.finishReason === 'MAX_TOKENS' };
    }
    case 'ollama':
      return { text: data?.message?.content || '', truncated: data?.done_reason === 'length' };
    case 'openwebui':
    case 'compatible':
      return readChatCompletion(name, data);
    default:
      return isChatService(provider) ? readChatCompletion(name, data) : { text: '', truncated: false };
  }
}

/** The request that lists the models a service offers. */
export function buildModelsRequest(provider, { baseUrl, apiKey, browser = false }) {
  switch (provider) {
    case 'anthropic': {
      const headers = { 'x-api-key': apiKey || '', 'anthropic-version': ANTHROPIC_VERSION };
      if (browser) headers['anthropic-dangerous-direct-browser-access'] = 'true';
      return { url: 'https://api.anthropic.com/v1/models?limit=100', init: { headers } };
    }
    case 'openai':
      return { url: 'https://api.openai.com/v1/models', init: { headers: bearer(apiKey) } };
    case 'gemini':
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        init: { headers: { 'x-goog-api-key': apiKey || '' } },
      };
    case 'ollama':
      return { url: `${baseFor(provider, baseUrl)}/api/tags`, init: {} };
    case 'openwebui':
      return { url: `${baseFor(provider, baseUrl)}/api/models`, init: { headers: bearer(apiKey) } };
    case 'compatible':
      return { url: `${baseFor(provider, baseUrl)}/models`, init: { headers: bearer(apiKey) } };
    default:
      if (!isChatService(provider)) throw new AiError('Choose an AI service in Settings › AI writer.');
      return { url: `${serviceUrl(provider, baseUrl)}/models`, init: { headers: bearer(apiKey) } };
  }
}

// Models an online service lists that can't write a letter.
const NOT_FOR_WRITING = /(embed|rerank|moderation|whisper|tts|speech|transcri|audio|image|ocr)/i;

// OpenAI lists every model it has; these ones can't write a letter.
const OPENAI_NOT_FOR_WRITING =
  /(embed|whisper|tts|dall-e|image|audio|realtime|moderation|transcribe|search|davinci|babbage|computer-use|codex|sora|instruct)/i;

/** [{ id, label }] from a model list reply, newest names first where it helps. */
export function readModels(provider, data) {
  let models = [];
  switch (provider) {
    case 'anthropic':
      models = (data?.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
      break;
    case 'openai':
      models = (data?.data || [])
        .map((m) => m.id)
        .filter((id) => /^(gpt|o\d|chatgpt)/i.test(id) && !OPENAI_NOT_FOR_WRITING.test(id))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map((id) => ({ id, label: id }));
      break;
    case 'gemini':
      models = (data?.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .filter((m) => /gemini/i.test(m.name) && !/(embedding|image|tts|audio|live)/i.test(m.name))
        .map((m) => ({ id: String(m.name).replace(/^models\//, ''), label: m.displayName || m.name }))
        .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
      break;
    case 'ollama':
      models = (data?.models || []).map((m) => ({ id: m.name || m.model, label: m.name || m.model }));
      break;
    case 'openwebui':
    case 'compatible':
      models = (data?.data || []).map((m) => ({ id: m.id, label: m.name || m.id }));
      break;
    default:
      if (!isChatService(provider)) break;
      models = (data?.data || [])
        .filter((m) => m?.id && !NOT_FOR_WRITING.test(m.id))
        // OpenRouter says what each model puts out; keep the ones that write text.
        .filter((m) => !m.architecture?.output_modalities || m.architecture.output_modalities.includes('text'))
        .map((m) => ({ id: m.id, label: m.name || m.id }));
      break;
  }
  const seen = new Set();
  return models.filter((m) => m.id && !seen.has(m.id) && seen.add(m.id));
}

/** The service's own explanation of an error, if it sent one. */
function serviceMessage(data, text) {
  const err = data?.error;
  const message =
    (typeof err === 'string' ? err : err?.message) || data?.message || data?.detail || String(text || '').trim();
  return String(message || '').replace(/\s+/g, ' ').slice(0, 300);
}

/** A failed HTTP reply, in words the clinician can act on. */
export function describeHttpError(provider, status, data, text) {
  const name = providerName(provider);
  const detail = serviceMessage(data, text);
  const p = PROVIDERS[provider];
  const where = p?.cloud ? 'Settings › AI writer' : 'Settings › AI writer (server address and key)';

  if (provider === 'openrouter' && /data policy|data_collection|privacy/i.test(detail)) {
    return new AiError(
      'None of the companies that run this model on OpenRouter promise not to keep or train on what they’re sent, so nothing was sent. Choose another model in Settings › AI writer.',
      { status }
    );
  }
  if (status === 401 || status === 403) {
    return new AiError(`${name} didn't accept the API key. Check it in ${where}.${detail ? ` (${detail})` : ''}`, { status });
  }
  if (status === 404) {
    return new AiError(
      `${name} couldn't find that model or address. Check the model in ${where}.${detail ? ` (${detail})` : ''}`,
      { status }
    );
  }
  if (status === 429) {
    return new AiError(
      `${name} is limiting requests right now, or the account is out of credit. Wait a moment and try again.${detail ? ` (${detail})` : ''}`,
      { status }
    );
  }
  if (status >= 500) {
    return new AiError(`${name} is having trouble right now (error ${status}). Try again in a moment.`, { status });
  }
  // A 400 often means the service or model doesn't take a reply format.
  return new AiError(`${name} couldn't handle the request (error ${status})${detail ? `: ${detail}` : '.'}`, {
    status,
    retryWithoutSchema: status === 400 || status === 422,
  });
}

/** A request that never got an answer. */
export function describeNetworkError(provider, baseUrl, err, { timedOut = false } = {}) {
  const name = providerName(provider);
  if (timedOut) return new AiError(`${name} took too long to answer. Try again, or try a smaller model.`);
  if (err?.name === 'AbortError') return new AiError('Stopped.', { status: 'aborted' });
  if (PROVIDERS[provider]?.cloud) {
    return new AiError(`Couldn't reach ${name}. Check your internet connection and try again.`);
  }
  const where = cleanBaseUrl(baseUrl || PROVIDERS[provider]?.defaultBaseUrl) || 'its address';
  return new AiError(`Couldn't reach ${name} at ${where}. Make sure it's running, and check the address in Settings › AI writer.`);
}

async function send(provider, baseUrl, { url, init }, { signal, timeoutMs, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs ?? (PROVIDERS[provider]?.cloud ? TIMEOUT_MS.cloud : TIMEOUT_MS.local));
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    let response;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal, cache: 'no-store' });
    } catch (err) {
      throw describeNetworkError(provider, baseUrl, err, { timedOut });
    }
    let text = '';
    try {
      text = await response.text();
    } catch (err) {
      throw describeNetworkError(provider, baseUrl, err, { timedOut });
    }
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!response.ok) throw describeHttpError(provider, response.status, data, text);
    if (data === null) throw new AiError(`${providerName(provider)} sent back something LetterBank couldn't read.`);
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

/**
 * Ask `provider` to write. Resolves { text, truncated }. If the service turns
 * the request down as malformed (often a model that doesn't take a reply
 * format), asks once more with only the essentials.
 */
export async function chat(provider, options, { signal, timeoutMs, fetchImpl } = {}) {
  const attempt = async (plain) => {
    const request = buildChatRequest(provider, { ...options, schema: plain ? undefined : options.schema, plain });
    const data = await send(provider, options.baseUrl, request, { signal, timeoutMs, fetchImpl });
    return readChatReply(provider, data);
  };
  try {
    return await attempt(false);
  } catch (err) {
    if (err instanceof AiError && err.retryWithoutSchema) return attempt(true);
    throw err;
  }
}

/** The models `provider` offers: [{ id, label }]. */
export async function listModels(provider, options, { signal, fetchImpl } = {}) {
  let data;
  try {
    data = await send(provider, options.baseUrl, buildModelsRequest(provider, options), {
      signal,
      timeoutMs: 30 * 1000,
      fetchImpl,
    });
  } catch (err) {
    // A service without a model list: the suggestions are what there is.
    const suggested = PROVIDERS[provider]?.models;
    if (err instanceof AiError && err.status === 404 && isChatService(provider) && suggested?.length) {
      throw new AiError(
        `${providerName(provider)} doesn’t share a list of its models. Type a model name, such as ${suggested[0]}.`,
        { status: 404 }
      );
    }
    throw err;
  }
  return readModels(provider, data);
}
