import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  PRONOUN_OPTIONS,
  PRONOUN_OVERRIDES,
  pronounSet,
  pronounSpots,
  pronounWord,
} from '../utils/pronouns';
import { TextInput } from './ui';

const PARTS = [
  ['subject', 'Subject'],
  ['recipient', 'Address'],
  ['body', 'Letter'],
];

const CONTEXT = 42;
const MARK = '\u0000';

/**
 * A few words either side of one pronoun, from its own paragraph, as the
 * letter prints them, to tell the pronouns apart.
 */
function contextOf(text, part, key, wordOf, labels) {
  let marked = '';
  let at = 0;
  for (const spot of pronounSpots(text, part)) {
    marked += text.slice(at, spot.start) + (spot.key === key ? MARK : wordOf(spot));
    at = spot.end;
  }
  marked += text.slice(at);

  const [rawBefore, rawAfter = ''] = marked.split(MARK);
  const readable = (s) =>
    s
      .replace(/\[\[[^\]]*\]\]/g, '')
      .replace(/^\s*(\[(center|right|justify|left)\]|[->]|\d+\.)\s*/gm, '')
      .replace(/\*\*|__|\*/g, '')
      .replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (m, name) => `[${labels[name] || name.replace(/_/g, ' ')}]`)
      .replace(/\s+/g, ' ');
  let before = readable(rawBefore.split(/\n\s*\n/).pop());
  let after = readable(rawAfter.split(/\n\s*\n/)[0]);
  if (before.length > CONTEXT) before = `…${before.slice(before.length - CONTEXT).replace(/^\S*\s/, '')}`;
  if (after.length > CONTEXT) after = `${after.slice(0, CONTEXT).replace(/\s\S*$/, '')}…`;
  return { before, after };
}

/**
 * Under the Pronouns choice in Quick Fill: every pronoun in the letter, each
 * of which can follow the letter's choice or be set on its own, for a letter
 * about a second person or a client who uses she/they.
 */
export function PronounOverrides({ sources, values, labels = {}, onChangeValue }) {
  const overrides = values[PRONOUN_OVERRIDES] || {};
  const letterSet = pronounSet(values.pronouns);
  const changed = Object.keys(overrides).length;
  const [open, setOpen] = useState(changed > 0);

  const spots = useMemo(
    () =>
      PARTS.flatMap(([part, where]) =>
        pronounSpots(sources[part], part).map((spot) => ({ ...spot, part, where, text: sources[part] }))
      ),
    [sources]
  );
  if (!spots.length) return null;

  const setOverride = (key, set) => {
    const next = { ...overrides };
    if (set) next[key] = set;
    else delete next[key];
    onChangeValue(PRONOUN_OVERRIDES, Object.keys(next).length ? next : undefined);
  };

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11.5px] font-medium cursor-pointer text-ink-muted hover:text-ink"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Each pronoun ({spots.length})
        {changed > 0 && <span className="text-accent-ink">· {changed} set separately</span>}
      </button>

      {open && (
        <div className="space-y-1.5">
          <p className="text-[11px] leading-snug text-ink-faint">
            Each one follows the choice above. Set one separately when it refers to someone else, or for a
            client who uses more than one set, like she/they.
          </p>
          {spots.map((spot) => {
            const own = overrides[spot.key];
            const wordFor = (token, key) => pronounWord(token, overrides[key] || letterSet);
            const { before, after } = contextOf(
              spot.text,
              spot.part,
              spot.key,
              (other) => wordFor(other.token, other.key),
              labels
            );
            return (
              <div key={spot.key} className="rounded-md px-2 py-1.5 bg-surface-sunken">
                <p className="text-[11.5px] leading-snug text-ink-secondary">
                  {spots.some((s) => s.part !== 'body') && (
                    <span className="text-ink-faint">{spot.where}: </span>
                  )}
                  {before}
                  <strong className={own ? 'text-accent-ink' : 'text-ink'}>{wordFor(spot.token, spot.key)}</strong>
                  {after}
                </p>
                <TextInput
                  as="select"
                  value={own || ''}
                  onChange={(e) => setOverride(spot.key, e.target.value)}
                  aria-label={`Pronoun: ${before} ${wordFor(spot.token, spot.key)} ${after}`}
                  className="mt-1 !py-1 text-[12px]"
                >
                  <option value="">Letter’s choice ({pronounWord(spot.token, letterSet)})</option>
                  {PRONOUN_OPTIONS.map((option) => {
                    const set = pronounSet(option);
                    return (
                      <option key={set} value={set}>
                        {pronounWord(spot.token, set)} ({option})
                      </option>
                    );
                  })}
                </TextInput>
              </div>
            );
          })}
          {changed > 0 && (
            <button
              type="button"
              onClick={() => onChangeValue(PRONOUN_OVERRIDES, undefined)}
              className="text-[11px] font-medium cursor-pointer text-ink-muted hover:text-ink"
            >
              Make them all follow the choice above
            </button>
          )}
        </div>
      )}
    </div>
  );
}
