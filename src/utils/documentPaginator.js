import { parseBlocks, blocksToHtml } from './letterMarkup';
import { PAGE_BREAK_RE } from './letterBlocks';
import { resolveLetterhead } from './storage';
import { fillableArea } from '../constants/page';
import { addressHtml, dateHeight, inWindow, windowLayout } from './recipient';

/**
 * Document Paginator Engine
 * Accurately measures text chunks and splits clinical letters across letterhead pages
 * to strictly respect printable/fillable boundaries and prevent header/footer collision.
 */

export function paginateDocument({
  blocks: givenBlocks,
  renderedBody = '',
  fillableWidth,
  fillableHeight,
  fontSize = 13.5,
  lineHeight = 1.62,
  fontFamily = 'Source Serif 4',
  paragraphSpacing = 0.9,
  bodyAlignment = 'left',
  showDate = true,
  dateBlockHeight = 35,
  showContinuationHeader = true,
  signatureConfig = {},
  firstPageHeader,
  firstPageHtml = '',
}) {
  const allBlocks = givenBlocks ?? textToBlocks(renderedBody);
  const hasManualBreaks = allBlocks.some((b) => b.kind === 'pagebreak');

  // Calculate signature block height
  let sigHeight = 0;
  if (signatureConfig.showSignature && signatureConfig.url) {
    sigHeight += 80; // max signature image height + margin
  }
  if (signatureConfig.showCredentials) {
    sigHeight += 75; // Name, credentials, title, practice, phone/email
  }
  sigHeight += 25; // padding/margin

  // Page 1 carries the date line (and the address, when there is one);
  // pages 2+ carry the continuation header. Both are optional, and hiding
  // one gives that space back to the body.
  let firstHeaderHeight = firstPageHeader ?? (showDate ? dateBlockHeight : 0);
  const continuationHeaderHeight = showContinuationHeader ? 28 : 0;

  // Create temporary invisible element in DOM to measure exact rendered heights
  const measureEl = document.createElement('div');
  measureEl.style.position = 'fixed';
  measureEl.style.left = '-9999px';
  measureEl.style.top = '-9999px';
  measureEl.style.width = `${fillableWidth}px`;
  measureEl.style.fontFamily = `"${fontFamily}", Georgia, Cambria, serif`;
  measureEl.style.padding = '0';
  measureEl.style.margin = '0';
  measureEl.style.border = '0';
  measureEl.style.contain = 'layout';
  measureEl.style.fontSize = `${fontSize}pt`;
  measureEl.style.lineHeight = `${lineHeight}`;
  measureEl.style.whiteSpace = 'pre-wrap';
  measureEl.style.wordBreak = 'break-word';
  measureEl.style.visibility = 'hidden';
  document.body.appendChild(measureEl);

  try {
    if (firstPageHtml) {
      measureEl.innerHTML = firstPageHtml;
      firstHeaderHeight += measureEl.scrollHeight;
    }
    const singlePageMaxContentHeight = fillableHeight - firstHeaderHeight - sigHeight - 15;

    // Measure total content height, from the same block model the renderer uses.
    measureEl.innerHTML = blocksToHtml(allBlocks, { paragraphSpacing, bodyAlignment });
    const totalContentHeight = measureEl.scrollHeight;

    // If total content + signature fits cleanly on 1 page:
    if (!hasManualBreaks && totalContentHeight <= singlePageMaxContentHeight) {
      return [
        {
          pageNumber: 1,
          blocks: allBlocks,
          isSinglePage: true,
          showSignature: true,
          totalPages: 1,
        },
      ];
    }

    // Otherwise, break into a multi-page layout, one block at a time.
    const paragraphs = allBlocks;
    const pages = [];
    let currentPageChunks = [];
    let currentPageNumber = 1;

    // Available height for Page 1
    let availableHeight = fillableHeight - firstHeaderHeight - 15;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx];

      // ---pagebreak--- always starts a new page, even after an empty one,
      // and a page that overflows still continues onto the next.
      if (paragraph.kind === 'pagebreak') {
        pages.push({
          pageNumber: currentPageNumber,
          blocks: currentPageChunks,
          isSinglePage: false,
          showSignature: false,
        });
        currentPageNumber++;
        currentPageChunks = [];
        availableHeight = fillableHeight - continuationHeaderHeight - 15;
        continue;
      }

      // Measure paragraph height
      measureEl.innerHTML = blocksToHtml([paragraph], { paragraphSpacing, bodyAlignment });
      const pHeight = measureEl.scrollHeight;

      // Check if this paragraph fits on the current page
      if (pHeight <= availableHeight) {
        currentPageChunks.push(paragraph);
        availableHeight -= pHeight;
      } else {
        // Does not fit on current page.
        // If current page already has content, close current page and move this paragraph to next page
        if (currentPageChunks.length > 0) {
          pages.push({
            pageNumber: currentPageNumber,
            blocks: currentPageChunks,
            isSinglePage: false,
            showSignature: false,
          });

          currentPageNumber++;
          currentPageChunks = [];
          // New page available height
          availableHeight = fillableHeight - continuationHeaderHeight - 15;
        }

        // Check if paragraph fits on the fresh page
        if (pHeight <= availableHeight) {
          currentPageChunks.push(paragraph);
          availableHeight -= pHeight;
        } else {
          // A single block taller than a whole page: split it by its own lines,
          // keeping the block's kind, alignment and indent on each fragment.
          const lines = paragraph.items;
          for (let lIdx = 0; lIdx < lines.length; lIdx++) {
            const line = { ...paragraph, items: [lines[lIdx]] };
            measureEl.innerHTML = blocksToHtml([line], { paragraphSpacing, bodyAlignment });
            const lineH = measureEl.scrollHeight;

            if (lineH > availableHeight && currentPageChunks.length > 0) {
              pages.push({
                pageNumber: currentPageNumber,
                blocks: currentPageChunks,
                isSinglePage: false,
                showSignature: false,
              });
              currentPageNumber++;
              currentPageChunks = [];
              availableHeight = fillableHeight - continuationHeaderHeight - 15;
            }

            currentPageChunks.push(line);
            availableHeight -= lineH;
          }
        }
      }
    }

    // Push the last accumulated page chunks
    if (currentPageChunks.length === 0) {
      pages.push({
        pageNumber: currentPageNumber,
        blocks: [],
        isSinglePage: false,
        showSignature: true,
      });
    } else {
      // Check if signature fits on this final page
      if (availableHeight < sigHeight && currentPageChunks.length > 1) {
        // If signature doesn't fit, pop the last chunk to a new page or push signature to next page
        const lastChunk = currentPageChunks.pop();
        pages.push({
          pageNumber: currentPageNumber,
          blocks: currentPageChunks,
          isSinglePage: false,
          showSignature: false,
        });
        currentPageNumber++;
        pages.push({
          pageNumber: currentPageNumber,
          blocks: [lastChunk],
          isSinglePage: false,
          showSignature: true,
        });
      } else {
        pages.push({
          pageNumber: currentPageNumber,
          blocks: currentPageChunks,
          isSinglePage: false,
          showSignature: true,
        });
      }
    }

    // Update totalPages count on all pages
    const totalPages = pages.length;
    return pages.map((p) => ({ ...p, totalPages }));
  } finally {
    document.body.removeChild(measureEl);
  }
}



/**
 * Paginate a letter from its document settings.
 *
 * The preview and batch export used to each build the paginator's arguments
 * themselves, and batch export left out the date block's real height, so a
 * clinician who enlarged the date got batch PDFs that broke pages in different
 * places from the preview. Both now come through here.
 */
export function paginateLetter({
  blocks,
  renderedBody,
  letterhead: rawLetterhead,
  signature,
  recipient = [],
}) {
  const letterhead = resolveLetterhead(rawLetterhead);
  const { width: fillableWidth, height: fillableHeight } = fillableArea(letterhead);

  // The address takes a fixed slice of page 1 in a window envelope, and its
  // own height above the letter otherwise.
  const address = recipient.length
    ? inWindow(letterhead, recipient)
      ? { firstPageHeader: windowLayout(letterhead).header }
      : { firstPageHtml: addressHtml(recipient, letterhead.paragraphSpacing) }
    : {};

  const pages = paginateDocument({
    blocks,
    renderedBody,
    fillableWidth,
    fillableHeight,
    fontSize: letterhead.fontSize,
    lineHeight: letterhead.lineHeight,
    fontFamily: letterhead.fontFamily,
    paragraphSpacing: letterhead.paragraphSpacing,
    bodyAlignment: letterhead.bodyAlignment,
    showDate: letterhead.showDate,
    // Reserve what the date actually occupies, so changing its size or
    // spacing repaginates instead of silently overflowing.
    dateBlockHeight: dateHeight(letterhead),
    showContinuationHeader: letterhead.showContinuationHeader,
    signatureConfig: signature,
    ...address,
  });

  // Page 1 carries the address, so every renderer of the pages prints it.
  return recipient.length ? pages.map((p) => (p.pageNumber === 1 ? { ...p, recipient } : p)) : pages;
}

/**
 * Blocks from a rendered body, for callers that have only the text:
 * ---pagebreak--- becomes a { kind: 'pagebreak' } between sections.
 */
export function textToBlocks(renderedBody) {
  const sections = String(renderedBody || '').split(PAGE_BREAK_RE);
  if (sections.length === 1) return parseBlocks(sections[0]);
  return sections.flatMap((section, i) => [
    ...(i > 0 ? [{ kind: 'pagebreak' }] : []),
    ...parseBlocks(section.trim()),
  ]);
}
