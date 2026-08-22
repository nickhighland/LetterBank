import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { QuickFillPanel } from './components/QuickFillPanel';
import { DocumentEditor } from './components/DocumentEditor';
import { LetterPreview } from './components/LetterPreview';
import { PrintPortal } from './components/PrintPortal';
import { SettingsModal } from './components/SettingsModal';
import { BatchMergeModal } from './components/BatchMergeModal';
import { TemplateModal } from './components/TemplateModal';
import { Toast } from './components/Toast';
import { PracticeSwitcher } from './components/PracticeSwitcher';
import { UpdateBanner } from './components/UpdateBanner';
import { IncompleteFieldsModal } from './components/IncompleteFieldsModal';

import {
  loadTemplates,
  saveTemplates,
  resetTemplates,
  loadPresets,
  savePresets,
  loadPresetProfiles,
  savePresetProfiles,
  makeProfile,
  DEFAULT_PRESETS,
  loadClinician,
  saveClinician,
  loadSignature,
  saveSignature,
  loadLetterhead,
  saveLetterhead,
  loadTheme,
  saveTheme,
  loadValuesCache,
  saveValuesCache,
  loadActiveTemplateId,
  saveActiveTemplateId,
  loadLetterDates,
  saveLetterDates,
  purgeSeededDefaults,
} from './utils/storage';
import {
  extractVariables,
  renderTemplate,
  stripTrailingClosing,
  startsWithClosing,
} from './utils/variableParser';
import {
  exportStagedPdf,
  printStaged,
  batchExportZip,
  buildLetterFilename,
  isDesktop,
} from './utils/exporter';
import { paginateDocument } from './utils/documentPaginator';
import { fillableArea } from './constants/page';
import { useLetterPages } from './hooks/useLetterPages';
import { useElectronMenu } from './hooks/useElectronMenu';
import { useUpdater } from './hooks/useUpdater';

/**
 * Which `openModal` values open the Settings modal, and which of them name a
 * tab within it.
 *
 * These must be string literals. They were written as bare identifiers
 * (`[settings, presets, letterhead, signature]`), so `settings` resolved to no
 * binding at all and threw `ReferenceError: settings is not defined` while
 * rendering App — a blank white screen on load. The other three did resolve,
 * but to the state objects holding presets/letterhead/signature, which could
 * never equal the string in `openModal`, so the modal would not have opened
 * even once the crash was gone.
 */
const SETTINGS_TABS = ['presets', 'letterhead', 'signature'];
const SETTINGS_MODALS = ['settings', ...SETTINGS_TABS];

export function App() {
  // ---- Persisted state -----------------------------------------------------
  const [templates, setTemplates] = useState(loadTemplates);
  const [activeTemplateId, setActiveTemplateId] = useState(() => {
    const stored = loadActiveTemplateId();
    const all = loadTemplates();
    return all.some((t) => t.id === stored) ? stored : all[0]?.id || '';
  });
  // Practice profiles. `presets` stays a flat key->value object for everything
  // downstream; only its source changes — it is now the active profile's values.
  const [presetProfiles, setPresetProfiles] = useState(loadPresetProfiles);
  const [seedPurgeCount] = useState(() => purgeSeededDefaults(loadTemplates(), loadPresets()));
  const [valuesCache, setValuesCache] = useState(loadValuesCache);
  const [clinician, setClinician] = useState(loadClinician);
  const [signature, setSignature] = useState(loadSignature);
  const [letterhead, setLetterhead] = useState(loadLetterhead);
  const [letterDates, setLetterDates] = useState(loadLetterDates);
  const [theme, setTheme] = useState(loadTheme);

  // ---- UI state ------------------------------------------------------------
  const [activeView, setActiveView] = useState('fill');
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [openModal, setOpenModal] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  // ---- Batch merge state ---------------------------------------------------
  const [csvRecords, setCsvRecords] = useState([]);
  const [csvRecordIndex, setCsvRecordIndex] = useState(0);
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, message: '' });

  // When set, the print stage renders this instead of the on-screen letter.
  // Used to drive batch export one record at a time through the same renderer.
  const [printOverride, setPrintOverride] = useState(null);

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  // Tell the clinician when the one-time cleanup removed pre-filled sample data,
  // so a suddenly-empty field is explained rather than alarming.
  useEffect(() => {
    if (seedPurgeCount > 0) {
      notify(
        `Cleared ${seedPurgeCount} pre-filled sample value${
          seedPurgeCount === 1 ? '' : 's'
        } — letters now start blank`,
        'info'
      );
    }
  }, [seedPurgeCount, notify]);

  // ---- Theme ---------------------------------------------------------------
  useEffect(() => {
    saveTheme(theme);

    const applyTheme = () => {
      let resolved = theme;
      if (theme === "system") {
        resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      document.documentElement.setAttribute("data-theme", resolved);
      if (resolved === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();

    if (theme === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme();
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [theme]);

  // ---- Persistence ---------------------------------------------------------
  useEffect(() => saveTemplates(templates), [templates]);
  useEffect(() => savePresetProfiles(presetProfiles), [presetProfiles]);
  useEffect(() => saveClinician(clinician), [clinician]);
  useEffect(() => saveSignature(signature), [signature]);
  useEffect(() => saveLetterhead(letterhead), [letterhead]);
  useEffect(() => saveValuesCache(valuesCache), [valuesCache]);
  useEffect(() => saveActiveTemplateId(activeTemplateId), [activeTemplateId]);
  useEffect(() => saveLetterDates(letterDates), [letterDates]);

  // ---- Derived -------------------------------------------------------------
  const activeProfile =
    presetProfiles.profiles.find((p) => p.id === presetProfiles.activeId) ||
    presetProfiles.profiles[0];

  /** The active practice's values. Same shape the app has always consumed. */
  const presets = activeProfile?.values || DEFAULT_PRESETS;

  /** Writes land on the active profile, so Settings edits stay per-practice. */
  const setPresets = useCallback((next) => {
    setPresetProfiles((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === prev.activeId
          ? { ...p, values: typeof next === 'function' ? next(p.values) : next }
          : p
      ),
    }));
  }, []);

  const activeTemplate =
    templates.find((t) => t.id === activeTemplateId) || templates[0];

  const activeVariables = useMemo(
    () =>
      extractVariables(
        (activeTemplate?.body || '') + ' ' + (activeTemplate?.subject || '')
      ),
    [activeTemplate?.body, activeTemplate?.subject]
  );

  const currentValues = valuesCache[activeTemplate?.id] || {};

  // The signature block owns the sign-off. If it supplies one, drop the body's
  // trailing salutation so letters don't print "Sincerely," above "Warm regards,".
  const signatureOwnsClosing = startsWithClosing(signature.customBlockText);

  const renderedBody = useMemo(() => {
    const rendered = renderTemplate(activeTemplate?.body || '', currentValues);
    return signatureOwnsClosing ? stripTrailingClosing(rendered) : rendered;
  }, [activeTemplate?.body, currentValues, signatureOwnsClosing]);

  /**
   * Variables with no value. These render as visible placeholders such as
   * "[Client Name]", so an outbound letter must not carry them unnoticed.
   */
  const incompleteFields = useMemo(
    () => activeVariables.filter((v) => !String(currentValues[v] ?? '').trim()),
    [activeVariables, currentValues]
  );

  /** Run `action`, unless fields are empty — then ask first. */
  const guardComplete = useCallback(
    (action, label) => {
      if (incompleteFields.length > 0) {
        setPendingAction({ run: action, label });
        return;
      }
      action();
    },
    [incompleteFields.length]
  );

  // Empty means "today"; the renderer resolves it.
  const letterDate = letterDates[activeTemplate?.id] || '';

  const handleChangeLetterDate = useCallback(
    (iso) => setLetterDates((prev) => ({ ...prev, [activeTemplate?.id]: iso })),
    [activeTemplate?.id]
  );

  const pages = useLetterPages({
    renderedBody,
    letterhead,
    signature,
    clinician,
    clientName: currentValues.client_name || '',
  });

  // ---- Seed from saved presets only -----------------------------------------
  /**
   * Only the clinician's own saved presets pre-fill a letter.
   *
   * The templates also ship a `defaultValue` for most fields, and those used to
   * be seeded here too — which silently placed invented client names and dates
   * of birth (Alex Morgan, 1992-06-18, ...) into real clinical letters. A
   * clinician could export a treatment verification carrying a fabricated DOB
   * without ever having typed it. Those defaults now only load when "Sample"
   * is pressed deliberately.
   */
  useEffect(() => {
    if (!activeTemplate) return;

    setValuesCache((prev) => {
      const existing = prev[activeTemplate.id] || {};
      const updated = { ...existing };
      let changed = false;

      activeVariables.forEach((v) => {
        if ((updated[v] === undefined || updated[v] === '') && presets?.[v] !== undefined) {
          updated[v] = presets[v];
          changed = true;
        }
      });

      return changed ? { ...prev, [activeTemplate.id]: updated } : prev;
    });
  }, [activeTemplate?.id, presets, activeVariables]);

  // ---- Value editing -------------------------------------------------------
  const handleApplyPresets = useCallback(
    (customPresets = presets) => {
      const updated = { ...(valuesCache[activeTemplate?.id] || {}) };
      let matches = 0;

      activeVariables.forEach((varName) => {
        if (customPresets[varName] !== undefined) {
          updated[varName] = customPresets[varName];
          matches++;
        }
      });

      setValuesCache((prev) => ({ ...prev, [activeTemplate?.id]: updated }));

      if (
        customPresets.clinician_name ||
        customPresets.practice_name ||
        customPresets.practice_email
      ) {
        setClinician((prev) => ({
          ...prev,
          name: customPresets.clinician_name || prev.name,
          credentials: customPresets.clinician_credentials || prev.credentials,
          title: customPresets.license_title || prev.title,
          practiceName: customPresets.practice_name || prev.practiceName,
          phone: customPresets.practice_phone || prev.phone,
          email: customPresets.practice_email || prev.email,
          website: customPresets.practice_website || prev.website,
        }));
      }

      notify(
        matches === 0
          ? 'No fields in this letter matched your presets'
          : `Applied presets to ${matches} field${matches === 1 ? '' : 's'}`,
        matches === 0 ? 'info' : 'success'
      );
    },
    [presets, valuesCache, activeTemplate?.id, activeVariables, notify]
  );

  // ---- Practice profiles ---------------------------------------------------
  /**
   * Switching practice re-applies that practice's values to the open letter,
   * which is the point of the switcher — otherwise the header would say
   * "Alma" while the letter still carried the Headway details.
   */
  const handleSelectProfile = useCallback(
    (id) => {
      const next = presetProfiles.profiles.find((p) => p.id === id);
      if (!next) return;

      setPresetProfiles((prev) => ({ ...prev, activeId: id }));

      const updated = { ...(valuesCache[activeTemplate?.id] || {}) };
      activeVariables.forEach((v) => {
        if (next.values[v] !== undefined) updated[v] = next.values[v];
      });
      setValuesCache((prev) => ({ ...prev, [activeTemplate?.id]: updated }));

      notify(`Switched to ${next.name}`, 'info');
    },
    [presetProfiles.profiles, valuesCache, activeTemplate?.id, activeVariables, notify]
  );

  const handleAddProfile = useCallback(
    (name) => {
      const created = makeProfile(name?.trim() || 'New practice');
      setPresetProfiles((prev) => ({
        activeId: created.id,
        profiles: [...prev.profiles, created],
      }));
      notify(`Added ${created.name}`);
      return created.id;
    },
    [notify]
  );

  /** Copying is how most second practices start: same clinician, new platform. */
  const handleDuplicateProfile = useCallback(
    (id) => {
      const src = presetProfiles.profiles.find((p) => p.id === id);
      if (!src) return;
      const copy = makeProfile(`${src.name} (copy)`, src.values);
      setPresetProfiles((prev) => ({
        activeId: copy.id,
        profiles: [...prev.profiles, copy],
      }));
      notify(`Duplicated ${src.name}`);
    },
    [presetProfiles.profiles, notify]
  );

  const handleRenameProfile = useCallback((id, name) => {
    setPresetProfiles((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === id ? { ...p, name: name?.trim() || p.name } : p
      ),
    }));
  }, []);

  const handleDeleteProfile = useCallback(
    (id) => {
      const target = presetProfiles.profiles.find((p) => p.id === id);
      if (!target) return;
      if (presetProfiles.profiles.length <= 1) {
        notify('Keep at least one practice', 'error');
        return;
      }
      if (!window.confirm(`Delete the practice "${target.name}"? This cannot be undone.`)) return;

      setPresetProfiles((prev) => {
        const profiles = prev.profiles.filter((p) => p.id !== id);
        return {
          profiles,
          activeId: prev.activeId === id ? profiles[0].id : prev.activeId,
        };
      });
      notify(`Deleted ${target.name}`, 'info');
    },
    [presetProfiles.profiles, notify]
  );

  const handleChangeValue = useCallback(
    (varName, val) => {
      setValuesCache((prev) => ({
        ...prev,
        [activeTemplate.id]: { ...(prev[activeTemplate.id] || {}), [varName]: val },
      }));
    },
    [activeTemplate?.id]
  );

  const handleResetValues = useCallback(() => {
    const empty = {};
    activeVariables.forEach((v) => {
      empty[v] = '';
    });
    setValuesCache((prev) => ({ ...prev, [activeTemplate.id]: empty }));
    notify('Cleared all fields', 'info');
  }, [activeVariables, activeTemplate?.id, notify]);

  const handleFillSampleData = useCallback(() => {
    const sample = {};
    if (activeTemplate?.fields?.length) {
      activeTemplate.fields.forEach((f) => {
        sample[f.name] = f.defaultValue || '';
      });
    } else {
      activeVariables.forEach((v) => {
        if (v.includes('name')) sample[v] = 'Jordan Taylor';
        else if (v.includes('date')) sample[v] = '2026-08-25';
        else if (v.includes('time')) sample[v] = '11:00 AM';
        else sample[v] = 'Sample Clinical Detail';
      });
    }
    setValuesCache((prev) => ({ ...prev, [activeTemplate.id]: sample }));
    notify('Filled with sample data', 'info');
  }, [activeTemplate, activeVariables, notify]);

  // ---- Copy ----------------------------------------------------------------
  /**
   * Copies the letter body only.
   *
   * It used to prepend "Subject:" and a date line and append the full
   * signature block — practice name, license number, phone, email. Every one
   * of those already appears on the letterhead artwork, so pasting into a
   * portal or an email that has its own letterhead produced the practice
   * details twice.
   */
  const doCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(renderedBody.trim());
      notify('Letter body copied to clipboard');
    } catch (err) {
      console.error('Copy failed', err);
      notify('Could not access the clipboard', 'error');
    }
  }, [renderedBody, notify]);

  const handleCopyText = useCallback(
    () => guardComplete(doCopyText, 'copy this letter'),
    [guardComplete, doCopyText]
  );

  // ---- Export / Print ------------------------------------------------------
  const doExportPdf = useCallback(async () => {
    if (!pages.length) return;
    setIsExporting(true);
    try {
      setPrintOverride(null);
      const filename = buildLetterFilename(
        currentValues.client_name,
        activeTemplate?.title
      );
      const result = await exportStagedPdf(filename);

      if (result.method === 'print-dialog') {
        notify('Choose "Save as PDF" in the print dialog', 'info');
      } else if (result.saved) {
        notify('PDF saved');
      }
    } catch (err) {
      console.error('PDF export failed', err);
      notify(`PDF export failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [pages.length, currentValues.client_name, activeTemplate?.title, notify]);

  const handleExportPdf = useCallback(
    () => guardComplete(doExportPdf, 'export this letter'),
    [guardComplete, doExportPdf]
  );

  const doPrint = useCallback(async () => {
    if (!pages.length) return;
    try {
      setPrintOverride(null);
      await printStaged();
    } catch (err) {
      console.error('Print failed', err);
      notify(`Print failed: ${err.message}`, 'error');
    }
  }, [pages.length, notify]);

  const handlePrint = useCallback(
    () => guardComplete(doPrint, 'print this letter'),
    [guardComplete, doPrint]
  );

  // ---- Templates -----------------------------------------------------------
  const handleSaveTemplate = (updated) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    notify('Template saved');
  };

  const handleSaveAsNewTemplate = (newTpl) => {
    setTemplates((prev) => [newTpl, ...prev]);
    setActiveTemplateId(newTpl.id);
    notify(`Created "${newTpl.title}"`);
  };

  const handleDuplicateTemplate = (tpl) => {
    const duplicated = {
      ...tpl,
      id: `custom-${Date.now()}`,
      title: `${tpl.title} (Copy)`,
      isCustom: true,
    };
    setTemplates((prev) => [duplicated, ...prev]);
    setActiveTemplateId(duplicated.id);
    notify('Template duplicated');
  };

  const handleDeleteTemplate = (id) => {
    const tpl = templates.find((t) => t.id === id);
    if (!window.confirm(`Delete "${tpl?.title}"? This cannot be undone.`)) return;

    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    if (activeTemplateId === id) setActiveTemplateId(updated[0]?.id || '');
    notify('Template deleted', 'info');
  };

  const handleResetTemplates = () => {
    if (
      !window.confirm(
        'Reset the library to the original clinical defaults? Your custom letters will be removed.'
      )
    )
      return;
    const defaults = resetTemplates();
    setTemplates(defaults);
    setActiveTemplateId(defaults[0]?.id || '');
    notify('Library reset to defaults', 'info');
  };

  const handleExportTemplatesJson = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LetterBank_Templates_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Backed up ${templates.length} templates`);
  };

  const handleImportTemplatesJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('File did not contain a template list');
        }
        setTemplates(parsed);
        setActiveTemplateId(parsed[0]?.id || '');
        notify(`Imported ${parsed.length} templates`);
      } catch (err) {
        notify(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---- CSV batch -----------------------------------------------------------
  const applyRecord = (idx, records = csvRecords) => {
    setCsvRecordIndex(idx);
    setValuesCache((prev) => ({
      ...prev,
      [activeTemplate.id]: records[idx].values,
    }));
  };

  const handleApplyCsvBatch = (records) => {
    setCsvRecords(records);
    if (records.length > 0) applyRecord(0, records);
    notify(`Loaded ${records.length} records`);
  };

  /**
   * Stages one CSV record into the print portal and waits for React to commit
   * it, so the native PDF renderer captures the right document.
   */
  const stageRecord = useCallback(
    async (index) => {
      const rowValues = csvRecords[index].values;
      const raw = renderTemplate(activeTemplate.body, rowValues);
      const body = signatureOwnsClosing ? stripTrailingClosing(raw) : raw;

      const area = fillableArea(letterhead);
      const recordPages = paginateDocument({
        renderedBody: body,
        fillableWidth: area.width,
        fillableHeight: area.height,
        fontSize: letterhead.fontSize,
        lineHeight: letterhead.lineHeight,
        fontFamily: letterhead.fontFamily,
        paragraphSpacing: letterhead.paragraphSpacing,
        bodyAlignment: letterhead.bodyAlignment,
        showDate: letterhead.showDate,
        showContinuationHeader: letterhead.showContinuationHeader,
        signatureConfig: signature,
        clinician,
        clientName: rowValues.client_name || '',
      });

      flushSync(() => {
        setPrintOverride({
          pages: recordPages,
          clientName: rowValues.client_name || '',
        });
      });
    },
    [csvRecords, activeTemplate, letterhead, signature, clinician, signatureOwnsClosing]
  );

  const handleBatchExportZip = async (records) => {
    setIsBatchExporting(true);
    try {
      await batchExportZip({
        records,
        templateTitle: activeTemplate.title,
        stageRecord,
        onProgress: (current, total, message) =>
          setBatchProgress({ current, total, message }),
      });
      setOpenModal(null);
      notify(`Exported ${records.length} letters`);
    } catch (err) {
      console.error('Batch export failed', err);
      notify(err.message, 'error');
    } finally {
      setPrintOverride(null);
      setIsBatchExporting(false);
      setBatchProgress({ current: 0, total: 0, message: '' });
    }
  };

  const { update, openDownload, dismiss: dismissUpdate } = useUpdater(notify);

  // ---- Desktop menu accelerators ------------------------------------------
  useElectronMenu({
    onNewLetter: () => setOpenModal('template'),
    onExportPdf: handleExportPdf,
    onPrint: handlePrint,
  });

  const csvBatchInfo =
    csvRecords.length > 0
      ? { currentIndex: csvRecordIndex, total: csvRecords.length }
      : null;

  const stagedPages = printOverride?.pages || pages;
  const stagedClientName =
    printOverride?.clientName ?? (currentValues.client_name || '');

  return (
    <div className="h-full flex flex-col bg-surface-base text-ink">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenModal={setOpenModal}
        onCopyText={handleCopyText}
        onExportPdf={handleExportPdf}
        onPrint={handlePrint}
        isExporting={isExporting}
        theme={theme}
        setTheme={setTheme}
        csvBatchInfo={csvBatchInfo}
        incompleteCount={incompleteFields.length}
        practiceSwitcher={
          <PracticeSwitcher
            profiles={presetProfiles.profiles}
            activeId={presetProfiles.activeId}
            onSelect={handleSelectProfile}
            onAdd={handleAddProfile}
            onManage={() => setOpenModal('presets')}
          />
        }
      />

      <UpdateBanner update={update} onDownload={openDownload} onDismiss={dismissUpdate} />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          templates={templates}
          activeTemplateId={activeTemplate?.id}
          onSelectTemplate={(id) => {
            setActiveTemplateId(id);
            setCsvRecords([]);
          }}
          onNewTemplate={() => setOpenModal('template')}
          onDuplicateTemplate={handleDuplicateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onResetTemplates={handleResetTemplates}
          onExportTemplatesJson={handleExportTemplatesJson}
          onImportTemplatesJson={handleImportTemplatesJson}
        />

        {activeView === 'fill' ? (
          <QuickFillPanel
            template={activeTemplate}
            variables={activeVariables}
            values={currentValues}
            onChangeValue={handleChangeValue}
            onResetValues={handleResetValues}
            onFillSampleData={handleFillSampleData}
            presets={presets}
            onApplyPresets={handleApplyPresets}
            csvBatchInfo={csvBatchInfo}
            onCsvPrevRecord={() =>
              csvRecordIndex > 0 && applyRecord(csvRecordIndex - 1)
            }
            onCsvNextRecord={() =>
              csvRecordIndex < csvRecords.length - 1 && applyRecord(csvRecordIndex + 1)
            }
            letterDate={letterDate}
            onChangeLetterDate={handleChangeLetterDate}
            letterhead={letterhead}
            incompleteFields={incompleteFields}
          />
        ) : (
          <DocumentEditor
            template={activeTemplate}
            onSaveTemplate={handleSaveTemplate}
            onSaveAsNew={handleSaveAsNewTemplate}
          />
        )}

        <LetterPreview
          pages={pages}
          letterhead={letterhead}
          signature={signature}
          clinician={clinician}
          clientName={currentValues.client_name || ''}
          letterDate={letterDate}
          onToggleLetterhead={() =>
            setLetterhead((lh) => ({ ...lh, showLetterhead: !lh.showLetterhead }))
          }
        />
      </div>

      {/* The document staged for print and PDF — mounted at <body> level. */}
      <PrintPortal
        pages={stagedPages}
        letterhead={letterhead}
        signature={signature}
        clinician={clinician}
        clientName={stagedClientName}
        letterDate={letterDate}
      />

      <SettingsModal
        isOpen={SETTINGS_MODALS.includes(openModal)}
        initialTab={SETTINGS_TABS.includes(openModal) ? openModal : 'presets'}
        onClose={() => setOpenModal(null)}
        letterhead={letterhead}
        onSaveLetterhead={setLetterhead}
        presets={presets}
        onSavePresets={setPresets}
        profiles={presetProfiles.profiles}
        activeProfileId={presetProfiles.activeId}
        onSelectProfile={handleSelectProfile}
        onAddProfile={handleAddProfile}
        onDuplicateProfile={handleDuplicateProfile}
        onRenameProfile={handleRenameProfile}
        onDeleteProfile={handleDeleteProfile}
        onApplyPresetsToCurrentLetter={handleApplyPresets}
        signature={signature}
        onSaveSignature={setSignature}
        clinician={clinician}
        onSaveClinician={setClinician}
      />

      <BatchMergeModal
        isOpen={openModal === 'batch'}
        onClose={() => setOpenModal(null)}
        template={activeTemplate}
        variables={activeVariables}
        onApplyCsvBatch={handleApplyCsvBatch}
        onBatchExportZip={handleBatchExportZip}
        isBatchExporting={isBatchExporting}
        batchProgress={batchProgress}
        canBatchExport={isDesktop()}
      />

      <TemplateModal
        isOpen={openModal === 'template'}
        onClose={() => setOpenModal(null)}
        onSaveNewTemplate={handleSaveAsNewTemplate}
      />

      <IncompleteFieldsModal
        pending={pendingAction}
        fields={incompleteFields}
        onClose={() => setPendingAction(null)}
        onContinue={() => {
          const action = pendingAction?.run;
          setPendingAction(null);
          action?.();
        }}
        onFill={() => {
          setPendingAction(null);
          setActiveView('fill');
          // Put the cursor in the first empty field rather than leaving the
          // clinician to hunt for it.
          requestAnimationFrame(() => {
            document.querySelector('[data-empty-field="true"]')?.focus();
          });
        }}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export default App;
