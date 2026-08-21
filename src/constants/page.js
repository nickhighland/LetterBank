/**
 * Physical page geometry, in CSS pixels at 96 DPI.
 *
 * US Letter is 8.5in x 11in => 816 x 1056. These numbers were previously
 * written out by hand in five files (App, LetterDocument, LetterPreview,
 * SettingsModal, useLetterPages), so a change had to be made in five places
 * and could silently disagree between the preview and the export.
 */
export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;

/** Vertical gap between pages on the on-screen stage. */
export const PAGE_GAP = 28;

/** CSS pixels per inch at 96 DPI — the basis for the canvas dimensions above. */
export const PX_PER_INCH = 96;

/** Margins are stored in px but entered in inches, which is how paper is measured. */
export const pxToInches = (px) => Math.round((px / PX_PER_INCH) * 1000) / 1000;
export const inchesToPx = (inches) => Math.round(inches * PX_PER_INCH);

/**
 * The area a letter may occupy, given the calibrated letterhead margins.
 */
export function fillableArea(letterhead) {
  return {
    width: PAGE_WIDTH - (letterhead.leftMargin + letterhead.rightMargin),
    height: PAGE_HEIGHT - (letterhead.topMargin + letterhead.bottomMargin),
  };
}
