import { parseBlocks, blocksToHtml } from './letterMarkup';

/**
 * Document Paginator Engine
 * Accurately measures text chunks and splits clinical letters across letterhead pages
 * to strictly respect printable/fillable boundaries and prevent header/footer collision.
 */

export function paginateDocument({
  renderedBody,
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
  clinician = {},
  clientName = '',
}) {
  // Check for explicit manual pagebreaks
  const manualSections = renderedBody.split(/---pagebreak---|\[\[page\]\]/i);

  // If user used explicit pagebreaks, respect them
  if (manualSections.length > 1) {
    return manualSections.map((sec, idx) => ({
      pageNumber: idx + 1,
      blocks: parseBlocks(sec.trim()),
      isSinglePage: false,
      showSignature: idx === manualSections.length - 1,
      totalPages: manualSections.length,
    }));
  }

  // Calculate signature block height
  let sigHeight = 0;
  if (signatureConfig.showSignature && signatureConfig.url) {
    sigHeight += 80; // max signature image height + margin
  }
  if (signatureConfig.showCredentials) {
    sigHeight += 75; // Name, credentials, title, practice, phone/email
  }
  sigHeight += 25; // padding/margin

  // Page 1 carries the date line; pages 2+ carry the continuation header.
  // Both are optional, and hiding one gives that space back to the body.
  const dateHeaderHeight = showDate ? dateBlockHeight : 0;
  const continuationHeaderHeight = showContinuationHeader ? 28 : 0;

  // Single page capacity
  const singlePageMaxContentHeight = fillableHeight - dateHeaderHeight - sigHeight - 15;

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
    // Measure total content height, from the same block model the renderer uses.
    const allBlocks = parseBlocks(renderedBody);
    measureEl.innerHTML = blocksToHtml(allBlocks, { paragraphSpacing, bodyAlignment });
    const totalContentHeight = measureEl.scrollHeight;

    // If total content + signature fits cleanly on 1 page:
    if (totalContentHeight <= singlePageMaxContentHeight) {
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
    let availableHeight = fillableHeight - dateHeaderHeight - 15;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx];

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
    if (currentPageChunks.length > 0) {
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


