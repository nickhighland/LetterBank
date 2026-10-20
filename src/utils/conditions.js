/**
 * Optional wording, decided per letter.
 *
 *   [[if telehealth]]
 *   We will meet by video. Your link is {{telehealth_link}}.
 *   [[else]]
 *   We will meet at the office.
 *   [[end]]
 *
 * Also inline: "We will meet [[if telehealth]]by video[[else]]in person[[end]]."
 *
 * Conditions:
 *   [[if name]]              the field is answered Yes, or has any value
 *   [[if not name]]          the opposite
 *   [[if name = Zoom]]       the field reads "Zoom" (case does not matter)
 *   [[if name != Zoom]]      anything else
 *
 * Conditions nest. A line holding nothing but markers disappears entirely, and
 * a section that is left out takes its blank line with it, so the letter keeps
 * one blank line between paragraphs whichever way a condition goes.
 */

const MARKER_SOURCE = String.raw`\[\[\s*(if\s+[^\]]*?|else|end)\s*\]\]`;
const markerRe = () => new RegExp(MARKER_SOURCE, 'gi');
const STANDALONE_RE = new RegExp(String.raw`^\s*(?:${MARKER_SOURCE}\s*)+$`, 'i');
const VARIABLE_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
const QUOTES_RE = /^["'“”‘’](.*)["'“”‘’]$/;

/** "telehealth", "not telehealth", "platform = Zoom" -> a condition, or null. */
export function parseCondition(expression) {
  let text = String(expression || '').trim();
  let negate = false;
  const not = /^not\s+/i.exec(text);
  if (not) {
    negate = true;
    text = text.slice(not[0].length);
  }
  const m = /^([a-zA-Z0-9_-]+)\s*(?:(==|=|!=|is\s+not|is)\s*(.*))?$/i.exec(text);
  if (!m) return null;
  const [, name, op, raw] = m;
  if (!op) return { name, op: 'set', negate };
  const value = String(raw || '').trim().replace(QUOTES_RE, '$1');
  const different = op === '!=' || /^is\s+not$/i.test(op);
  return { name, op: 'equals', value, negate: negate !== different };
}

const NO_WORDS = new Set(['no', 'n', 'false', '0', 'off', 'none']);

/** True for Yes, or any value that isn't a way of saying no. */
export function isYes(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v !== '' && !NO_WORDS.has(v);
}

export function testCondition(condition, values = {}) {
  if (!condition) return false;
  const actual = values[condition.name];
  const result =
    condition.op === 'set'
      ? isYes(actual)
      : String(actual ?? '').trim().toLowerCase() === condition.value.toLowerCase();
  return condition.negate ? !result : result;
}

/** Split a line into text and marker pieces. */
function pieces(line) {
  const out = [];
  let last = 0;
  for (const m of line.matchAll(markerRe())) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    out.push({ marker: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

/**
 * Evaluate every condition in `text` for these values.
 *
 * Returns:
 *   text        the wording that applies, markers removed
 *   names       the fields this letter uses with these values, in the order
 *               they first appear: condition fields and {{fields}} alike.
 *               Fields only inside left-out wording are not listed.
 *   conditions  the conditions that were consulted
 *   lines       the wording that applies, line by line
 *   origins     for each of those lines, the line of `text` it came from
 */
export function evaluateConditions(text, values = {}) {
  const source = text || '';
  const names = [];
  const seen = new Set();
  const note = (name) => {
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  };
  const noteVariables = (chunk) => {
    for (const m of chunk.matchAll(VARIABLE_RE)) note(m[1]);
  };

  if (!source.includes('[[')) {
    noteVariables(source);
    const lines = source.split('\n');
    return { text: source, names, conditions: [], lines, origins: lines.map((_, i) => i) };
  }

  const stack = []; // one frame per open [[if]]: { result, on }
  const active = () => stack.every((frame) => frame.on);
  const conditions = [];

  const handle = (marker) => {
    const keyword = marker.toLowerCase();
    if (keyword === 'end') {
      stack.pop();
      return;
    }
    if (keyword === 'else') {
      const top = stack[stack.length - 1];
      if (top) top.on = !top.result;
      return;
    }
    const condition = parseCondition(marker.slice(2));
    if (condition && active()) {
      conditions.push(condition);
      note(condition.name);
    }
    const result = testCondition(condition, values);
    stack.push({ result, on: result });
  };

  const out = [];
  const origins = [];
  let skipped = false; // something was left out since the last kept line

  source.split('\n').forEach((line, index) => {
    if (STANDALONE_RE.test(line)) {
      pieces(line).forEach((p) => p.marker && handle(p.marker));
      skipped = true;
      return;
    }

    let kept = '';
    let anyActive = false;
    for (const piece of pieces(line)) {
      if (piece.marker) {
        handle(piece.marker);
      } else if (active()) {
        anyActive = true;
        kept += piece.text;
      }
    }
    if (line === '' && active()) anyActive = true;

    if (!anyActive) {
      skipped = true;
      return;
    }
    // One blank line between paragraphs, however much was left out between them.
    if (kept.trim() === '' && skipped && (out.length === 0 || out[out.length - 1].trim() === '')) {
      return;
    }
    noteVariables(kept);
    out.push(kept);
    origins.push(index);
    if (kept.trim() !== '') skipped = false;
  });

  if (skipped) {
    while (out.length && out[out.length - 1].trim() === '') {
      out.pop();
      origins.pop();
    }
  }

  return { text: out.join('\n'), names, conditions, lines: out, origins };
}

/**
 * Every condition in `text`, whatever the values: name -> { set, values }.
 * `set` is true when the name is tested on its own ([[if telehealth]]);
 * `values` lists what it is compared with ([[if platform = Zoom]]).
 */
export function describeConditions(text) {
  const found = new Map();
  for (const m of String(text || '').matchAll(markerRe())) {
    const marker = m[1].trim();
    if (!/^if\s/i.test(marker)) continue;
    const condition = parseCondition(marker.slice(2));
    if (!condition) continue;
    const entry = found.get(condition.name) || { set: false, values: [] };
    if (condition.op === 'set') entry.set = true;
    else if (!entry.values.some((v) => v.toLowerCase() === condition.value.toLowerCase())) {
      entry.values.push(condition.value);
    }
    found.set(condition.name, entry);
  }
  return found;
}

/** True when `text` contains any condition markers. */
export const hasConditions = (text) => markerRe().test(String(text || ''));
