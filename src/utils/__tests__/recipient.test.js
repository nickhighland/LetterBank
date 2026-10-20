import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { addressLines, windowLayout, WINDOW_ENVELOPE, dateHeight, marginHidesWindow } from '../recipient';
import { DEFAULT_LETTERHEAD } from '../storage';
import { buildDocx } from '../docxExporter';
import { draftFrom, isDraftDirty } from '../templateDraft';

const lh = (patch = {}) => ({ ...DEFAULT_LETTERHEAD, ...patch });

describe('recipient address', () => {
  it('prints each written line, leaving blank ones out', () => {
    expect(addressLines('Jane Client\n\n  42 Maple St  \nSpringfield, IL 62704\n')).toEqual([
      'Jane Client',
      '42 Maple St',
      'Springfield, IL 62704',
    ]);
    expect(addressLines('')).toEqual([]);
  });

  it('keeps the date above the window when it fits, and the letter below it', () => {
    const layout = windowLayout(lh());
    expect(layout.dateAbove).toBe(true);
    // The letter starts under the window whatever the margin.
    expect(lh().topMargin + layout.header).toBe(WINDOW_ENVELOPE.top + WINDOW_ENVELOPE.height + WINDOW_ENVELOPE.gapAfter);
  });

  it('moves the date below the address when the top margin leaves no room above', () => {
    const page = lh({ topMargin: 200 });
    const layout = windowLayout(page);
    expect(layout.dateAbove).toBe(false);
    expect(layout.header).toBe(layout.toBody + dateHeight(page));
  });

  it('keeps the address inside the window across the page', () => {
    expect(windowLayout(lh({ leftMargin: 48 })).left).toBe(WINDOW_ENVELOPE.minLeft);
    expect(windowLayout(lh({ leftMargin: 90 })).left).toBe(90);
    expect(windowLayout(lh({ leftMargin: 144 })).left).toBe(WINDOW_ENVELOPE.maxLeft);
    expect(windowLayout(lh({ fontSize: 13.5 })).fontSize).toBe(WINDOW_ENVELOPE.maxFontSize);
    expect(windowLayout(lh({ fontSize: 10 })).fontSize).toBe(10);
  });

  it('warns when the top margin starts below the window', () => {
    expect(marginHidesWindow(lh())).toBe(false);
    expect(marginHidesWindow(lh({ topMargin: 240 }))).toBe(true);
  });

  it('is part of a letter’s unsaved changes', () => {
    const template = { id: 't', title: 'Letter', body: 'Hello' };
    expect(isDraftDirty(template, draftFrom(template))).toBe(false);
    expect(isDraftDirty(template, { ...draftFrom(template), recipient: '{{client_name}}' })).toBe(true);
  });
});

describe('recipient address in Word', () => {
  const documentXml = async (letter) => {
    const zip = await JSZip.loadAsync(
      await buildDocx({ renderedBody: 'Dear Jane,\n\nHello.', signature: {}, clinician: {}, ...letter })
    );
    return zip.file('word/document.xml').async('string');
  };

  it('follows the date when printed above the letter', async () => {
    const doc = await documentXml({ recipient: ['Jane Client', '42 Maple St'], letterhead: lh() });
    expect(doc).toMatch(/Jane Client<\/w:t><\/w:r><w:r><w:br\/><\/w:r>.*42 Maple St/);
    expect(doc.indexOf('42 Maple St')).toBeLessThan(doc.indexOf('Dear Jane'));
  });

  it('sits where the window is, in exact lines, and the page no longer centres', async () => {
    const letterhead = lh({ recipientLayout: 'window', verticalCenterSinglePage: true });
    const doc = await documentXml({ recipient: ['Jane Client'], letterhead });
    const top = WINDOW_ENVELOPE.top - letterhead.topMargin - dateHeight(letterhead);
    expect(doc).toContain(`<w:spacing w:before="${Math.round(top * 15)}"`);
    expect(doc).toMatch(/w:lineRule="exact"\/><w:ind w:left="180"/);
    expect(doc).not.toContain('<w:vAlign');
  });

  it('leaves letters without an address as they were', async () => {
    const doc = await documentXml({ letterhead: lh({ recipientLayout: 'window' }) });
    expect(doc).not.toContain('lineRule="exact"');
  });
});
