import React, { useState } from 'react';
import { Cloud, Laptop, Server, KeyRound, RefreshCw, Check, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { PROVIDERS, PROVIDER_IDS, sendsOffComputer, cleanBaseUrl } from '../../electron/ai/providers.js';
import { listModels } from '../ai/client';
import { Button, Field, TextInput } from './ui';

const PROVIDER_ICONS = { cloud: Cloud, local: Laptop, server: Server };

/**
 * Settings › AI writer: which service writes letters, its model, and its key
 * or server address.
 *
 * `value` is the AI settings being edited; `pendingKeys` holds keys typed
 * here and not saved yet (provider -> key, '' to remove). Both are saved by
 * "Save all changes". Saved keys are never shown again, only whether there
 * is one.
 */
export function AiSettingsPanel({ value, onChange, savedKeys = {}, pendingKeys = {}, onChangePendingKey }) {
  const provider = value.provider;
  const info = PROVIDERS[provider];
  const [modelLists, setModelLists] = useState({}); // provider -> { models, error, loading }
  const list = modelLists[provider] || {};

  // How the key row shows: the saved key, a box to replace it, or removing it.
  const [keyModes, setKeyModes] = useState({});
  const pending = pendingKeys[provider];
  const typedKey = typeof pending === 'string' && pending.trim() ? pending.trim() : '';
  const keyMode = keyModes[provider] || (savedKeys[provider] ? (pending === '' ? 'remove' : 'saved') : 'new');
  const setKeyMode = (mode) => setKeyModes((prev) => ({ ...prev, [provider]: mode }));
  const baseUrl = value.baseUrls[provider] ?? info.defaultBaseUrl ?? '';
  const offComputer = sendsOffComputer(provider, baseUrl);

  const setProvider = (id) => onChange({ ...value, provider: id });
  const setModel = (model) => onChange({ ...value, models: { ...value.models, [provider]: model } });
  const setBaseUrl = (url) => onChange({ ...value, baseUrls: { ...value.baseUrls, [provider]: url } });

  /** Load the service's models; doubles as a check that the key and address work. */
  const loadModels = async () => {
    setModelLists((prev) => ({ ...prev, [provider]: { ...prev[provider], loading: true, error: '' } }));
    try {
      const models = await listModels({
        provider,
        baseUrl: cleanBaseUrl(baseUrl),
        apiKey: typedKey || undefined,
      });
      setModelLists((prev) => ({ ...prev, [provider]: { models, loading: false, error: '', checked: true } }));
      if (models.length && !String(value.models[provider] || '').trim()) setModel(models[0].id);
    } catch (err) {
      setModelLists((prev) => ({ ...prev, [provider]: { models: [], loading: false, error: err.message } }));
    }
  };

  const kindOf = (p) => (p.cloud ? 'cloud' : p.key === 'none' ? 'local' : 'server');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-ink">AI letter writer</h3>
        <p className="text-[11px] text-ink-muted">
          Describe a letter and the AI writes it, with fields for the client’s details. Choose the service that
          writes it.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PROVIDER_IDS.map((id) => {
          const p = PROVIDERS[id];
          const Icon = PROVIDER_ICONS[kindOf(p)];
          const active = id === provider;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setProvider(id)}
              aria-pressed={active}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-colors
                ${active ? 'border-accent bg-accent-soft' : 'border-line bg-surface-raised hover:bg-surface-hover'}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-accent-ink' : 'text-ink-muted'}`} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  {p.label}
                  {savedKeys[id] && !active && (
                    <Check className="w-3 h-3 text-success" aria-label="Set up" />
                  )}
                </span>
                <span className="block text-[11px] leading-snug text-ink-muted">{p.company}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border p-4 space-y-5 border-line bg-surface-sunken">
        {info.defaultBaseUrl && (
          <Field
            label="Server address"
            hint={
              provider === 'ollama'
                ? 'Ollama’s address on this Mac is usually http://localhost:11434.'
                : provider === 'openwebui'
                  ? 'Where you open Open WebUI in your browser, such as http://localhost:3000.'
                  : 'The server’s OpenAI-compatible address, usually ending in /v1. LM Studio: http://localhost:1234/v1.'
            }
          >
            <TextInput
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={info.defaultBaseUrl}
              spellCheck={false}
              autoCapitalize="off"
            />
          </Field>
        )}

        {info.key !== 'none' && (
          <Field
            label="API key"
            hint={info.keyHint}
            action={
              info.keyUrl ? (
                <a
                  href={info.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-accent-ink hover:underline"
                >
                  Get a {info.label} key
                </a>
              ) : null
            }
          >
            {keyMode === 'saved' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-lg border text-[13px] border-line bg-surface-raised text-ink-secondary">
                  <KeyRound className="w-3.5 h-3.5 text-success" />
                  Saved in your Mac’s keychain
                </div>
                <Button onClick={() => setKeyMode('replace')}>Replace</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setKeyMode('remove');
                    onChangePendingKey(provider, '');
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <TextInput
                  type="password"
                  value={pending || ''}
                  onChange={(e) => {
                    const typed = e.target.value;
                    onChangePendingKey(provider, typed.trim() ? typed : keyMode === 'remove' ? '' : undefined);
                  }}
                  placeholder={info.keyPlaceholder || 'Paste your API key'}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus={keyMode === 'replace'}
                />
                {savedKeys[provider] && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setKeyMode('saved');
                      onChangePendingKey(provider, undefined);
                    }}
                  >
                    Keep saved key
                  </Button>
                )}
              </div>
            )}
            {keyMode === 'remove' && !typedKey && (
              <p className="text-[11px] text-warning">The saved key is removed when you save.</p>
            )}
          </Field>
        )}

        <Field
          label="Model"
          hint={
            info.cloud
              ? `Load models lists what your ${info.label} account can use.`
              : 'Load models lists what the server has installed.'
          }
          action={
            <button
              type="button"
              onClick={loadModels}
              disabled={list.loading}
              className="inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer text-accent-ink hover:underline disabled:opacity-60"
            >
              {list.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Load models
            </button>
          }
        >
          <TextInput
            value={value.models[provider] || ''}
            onChange={(e) => setModel(e.target.value)}
            list={`ai-models-${provider}`}
            placeholder={info.defaultModel || 'Choose or type a model name'}
            spellCheck={false}
            autoCapitalize="off"
          />
          <datalist id={`ai-models-${provider}`}>
            {(list.models || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label !== m.id ? m.label : null}
              </option>
            ))}
          </datalist>
          {list.error && <p className="text-[11.5px] text-danger">{list.error}</p>}
          {list.checked && !list.error && (
            <p className="text-[11.5px] text-success">
              Connected. {list.models.length} model{list.models.length === 1 ? '' : 's'} available.
            </p>
          )}
        </Field>
      </div>

      <div
        className={`flex gap-3 p-4 rounded-xl text-[12px] leading-relaxed ${
          offComputer ? 'bg-warning-soft text-ink-secondary' : 'bg-success-soft text-ink-secondary'
        }`}
      >
        {offComputer ? (
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
        ) : (
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-success" />
        )}
        <div className="space-y-1.5">
          {info.cloud ? (
            <p>
              {info.label} runs on {info.company}’s servers, so what you type in the AI writer is sent to {info.company}.
              Describe the letter, not the client: names, dates and other details become fields you fill in afterwards.
            </p>
          ) : offComputer ? (
            <p>
              This server isn’t on this Mac, so what you type in the AI writer is sent to it. Describe the letter, not
              the client.
            </p>
          ) : (
            <p>{info.label} runs on this Mac, so what you type in the AI writer stays here.</p>
          )}
          <p>
            LetterBank sends only your description and, when rewriting, the letter’s wording and field names. It never
            sends what you type into Quick Fill, and it keeps nothing the AI sends back except a letter you choose to
            save.
          </p>
        </div>
      </div>
    </div>
  );
}
