import React from 'react';

/**
 * Shared primitives.
 *
 * Colours come from utility classes backed by the semantic tokens registered
 * in index.css (`@theme inline`). That keeps one source of truth for the
 * values while letting hover, focus and disabled states stay in CSS — they
 * used to be hand-written onMouseEnter/onMouseLeave handlers, because an
 * inline style object has no :hover.
 */

export function IconButton({ children, onClick, label, active = false, danger = false }) {
  const tone = danger
    ? 'text-danger hover:bg-danger-soft'
    : active
    ? 'text-accent-ink bg-accent-soft'
    : 'text-ink-secondary hover:bg-surface-hover';

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-lg shrink-0
                  whitespace-nowrap cursor-pointer transition-colors ${tone}`}
    >
      {children}
    </button>
  );
}

export function SegmentedControl({ value, onChange, options, compact = false }) {
  return (
    <div className="flex items-center p-0.5 rounded-lg shrink-0 bg-surface-sunken">
      {options.map(({ value: v, label, Icon }) => {
        const isActive = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 rounded-md font-medium cursor-pointer transition-colors
                        ${compact ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]'}
                        ${
                          isActive
                            ? 'bg-surface-raised text-ink shadow-token-sm'
                            : 'text-ink-muted hover:text-ink-secondary'
                        }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const TextInput = React.forwardRef(function TextInput(
  { as = 'input', className = '', ...props },
  ref
) {
  const Tag = as;
  return (
    <Tag
      ref={ref}
      {...props}
      className={`w-full px-3 py-2.5 text-[13px] rounded-lg border outline-none transition-colors
                  bg-surface-raised border-line text-ink
                  placeholder:text-ink-faint
                  focus:border-accent focus:ring-2 focus:ring-accent/15
                  ${as === 'textarea' ? 'resize-y' : ''} ${className}`}
    />
  );
});

const BADGE_TONES = {
  neutral: 'bg-surface-sunken text-ink-muted',
  accent: 'bg-accent-soft text-accent-ink',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
};

export function Badge({ children, tone = 'neutral' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold
                  uppercase tracking-wide whitespace-nowrap ${BADGE_TONES[tone] || BADGE_TONES.neutral}`}
    >
      {children}
    </span>
  );
}

/**
 * Shared modal shell.
 *
 * The open/closed gate lives here so each modal's own hooks can run
 * unconditionally. Previously every modal did `if (!isOpen) return null`
 * ahead of its useState calls, which violates the Rules of Hooks.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  width = 'max-w-2xl',
  children,
  footer,
}) {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-scrim backdrop-blur-[6px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width} max-h-[86vh] flex flex-col rounded-2xl border overflow-hidden
                    bg-surface-base border-line shadow-token-xl`}
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0 bg-surface-raised border-line">
          {Icon && (
            <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0 bg-accent-soft text-accent-ink">
              <Icon className="w-4 h-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-[12px] mt-0.5 text-ink-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid place-items-center w-8 h-8 rounded-lg shrink-0 cursor-pointer
                       text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M12 4L4 12M4 4l8 8" />
            </svg>
          </button>
        </div>

        <div className="flex-1 scroll-pane">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t shrink-0 bg-surface-raised border-line">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-white border-transparent hover:bg-accent-hover',
  secondary: 'bg-surface-raised text-ink-secondary border-line hover:bg-surface-hover hover:text-ink',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:bg-surface-hover hover:text-ink',
  danger: 'bg-danger-soft text-danger border-transparent hover:brightness-95',
};

export function Button({ variant = 'secondary', children, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 h-9.5 px-4 text-[13px] font-semibold
                  rounded-lg border cursor-pointer transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, action }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 min-h-[20px]">
        <label className="text-[12px] font-semibold flex items-center gap-1.5 text-ink-secondary">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}
