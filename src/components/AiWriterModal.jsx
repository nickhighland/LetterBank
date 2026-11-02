import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, ShieldAlert, Settings as SettingsIcon, RotateCcw, Wand2, AlertCircle } from 'lucide-react';
import { Modal, Button, Field, TextInput, SegmentedControl } from './ui';
import { TYPE_ICONS } from './FieldForm';
import { activeAi, aiSetupNeeded } from '../ai/settings';
import { buildLetterPrompt } from '../ai/prompt';
import { letterFromReply } from '../ai/reply';
import { clientDetailsIn } from '../ai/privacy';
import { generate } from '../ai/client';
import { resolveFieldDefs, allLetterFields } from '../utils/fieldDefs';
import { formatLabel } from '../utils/variableParser';
import { isPronounToken } from '../utils/pronouns';
import { markupToPlainText } from '../utils/letterMarkup';

const EXAMPLES = [
  'A letter to a client’s employer confirming they are in weekly therapy with me and recommending medical leave from a start date to a return date. Leave the diagnosis out.',
  'A friendly reminder to a client that their session was moved, with the new date and time, and whether it’s telehealth or in the office.',
  'A letter to a school asking for testing accommodations for a student I see, listing the accommodations I recommend.',
];

const PLACEHOLDERS = {
  new: 'Describe the letter: who it’s to, what it’s for, and anything it must say. Leave out the client’s name and details; they become fields you fill in.',
  revise: 'What should change? For example: make it shorter and warmer, and add a paragraph about rescheduling by phone.',
};

const KEYS = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘↩' : 'Ctrl+Enter';

/** A letter's text with its fields shown as labelled chips. */
function LetterPreviewText({ text, labels }) {
  const paragraphs = markupToPlainText(text).split(/\n{2,}/);
  const piece = (part, i) => {
    const field = /^\{\{([a-zA-Z0-9_-]+)\}\}$/.exec(part);
    if (field) {
      const name = field[1];
      const pronoun = isPronounToken(name);
      return (
        <span
          key={i}
          title={`{{${name}}}`}
          className={`inline-block px-1.5 rounded text-[0.92em] font-sans font-medium ${
            pronoun ? 'bg-surface-sunken text-ink-secondary' : 'bg-accent-soft text-accent-ink'
          }`}
        >
          {pronoun ? name.replace(/_/g, ' ') : labels[name] || formatLabel(name)}
        </span>
      );
    }
    const marker = /^\[\[\s*(if\s+[^\]]*?|else|end)\s*\]\]$/i.exec(part);
    if (marker) {
      const kind = marker[1].toLowerCase();
      const word =
        kind === 'else'
          ? 'otherwise'
          : kind === 'end'
            ? 'end'
            : marker[1].replace(/^if\s+(not\s+)?([a-zA-Z0-9_-]+)/i, (m, not, name) => `if ${not ? 'not ' : ''}${labels[name] || formatLabel(name)}`);
      return (
        <span key={i} className="inline-block px-1.5 mx-0.5 rounded text-[11px] font-sans font-semibold bg-warning-soft text-warning">
          {word}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  };
  return (
    <div className="space-y-3 font-serif text-[13.5px] leading-relaxed text-paper-ink">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p.split(/(\{\{[a-zA-Z0-9_-]+\}\}|\[\[\s*(?:if\s+[^\]]*?|else|end)\s*\]\])/i).map(piece)}
        </p>
      ))}
    </div>
  );
}

/**
 * Write with AI: the clinician describes a letter, the chosen AI writes it
 * with {{fields}} for every client detail, and the clinician looks it over,
 * asks for changes, and adds it to the library (or, when rewriting the open
 * letter, puts it in the Editor as an unsaved change).
 *
 * What is typed here lives in this component's memory only. Before it is
 * sent to a service off this computer, it is checked for what looks like a
 * client's details (see ai/privacy.js) and the clinician is asked first.
 */
export function AiWriterModal({
  isOpen,
  onClose,
  initialMode = 'new',
  letter = null,
  aiSettings,
  savedKeys = {},
  fieldLibrary = [],
  presets = {},
  valuesCache = {},
  categories = [],
  onCreate,
  onApplyRevision,
  onOpenSettings,
  ask,
}) {
  const [mode, setMode] = useState(initialMode);
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState('compose'); // compose | writing | result | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [refine, setRefine] = useState('');
  const [lastRun, setLastRun] = useState(null);
  const abortRef = useRef(null);
  const textRef = useRef(null);

  const ai = activeAi(aiSettings);
  const setupNeeded = aiSetupNeeded(aiSettings, savedKeys);
  const canRevise = Boolean(letter);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode === 'revise' && canRevise ? 'revise' : 'new');
    if (phase === 'error') setPhase(result ? 'result' : 'compose');
    requestAnimationFrame(() => textRef.current?.focus());
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  // Stop a request still running if the dialog is closed.
  useEffect(() => {
    if (!isOpen) abortRef.current?.abort();
  }, [isOpen]);

  const reset = () => {
    setDescription('');
    setRefine('');
    setResult(null);
    setError('');
    setLastRun(null);
    setPhase('compose');
  };

  /** Write (or rewrite) a letter. `run` is { mode, instructions, base }. */
  const write = async (run) => {
    const instructions = run.instructions.trim();
    if (!instructions || setupNeeded) return;

    if (ai.offComputer) {
      const found = clientDetailsIn(instructions, { valuesCache, presets });
      if (found.length) {
        let host = '';
        try {
          host = new URL(ai.baseUrl).host;
        } catch {}
        const where = ai.info.cloud
          ? `${ai.info.label} runs on ${ai.info.company}’s servers`
          : `Your ${ai.info.label === 'Other local server' ? 'server' : `${ai.info.label} server`} is at ${host}, not on this Mac`;
        const answer = await ask({
          title: ai.info.cloud ? `Send these details to ${ai.info.label}?` : 'Send these details to your server?',
          icon: ShieldAlert,
          message:
            `What you typed includes what looks like a client’s details:\n\n${found.map((f) => `•  ${f}`).join('\n')}\n\n` +
            `${where}, so they would be sent there. The letter doesn’t need them: ` +
            'it gets fields for names, dates and the like, which you fill in afterwards.',
          cancelLabel: 'Edit what I typed',
          choices: [{ value: 'send', label: 'Send anyway', danger: true }],
        });
        if (answer !== 'send') return;
      }
    }

    const previous = phase;
    setPhase('writing');
    setError('');
    setLastRun(run);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const request = buildLetterPrompt({
        mode: run.base ? 'revise' : 'new',
        instructions,
        letter: run.base,
        library: fieldLibrary,
        presets,
        categories,
      });
      const reply = await generate(
        { provider: ai.provider, model: ai.model, baseUrl: ai.baseUrl, ...request },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      setResult(letterFromReply(reply.text, { base: run.base, truncated: reply.truncated }));
      setRefine('');
      setPhase('result');
    } catch (err) {
      if (controller.signal.aborted) {
        setPhase(previous === 'error' ? (result ? 'result' : 'compose') : previous);
        return;
      }
      setError(err?.message || String(err));
      setPhase('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const startRun = () => write({ instructions: description, base: mode === 'revise' ? letter : null });
  const refineRun = () => write({ instructions: refine, base: result });

  const finish = () => {
    if (!result) return;
    const { note, ...template } = result;
    if (mode === 'revise' && canRevise) onApplyRevision?.(template);
    else onCreate?.(template);
    reset();
    onClose();
  };

  const onKeyDown = (run) => (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  };

  const setResultField = (patch) => setResult((prev) => ({ ...prev, ...patch }));

  const fieldDefs = useMemo(() => {
    if (!result) return {};
    const text = `${result.recipient}\n\n${result.body}\n\n${result.subject}`;
    return resolveFieldDefs(allLetterFields(text), { text, library: fieldLibrary, templateFields: result.fields });
  }, [result, fieldLibrary]);
  const labels = useMemo(
    () => Object.fromEntries(Object.values(fieldDefs).map((d) => [d.name, d.label])),
    [fieldDefs]
  );

  const usingLine = (
    <span className="text-[11.5px] text-ink-muted">
      Using {ai.info.label}
      {ai.model ? <span className="text-ink-faint"> · {ai.model}</span> : null}
      {' · '}
      <button type="button" onClick={onOpenSettings} className="font-medium cursor-pointer text-accent-ink hover:underline">
        Change
      </button>
    </span>
  );

  const title = mode === 'revise' ? 'Rewrite with AI' : 'Write with AI';

  let footer;
  if (phase === 'writing') {
    footer = (
      <>
        <span className="mr-auto">{usingLine}</span>
        <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
          Stop
        </Button>
      </>
    );
  } else if (phase === 'result') {
    footer = (
      <>
        <Button variant="ghost" onClick={reset} className="mr-auto">
          <RotateCcw className="w-3.5 h-3.5" />
          Start over
        </Button>
        <Button onClick={() => lastRun && write(lastRun)} title="Write it again from the same description">
          Try again
        </Button>
        <Button variant="primary" onClick={finish} disabled={!result?.title?.trim()}>
          {mode === 'revise' ? 'Use in the Editor' : 'Add to my letters'}
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        <span className="mr-auto">{setupNeeded ? null : usingLine}</span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {phase === 'error' && result && (
          <Button onClick={() => setPhase('result')}>Back to the letter</Button>
        )}
        <Button
          variant="primary"
          onClick={phase === 'error' && lastRun ? () => write(lastRun) : startRun}
          disabled={Boolean(setupNeeded) || !(phase === 'error' && lastRun ? lastRun.instructions : description).trim()}
          title={`Write (${KEYS})`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {phase === 'error' ? 'Try again' : mode === 'revise' ? 'Rewrite' : 'Write letter'}
        </Button>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={
        mode === 'revise'
          ? 'Say what to change. The AI keeps the letter’s fields and everything you don’t mention.'
          : 'Describe the letter. Names, dates and other details become fields you fill in afterwards.'
      }
      icon={Sparkles}
      width="max-w-2xl"
      footer={footer}
    >
      <div className="p-6 space-y-5">
        {setupNeeded && phase !== 'writing' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-soft">
            <SettingsIcon className="w-4 h-4 mt-0.5 shrink-0 text-accent-ink" />
            <div className="flex-1 space-y-2">
              <p className="text-[13px] font-semibold text-ink">Set up the AI writer first</p>
              <p className="text-[12px] text-ink-secondary">
                Choose Claude, ChatGPT, Gemini or a model on your own computer (Ollama, Open WebUI, LM Studio).{' '}
                {setupNeeded}
              </p>
              <Button variant="primary" onClick={onOpenSettings} className="!h-8">
                Open AI settings
              </Button>
            </div>
          </div>
        )}

        {(phase === 'compose' || phase === 'error') && (
          <>
            {canRevise && (
              <SegmentedControl
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setResult(null);
                  if (phase === 'error') setPhase('compose');
                }}
                options={[
                  { value: 'new', label: 'New letter', Icon: Sparkles },
                  { value: 'revise', label: `Change “${letter.title}”`, Icon: Wand2 },
                ]}
              />
            )}

            <Field label={mode === 'revise' ? 'What should change?' : 'What should the letter say?'}>
              <TextInput
                as="textarea"
                ref={textRef}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={onKeyDown(startRun)}
                placeholder={PLACEHOLDERS[mode]}
                className="!text-[13.5px] leading-relaxed"
              />
            </Field>

            {mode === 'new' && !description.trim() && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">For example</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setDescription(example)}
                    className="block w-full text-left px-3 py-2 rounded-lg text-[12px] leading-snug cursor-pointer
                               text-ink-secondary bg-surface-raised border border-line hover:bg-surface-hover"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

            {phase === 'error' && (
              <div role="alert" className="flex gap-2.5 p-3.5 rounded-xl text-[12.5px] leading-relaxed bg-danger-soft text-danger">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-1.5">
                  <p>{error}</p>
                  {/settings/i.test(error) && (
                    <button type="button" onClick={onOpenSettings} className="font-semibold underline cursor-pointer">
                      Open AI settings
                    </button>
                  )}
                </div>
              </div>
            )}

            {ai.offComputer && !setupNeeded && (
              <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-faint">
                <ShieldAlert className="w-3.5 h-3.5 mt-px shrink-0" />
                What you type here is sent to {ai.info.cloud ? ai.info.company : 'your server'}. LetterBank never sends what
                you type into Quick Fill.
              </p>
            )}
          </>
        )}

        {phase === 'writing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-accent" />
            <p className="text-[14px] font-semibold text-ink">
              {lastRun?.base ? 'Rewriting your letter…' : 'Writing your letter…'}
            </p>
            <p className="text-[12px] text-ink-muted">
              {ai.info.cloud ? 'This usually takes under a minute.' : 'A model on your own computer can take a few minutes.'}
            </p>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="space-y-5">
            {result.note && (
              <div className="flex gap-2.5 p-3.5 rounded-xl text-[12.5px] leading-relaxed bg-accent-soft text-ink-secondary">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-accent-ink" />
                <p>{result.note}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Title">
                <TextInput value={result.title} onChange={(e) => setResultField({ title: e.target.value })} />
              </Field>
              <Field label="Category">
                <TextInput
                  value={result.category}
                  onChange={(e) => setResultField({ category: e.target.value })}
                  list="ai-letter-categories"
                />
                <datalist id="ai-letter-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="Subject">
              <TextInput value={result.subject} onChange={(e) => setResultField({ subject: e.target.value })} />
            </Field>

            <div className="space-y-2">
              <span className="text-[12px] font-semibold text-ink-secondary">Letter</span>
              <div className="rounded-xl border p-5 max-h-[40vh] overflow-y-auto border-line bg-paper shadow-token-sm">
                {result.recipient && (
                  <div className="mb-4">
                    <LetterPreviewText text={result.recipient} labels={labels} />
                  </div>
                )}
                <LetterPreviewText text={result.body} labels={labels} />
              </div>
              <p className="text-[11px] text-ink-faint">
                The date and your signature are added when it prints. You can change any wording in the Editor.
              </p>
            </div>

            {Object.keys(fieldDefs).length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[12px] font-semibold text-ink-secondary">
                  {Object.keys(fieldDefs).length} field{Object.keys(fieldDefs).length === 1 ? '' : 's'} to fill in
                </span>
                <div className="flex flex-wrap gap-1">
                  {Object.values(fieldDefs).map((def) => {
                    const Icon = TYPE_ICONS[def.type] || TYPE_ICONS.text;
                    return (
                      <span
                        key={def.name}
                        title={`{{${def.name}}}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium bg-accent-soft text-accent-ink"
                      >
                        <Icon className="w-3 h-3" />
                        {def.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <Field label="Ask for changes" hint="The AI changes this draft and leaves the rest as it is.">
              <div className="flex gap-2">
                <TextInput
                  value={refine}
                  onChange={(e) => setRefine(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      refineRun();
                    }
                  }}
                  placeholder="e.g. Make it more formal, and mention the next appointment."
                />
                <Button onClick={refineRun} disabled={!refine.trim()}>
                  <Wand2 className="w-3.5 h-3.5" />
                  Revise
                </Button>
              </div>
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}
