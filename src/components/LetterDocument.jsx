import React from 'react';
import { formatLetterDate, renderTemplate } from '../utils/variableParser';
import { INDENT_STEP, parseInline } from '../utils/letterMarkup';
import { resolveLetterhead } from '../utils/storage';
import { PAGE_WIDTH, PAGE_HEIGHT, fillableArea } from '../constants/page';

/**
 * The single source of truth for what a letter looks like.
 *
 * Previously this markup existed twice: once as JSX in LetterPreview and once
 * as a ~120-line inline HTML string in App.jsx for batch export. The two had
 * already drifted (different paragraph margins; the batch copy ignored the
 * custom signature block entirely), so screen preview and exported PDF did not
 * agree. Everything now renders through here: preview, print and PDF.
 */

const SIGNATURE_TOKENS = [
  ['clinician_name', (c) => c.name],
  ['clinician_credentials', (c) => c.credentials],
  ['license_title', (c) => c.title],
  ['practice_name', (c) => c.practiceName],
  ['practice_phone', (c) => c.phone],
  ['practice_email', (c) => c.email],
  ['practice_website', (c) => c.website],
];

export function resolveSignatureTokens(line, clinician = {}) {
  return SIGNATURE_TOKENS.reduce(
    (acc, [token, get]) =>
      acc.replace(new RegExp(`\\{\\{${token}\\}\\}`, 'g'), get(clinician) || ''),
    line
  );
}

/**
 * Build a valid CSS font-family value.
 *
 * `font-family: Source Serif 4` is invalid CSS — an unquoted family name
 * cannot contain a bare number token, so the whole declaration is dropped and
 * the element silently inherits the UI sans font. Every letter was being
 * typeset in the fallback. Quote the name and always ship a real fallback.
 */
export function fontStack(family) {
  const name = family || 'Source Serif 4';
  const fallback =
    name === 'Inter'
      ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      : "Georgia, Cambria, 'Times New Roman', serif";
  return `"${name}", ${fallback}`;
}

function alignToFlex(alignment) {
  if (alignment === 'center') return 'center';
  if (alignment === 'right') return 'flex-end';
  return 'flex-start';
}

function SignatureBlock({ signature, clinician, fontFamily, fontSize }) {
  const align = signature.alignment || 'left';

  if (signature.customBlockText) {
    return (
      <div
        className="signature-block"
        style={{ fontFamily, textAlign: align }}
      >
        <div style={{ fontSize: `${fontSize - 1.5}pt`, lineHeight: 1.4 }}>
          {signature.customBlockText.split('\n').map((line, i) => {
            const isImageToken =
              line.includes('{{signature_image}}') || line.includes('[SIGNATURE_IMAGE]');

            if (isImageToken) {
              if (!signature.showSignature || !signature.url) {
                return <div key={i} style={{ height: '0.5em' }} />;
              }
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: alignToFlex(align),
                    margin: '6px 0',
                  }}
                >
                  <img
                    src={signature.url}
                    alt="Clinician signature"
                    className="signature-img"
                    style={{ width: `${signature.width || 180}px` }}
                  />
                </div>
              );
            }

            return (
              <div key={i} style={{ minHeight: '1.25em' }}>
                {resolveSignatureTokens(line, clinician)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="signature-block" style={{ fontFamily, textAlign: align }}>
      {signature.showSignature && signature.url && (
        <div style={{ display: 'flex', justifyContent: alignToFlex(align) }}>
          <img
            src={signature.url}
            alt="Clinician signature"
            className="signature-img"
            style={{ width: `${signature.width || 180}px`, marginBottom: 4 }}
          />
        </div>
      )}
      {signature.showCredentials && (
        <div>
          <div className="signature-name">
            {clinician.name}
            {clinician.credentials ? `, ${clinician.credentials}` : ''}
          </div>
          <div className="signature-title">{clinician.title}</div>
          <div className="signature-contact">
            {clinician.practiceName}
            {clinician.phone ? ` • ${clinician.phone}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline runs. Mirrors inlineToHtml(), which the paginator measures. */
function Inline({ text }) {
  return parseInline(text).map(({ text: t, bold, italic, underline }, i) => {
    if (bold) return <strong key={i}>{t}</strong>;
    if (italic) return <em key={i}>{t}</em>;
    if (underline) return <u key={i}>{t}</u>;
    return <React.Fragment key={i}>{t}</React.Fragment>;
  });
}

/**
 * One parsed block: a paragraph, a bullet list or a numbered list.
 * Must stay in step with blocksToHtml() in letterMarkup, which the paginator
 * measures — if the two diverge, page breaks land in the wrong place.
 */
function LetterBlock({ block, paragraphSpacing, bodyAlignment }) {
  const style = {
    marginBottom: `${paragraphSpacing}em`,
    textAlign: block.align || bodyAlignment,
  };
  const pad = block.indent * INDENT_STEP;

  if (block.kind === 'paragraph') {
    return (
      <p style={{ ...style, paddingLeft: pad || undefined }}>
        {block.items.map((line, j, arr) => (
          <React.Fragment key={j}>
            <Inline text={line} />
            {j < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  }

  const List = block.kind === 'numbers' ? 'ol' : 'ul';
  return (
    <List style={{ ...style, paddingLeft: pad + 24, listStylePosition: 'outside' }}>
      {block.items
        .filter((t) => t.trim() !== '')
        .map((item, j) => (
          <li key={j} style={{ marginBottom: '0.25em' }}>
            <Inline text={item} />
          </li>
        ))}
    </List>
  );
}

/**
 * Renders one physical 816x1056 page.
 */
export function LetterPage({
  page,
  letterhead: rawLetterhead,
  signature,
  clinician,
  clientName,
  isSingleCentered,
  showMarginGuides = false,
  letterDate,
}) {
  const letterhead = resolveLetterhead(rawLetterhead);
  const fontFamily = fontStack(letterhead.fontFamily);
  const { fontSize, lineHeight } = letterhead;
  const { width: fillableWidth, height: fillableHeight } = fillableArea(letterhead);

  return (
    <div className="letter-page-canvas">
      {letterhead.showLetterhead && (
        <div
          className="letterhead-bg"
          style={{ backgroundImage: `url(${letterhead.url})` }}
        />
      )}

      {showMarginGuides && (
        <div
          className="absolute pointer-events-none z-10 border border-dashed"
          style={{
            top: letterhead.topMargin,
            bottom: letterhead.bottomMargin,
            left: letterhead.leftMargin,
            right: letterhead.rightMargin,
            borderColor: 'rgba(3, 105, 161, 0.55)',
            background: 'rgba(3, 105, 161, 0.04)',
          }}
        >
          <span
            className="absolute -top-5 left-0 font-mono rounded px-1.5 py-0.5"
            style={{
              fontSize: 9,
              color: '#0369a1',
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(3,105,161,0.3)',
            }}
          >
            {fillableWidth} × {fillableHeight} px fillable
          </span>
        </div>
      )}

      <div
        className={`letter-content-boundary${
          isSingleCentered ? ' single-page-centered' : ''
        }`}
        style={{
          top: letterhead.topMargin,
          bottom: letterhead.bottomMargin,
          left: letterhead.leftMargin,
          right: letterhead.rightMargin,
        }}
      >
        {page.pageNumber === 1
          ? letterhead.showDate && (
              <div
                className="letter-date-line"
                style={{
                  fontFamily,
                  fontSize: `${fontSize + letterhead.dateSize}pt`,
                  textAlign: letterhead.dateAlignment,
                  marginTop: letterhead.dateSpaceBefore,
                  marginBottom: letterhead.dateSpaceAfter,
                }}
              >
                {formatLetterDate(letterDate, letterhead.dateFormat)}
              </div>
            )
          : letterhead.showContinuationHeader && (
              <div
                className="letter-continuation-header"
                style={{
                  fontFamily,
                  borderBottom: letterhead.continuationRule ? undefined : 'none',
                }}
              >
                <span>{renderTemplate(letterhead.continuationText, { client_name: clientName })}</span>
                <span>
                  Page {page.pageNumber} of {page.totalPages}
                </span>
              </div>
            )}

        <div
          className="letter-body-text"
          style={{
            fontFamily,
            fontSize: `${fontSize}pt`,
            lineHeight,
            textAlign: letterhead.bodyAlignment,
          }}
        >
          {(page.blocks || []).map((block, i) => (
            <LetterBlock
              key={i}
              block={block}
              paragraphSpacing={letterhead.paragraphSpacing}
              bodyAlignment={letterhead.bodyAlignment}
            />
          ))}
        </div>

        {page.showSignature && (
          <SignatureBlock
            signature={signature}
            clinician={clinician}
            fontFamily={fontFamily}
            fontSize={fontSize}
          />
        )}
      </div>

      {letterhead.showPageNumbers &&
        (page.totalPages > 1 || letterhead.pageNumbersOnSinglePage) && (
          <div className={`letter-page-folio is-${letterhead.pageNumberPosition}`}>
            Page {page.pageNumber} of {page.totalPages}
          </div>
        )}
    </div>
  );
}

/**
 * Renders the full multi-page document.
 */
export function LetterDocument({
  pages,
  letterhead,
  signature,
  clinician,
  clientName,
  showMarginGuides = false,
  letterDate,
}) {
  const centerSingle = pages.length === 1 && letterhead.verticalCenterSinglePage;

  return pages.map((page) => (
    <LetterPage
      key={page.pageNumber}
      page={page}
      letterhead={letterhead}
      signature={signature}
      clinician={clinician}
      clientName={clientName}
      isSingleCentered={centerSingle}
      showMarginGuides={showMarginGuides}
      letterDate={letterDate}
    />
  ));
}
