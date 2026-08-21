import React from 'react';
import {
  FileText,
  Edit3,
  AlertTriangle,
  Image as ImageIcon,
  PenTool,
  Users,
  Copy,
  Download,
  Printer,
  Sun,
  Moon,
  Laptop,
  Loader2,
} from 'lucide-react';
import { IconButton, SegmentedControl } from './ui';
import { BrandLogo } from './BrandLogo';

const SETTINGS = [
  { id: 'presets', label: 'Presets', Icon: FileText, hint: 'Practice & clinician presets' },
  { id: 'letterhead', label: 'Letterhead', Icon: ImageIcon, hint: 'Letterhead, margins & type' },
  { id: 'signature', label: 'Signature', Icon: PenTool, hint: 'Signature block & credentials' },
  { id: 'batch', label: 'Merge', Icon: Users, hint: 'CSV mail merge' },
];

const Divider = () => <div className="w-px h-7 shrink-0 bg-line no-drag" />;

export function Header({
  activeView,
  setActiveView,
  onOpenModal,
  onCopyText,
  onExportPdf,
  onPrint,
  isExporting,
  theme,
  setTheme,
  csvBatchInfo,
  incompleteCount = 0,
}) {
  const isMacDesktop =
    typeof window !== 'undefined' &&
    window.electronAPI?.isElectron &&
    window.electronAPI?.platform === 'darwin';

  return (
    <header
      className={`h-15 shrink-0 border-b flex items-center gap-4 px-5 select-none bg-surface-raised border-line app-drag-region ${
        isMacDesktop ? 'pl-20' : ''
      }`}
    >
      {/* Brand Logo - auto-switches between Day and Night assets */}
      <div className="no-drag flex items-center">
        <BrandLogo className="h-7 w-auto shrink-0 text-ink" />
      </div>

      <Divider />

      <div className="no-drag">
        <SegmentedControl
          value={activeView}
          onChange={setActiveView}
          options={[
            { value: 'fill', label: 'Quick Fill', Icon: FileText },
            { value: 'editor', label: 'Editor', Icon: Edit3 },
          ]}
        />
      </div>

      {incompleteCount > 0 && (
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]
                     font-medium bg-warning-soft text-warning no-drag"
          title="Copy, print and export will ask you to confirm"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {incompleteCount} empty
        </div>
      )}

      {csvBatchInfo && (
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent-soft text-accent-ink no-drag">
          <Users className="w-3.5 h-3.5" />
          Record {csvBatchInfo.currentIndex + 1} of {csvBatchInfo.total}
        </div>
      )}

      {/* Draggable spacer across the middle of the window */}
      <div className="flex-1 min-w-4 h-full" />

      {/* Settings */}
      <div className="flex items-center gap-1 shrink-0 no-drag">
        {SETTINGS.map(({ id, label, Icon, hint }) => (
          <IconButton key={id} onClick={() => onOpenModal(id)} label={hint}>
            <Icon className="w-4 h-4" />
            <span className="hidden xl:inline">{label}</span>
          </IconButton>
        ))}
      </div>

      <Divider />

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 no-drag">
        <IconButton onClick={onCopyText} label="Copy letter body to clipboard">
          <Copy className="w-4 h-4" />
          <span className="hidden lg:inline">Copy</span>
        </IconButton>

        <IconButton onClick={onPrint} label="Print letter">
          <Printer className="w-4 h-4" />
          <span className="hidden lg:inline">Print</span>
        </IconButton>

        <button
          onClick={onExportPdf}
          disabled={isExporting}
          title="Export as PDF"
          className="flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-semibold rounded-lg
                     whitespace-nowrap shrink-0 cursor-pointer transition-colors
                     bg-accent text-white hover:bg-accent-hover
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{isExporting ? 'Exporting…' : 'Export PDF'}</span>
        </button>
      </div>

      <Divider />

      {/* Day / Night / System Mode Segmented Control */}
      <div className="no-drag">
        <SegmentedControl
          value={theme}
          onChange={setTheme}
          compact
          options={[
            { value: 'light', label: 'Day', Icon: Sun },
            { value: 'dark', label: 'Night', Icon: Moon },
            { value: 'system', label: 'Auto', Icon: Laptop },
          ]}
        />
      </div>
    </header>
  );
}
