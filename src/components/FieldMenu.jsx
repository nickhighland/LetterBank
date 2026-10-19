import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, CalendarDays, Clock, AlignLeft, Type, ArrowLeft } from 'lucide-react';
import {
  BUILT_IN_FIELDS,
  FIELD_TYPES,
  fieldTypeFor,
  formatLabel,
  toFieldName,
} from '../utils/variableParser';

const TYPE_ICONS = { text: Type, date: CalendarDays, time: Clock, textarea: AlignLeft };

const MENU_WIDTH = 272;

/**
 * The editor's Insert field menu, opened by right-clicking the letter body
 * (or the Field button). Lists the fields already in the letter, a set of
 * common ones, and a "Custom field" form that names a new placeholder and
 * picks its type — a Date field opens a date picker in Quick Fill, a Time
 * field a time picker.
 */
export function FieldMenu({ position, existing = [], types = {}, onInsert, onClose }) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState(null); // { name, type } while the form is open
  const [pos, setPos] = useState(position);

  // Keep the menu on screen when opened near the bottom or right edge.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { innerWidth: w, innerHeight: h } = window;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(position.x, w - rect.width - 8)),
      y: Math.max(8, Math.min(position.y, h - rect.height - 8)),
    });
  }, [position, custom]);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const matches = (name) =>
    !q || name.includes(q.replace(/\s+/g, '_')) || formatLabel(name).toLowerCase().includes(q);

  const inLetter = useMemo(
    () => existing.filter(matches).map((name) => ({ name, type: fieldTypeFor(name, types) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing, types, q]
  );
  const common = useMemo(
    () => BUILT_IN_FIELDS.filter((f) => !existing.includes(f.name) && matches(f.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing, q]
  );

  const openCustom = () => setCustom({ name: query, type: 'text' });
  const customName = toFieldName(custom?.name);

  const submitCustom = (e) => {
    e.preventDefault();
    if (!customName) return;
    onInsert(customName, custom.type);
  };

  const Row = ({ field }) => {
    const Icon = TYPE_ICONS[field.type] || Type;
    return (
      <button
        type="button"
        onClick={() => onInsert(field.name, field.type)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left cursor-pointer
                   text-[12.5px] text-ink hover:bg-surface-hover"
      >
        <Icon className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
        <span className="flex-1 truncate">{formatLabel(field.name)}</span>
        <code className="text-[10.5px] text-ink-faint truncate max-w-[110px]">{`{{${field.name}}}`}</code>
      </button>
    );
  };

  const Heading = ({ children }) => (
    <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
      {children}
    </div>
  );

  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 rounded-xl border shadow-token-md bg-surface-raised border-line select-none"
      style={{ left: pos.x, top: pos.y, width: MENU_WIDTH }}
    >
      {custom ? (
        <form onSubmit={submitCustom} className="p-3 space-y-3">
          <button
            type="button"
            onClick={() => setCustom(null)}
            className="flex items-center gap-1 text-[11px] font-medium cursor-pointer text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="w-3 h-3" />
            All fields
          </button>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-ink-secondary">Field name</span>
            <input
              autoFocus
              value={custom.name}
              onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Return to work date"
              className="w-full h-8 px-2.5 rounded-md border text-[12.5px] bg-surface-base border-line text-ink
                         focus:outline-none focus:border-accent"
            />
          </label>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-ink-secondary">Type</span>
            <div className="grid grid-cols-2 gap-1">
              {FIELD_TYPES.map(({ value, label }) => {
                const Icon = TYPE_ICONS[value];
                const active = custom.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCustom((c) => ({ ...c, type: value }))}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 h-8 px-2 rounded-md text-[12px] font-medium cursor-pointer border
                      ${
                        active
                          ? 'bg-accent-soft text-accent-ink border-accent'
                          : 'bg-surface-base text-ink-secondary border-line hover:bg-surface-hover'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <code className="text-[11px] truncate text-ink-muted">
              {customName ? `{{${customName}}}` : ' '}
            </code>
            <button
              type="submit"
              disabled={!customName}
              className="h-8 px-3 rounded-md text-[12px] font-semibold cursor-pointer bg-accent text-white
                         hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="p-2 border-b border-line">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const first = inLetter[0] || common[0];
                if (first) onInsert(first.name, first.type);
                else if (query.trim()) openCustom();
              }}
              placeholder="Insert field…"
              className="w-full h-8 px-2.5 rounded-md border text-[12.5px] bg-surface-base border-line text-ink
                         focus:outline-none focus:border-accent"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {inLetter.length > 0 && (
              <>
                <Heading>In this letter</Heading>
                {inLetter.map((f) => (
                  <Row key={f.name} field={f} />
                ))}
              </>
            )}
            {common.length > 0 && (
              <>
                <Heading>Common fields</Heading>
                {common.map((f) => (
                  <Row key={f.name} field={f} />
                ))}
              </>
            )}
            {inLetter.length === 0 && common.length === 0 && (
              <p className="px-2.5 py-3 text-[12px] text-ink-muted">No matching field.</p>
            )}
          </div>
          <div className="p-1 border-t border-line">
            <button
              type="button"
              onClick={openCustom}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left cursor-pointer
                         text-[12.5px] font-medium text-accent-ink hover:bg-accent-soft"
            >
              <Plus className="w-3.5 h-3.5" />
              {query.trim() ? `Custom field “${query.trim()}”…` : 'Custom field…'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
