import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildChatRequest,
  readChatReply,
  readModels,
  chat,
  listModels,
  cleanBaseUrl,
  sendsOffComputer,
  isOnThisComputer,
} from '../ai/providers.js';
import { createKeyStore } from '../ai/keys.js';
import { registerAiIpc } from '../ai/ipc.js';

const ask = { model: 'm', system: 'SYSTEM', prompt: 'PROMPT', apiKey: 'KEY', schema: { type: 'object' } };
const body = (req) => JSON.parse(req.init.body);

/** A fetch that answers each call with the next reply: [status, json]. */
function fakeFetch(...replies) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    const [status, data] = replies.shift() || [200, {}];
    return { ok: status < 400, status, text: async () => JSON.stringify(data) };
  });
  fn.calls = calls;
  return fn;
}

describe('requests', () => {
  it('asks Claude for JSON in the letter shape, with refusal fallbacks on current models', () => {
    const req = buildChatRequest('anthropic', { ...ask, model: 'claude-opus-5-5' });
    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.init.headers['x-api-key']).toBe('KEY');
    expect(req.init.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    const b = body(req);
    expect(b.system).toBe('SYSTEM');
    expect(b.messages).toEqual([{ role: 'user', content: 'PROMPT' }]);
    expect(b.output_config.format).toEqual({ type: 'json_schema', schema: { type: 'object' } });
    expect(b.fallbacks).toBe('default');
    expect(b).not.toHaveProperty('temperature');

    const plain = body(buildChatRequest('anthropic', { ...ask, model: 'claude-opus-5-5', schema: undefined, plain: true }));
    expect(plain).not.toHaveProperty('fallbacks');
    expect(plain).not.toHaveProperty('output_config');

    const older = buildChatRequest('anthropic', { ...ask, model: 'claude-haiku-4-5' });
    expect(body(older)).not.toHaveProperty('fallbacks');
    expect(older.init.headers).not.toHaveProperty('anthropic-beta');
  });

  it('tells OpenAI not to keep the response', () => {
    const b = body(buildChatRequest('openai', ask));
    expect(b.store).toBe(false);
    expect(b.instructions).toBe('SYSTEM');
    expect(b.text.format.type).toBe('json_schema');
  });

  it('sends Gemini its key in a header, not the address', () => {
    const req = buildChatRequest('gemini', { ...ask, model: 'gemini-3.6-flash' });
    expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    expect(req.init.headers['x-goog-api-key']).toBe('KEY');
    expect(body(req).generationConfig.responseJsonSchema).toEqual({ type: 'object' });
  });

  it('talks to Ollama and OpenAI-compatible servers at their own address', () => {
    expect(buildChatRequest('ollama', { ...ask, baseUrl: 'localhost:11434/' }).url).toBe('http://localhost:11434/api/chat');
    expect(body(buildChatRequest('ollama', ask)).format).toEqual({ type: 'object' });
    expect(buildChatRequest('openwebui', { ...ask, baseUrl: 'http://box:3000' }).url).toBe(
      'http://box:3000/api/chat/completions'
    );
    const lm = buildChatRequest('compatible', { ...ask, baseUrl: 'http://localhost:1234/v1' });
    expect(lm.url).toBe('http://localhost:1234/v1/chat/completions');
    expect(lm.init.headers.Authorization).toBe('Bearer KEY');
  });

  it('needs a model', () => {
    expect(() => buildChatRequest('anthropic', { ...ask, model: '' })).toThrow(/model/);
  });
});

describe('replies', () => {
  it('reads the text of each service, skipping thinking', () => {
    expect(
      readChatReply('anthropic', {
        stop_reason: 'end_turn',
        content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"a":1}' }],
      })
    ).toEqual({ text: '{"a":1}', truncated: false });
    expect(
      readChatReply('openai', {
        status: 'completed',
        output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'x' }] }],
      }).text
    ).toBe('x');
    expect(
      readChatReply('gemini', {
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'hmm', thought: true }, { text: 'y' }] } }],
      }).text
    ).toBe('y');
    expect(readChatReply('ollama', { message: { content: 'z' }, done_reason: 'length' })).toEqual({
      text: 'z',
      truncated: true,
    });
    expect(readChatReply('compatible', { choices: [{ message: { content: 'w' } }] }).text).toBe('w');
  });

  it('says so when the service declines', () => {
    expect(() => readChatReply('anthropic', { stop_reason: 'refusal', content: [] })).toThrow(/declined/);
    expect(() => readChatReply('gemini', { promptFeedback: { blockReason: 'SAFETY' } })).toThrow(/declined/);
  });

  it('lists only models that write', () => {
    const openai = readModels('openai', {
      data: [{ id: 'gpt-6-astra' }, { id: 'text-embedding-3-large' }, { id: 'whisper-1' }, { id: 'gpt-5.5' }],
    });
    expect(openai.map((m) => m.id)).toEqual(['gpt-6-astra', 'gpt-5.5']);
    const gemini = readModels('gemini', {
      models: [
        { name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
      ],
    });
    expect(gemini).toEqual([{ id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' }]);
    expect(readModels('ollama', { models: [{ name: 'llama3.3:latest' }] })[0].id).toBe('llama3.3:latest');
  });
});

describe('sending', () => {
  it('asks again without the reply format when a server turns it down', async () => {
    const fetchImpl = fakeFetch(
      [400, { error: { message: 'response_format not supported' } }],
      [200, { choices: [{ message: { content: '{"body":"Hi"}' } }] }]
    );
    const reply = await chat('compatible', { ...ask, baseUrl: 'http://localhost:1234/v1' }, { fetchImpl });
    expect(reply.text).toBe('{"body":"Hi"}');
    expect(fetchImpl.calls[0].body.response_format).toBeDefined();
    expect(fetchImpl.calls[1].body.response_format).toBeUndefined();
  });

  it('explains a rejected key and an unreachable local server', async () => {
    await expect(
      chat('anthropic', { ...ask, model: 'claude-opus-5-5' }, { fetchImpl: fakeFetch([401, { error: { message: 'invalid x-api-key' } }]) })
    ).rejects.toThrow(/didn't accept the API key/);

    const refused = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(chat('ollama', { ...ask, baseUrl: 'http://localhost:11434' }, { fetchImpl: refused })).rejects.toThrow(
      /Couldn't reach Ollama at http:\/\/localhost:11434/
    );
  });

  it('gives up after the timeout', async () => {
    const hang = (url, init) =>
      new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    await expect(chat('ollama', ask, { fetchImpl: hang, timeoutMs: 20 })).rejects.toThrow(/took too long/);
  });

  it('lists models', async () => {
    const fetchImpl = fakeFetch([200, { data: [{ id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' }] }]);
    expect(await listModels('anthropic', { apiKey: 'K' }, { fetchImpl })).toEqual([
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    ]);
  });
});

describe('addresses', () => {
  it('knows what stays on this computer', () => {
    expect(cleanBaseUrl(' localhost:11434/ ')).toBe('http://localhost:11434');
    expect(cleanBaseUrl('ftp://x')).toBe('');
    expect(isOnThisComputer('http://127.0.0.1:8080')).toBe(true);
    expect(isOnThisComputer('http://[::1]:3000')).toBe(true);
    expect(isOnThisComputer('http://nas.local:3000')).toBe(false);
    expect(sendsOffComputer('ollama', 'http://localhost:11434')).toBe(false);
    expect(sendsOffComputer('openwebui', 'https://ai.example.com')).toBe(true);
    expect(sendsOffComputer('anthropic')).toBe(true);
  });
});

/** safeStorage stand-in: reversible, and visibly not plain text. */
const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(`enc:${s}`).reverse(),
  decryptString: (b) => Buffer.from(b).reverse().toString().replace(/^enc:/, ''),
};

describe('API keys', () => {
  it('keeps keys encrypted, apart from settings, and can remove them', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'letterbank-keys-'));
    const keys = createKeyStore(dir, fakeSafeStorage);
    expect(await keys.set('anthropic', ' sk-ant-secret ')).toEqual({ anthropic: true });
    expect(fs.readFileSync(keys.file, 'utf8')).not.toContain('sk-ant-secret');
    expect(createKeyStore(dir, fakeSafeStorage).get('anthropic')).toBe('sk-ant-secret');
    expect(await keys.set('anthropic', '')).toEqual({});
    expect(keys.get('anthropic')).toBe('');
  });

  it('won’t save a key it can’t encrypt', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'letterbank-keys-'));
    const keys = createKeyStore(dir, { ...fakeSafeStorage, isEncryptionAvailable: () => false });
    await expect(keys.set('openai', 'sk-x')).rejects.toThrow(/wasn’t saved/);
  });
});

describe('main-process bridge', () => {
  function setup(fetchImpl) {
    const handlers = {};
    const ipcMain = { handle: (name, fn) => (handlers[name] = fn) };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'letterbank-ipc-'));
    const keys = createKeyStore(dir, fakeSafeStorage);
    registerAiIpc(ipcMain, keys, { fetchImpl });
    return { handlers, keys };
  }

  it('sends the saved key and never returns it to the page', async () => {
    const fetchImpl = fakeFetch([200, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }]);
    const { handlers } = setup(fetchImpl);
    await handlers['ai:setKey'](null, 'anthropic', 'sk-ant-secret');
    expect(await handlers['ai:keys']()).toEqual({ anthropic: true });

    const result = await handlers['ai:generate'](null, 'r1', { ...ask, provider: 'anthropic', model: 'claude-opus-5-5', apiKey: undefined });
    expect(result).toEqual({ ok: true, text: 'ok', truncated: false });
    expect(fetchImpl.calls[0].init.headers['x-api-key']).toBe('sk-ant-secret');
    expect(JSON.stringify(await handlers['ai:keys']())).not.toContain('secret');
  });

  it('asks for a key before sending anything', async () => {
    const fetchImpl = fakeFetch();
    const { handlers } = setup(fetchImpl);
    const result = await handlers['ai:generate'](null, 'r2', { ...ask, provider: 'openai', apiKey: undefined });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Add your ChatGPT API key/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stops a request when asked', async () => {
    const hang = (url, init) =>
      new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const { handlers } = setup(hang);
    const pending = handlers['ai:generate'](null, 'r3', { ...ask, provider: 'ollama' });
    await handlers['ai:cancel'](null, 'r3');
    expect(await pending).toMatchObject({ ok: false, aborted: true });
  });
});
