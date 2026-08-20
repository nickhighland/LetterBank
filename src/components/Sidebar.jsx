import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Copy,
  Trash2,
  Sparkles,
  CalendarX,
  Clock,
  Award,
  FileX,
  FileCheck,
  Stethoscope,
  Heart,
  ShieldCheck,
  Receipt,
  FileText,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { TEMPLATE_CATEGORIES } from '../data/defaultTemplates';
import { TextInput, Badge } from './ui';

const ICON_MAP = {
  Sparkles,
  CalendarX,
  Clock,
  Award,
  FileX,
  FileCheck,
  Stethoscope,
  Heart,
  ShieldCheck,
  Receipt,
  FileText,
};

/**
 * A small action that lives inside the template card.
 *
 * Rendered as a span with a button role because the card itself is a <button>,
 * and nesting interactive elements is invalid HTML.
 */
function CardAction({ title, onActivate, danger, children }) {
  const activate = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onActivate();
  };

  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      onClick={activate}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && activate(e)}
      className={`grid place-items-center w-6 h-6 rounded cursor-pointer transition-colors
                  ${danger ? 'text-danger hover:bg-danger-soft' : 'text-ink-faint hover:text-ink hover:bg-surface-hover'}`}
    >
      {children}
    </span>
  );
}

export function Sidebar({
  templates,
  activeTemplateId,
  onSelectTemplate,
  onNewTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onResetTemplates,
  onExportTemplatesJson,
  onImportTemplatesJson,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (category !== 'All' && tpl.category !== category) return false;
      if (!q) return true;
      return (
        tpl.title.toLowerCase().includes(q) ||
        tpl.description?.toLowerCase().includes(q) ||
        tpl.body?.toLowerCase().includes(q)
      );
    });
  }, [templates, query, category]);

  const utilityClass =
    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:text-ink hover:bg-surface-hover';

  return (
    <aside className="w-[240px] xl:w-[288px] shrink-0 border-r flex flex-col min-h-0 select-none bg-surface-sunken border-line">
      {/* Header */}
      <div className="px-4 py-4 space-y-3 border-b shrink-0 border-line">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Letters · {templates.length}
          </h2>
          <button
            onClick={onNewTemplate}
            title="Create a new letter"
            className="flex items-center gap-1 h-7 px-2.5 text-[12px] font-semibold rounded-lg
                       cursor-pointer transition-colors bg-accent text-white hover:bg-accent-hover"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            New
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint" />
          <TextInput
            type="search"
            placeholder="Search letters…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="!pl-8 !py-1.5"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-0.5 px-0.5 pb-0.5">
          {TEMPLATE_CATEGORIES.map((cat) => {
            const isActive = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0
                            border cursor-pointer transition-colors
                            ${
                              isActive
                                ? 'bg-accent text-white border-transparent'
                                : 'text-ink-muted border-line hover:bg-surface-hover hover:text-ink'
                            }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 scroll-pane pl-3 pr-1 py-3 space-y-1.5 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-[12px] text-center py-10 px-4 text-ink-faint">
            No letters match “{query}”.
          </p>
        ) : (
          filtered.map((template) => {
            const Icon = ICON_MAP[template.icon] || FileText;
            const isActive = template.id === activeTemplateId;

            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`group w-full text-left px-3 py-2.5 rounded-xl border cursor-pointer transition-colors
                            ${
                              isActive
                                ? 'bg-surface-active border-accent'
                                : 'border-transparent hover:bg-surface-hover'
                            }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`grid place-items-center w-7 h-7 rounded-lg shrink-0 mt-px
                                ${isActive ? 'bg-accent text-white' : 'bg-surface-deep text-ink-muted'}`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[13px] font-semibold leading-snug truncate
                                  ${isActive ? 'text-accent-ink' : 'text-ink'}`}
                    >
                      {template.title}
                    </div>
                    <p className="text-[12px] leading-relaxed mt-1 line-clamp-2 text-ink-muted">
                      {template.description || `${template.body.slice(0, 70)}…`}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <Badge tone={isActive ? 'accent' : 'neutral'}>{template.category}</Badge>

                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <CardAction title="Duplicate" onActivate={() => onDuplicateTemplate(template)}>
                          <Copy className="w-3 h-3" />
                        </CardAction>
                        {template.isCustom && (
                          <CardAction
                            title="Delete"
                            danger
                            onActivate={() => onDeleteTemplate(template.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </CardAction>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer utilities */}
      <div className="flex items-center justify-between px-3 py-3 border-t shrink-0 text-[11px] border-line text-ink-muted">
        <button onClick={onExportTemplatesJson} title="Back up all templates to a JSON file" className={utilityClass}>
          <Download className="w-3.5 h-3.5" />
          Backup
        </button>

        <label title="Restore templates from a JSON file" className={utilityClass}>
          <Upload className="w-3.5 h-3.5" />
          Restore
          <input type="file" accept="application/json" onChange={onImportTemplatesJson} className="hidden" />
        </label>

        <button onClick={onResetTemplates} title="Reset the library to the default clinical templates" className={utilityClass}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>
    </aside>
  );
}
