import { describe, it, expect } from 'vitest';
import { createBackup, readBackupFile, lettersToAdd, BACKUP_FORMAT } from '../backup';

const letter = (id, body = `Body of ${id}`) => ({ id, title: id, category: 'General', subject: '', body, fields: [] });

describe('createBackup', () => {
  it('carries settings and embedded images, and nothing else', async () => {
    const backup = await createBackup({
      templates: [letter('a')],
      presetProfiles: { activeId: 'p', profiles: [{ id: 'p', name: 'Practice', values: {} }] },
      letterhead: { url: 'data:image/png;base64,AAAA', showLetterhead: true },
      theme: 'dark',
      valuesCache: { a: { client_name: 'Jane Client' } },
    });
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(Object.keys(backup.settings).sort()).toEqual(['letterhead', 'presetProfiles', 'templates', 'theme']);
    expect(backup.settings.letterhead.url).toBe('data:image/png;base64,AAAA');
    expect(JSON.stringify(backup)).not.toContain('Jane Client');
  });
});

describe('readBackupFile', () => {
  it('reads an older letters-only backup', () => {
    const result = readBackupFile(JSON.stringify([letter('a'), { broken: true }]));
    expect(result.kind).toBe('letters');
    expect(result.templates.map((t) => t.id)).toEqual(['a']);
  });

  it('reads a full backup and fills in anything missing or damaged', () => {
    const result = readBackupFile(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        createdAt: '2026-10-19T12:00:00.000Z',
        settings: { templates: [letter('a')], theme: 'neon', clinician: 'nonsense' },
      })
    );
    expect(result.kind).toBe('full');
    expect(result.settings.theme).toBe('system');
    expect(result.settings.presetProfiles.profiles).toHaveLength(1);
    expect(typeof result.settings.clinician).toBe('object');
    expect(result.settings.letterhead).toHaveProperty('topMargin');
  });

  it('turns away files that are not backups', () => {
    expect(() => readBackupFile('not json')).toThrow(/not a LetterBank backup/);
    expect(() => readBackupFile('{"hello": 1}')).toThrow(/not a LetterBank backup/);
    expect(() => readBackupFile('[]')).toThrow(/no letters/);
  });

  it('asks for an update before restoring a newer format', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 99, settings: { templates: [letter('a')] } });
    expect(() => readBackupFile(text)).toThrow(/newer version/);
  });
});

describe('lettersToAdd', () => {
  it('skips letters already in the library and copies ones whose id is taken', () => {
    const existing = [letter('a'), letter('b')];
    const imported = [letter('a'), letter('b', 'Changed elsewhere'), letter('c')];
    const added = lettersToAdd(existing, imported, (i) => `copy-${i}`);
    expect(added.map((t) => t.id)).toEqual(['copy-1', 'c']);
    expect(added[0].body).toBe('Changed elsewhere');
    expect(lettersToAdd([...existing, ...added], imported)).toEqual([]);
  });
});
