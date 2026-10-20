import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { parseBlocks, parseInline } from './letterMarkup';
import { formatLetterDate, renderContinuationHeader } from './variableParser';
import { resolveLetterhead } from './storage';
import { resolveSignatureTokens } from '../components/LetterDocument';
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants/page';
import { ADDRESS_LINE_HEIGHT, WINDOW_ENVELOPE, dateHeight, inWindow, windowLayout } from './recipient';
import { isDesktop } from './exporter';

/**
 * Word (.docx) export — built locally with JSZip, no network and no extra
 * dependency.
 *
 * PDF is a picture of the letter; Word is for a letter that someone still
 * needs to edit (a recipient's own form, a last-minute wording change). So
 * this writes real, editable Word structure rather than an image of the page:
 *
 *   - body paragraphs, bullets, numbered lists, bold/italic/underline,
 *     alignment and indents from the letter markup
 *   - the date line and recipient address on page 1, and the signature
 *     block (with its image)
 *   - the letterhead artwork as a full-page image behind the text, in the
 *     page header so it repeats on every page
 *   - the "RE: <subject>  Page X of Y" header from page 2 onward, using
 *     Word's own page fields so it stays right if the letter is edited
 *   - margins, typeface, size, line height and paragraph spacing from
 *     Document setup
 *
 * Word lays the text out itself, so its page breaks can land a line or two
 * away from the preview's — explicit ---pagebreak--- breaks are kept.
 */

const TWIPS_PER_PX = 15; // 1px = 1/96in, 1 twip = 1/1440in
const EMU_PER_PX = 9525;
const BODY_COLOR = '16202E';
const MUTED_COLOR = '55606F';

const twips = (px) => Math.round(px * TWIPS_PER_PX);
const emu = (px) => Math.round(px * EMU_PER_PX);
const halfPoints = (pt) => Math.max(2, Math.round(pt * 2));

const JC = { left: 'left', center: 'center', right: 'right', justify: 'both' };

// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function xml(text) {
  return String(text ?? '')
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Runs and paragraphs ---------------------------------------------------

function runProps({ font, size, color, bold, italic, underline }) {
  return (
    '<w:rPr>' +
    (font ? `<w:rFonts w:ascii="${xml(font)}" w:hAnsi="${xml(font)}" w:cs="${xml(font)}"/>` : '') +
    (bold ? '<w:b/>' : '') +
    (italic ? '<w:i/>' : '') +
    (color ? `<w:color w:val="${color}"/>` : '') +
    (size ? `<w:sz w:val="${halfPoints(size)}"/><w:szCs w:val="${halfPoints(size)}"/>` : '') +
    // Schema order matters to Word: <w:u> comes after the size elements.
    (underline ? '<w:u w:val="single"/>' : '') +
    '</w:rPr>'
  );
}

function textRun(text, props = {}) {
  return `<w:r>${runProps(props)}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

/** A line of letter markup as runs, honouring **bold**, *italic*, __underline__. */
function inlineRuns(line, base) {
  return parseInline(line)
    .map((run) => textRun(run.text, { ...base, ...run }))
    .join('');
}

function paragraph(content, {
  align,
  before = 0,
  after = 0,
  line,
  exact,
  indentLeft = 0,
  indentRight = 0,
  hanging = 0,
  markSize,
  keepNext = false,
  pageBreakBefore = false,
  extra = '',
} = {}) {
  const pPr =
    '<w:pPr>' +
    (keepNext ? '<w:keepNext/><w:keepLines/>' : '') +
    (pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
    extra +
    `<w:spacing w:before="${Math.round(before)}" w:after="${Math.round(after)}"` +
    (line ? ` w:line="${Math.round(line * 240)}" w:lineRule="auto"` : '') +
    // An exact line height in twips: what puts a window address where the window is.
    (exact ? ` w:line="${Math.max(1, Math.round(exact))}" w:lineRule="exact"` : '') +
    '/>' +
    (indentLeft || indentRight || hanging
      ? `<w:ind w:left="${Math.round(indentLeft)}" w:right="${Math.round(indentRight)}"` +
        (hanging ? ` w:hanging="${Math.round(hanging)}"` : '') +
        '/>'
      : '') +
    (align ? `<w:jc w:val="${JC[align] || 'left'}"/>` : '') +
    // Paragraph-mark size: lets an image-only header line take next to no height.
    (markSize ? `<w:rPr><w:sz w:val="${markSize}"/><w:szCs w:val="${markSize}"/></w:rPr>` : '') +
    '</w:pPr>';
  return `<w:p>${pPr}${content}</w:p>`;
}

// ---- Images ----------------------------------------------------------------

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

/**
 * Any image the app can show (PNG, JPEG, SVG, data: or bundled URL) as PNG
 * bytes. Word does not take SVG on its own, so everything goes through a
 * canvas, drawn at 2x the size it occupies on the page so it stays crisp.
 */
async function imageToPng(url, widthPx, heightPx) {
  const img = await loadImage(url);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx * scale));
  canvas.height = Math.max(1, Math.round(heightPx * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not convert image');
  return new Uint8Array(await blob.arrayBuffer());
}

async function naturalSize(url) {
  const img = await loadImage(url);
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

let drawingId = 1;

function drawingXml({ relId, widthPx, heightPx, name, anchorFullPage = false }) {
  const id = drawingId++;
  const cx = emu(widthPx);
  const cy = emu(heightPx);
  const graphic =
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic>';

  if (anchorFullPage) {
    return (
      '<w:r><w:drawing>' +
      '<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" ' +
      'behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1">' +
      '<wp:simplePos x="0" y="0"/>' +
      '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>' +
      '<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>' +
      `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:wrapNone/><wp:docPr id="${id}" name="${xml(name)}"/><wp:cNvGraphicFramePr/>` +
      graphic +
      '</wp:anchor></w:drawing></w:r>'
    );
  }

  return (
    '<w:r><w:drawing>' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="${xml(name)}"/><wp:cNvGraphicFramePr/>` +
    graphic +
    '</wp:inline></w:drawing></w:r>'
  );
}

// ---- Fields ----------------------------------------------------------------

function fieldRuns(instr, props) {
  return (
    `<w:r>${runProps(props)}<w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r>${runProps(props)}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>` +
    `<w:r>${runProps(props)}<w:fldChar w:fldCharType="separate"/></w:r>` +
    textRun('1', props) +
    `<w:r>${runProps(props)}<w:fldChar w:fldCharType="end"/></w:r>`
  );
}

const pageXofY = (props) =>
  textRun('Page ', props) + fieldRuns('PAGE', props) + textRun(' of ', props) + fieldRuns('NUMPAGES', props);

// ---- Package parts ---------------------------------------------------------

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

function relsXml(rels) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join('') +
    '</Relationships>'
  );
}

function stylesXml({ font, size, line }) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:styles ${NS}>` +
    '<w:docDefaults><w:rPrDefault>' +
    runProps({ font, size, color: BODY_COLOR }) +
    '</w:rPrDefault><w:pPrDefault><w:pPr>' +
    `<w:spacing w:before="0" w:after="0" w:line="${Math.round(line * 240)}" w:lineRule="auto"/>` +
    '</w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '</w:styles>'
  );
}

const SETTINGS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  `<w:settings ${NS}>` +
  '<w:defaultTabStop w:val="720"/>' +
  '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
  '</w:settings>';

function coreXml(title) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${xml(title)}</dc:title><dc:creator>LetterBank</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
}

function contentTypesXml(parts) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    parts.map(([name, type]) => `<Override PartName="${name}" ContentType="${type}"/>`).join('') +
    '</Types>'
  );
}

const WML = 'application/vnd.openxmlformats-officedocument.wordprocessingml';

// ---- Letter ----------------------------------------------------------------

function bodyParagraphs(renderedBody, lh) {
  const base = { font: lh.fontFamily, size: lh.fontSize, color: BODY_COLOR };
  const after = lh.paragraphSpacing * lh.fontSize * 20; // em -> twips
  const sections = renderedBody.split(/---pagebreak---|\[\[page\]\]/i);
  const out = [];

  sections.forEach((section, sIdx) => {
    let first = sIdx > 0;
    parseBlocks(section.trim()).forEach((block) => {
      const align = block.align || lh.bodyAlignment;
      const pad = block.indent * 32;
      const pageBreakBefore = first;
      first = false;

      if (block.kind === 'paragraph') {
        const content = block.items
          .map((line, i) => (i > 0 ? '<w:r><w:br/></w:r>' : '') + inlineRuns(line, base))
          .join('');
        out.push(
          paragraph(content, {
            align,
            after,
            line: lh.lineHeight,
            indentLeft: twips(pad),
            pageBreakBefore,
          })
        );
        return;
      }

      const items = block.items.filter((t) => t.trim() !== '');
      items.forEach((item, i) => {
        const marker = block.kind === 'numbers' ? `${i + 1}.` : '•';
        out.push(
          paragraph(textRun(`${marker}\t`, base) + inlineRuns(item, base), {
            align,
            after: i === items.length - 1 ? after : lh.fontSize * 0.25 * 20,
            line: lh.lineHeight,
            indentLeft: twips(pad + 24),
            hanging: twips(20),
            pageBreakBefore: pageBreakBefore && i === 0,
          })
        );
      });
    });
  });

  return out;
}

async function signatureParagraphs(signature, clinician, lh, addImage) {
  const align = signature.alignment || 'left';
  const font = lh.fontFamily;
  const out = [];

  const imagePara = async () => {
    if (!signature.showSignature || !signature.url) return null;
    try {
      const size = await naturalSize(signature.url);
      let w = signature.width || 180;
      let h = size.width ? (w * size.height) / size.width : 60;
      if (h > 75) {
        w = (w * 75) / h;
        h = 75;
      }
      const relId = await addImage(signature.url, w, h);
      return paragraph(drawingXml({ relId, widthPx: w, heightPx: h, name: 'Signature' }), {
        align,
        before: twips(6),
        after: twips(6),
        keepNext: true,
      });
    } catch {
      return null; // a missing signature image must not block the export
    }
  };

  if (signature.customBlockText) {
    const props = { font, size: lh.fontSize - 1.5, color: BODY_COLOR };
    const lines = signature.customBlockText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const opts = { align, line: 1.4, keepNext: i < lines.length - 1, before: i === 0 ? twips(18) : 0 };
      if (line.includes('{{signature_image}}') || line.includes('[SIGNATURE_IMAGE]')) {
        const img = await imagePara();
        if (img) out.push(img);
        continue;
      }
      const text = resolveSignatureTokens(line, clinician);
      out.push(paragraph(text ? textRun(text, props) : '', opts));
    }
    return out;
  }

  const img = await imagePara();
  if (img) out.push(img);
  if (signature.showCredentials) {
    const name = `${clinician.name || ''}${clinician.credentials ? `, ${clinician.credentials}` : ''}`;
    const contact = `${clinician.practiceName || ''}${clinician.phone ? ` • ${clinician.phone}` : ''}`;
    out.push(paragraph(textRun(name, { font, size: 12.5, bold: true, color: '101A27' }), { align, keepNext: true, before: img ? 0 : twips(18) }));
    out.push(paragraph(textRun(clinician.title || '', { font, size: 10.5, color: '3F4A5C' }), { align, keepNext: true }));
    out.push(paragraph(textRun(contact, { font, size: 9.5, color: MUTED_COLOR }), { align }));
  }
  return out;
}

/**
 * Build the .docx bytes for the open letter.
 */
export async function buildDocx({
  renderedBody,
  pageCount = 1,
  letterhead: rawLetterhead,
  signature,
  clinician,
  subject,
  clientName,
  letterDate,
  recipient = [],
}) {
  drawingId = 1;
  const lh = resolveLetterhead(rawLetterhead);
  const zip = new JSZip();

  // Each part that shows an image needs its own relationship to it.
  const media = new Map(); // url -> media file name
  const partRels = { document: [], header1: [], header2: [] };

  const imageAdder = (part) => async (url, w, h) => {
    if (!media.has(url)) {
      const name = `image${media.size + 1}.png`;
      zip.file(`word/media/${name}`, await imageToPng(url, w, h));
      media.set(url, name);
    }
    const relId = `rIdImg${partRels[part].length + 1}`;
    partRels[part].push([relId, REL_IMAGE, `media/${media.get(url)}`]);
    return relId;
  };

  // --- Letterhead artwork, behind the text on every page.
  let letterheadDrawing = { header1: '', header2: '' };
  if (lh.showLetterhead && lh.url) {
    try {
      for (const part of ['header1', 'header2']) {
        const relId = await imageAdder(part)(lh.url, PAGE_WIDTH, PAGE_HEIGHT);
        letterheadDrawing[part] = drawingXml({
          relId,
          widthPx: PAGE_WIDTH,
          heightPx: PAGE_HEIGHT,
          name: 'Letterhead',
          anchorFullPage: true,
        });
      }
    } catch {
      letterheadDrawing = { header1: '', header2: '' };
    }
  }

  // --- Headers. header1 = page 1 (artwork only), header2 = page 2 onward.
  const headerProps = { font: lh.fontFamily, size: 10.5, color: MUTED_COLOR };
  const contentWidth = PAGE_WIDTH - lh.leftMargin - lh.rightMargin;

  const firstHeader = paragraph(letterheadDrawing.header1, { line: 0.1, markSize: 2 });

  const continuation = lh.showContinuationHeader
    ? paragraph(
        textRun(renderContinuationHeader(lh.continuationText, { subject, clientName }), headerProps) +
          `<w:r>${runProps(headerProps)}<w:tab/></w:r>` +
          pageXofY(headerProps),
        {
          after: twips(14),
          extra:
            (lh.continuationRule
              ? '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="6" w:color="C3CCD8"/></w:pBdr>'
              : '') + `<w:tabs><w:tab w:val="right" w:pos="${twips(contentWidth)}"/></w:tabs>`,
        }
      )
    : '';
  const otherHeader = continuation
    ? continuation.replace('</w:pPr>', `</w:pPr>${letterheadDrawing.header2}`)
    : paragraph(letterheadDrawing.header2, { line: 0.1, markSize: 2 });

  const headerXml = (content) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${content}</w:hdr>`;
  zip.file('word/header1.xml', headerXml(firstHeader));
  zip.file('word/header2.xml', headerXml(otherHeader));

  // --- Footer with page numbers, mirroring the preview's folio.
  const showFolio = lh.showPageNumbers && (pageCount > 1 || lh.pageNumbersOnSinglePage);
  const folioAlign = { 'bottom-left': 'left', 'bottom-center': 'center', 'bottom-right': 'right' }[
    lh.pageNumberPosition
  ];
  const folioProps = { font: 'Inter', size: 7, color: '94A0B0' };
  const footer = paragraph(showFolio ? pageXofY(folioProps) : '', {
    align: folioAlign,
    indentLeft: twips(32 - lh.leftMargin),
    indentRight: twips(32 - lh.rightMargin),
  });
  zip.file(
    'word/footer1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${footer}</w:ftr>`
  );

  // --- Body.
  const body = [];
  const envelope = inWindow(lh, recipient) ? windowLayout(lh) : null;
  const dateRun = textRun(formatLetterDate(letterDate, lh.dateFormat), {
    font: lh.fontFamily,
    size: lh.fontSize + lh.dateSize,
    color: BODY_COLOR,
  });
  const addressRuns = (base) =>
    recipient.map((line, i) => (i > 0 ? '<w:r><w:br/></w:r>' : '') + inlineRuns(line, base)).join('');

  if (envelope) {
    // Word places text by flow, not position, so everything above the
    // address has an exact height: the date, then space down to the window,
    // the address, then space down to the letter's first line.
    const W = WINDOW_ENVELOPE;
    let y = lh.topMargin;
    if (envelope.dateAbove && lh.showDate) {
      const lineHeight = dateHeight(lh) - lh.dateSpaceBefore - lh.dateSpaceAfter;
      body.push(
        paragraph(dateRun, {
          align: lh.dateAlignment,
          before: twips(lh.dateSpaceBefore),
          after: twips(lh.dateSpaceAfter),
          exact: twips(lineHeight),
        })
      );
      y += dateHeight(lh);
    }
    const lineHeight = envelope.fontSize * W.lineHeight * (96 / 72); // pt -> px
    body.push(
      paragraph(addressRuns({ font: lh.fontFamily, size: envelope.fontSize, color: BODY_COLOR }), {
        before: twips(Math.max(0, W.top - y)),
        after: twips(Math.max(0, W.height + W.gapAfter - recipient.length * lineHeight)),
        exact: twips(lineHeight),
        indentLeft: twips(envelope.left - lh.leftMargin),
      })
    );
    if (!envelope.dateAbove && lh.showDate) {
      body.push(
        paragraph(dateRun, {
          align: lh.dateAlignment,
          before: twips(lh.dateSpaceBefore),
          after: twips(lh.dateSpaceAfter),
        })
      );
    }
  } else {
    if (lh.showDate) {
      body.push(
        paragraph(dateRun, {
          align: lh.dateAlignment,
          before: twips(lh.dateSpaceBefore),
          after: twips(lh.dateSpaceAfter),
        })
      );
    }
    if (recipient.length) {
      body.push(
        paragraph(addressRuns({ font: lh.fontFamily, size: lh.fontSize, color: BODY_COLOR }), {
          after: lh.paragraphSpacing * lh.fontSize * 20,
          line: ADDRESS_LINE_HEIGHT,
        })
      );
    }
  }
  body.push(...bodyParagraphs(renderedBody, lh));
  body.push(...(await signatureParagraphs(signature, clinician, lh, imageAdder('document'))));

  const sectPr =
    '<w:sectPr>' +
    '<w:headerReference w:type="first" r:id="rIdHdr1"/>' +
    '<w:headerReference w:type="default" r:id="rIdHdr2"/>' +
    '<w:footerReference w:type="default" r:id="rIdFtr1"/>' +
    '<w:footerReference w:type="first" r:id="rIdFtr1"/>' +
    `<w:pgSz w:w="${twips(PAGE_WIDTH)}" w:h="${twips(PAGE_HEIGHT)}"/>` +
    `<w:pgMar w:top="${twips(lh.topMargin)}" w:right="${twips(lh.rightMargin)}" ` +
    `w:bottom="${twips(lh.bottomMargin)}" w:left="${twips(lh.leftMargin)}" ` +
    `w:header="${twips(lh.topMargin)}" w:footer="${twips(12)}" w:gutter="0"/>` +
    (pageCount === 1 && lh.verticalCenterSinglePage && !envelope ? '<w:vAlign w:val="center"/>' : '') +
    '<w:titlePg/>' +
    '</w:sectPr>';

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join('')}${sectPr}</w:body></w:document>`
  );

  zip.file('word/styles.xml', stylesXml({ font: lh.fontFamily, size: lh.fontSize, line: lh.lineHeight }));
  zip.file('word/settings.xml', SETTINGS_XML);

  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  zip.file(
    'word/_rels/document.xml.rels',
    relsXml([
      ['rIdStyles', `${R}/styles`, 'styles.xml'],
      ['rIdSettings', `${R}/settings`, 'settings.xml'],
      ['rIdHdr1', `${R}/header`, 'header1.xml'],
      ['rIdHdr2', `${R}/header`, 'header2.xml'],
      ['rIdFtr1', `${R}/footer`, 'footer1.xml'],
      ...partRels.document,
    ])
  );
  zip.file('word/_rels/header1.xml.rels', relsXml(partRels.header1));
  zip.file('word/_rels/header2.xml.rels', relsXml(partRels.header2));

  zip.file('docProps/core.xml', coreXml(subject || 'Letter'));
  zip.file(
    '_rels/.rels',
    relsXml([
      ['rId1', `${R}/officeDocument`, 'word/document.xml'],
      ['rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'],
    ])
  );
  zip.file(
    '[Content_Types].xml',
    contentTypesXml([
      ['/word/document.xml', `${WML}.document.main+xml`],
      ['/word/styles.xml', `${WML}.styles+xml`],
      ['/word/settings.xml', `${WML}.settings+xml`],
      ['/word/header1.xml', `${WML}.header+xml`],
      ['/word/header2.xml', `${WML}.header+xml`],
      ['/word/footer1.xml', `${WML}.footer+xml`],
      ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
    ])
  );

  return zip.generateAsync({
    type: 'uint8array',
    mimeType: `${WML}.document`,
    compression: 'DEFLATE',
  });
}

/**
 * Build and save the open letter as a .docx. Desktop gets a native Save
 * dialog; the browser downloads it.
 */
export async function exportDocx({ filename, ...letter }) {
  const bytes = await buildDocx(letter);

  if (isDesktop() && window.electronAPI.saveDocx) {
    return window.electronAPI.saveDocx(filename, bytes);
  }

  saveAs(new Blob([bytes], { type: `${WML}.document` }), filename);
  return { saved: true };
}
