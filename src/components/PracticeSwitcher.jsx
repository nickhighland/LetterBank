import React, { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Plus, Settings2 } from 'lucide-react';

/**
 * Switch the active practice profile from the header.
 *
 * A clinician seeing clients through Headway, Alma and a private practice needs
 * a different practice name, contact block and telehealth link per platform.
 * Switching here swaps every preset-backed field on the current letter in one
 * click, rather than editing them one at a time in Settings.
 */
export function PracticeSwitcher({ profiles, activeId, onSelect, onAdd, onManage }) {
  const [open, setOpen] = useState(false);
  // Naming happens inline rather than via window.prompt(), which throws
  // "prompt() is not supported." in Electron — the button appeared dead in the
  // desktop app while the same action worked from Settings.
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const boxRef = useRef(null);
  const draftRef = useRef(null);

  const active = profiles.find((p) => p.id === activeId) || profiles[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reset the draft whenever the menu closes, so it never reopens mid-entry.
  useEffect(() => {
    if (!open) {
      setAdding(false);
      setDraftName('');
    }
  }, [open]);

  useEffect(() => {
    if (adding) draftRef.current?.focus();
  }, [adding]);

  const commitName = () => {
    const name = draftName.trim();
    if (!name) return;
    onAdd?.(name);
    setAdding(false);
    setDraftName('');
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative no-drag shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Active practice: ${active?.name}`}
        className="flex items-center gap-1.5 h-9 px-2.5 max-w-[190px] rounded-lg cursor-pointer
                   transition-colors text-ink-secondary hover:bg-surface-hover"
      >
        <Building2 className="w-4 h-4 shrink-0" />
        <span className="text-[13px] font-medium truncate">{active?.name}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 w-64 z-50 rounded-xl border overflow-hidden
                     bg-surface-raised border-line shadow-token-md"
        >
          <div className="px-3 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Practice
          </div>

          <ul className="max-h-72 overflow-y-auto pb-1">
            {profiles.map((p) => {
              const isActive = p.id === active?.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setOpen(false);
                      if (!isActive) onSelect(p.id);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer
                                transition-colors hover:bg-surface-hover ${
                                  isActive ? 'text-accent-ink' : 'text-ink'
                                }`}
                  >
                    <Check
                      className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium truncate">{p.name}</span>
                      {p.values?.practice_email && (
                        <span className="block text-[11px] truncate text-ink-muted">
                          {p.values.practice_email}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-line">
            {adding ? (
              <div className="flex items-center gap-1.5 px-2 py-2">
                <input
                  ref={draftRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitName();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setAdding(false);
                      setDraftName('');
                    }
                  }}
                  placeholder="e.g. Headway"
                  aria-label="New practice name"
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-[13px] rounded-lg border outline-none
                             bg-surface-raised border-line text-ink placeholder:text-ink-faint
                             focus:border-accent"
                />
                <button
                  type="button"
                  onClick={commitName}
                  disabled={!draftName.trim()}
                  className="h-8 px-2.5 text-[12px] font-semibold rounded-lg shrink-0 cursor-pointer
                             bg-accent text-white hover:bg-accent-hover transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer
                           transition-colors text-ink-secondary hover:bg-surface-hover"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[12px] font-medium">Add practice</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer
                         transition-colors text-ink-secondary hover:bg-surface-hover"
            >
              <Settings2 className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[12px] font-medium">Edit practice details…</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
