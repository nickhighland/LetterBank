import React, { createContext, useContext } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { parseCondition } from '../utils/conditions';
import { formatLabel } from '../utils/variableParser';

/**
 * What a chip shows. The Editor shows each field's label; the page in the
 * preview shows its value, or "[Label]" while it is empty, as it prints.
 */
export const ChipContext = createContext({
  field: (name) => ({ text: formatLabel(name), empty: true }),
  label: formatLabel,
  onOpenField: null,
});

/** "If Telehealth", "Otherwise", "End of optional wording". */
export function describeMarker(expr, label = formatLabel) {
  const keyword = String(expr || '').trim().toLowerCase();
  if (keyword === 'end') return 'End optional';
  if (keyword === 'else') return 'Otherwise';
  const condition = parseCondition(String(expr).trim().slice(2));
  if (!condition) return String(expr);
  const name = label(condition.name);
  if (condition.op === 'set') return condition.negate ? `If not ${name}` : `If ${name}`;
  return `If ${name} ${condition.negate ? 'is not' : 'is'} ${condition.value}`;
}

export function FieldChip({ node, selected }) {
  const { field, onOpenField } = useContext(ChipContext);
  const { name } = node.attrs;
  const shown = field(name);
  return (
    <NodeViewWrapper
      as="span"
      className={`lb-chip lb-chip-field${shown.empty ? ' is-empty' : ''}${selected ? ' is-selected' : ''}`}
      title={shown.title || `{{${name}}}`}
      onDoubleClick={onOpenField ? () => onOpenField(name) : undefined}
    >
      {shown.text}
    </NodeViewWrapper>
  );
}

export function ConditionChip({ node, selected }) {
  const { label } = useContext(ChipContext);
  const { expr } = node.attrs;
  const keyword = String(expr).trim().toLowerCase();
  const kind = keyword === 'end' ? 'end' : keyword === 'else' ? 'else' : 'if';
  return (
    <NodeViewWrapper
      as="span"
      className={`lb-chip lb-chip-condition is-${kind}${selected ? ' is-selected' : ''}`}
      title={`[[${expr}]]: the wording between this and End prints only when the condition holds`}
    >
      {describeMarker(expr, label)}
    </NodeViewWrapper>
  );
}
