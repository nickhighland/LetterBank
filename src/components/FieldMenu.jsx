import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, Type, ArrowLeft, Split } from 'lucide-react';
import { BUILT_IN_FIELDS, formatLabel, toFieldName } from '../utils/variableParser';
import { normaliseFieldDef } from '../utils/fieldDefs';
import { PRONOUN_FIELD } from '../utils/pronouns';

const PRONOUN_WORDS = [
  ['they', 'they · she · he'],
  ['them', 'them · her · him'],
  ['their', 'their · her · his'],
  ['theirs', 'theirs · hers · his'],
  ['themselves', 'themselves · herself · himself'],
  ['they_are', 'they are · she is · he is'],
  ['they_were', 'they were · she was · he was'],
  ['they_have', 'they have · she has · he has'],
];
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
import { FieldForm, TYPE_ICONS, newFieldDef, isFieldDefComplete } from './FieldForm';

const MENU_WIDTH = 288;

/**
 * The editor's Insert field menu, opened by right-clicking the letter body
 * (or the Field button). Lists the fields already in the letter, the
 * clinician's own fields (Settings › My fields), a set of common ones, and a
 * "New field" form that names a placeholder and picks its type: a Date opens
 * a date picker in Quick Fill, a Dropdown offers its choices, a Yes/No is a
 * checkbox. "Optional wording" wraps the selection in [[if …]] … [[end]].
 */
export function FieldMenu({
  position,
  existing = [],
  defs = {},
  library = [],
  onInsert,
  onOptional,
  onClose,
}) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState(null); // a field definition while the form is open
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [optional, setOptional] = useState(null); // { name } while choosing a condition
  const [pronounPick, setPronounPick] = useState(null); // { capital } while choosing a pronoun
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
  }, [position, custom, optional, pronounPick]);

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
  const matches = (field) =>
    !q ||
    field.name.includes(q.replace(/\s+/g, '_')) ||
    (field.label || formatLabel(field.name)).toLowerCase().includes(q);

  const inLetter = useMemo(
    () =>
      existing
        .map((name) => defs[name] || { name, type: 'text' })
        .filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing, defs, q]
  );
  const mine = useMemo(
    () => library.filter((f) => !existing.includes(f.name) && matches(f)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, existing, q]
  );
  const common = useMemo(
    () =>
      BUILT_IN_FIELDS.filter(
        (f) => !existing.includes(f.name) && !library.some((l) => l.name === f.name) && matches(f)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing, library, q]
  );

  const openCustom = () => setCustom(newFieldDef(query));
  const insert = (field, opts = {}) => {
    // Pronouns are placed word by word: {{they}}, {{their}}, {{They_are}}…
    if (field.name === PRONOUN_FIELD) setPronounPick({ capital: false });
    else onInsert(normaliseFieldDef(field) || field, opts);
  };

  const submitCustom = (e) => {
    e.preventDefault();
    if (!isFieldDefComplete(custom)) return;
    insert(custom, { saveToLibrary, isNew: true });
  };

  // Yes/No fields that can switch optional wording on and off.
  const switches = [
    ...existing.map((name) => defs[name]).filter((d) => d?.type === 'yesno'),
    ...library.filter((f) => f.type === 'yesno' && !existing.includes(f.name)),
  ];
  const optionalName = toFieldName(optional?.name);

  const Row = ({ field }) => {
    const Icon = TYPE_ICONS[field.type] || Type;
    return (
      <button
        type="button"
        onClick={() => insert(field)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left cursor-pointer
                   text-[12.5px] text-ink hover:bg-surface-hover"
      >
        <Icon className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
        <span className="flex-1 truncate">{field.label || formatLabel(field.name)}</span>
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
        <form onSubmit={submitCustom} className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
          <button
            type="button"
            onClick={() => setCustom(null)}
            className="flex items-center gap-1 text-[11px] font-medium cursor-pointer text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="w-3 h-3" />
            All fields
          </button>
          <FieldForm value={custom} onChange={setCustom} compact />
          <label className="flex items-center gap-2 text-[12px] text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
              className="w-3.5 h-3.5 accent-accent"
            />
            Add to My fields, for other letters too
          </label>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!isFieldDefComplete(custom)}
              className="h-8 px-3 rounded-md text-[12px] font-semibold cursor-pointer bg-accent text-white
                         hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert
            </button>
          </div>
        </form>
      ) : pronounPick ? (
        <div className="p-3 space-y-2">
          <button
            type="button"
            onClick={() => setPronounPick(null)}
            className="flex items-center gap-1 text-[11px] font-medium cursor-pointer text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="w-3 h-3" />
            All fields
          </button>
          <p className="text-[12px] leading-snug text-ink-secondary">
            Follows the Pronouns field in Quick Fill.
          </p>
          <div className="space-y-0.5">
            {PRONOUN_WORDS.map(([token, reads]) => {
              const name = pronounPick.capital ? capitalise(token) : token;
              return (
                <button
                  key={token}
                  type="button"
                  onClick={() => onInsert({ name, type: 'text' }, { pronoun: true })}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left cursor-pointer
                             text-[12.5px] text-ink hover:bg-surface-hover"
                >
                  <span>{pronounPick.capital ? capitalise(reads) : reads}</span>
                  <code className="text-[10.5px] text-ink-faint">{`{{${name}}}`}</code>
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-[12px] text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={pronounPick.capital}
              onChange={(e) => setPronounPick({ capital: e.target.checked })}
              className="w-3.5 h-3.5 accent-accent"
            />
            Capitalised, to start a sentence
          </label>
        </div>
      ) : optional ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (optionalName) onOptional(optionalName);
          }}
          className="p-3 space-y-3"
        >
          <button
            type="button"
            onClick={() => setOptional(null)}
            className="flex items-center gap-1 text-[11px] font-medium cursor-pointer text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="w-3 h-3" />
            All fields
          </button>
          <p className="text-[12px] leading-snug text-ink-secondary">
            The selected wording prints only when this box is ticked in Quick Fill.
          </p>
          {switches.length > 0 && (
            <div className="space-y-0.5">
              {switches.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => onOptional(f.name)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left cursor-pointer
                             text-[12.5px] text-ink hover:bg-surface-hover"
                >
                  <TYPE_ICONS.yesno className="w-3.5 h-3.5 text-ink-muted" />
                  {f.label || formatLabel(f.name)}
                </button>
              ))}
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-ink-secondary">
              {switches.length ? 'Or a new checkbox' : 'Checkbox'}
            </span>
            <input
              autoFocus
              value={optional.name}
              onChange={(e) => setOptional({ name: e.target.value })}
              placeholder="e.g. Telehealth"
              className="w-full h-8 px-2.5 rounded-md border text-[12.5px] bg-surface-base border-line text-ink
                         focus:outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <code className="text-[11px] truncate text-ink-muted">
              {optionalName ? `[[if ${optionalName}]]…[[end]]` : ' '}
            </code>
            <button
              type="submit"
              disabled={!optionalName}
              className="h-8 px-3 rounded-md text-[12px] font-semibold cursor-pointer bg-accent text-white
                         hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Make optional
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
                const first = inLetter[0] || mine[0] || common[0];
                if (first) insert(first);
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
            {mine.length > 0 && (
              <>
                <Heading>My fields</Heading>
                {mine.map((f) => (
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
            {inLetter.length === 0 && mine.length === 0 && common.length === 0 && (
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
              {query.trim() ? `New field “${query.trim()}”…` : 'New field…'}
            </button>
            {onOptional && (
              <button
                type="button"
                onClick={() => setOptional({ name: '' })}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left cursor-pointer
                           text-[12.5px] font-medium text-ink-secondary hover:bg-surface-hover"
              >
                <Split className="w-3.5 h-3.5" />
                Make selection optional…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
