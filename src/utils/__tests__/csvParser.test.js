import { describe, it, expect } from 'vitest';
import { autoMapHeaders, generateMergedRecords, parseCsvString } from '../csvParser';
import { normalizeDate, normalizeTime } from '../variableParser';

const VARS = ['client_name', 'client_dob', 'intake_date', 'practice_name', 'practice_phone', 'practice_email'];

describe('autoMapHeaders', () => {
  it('maps an EHR client list without touching practice fields', () => {
    expect(autoMapHeaders(['Client', 'DOB', 'Email', 'Phone'], VARS)).toEqual({
      client_name: 'Client',
      client_dob: 'DOB',
      intake_date: '',
      practice_name: '',
      practice_phone: '',
      practice_email: '',
    });
  });

  it('never maps a generic Name column to the practice name, or a # column to anything', () => {
    const mapping = autoMapHeaders(['Name', 'Date of Birth', '#'], VARS);
    expect(mapping.client_name).toBe('Name');
    expect(mapping.client_dob).toBe('Date of Birth');
    expect(mapping.practice_name).toBe('');
    expect(Object.values(mapping)).not.toContain('#');
  });

  it('prefers an exact header over an alias', () => {
    const mapping = autoMapHeaders(['Name', 'client_name'], ['client_name']);
    expect(mapping.client_name).toBe('client_name');
  });

  it('joins First Name and Last Name when the letter wants a full name', () => {
    const mapping = autoMapHeaders(['First Name', 'Last Name'], ['client_name']);
    const [record] = generateMergedRecords([{ 'First Name': 'Jane', 'Last Name': 'Doe' }], mapping);
    expect(record.values.client_name).toBe('Jane Doe');
  });
});

describe('dates and times from a CSV', () => {
  it('normalises the ways spreadsheets write dates', () => {
    expect(normalizeDate('10/22/2026')).toBe('2026-10-22');
    expect(normalizeDate('1/5/26')).toBe('2026-01-05');
    expect(normalizeDate('2026/10/22')).toBe('2026-10-22');
    expect(normalizeDate('Oct 22, 2026')).toBe('2026-10-22');
    expect(normalizeDate('22 October 2026')).toBe('2026-10-22');
    expect(normalizeDate('02/31/2026')).toBe('02/31/2026');
    expect(normalizeDate('24 hours before')).toBe('24 hours before');
  });

  it('normalises 12-hour times for the time picker', () => {
    expect(normalizeTime('2:30 PM')).toBe('14:30');
    expect(normalizeTime('9am')).toBe('09:00');
    expect(normalizeTime('12:15 a.m.')).toBe('00:15');
    expect(normalizeTime('9:05')).toBe('09:05');
  });

  it('applies to date fields only', async () => {
    const csv = 'client_name,client_dob,notes\nJane Doe,4/7/1990,10/22/2026';
    const { records } = await parseCsvString(csv, ['client_name', 'client_dob', 'notes']);
    expect(records[0].values).toEqual({
      client_name: 'Jane Doe',
      client_dob: '1990-04-07',
      notes: '10/22/2026',
    });
  });
});
