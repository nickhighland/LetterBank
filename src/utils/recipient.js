import { inlineToHtml } from './letterMarkup';

/**
 * The recipient's address on page 1: above the letter, or where a #10
 * window envelope shows it (Settings › Letterhead › Page furniture).
 *
 * A letter's address is part of its template (Editor › Recipient address),
 * written with fields like the rest of the letter, so what fills it is
 * typed in Quick Fill and erased with the other client details.
 */

/**
 * A #10 window envelope is 4⅛ × 9½ in, with a 1⅛ × 4½ in window ⅞ in from
 * the left and ½ in from the bottom. Folded in three, the letter's top panel
 * faces the window, and sits between the bottom of the envelope and the top.
 *
 * Positions are px on the 816 × 1056 page from its top-left corner. The
 * address starts 2¼ in down, which keeps four lines in the window whether
 * the folded letter settles at the bottom or rides up a little, and at least
 * ⅞ in in, which keeps it clear of the window's edge when the letter slides
 * sideways in the envelope.
 */
export const WINDOW_ENVELOPE = {
  top: 216, // 2¼ in
  height: 84, // ⅞ in: four lines
  minLeft: 84, // ⅞ in
  maxLeft: 96, // 1 in
  width: 312, // 3¼ in
  maxFontSize: 12, // pt: larger and four lines no longer fit the window
  lineHeight: 1.2,
  gapAfter: 24, // between the window and the letter's first line
};

/** Line height of an address printed above the letter. */
export const ADDRESS_LINE_HEIGHT = 1.3;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** The address as the lines it prints, with blank lines left out. */
export function addressLines(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The height page 1 keeps for the date line. */
export function dateHeight(lh) {
  if (!lh.showDate) return 0;
  return (lh.fontSize + lh.dateSize) * 1.6 + lh.dateSpaceBefore + lh.dateSpaceAfter;
}

/** True when this page shows its address in the envelope window. */
export const inWindow = (lh, lines) => lines?.length > 0 && lh.recipientLayout === 'window';

/**
 * Page 1 laid out for a window envelope. The address sits at a fixed place
 * on the paper; the date stays above it when there is room, otherwise it
 * moves just below; the letter starts under the window.
 *
 *   left, fontSize   where the address prints, and how large
 *   dateAbove        whether the date fits above the window
 *   toBody           from the top margin to where the window area ends
 *   header           everything above the letter's first line on page 1
 */
export function windowLayout(lh) {
  const W = WINDOW_ENVELOPE;
  const date = dateHeight(lh);
  const toBody = Math.max(0, W.top + W.height + W.gapAfter - lh.topMargin);
  const dateAbove = lh.topMargin + date <= W.top - 8;
  return {
    left: clamp(lh.leftMargin, W.minLeft, W.maxLeft),
    fontSize: Math.min(lh.fontSize, W.maxFontSize),
    dateAbove,
    toBody,
    header: dateAbove ? toBody : toBody + date,
  };
}

/** True when the top margin reaches into the envelope window. */
export const marginHidesWindow = (lh) => lh.topMargin > WINDOW_ENVELOPE.top;

/**
 * An address printed above the letter, as the paginator measures it. Must
 * match the address in LetterDocument.
 */
export function addressHtml(lines, paragraphSpacing) {
  return (
    `<div style="line-height:${ADDRESS_LINE_HEIGHT};margin-bottom:${paragraphSpacing}em">` +
    `${lines.map(inlineToHtml).join('<br/>')}</div>`
  );
}
