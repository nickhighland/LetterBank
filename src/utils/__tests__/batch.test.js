import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mergeRecordValues, missingFields, findBatchGaps } from '../batch';
import { batchExportZip } from '../exporter';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
const { saveAs } = await import('file-saver');

describe('mergeRecordValues', () => {
  const presets = { practice_name: 'Highland Therapy', practice_phone: '555-0100', unused: 'x' };
  const variables = ['client_name', 'practice_name', 'practice_phone'];

  it('puts presets under the row so practice fields are not left blank', () => {
    expect(mergeRecordValues({ client_name: 'Alice Adams' }, presets, variables)).toEqual({
      client_name: 'Alice Adams',
      practice_name: 'Highland Therapy',
      practice_phone: '555-0100',
    });
  });

  it('lets a non-empty cell win over the preset, but not an empty one', () => {
    const merged = mergeRecordValues(
      { practice_name: 'Other Practice', practice_phone: '  ' },
      presets,
      variables
    );
    expect(merged.practice_name).toBe('Other Practice');
    expect(merged.practice_phone).toBe('555-0100');
  });

  it('only brings in presets the letter uses', () => {
    expect(mergeRecordValues({}, presets, variables)).not.toHaveProperty('unused');
  });
});

describe('findBatchGaps', () => {
  it('lists each row that would print placeholders, by client name', () => {
    const records = [
      { values: { client_name: 'Alice Adams', intake_date: '2026-10-20' } },
      { values: { client_name: 'Bob Brown' } },
      { values: {} },
    ];
    const gaps = findBatchGaps(records, ['client_name', 'intake_date', 'practice_name'], {
      practice_name: 'Highland Therapy',
    });
    expect(gaps).toEqual([
      { index: 1, label: 'Bob Brown', missing: ['intake_date'] },
      { index: 2, label: 'Row 3', missing: ['client_name', 'intake_date'] },
    ]);
  });

  it('missingFields treats whitespace as empty', () => {
    expect(missingFields(['a', 'b'], { a: ' ', b: 'x' })).toEqual(['a']);
  });
});

describe('batchExportZip', () => {
  beforeEach(() => {
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.document = { fonts: { ready: Promise.resolve() }, getElementById: () => null };
    globalThis.window = {
      electronAPI: {
        isElectron: true,
        renderPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
        saveZip: vi.fn(async () => ({ saved: true })),
      },
    };
  });
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.requestAnimationFrame;
  });

  it('stages each letter from the same row its file is named after', async () => {
    const records = [
      { values: { client_name: 'Carol Clark' } },
      { values: { client_name: 'Dan Davis' } },
    ];
    const staged = [];
    await batchExportZip({
      records,
      templateTitle: 'Medical Leave',
      stageRecord: async (record) => staged.push(record),
    });
    expect(staged).toEqual(records);
  });

  it('does not save the archive anywhere when the save dialog is cancelled', async () => {
    window.electronAPI.saveZip = vi.fn(async () => ({ saved: false }));
    const result = await batchExportZip({
      records: [{ values: { client_name: 'Carol Clark' } }],
      templateTitle: 'Medical Leave',
      stageRecord: async () => {},
    });
    expect(result.saved).toBe(false);
    expect(saveAs).not.toHaveBeenCalled();
  });
});
