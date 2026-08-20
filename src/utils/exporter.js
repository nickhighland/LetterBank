import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Export pipeline — 100% local, no network, no rasterisation.
 *
 * Everything (screen preview, print, PDF) renders the same DOM inside
 * #print-root and is driven by the same `@media print` stylesheet.
 *
 * Desktop: Chromium's printToPDF emits real vector text.
 * Web:     window.print() and the browser's own "Save as PDF".
 *
 * The old pipeline (html2canvas -> jsPDF) is gone. It rasterised at 192 DPI,
 * could not render mix-blend-mode signatures, and threw
 * `Attempting to parse an unsupported color function "oklch"` on every single
 * export once Tailwind v4 landed.
 */

export const isDesktop = () =>
  typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

export function sanitizeFilename(str, fallback = 'Letter') {
  const clean = String(str || '')
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '_');
  return clean || fallback;
}

export function buildLetterFilename(clientName, templateTitle) {
  const who = sanitizeFilename(clientName, 'Letter');
  const what = sanitizeFilename(templateTitle, 'Document');
  const when = new Date().toISOString().slice(0, 10);
  return `${who}_${what}_${when}.pdf`;
}

/**
 * Resolve once the browser has actually painted the staged document AND all
 * webfonts + images inside it are ready. Without the font wait, a cold export
 * can capture Georgia metrics instead of Source Serif 4.
 */
export function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function waitForStageReady(root) {
  await nextPaint();

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const el = root || document.getElementById('print-root');
  if (el) {
    const images = Array.from(el.querySelectorAll('img'));
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener('load', res, { once: true });
              img.addEventListener('error', res, { once: true });
            })
      )
    );
  }

  await nextPaint();
}

/**
 * Save the currently staged document as a PDF.
 * Returns { saved, method, filePath? }.
 */
export async function exportStagedPdf(filename) {
  await waitForStageReady();

  if (isDesktop()) {
    const result = await window.electronAPI.savePdf(filename);
    return { ...result, method: 'native' };
  }

  // Browser: the print dialog's "Save as PDF" destination produces the same
  // vector output. No silent download is possible without a rasteriser.
  window.print();
  return { saved: true, method: 'print-dialog' };
}

/**
 * Send the currently staged document to a printer.
 */
export async function printStaged() {
  await waitForStageReady();

  if (isDesktop()) {
    return window.electronAPI.printLetter();
  }

  window.print();
  return { success: true };
}

/**
 * Batch: caller stages each record in turn via `stageRecord(index)`, which must
 * resolve once that record's pages are committed to #print-root.
 *
 * Desktop only — the browser cannot produce PDF bytes without a print dialog
 * per document, so the web build offers per-record export instead.
 */
export async function batchExportZip({
  records,
  templateTitle,
  stageRecord,
  onProgress,
}) {
  if (!isDesktop()) {
    throw new Error(
      'Batch ZIP export requires the LetterBank desktop app. In the browser, ' +
        'use the record navigator to export letters one at a time.'
    );
  }

  const zip = new JSZip();
  const folder = zip.folder('LetterBank_Batch_Letters');
  const total = records.length;
  const usedNames = new Map();

  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total, `Rendering letter ${i + 1} of ${total}…`);

    await stageRecord(i);
    await waitForStageReady();

    const bytes = await window.electronAPI.renderPdf();

    const base = `${sanitizeFilename(
      records[i].values?.client_name,
      `Record_${i + 1}`
    )}_${sanitizeFilename(templateTitle, 'Letter')}`;

    // Two clients with the same name must not overwrite each other.
    const seen = usedNames.get(base) || 0;
    usedNames.set(base, seen + 1);
    const filename = seen === 0 ? `${base}.pdf` : `${base}_${seen + 1}.pdf`;

    folder.file(filename, bytes);
  }

  onProgress?.(total, total, 'Compressing archive…');

  const zipName = `LetterBank_${sanitizeFilename(templateTitle, 'Batch')}_${new Date()
    .toISOString()
    .slice(0, 10)}.zip`;

  const blob = await zip.generateAsync({ type: 'blob' });
  const buffer = await blob.arrayBuffer();

  const result = await window.electronAPI.saveZip(zipName, new Uint8Array(buffer));
  if (!result.saved) {
    // User cancelled the native dialog — fall back to a normal download so the
    // work isn't thrown away.
    saveAs(blob, zipName);
  }

  return result;
}
