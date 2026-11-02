import { describe, it, expect } from 'vitest';
import { extractJson, cleanPlaceholders, tidyBody, letterFromReply } from '../reply';
import { buildLetterPrompt, knownFields, LETTER_SCHEMA } from '../prompt';
import { clientDetailsIn } from '../privacy';
import { normaliseAiSettings, aiSetupNeeded, activeAi } from '../settings';

const reply = (letter) => JSON.stringify({
  title: 'Return to Work',
  category: 'Leave',
  description: 'Clears a client to go back to work.',
  subject: 'Return to work: {{client_name}}',
  recipient: '',
  body: 'Dear {{recipient_name}},\n\n{{Client_name}} may return on {{return_date}}.\n\nSincerely,',
  fields: [
    { name: 'return_date', label: 'Return-to-work date', type: 'date', options: [], help: '' },
    { name: 'recipient_name', label: 'Recipient Name', type: 'text', options: [], help: '' },
    { name: 'unused', label: 'Not in the letter', type: 'text', options: [], help: '' },
  ],
  note: 'Check the return date.',
  ...letter,
});

describe('reading the reply', () => {
  it('finds the JSON in fences, after thinking, and with raw line breaks', () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('<think>let me see {x}</think>Here you go: {"a": 2}')).toEqual({ a: 2 });
    expect(extractJson('{"body": "Dear X,\n\nHello."}')).toEqual({ body: 'Dear X,\n\nHello.' });
    expect(() => extractJson('Sorry, I cannot.')).toThrow();
  });

  it('tidies placeholders and pronouns a model got wrong', () => {
    expect(cleanPlaceholders('{{ Client Name }} said {{She}} would bring {{her}} form; {{They_are}} ready.')).toBe(
      '{{client_name}} said {{They}} would bring {{their}} form; {{They_are}} ready.'
    );
  });

  it('drops a date line and a signature block the app prints itself', () => {
    expect(
      tidyBody('{{letter_date}}\n\nDear {{client_name}},\n\nHello.\n\nSincerely,\n\n{{clinician_name}}, {{clinician_credentials}}\n{{practice_name}}')
    ).toBe('Dear {{client_name}},\n\nHello.\n\nSincerely,');
    // Words after the closing are the clinician's, so they stay.
    expect(tidyBody('Hello.\n\nSincerely,\nP.S. Bring your card.')).toBe('Hello.\n\nSincerely,\nP.S. Bring your card.');
  });

  it('makes a template with only the fields it uses', () => {
    const tpl = letterFromReply(reply(), { makeId: () => 'custom-1' });
    expect(tpl).toMatchObject({
      id: 'custom-1',
      title: 'Return to Work',
      category: 'Leave',
      subject: 'Return to work: {{client_name}}',
      isCustom: true,
      note: 'Check the return date.',
    });
    expect(tpl.body).toContain('{{client_name}} may return on {{return_date}}');
    // return_date's label differs from the guess, so it is kept; recipient_name's doesn't.
    expect(tpl.fields.map((f) => f.name)).toEqual(['return_date']);
  });

  it('keeps the letter’s id and its fields when rewriting', () => {
    const base = {
      id: 'tpl-9',
      pinned: true,
      title: 'Old',
      fields: [{ name: 'return_date', label: 'Back on', type: 'date', defaultValue: '' }],
    };
    const tpl = letterFromReply(reply({ fields: [] }), { base });
    expect(tpl.id).toBe('tpl-9');
    expect(tpl.pinned).toBe(true);
    expect(tpl.fields).toEqual(base.fields);
  });

  it('explains a reply with no letter in it', () => {
    expect(() => letterFromReply('I can’t help with that.')).toThrow(/wasn’t a letter/);
    expect(() => letterFromReply('{"title": "x", "body": ""}')).toThrow(/no letter/);
    expect(() => letterFromReply('{"title": "x", "body": "Dear', { truncated: true })).toThrow(/stopped before/);
  });
});

describe('the prompt', () => {
  const valuesCache = { a: { client_name: 'Jordan Reed' } };

  it('names the fields to reuse but never anyone’s details', () => {
    const presets = { practice_name: 'Hope Counseling', practice_phone: '(555) 123-4567', supervisor_name: 'Dr. Lee' };
    const { system, prompt, schema } = buildLetterPrompt({
      instructions: 'A return to work letter',
      library: [{ name: 'employer_name', label: 'Employer', type: 'text' }],
      presets,
      categories: ['Leave'],
      valuesCache,
    });
    expect(system).toMatch(/\{\{they_have\}\}/);
    expect(schema).toBe(LETTER_SCHEMA);
    expect(prompt).toContain('A return to work letter');
    expect(prompt).toContain('- employer_name: Employer (text)');
    expect(prompt).toContain('supervisor_name');
    expect(prompt).toContain('practice_phone');
    expect(prompt).not.toContain('Hope Counseling');
    expect(prompt).not.toContain('555');
    expect(prompt).not.toContain('Dr. Lee');
    expect(prompt).not.toContain('Jordan');
  });

  it('sends the letter being rewritten', () => {
    const { prompt } = buildLetterPrompt({
      mode: 'revise',
      instructions: 'Shorter',
      letter: { title: 'Welcome', body: 'Dear {{client_name}},', fields: [{ name: 'intake_date', type: 'date' }] },
    });
    expect(prompt).toContain('"body": "Dear {{client_name}},"');
    expect(prompt).toContain('Shorter');
    expect(prompt).toContain('- intake_date:');
  });

  it('offers neither {{date}} nor pronouns as fields', () => {
    const names = knownFields().map((f) => f.name);
    expect(names).toContain('client_name');
    expect(names).not.toContain('date');
    expect(names).not.toContain('pronouns');
  });
});

describe('client details in a description', () => {
  const valuesCache = {
    a: { client_name: 'Jordan Reed', practice_name: 'Hope Counseling', telehealth: 'yes', '@pronouns': { 'body:0': 'she' } },
  };
  const presets = { practice_name: 'Hope Counseling', practice_email: 'office@hope.example' };

  it('finds what was typed into a letter, and contact details', () => {
    expect(
      clientDetailsIn('Letter for Jordan, born 3/14/1990, at jordan@mail.com or 555-123-4567', { valuesCache, presets })
    ).toEqual(['Jordan', 'jordan@mail.com', '555-123-4567', '3/14/1990']);
  });

  it('ignores the practice’s own details and ordinary words', () => {
    expect(clientDetailsIn('Use Hope Counseling’s address and office@hope.example. Say yes.', { valuesCache, presets })).toEqual([]);
    expect(clientDetailsIn('A reminder about rescheduling', { valuesCache, presets })).toEqual([]);
  });
});

describe('settings', () => {
  it('fills in defaults and says what is missing', () => {
    const s = normaliseAiSettings({ provider: 'nonsense', models: { ollama: 'llama3.3' } });
    expect(s.provider).toBe('anthropic');
    expect(s.models.anthropic).toBe('claude-opus-5-5');
    expect(s.models.ollama).toBe('llama3.3');
    expect(aiSetupNeeded(s, {})).toMatch(/Claude API key/);
    expect(aiSetupNeeded(s, { anthropic: true })).toBe('');
    expect(aiSetupNeeded({ ...s, provider: 'ollama' }, {})).toBe('');
    expect(aiSetupNeeded({ ...s, provider: 'compatible' }, {})).toMatch(/model/);
    expect(activeAi({ ...s, provider: 'ollama' })).toMatchObject({ baseUrl: 'http://localhost:11434', offComputer: false });
  });

  it('starts each online service on a suggested model and its international site', () => {
    const s = normaliseAiSettings({ provider: 'glm' });
    expect(activeAi(s)).toMatchObject({ model: 'glm-5.3', baseUrl: 'https://api.z.ai/api/paas/v4', offComputer: true });
    const china = normaliseAiSettings({ provider: 'glm', baseUrls: { glm: 'https://open.bigmodel.cn/api/paas/v4' } });
    expect(activeAi(china).baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4');
    expect(activeAi(normaliseAiSettings({ provider: 'deepseek' }))).toMatchObject({ model: 'deepseek-v4-pro', baseUrl: '' });
    expect(aiSetupNeeded(s, {})).toMatch(/GLM API key/);
    expect(aiSetupNeeded(s, { glm: true })).toBe('');
  });
});
