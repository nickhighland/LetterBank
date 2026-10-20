import { describe, it, expect } from 'vitest';
import { evaluateConditions, parseCondition, describeConditions } from '../conditions';
import { pronounValues, normalisePronouns } from '../pronouns';
import {
  allLetterFields,
  letterFieldsInUse,
  resolveFieldDefs,
  renderLetter,
  normaliseFieldValue,
  normaliseFieldLibrary,
  needsValue,
  typesOf,
} from '../fieldDefs';

const LETTER = [
  'Dear {{client_name}},',
  '',
  '[[if telehealth]]',
  'We will meet by video at {{video_link}}.',
  '[[else]]',
  'We will meet at {{office_address}}.',
  '[[end]]',
  '',
  'Sincerely,',
].join('\n');

describe('optional wording', () => {
  it('keeps one branch and one blank line either way', () => {
    expect(evaluateConditions(LETTER, { telehealth: 'yes' }).text).toBe(
      'Dear {{client_name}},\n\nWe will meet by video at {{video_link}}.\n\nSincerely,'
    );
    expect(evaluateConditions(LETTER, { telehealth: 'no' }).text).toBe(
      'Dear {{client_name}},\n\nWe will meet at {{office_address}}.\n\nSincerely,'
    );
  });

  it('drops a whole paragraph without leaving a gap', () => {
    const text = 'One.\n\n[[if extra]]\nTwo.\n[[end]]\n\nThree.';
    expect(evaluateConditions(text, {}).text).toBe('One.\n\nThree.');
    expect(evaluateConditions(text, { extra: 'yes' }).text).toBe('One.\n\nTwo.\n\nThree.');
  });

  it('works inline, nested, and with comparisons', () => {
    const text = 'We meet [[if platform = Zoom]]on Zoom[[else]]in person[[if parking]], parking free[[end]][[end]].';
    expect(evaluateConditions(text, { platform: 'zoom' }).text).toBe('We meet on Zoom.');
    expect(evaluateConditions(text, { platform: 'Office' }).text).toBe('We meet in person.');
    expect(evaluateConditions(text, { parking: 'yes' }).text).toBe('We meet in person, parking free.');
    expect(parseCondition('not telehealth')).toEqual({ name: 'telehealth', op: 'set', negate: true });
    expect(parseCondition('platform != "Doxy"')).toMatchObject({ value: 'Doxy', negate: true });
  });

  it('lists only the fields the chosen wording uses', () => {
    expect(evaluateConditions(LETTER, { telehealth: 'no' }).names).toEqual([
      'client_name',
      'telehealth',
      'office_address',
    ]);
    expect(allLetterFields(LETTER)).toEqual(['client_name', 'telehealth', 'video_link', 'office_address']);
  });

  it('describes how each condition field is used', () => {
    const found = describeConditions('[[if a]]x[[end]] [[if b = One]]y[[end]] [[if b = Two]]z[[end]]');
    expect(found.get('a')).toEqual({ set: true, values: [] });
    expect(found.get('b')).toEqual({ set: false, values: ['One', 'Two'] });
  });
});

describe('pronouns', () => {
  it('fills every pronoun placeholder, capitalised where asked', () => {
    const text = '{{They_are}} doing well. I spoke with {{them}} about {{their}} goals; {{they}} chose them {{themselves}}.';
    expect(renderLetter(text, { pronouns: 'she/her' })).toBe(
      'She is doing well. I spoke with her about her goals; she chose them herself.'
    );
    expect(renderLetter(text, {})).toBe(
      'They are doing well. I spoke with them about their goals; they chose them themselves.'
    );
    expect(pronounValues('He').their).toBe('his');
  });

  it('shows one Pronouns field for all of them', () => {
    expect(letterFieldsInUse('{{They}} said {{they_were}} fine.', {})).toEqual(['pronouns']);
    expect(normalisePronouns('Her')).toBe('she/her');
    expect(normalisePronouns('')).toBe('');
  });
});

describe('field definitions', () => {
  const library = normaliseFieldLibrary([
    { name: 'platform', label: 'Telehealth platform', type: 'select', options: 'Zoom\nDoxy\nZoom' },
    { name: 'pronouns', type: 'text' },
    { name: '' },
  ]);

  it('keeps a clean library', () => {
    expect(library).toEqual([
      { name: 'platform', label: 'Telehealth platform', type: 'select', help: '', options: ['Zoom', 'Doxy'] },
    ]);
  });

  it('resolves library, letter, built-in, then a guess', () => {
    const text = '{{platform}} {{intake_date}} {{client_dob}} {{notes}} [[if telehealth]]x[[end]] [[if room = A]]y[[end]]';
    const defs = resolveFieldDefs(['platform', 'intake_date', 'client_dob', 'notes', 'telehealth', 'room', 'pronouns'], {
      text,
      library,
      templateFields: [{ name: 'intake_date', label: 'Intake', type: 'text' }],
    });
    expect(defs.platform).toMatchObject({ type: 'select', options: ['Zoom', 'Doxy'], source: 'library' });
    expect(defs.intake_date).toMatchObject({ type: 'text', label: 'Intake', source: 'letter' });
    expect(defs.client_dob).toMatchObject({ type: 'date', source: 'built-in' });
    expect(defs.notes.type).toBe('textarea');
    expect(defs.telehealth.type).toBe('yesno');
    expect(defs.room).toMatchObject({ type: 'select', options: ['A'] });
    expect(defs.pronouns.options).toEqual(['they/them', 'she/her', 'he/him']);
  });

  it('prints Yes/No answers and treats an unticked box as answered', () => {
    const defs = resolveFieldDefs(['telehealth'], {
      text: '{{telehealth}}',
      library: [{ name: 'telehealth', type: 'yesno' }],
    });
    expect(renderLetter('Video: {{telehealth}}', {}, typesOf(defs))).toBe('Video: No');
    expect(needsValue(defs.telehealth, '')).toBe(false);
    expect(needsValue({ type: 'text' }, ' ')).toBe(true);
  });

  it('reads spreadsheet values the way each picker holds them', () => {
    expect(normaliseFieldValue('TRUE', 'yesno')).toBe('yes');
    expect(normaliseFieldValue('No', 'yesno')).toBe('no');
    expect(normaliseFieldValue('10/22/2026', 'date')).toBe('2026-10-22');
    expect(normaliseFieldValue('He/Him', 'select', 'pronouns')).toBe('he/him');
  });
});
