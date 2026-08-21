import React from 'react';

/**
 * LetterBank Brand Logo
 * Seamlessly adapts between Day (light) and Night (dark) themes using official assets.
 */
export function BrandLogo({ className = 'h-7 w-auto' }) {
  return (
    <div className="flex items-center select-none shrink-0">
      <img
        src="./letterbank-logo.svg"
        alt="LetterBank"
        className={`${className} dark:hidden block object-contain`}
      />
      <img
        src="./letterbank-logo-dark.png"
        alt="LetterBank"
        className={`${className} hidden dark:block object-contain`}
      />
    </div>
  );
}
