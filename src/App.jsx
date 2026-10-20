import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { ShieldAlert } from 'lucide-react';

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
  loadActiveTemplateId,
  saveActiveTemplateId,
  loadFieldLibrary,
  saveFieldLibrary,
} from './utils/storage';
import { onSaveError, importImageDataUrl } from './utils/persist';
import { createBackup, readBackupFile, lettersToAdd, backupFileName } from './utils/backup';
import { draftFrom, isDraftDirty, withDraft, dirtyTemplateIds } from './utils/templateDraft';
import { useChoiceDialog } from './components/ChoiceDialog';
import {
  stripTrailingClosing,
  startsWithClosing,
  renderContinuationHeader,
  renderTemplate,
  formatLabel,
} from './utils/variableParser';
import {
  allLetterFields,
  letterFieldsInUse,
  resolveFieldDefs,
  typesOf,
  labelsOf,
  needsValue,
  renderLetter,
  normaliseFieldLibrary,
  withFieldDef,
  letterValues,
} from './utils/fieldDefs';
import { renderLetterBlocks, splitBody, replaceBlocks } from './utils/letterBlocks';
import { markupToPlainText } from './utils/letterMarkup';
import {
  exportStagedPdf,
  printStaged,
  batchExportZip,
  buildLetterFilename,
  isDesktop,
} from './utils/exporter';
import { exportDocx, buildDocx } from './utils/docxExporter';
import { addressLines } from './utils/recipient';
import { categoriesInUse, categoryChoices, renameCategory } from './utils/categories';
import { paginateLetter } from './utils/documentPaginator';
import { mergeRecordValues } from './utils/batch';
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
const SETTINGS_TABS = ['presets', 'letterhead', 'signature', 'fields'];

/** How a failed save is described: "Couldn't save your letterhead". */
const SAVE_LABELS = {
  templates: 'your letter templates',
  presetProfiles: 'your practice details',
  clinician: 'your credentials',
  signature: 'your signature',
  letterhead: 'your letterhead',
  theme: 'the theme',
  activeTemplateId: 'the open letter',
  fieldLibrary: 'your fields',
};
const SETTINGS_MODALS = ['settings', ...SETTINGS_TABS];

/** "1 letter", "3 letters". */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const EMPTY_VALUES = {};

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
  const [clinician, setClinician] = useState(loadClinician);
  const [signature, setSignature] = useState(loadSignature);
  const [letterhead, setLetterhead] = useState(loadLetterhead);
  const [theme, setTheme] = useState(loadTheme);
  const [fieldLibrary, setFieldLibrary] = useState(loadFieldLibrary);

  // ---- Client details: memory only ------------------------------------------
  // What is typed into each letter, and each letter's own date and subject.
  // Never written anywhere, so closing LetterBank erases them for good.
  const [valuesCache, setValuesCache] = useState({});
  const [letterDates, setLetterDates] = useState({});
  const [letterSubjects, setLetterSubjects] = useState({});
  // Wording changed on the page in Quick Fill, for this letter only.
  const [letterBodies, setLetterBodies] = useState({});
  // Letters opened this session, latest first, for the sidebar. Forgotten on quit.
  const [recentIds, setRecentIds] = useState([]);

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

  /** A toast; `action` adds a button to it, such as { label: 'Undo', run }. */
  const notify = useCallback((message, tone = 'success', action = null) => {
    setToast({ message, tone, action, id: Date.now() });
  }, []);

  const [choiceDialog, ask] = useChoiceDialog();

  // A save that fails says so now, instead of the change quietly vanishing on
  // the next launch.
  useEffect(
    () =>
      onSaveError((key, err) =>
        notify(`Couldn't save ${SAVE_LABELS[key] || 'your settings'}: ${err?.message || err}`, 'error')
      ),
    [notify]
  );

  // ---- Theme ---------------------------------------------------------------
  useEffect(() => {
    void saveTheme(theme);

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
  // Settings only. Client details above are deliberately absent.
  useEffect(() => void saveTemplates(templates), [templates]);
  useEffect(() => void savePresetProfiles(presetProfiles), [presetProfiles]);
  useEffect(() => void saveClinician(clinician), [clinician]);
  useEffect(() => void saveSignature(signature), [signature]);
  useEffect(() => void saveLetterhead(letterhead), [letterhead]);
  useEffect(() => void saveActiveTemplateId(activeTemplateId), [activeTemplateId]);
  useEffect(() => void saveFieldLibrary(fieldLibrary), [fieldLibrary]);

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

  const savedTemplate =
    templates.find((t) => t.id === activeTemplateId) || templates[0];

  // ---- Unsaved template edits -----------------------------------------------
  // By template id, so they survive switching views or letters. The letter
  // below is the draft whenever there is one: what the preview shows, and what
  // prints, is what the editor says.
  const [templateDrafts, setTemplateDrafts] = useState({});
  const editorDraft = templateDrafts[savedTemplate?.id] || draftFrom(savedTemplate);
  const draftDirty = isDraftDirty(savedTemplate, templateDrafts[savedTemplate?.id]);
  const activeTemplate = useMemo(
    () => withDraft(savedTemplate, templateDrafts[savedTemplate?.id]),
    [savedTemplate, templateDrafts]
  );
  const unsavedTemplateIds = useMemo(
    () => dirtyTemplateIds(templates, templateDrafts),
    [templates, templateDrafts]
  );

  const handleChangeDraft = useCallback(
    (update) => {
      const id = savedTemplate?.id;
      if (!id) return;
      setTemplateDrafts((prev) => {
        const current = prev[id] || draftFrom(savedTemplate);
        return { ...prev, [id]: typeof update === 'function' ? update(current) : update };
      });
    },
    [savedTemplate]
  );

  const clearDraft = useCallback((id) => {
    setTemplateDrafts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Closing the window with unsaved changes asks Save / Don't Save / Cancel
  // (electron/main.js); Save lands here.
  const draftState = useRef({ templates, templateDrafts });
  draftState.current = { templates, templateDrafts };

  useEffect(() => {
    window.electronAPI?.setUnsavedDrafts?.(unsavedTemplateIds.length);
  }, [unsavedTemplateIds.length]);

  useEffect(
    () =>
      window.electronAPI?.onSaveDraftsRequested?.(async () => {
        const { templates: current, templateDrafts: drafts } = draftState.current;
        const updated = current.map((t) => withDraft(t, drafts[t.id]));
        setTemplates(updated);
        setTemplateDrafts({});
        window.electronAPI.draftsSaved(await saveTemplates(updated));
      }),
    []
  );

  // The browser build can only offer the browser's own "Leave site?" prompt.
  useEffect(() => {
    if (window.electronAPI || !unsavedTemplateIds.length) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsavedTemplateIds.length]);

  // The subject this letter prints with: the clinician's own wording for this
  // letter if they changed it in Quick Fill, otherwise the template's.
  // An empty override is kept: clearing the subject leaves it blank (the page 2
  // header then falls back to the client's name) rather than snapping back.
  const subjectOverridden = Object.hasOwn(letterSubjects, activeTemplate?.id || '');
  const subjectSource = subjectOverridden
    ? letterSubjects[activeTemplate.id]
    : activeTemplate?.subject || '';

  // The wording this letter prints with. In Quick Fill that is the wording
  // the clinician changed on the page for this letter, if they did; the
  // Editor always shows the template's own, which is what it edits.
  const bodyOverridden =
    activeView === 'fill' && Object.hasOwn(letterBodies, activeTemplate?.id || '');
  const bodySource = bodyOverridden ? letterBodies[activeTemplate.id] : activeTemplate?.body || '';

  const handleResetBody = useCallback(
    () =>
      setLetterBodies((prev) => {
        const next = { ...prev };
        delete next[activeTemplate?.id];
        return next;
      }),
    [activeTemplate?.id]
  );

  // The address the letter is sent to, if it has one (Editor › Recipient address).
  const recipientSource = activeTemplate?.recipient || '';

  const currentValues = valuesCache[activeTemplate?.id] || EMPTY_VALUES;
  const letterSource = `${recipientSource}\n\n${bodySource}\n\n${subjectSource}`;

  /** Every field the letter can ask for, whichever way its options go. */
  const allVariables = useMemo(() => allLetterFields(letterSource), [letterSource]);

  /** The fields the letter uses as it stands: what Quick Fill shows. */
  const activeVariables = useMemo(() => {
    const names = [
      ...letterFieldsInUse(recipientSource, currentValues),
      ...letterFieldsInUse(bodySource, currentValues),
      ...letterFieldsInUse(subjectSource, currentValues),
    ];
    return [...new Set(names)];
  }, [recipientSource, bodySource, subjectSource, currentValues]);

  /** Each field's label, type, help and choices. See utils/fieldDefs.js. */
  const fieldDefs = useMemo(
    () =>
      resolveFieldDefs(allVariables, {
        text: letterSource,
        library: fieldLibrary,
        templateFields: activeTemplate?.fields,
      }),
    [allVariables, letterSource, fieldLibrary, activeTemplate?.fields]
  );
  const fieldTypes = useMemo(() => typesOf(fieldDefs), [fieldDefs]);
  const fieldLabels = useMemo(() => labelsOf(fieldDefs), [fieldDefs]);

  const renderedSubject = useMemo(
    () => renderLetter(subjectSource, currentValues, fieldTypes, fieldLabels).trim(),
    [subjectSource, currentValues, fieldTypes, fieldLabels]
  );

  const renderedRecipient = useMemo(
    () => addressLines(renderLetter(recipientSource, currentValues, fieldTypes, fieldLabels)),
    [recipientSource, currentValues, fieldTypes, fieldLabels]
  );

  const continuationLine = renderContinuationHeader(letterhead.continuationText, {
    subject: renderedSubject,
    clientName: currentValues.client_name || '',
  });

  const handleChangeSubject = useCallback(
    (text) => setLetterSubjects((prev) => ({ ...prev, [activeTemplate?.id]: text })),
    [activeTemplate?.id]
  );

  const handleResetSubject = useCallback(
    () =>
      setLetterSubjects((prev) => {
        const next = { ...prev };
        delete next[activeTemplate?.id];
        return next;
      }),
    [activeTemplate?.id]
  );

  // The signature block owns the sign-off. If it supplies one, drop the body's
  // trailing salutation so letters don't print "Sincerely," above "Warm regards,".
  const signatureOwnsClosing = startsWithClosing(signature.customBlockText);

  const renderedBody = useMemo(() => {
    const rendered = renderLetter(bodySource, currentValues, fieldTypes, fieldLabels);
    return signatureOwnsClosing ? stripTrailingClosing(rendered) : rendered;
  }, [bodySource, currentValues, fieldTypes, fieldLabels, signatureOwnsClosing]);

  /** The same letter as blocks that know where in the template they came from. */
  const renderedBlocks = useMemo(
    () =>
      renderLetterBlocks(bodySource, currentValues, fieldTypes, fieldLabels, {
        stripClosing: signatureOwnsClosing,
      }),
    [bodySource, currentValues, fieldTypes, fieldLabels, signatureOwnsClosing]
  );

  /**
   * Variables with no value. These render as visible placeholders such as
   * "[Client Name]", so an outbound letter must not carry them unnoticed.
   */
  const incompleteFields = useMemo(
    () => activeVariables.filter((v) => needsValue(fieldDefs[v], currentValues[v])),
    [activeVariables, currentValues, fieldDefs]
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
    blocks: renderedBlocks,
    letterhead,
    signature,
    recipient: renderedRecipient,
  });

  // ---- Editing on the page --------------------------------------------------
  /**
   * A paragraph edited on the page. In the Editor it changes the template's
   * draft, like typing in the Editor pane. In Quick Fill it changes this
   * letter's own wording only: the template is left alone, and like the
   * client's details the change is gone when LetterBank closes.
   */
  const commitPageEdit = useCallback(
    (origin, markup) => {
      if (activeView === 'editor') {
        handleChangeDraft((prev) => ({ ...prev, body: replaceBlocks(prev.body, origin, markup) }));
        return;
      }
      const id = activeTemplate?.id;
      if (!id) return;
      setLetterBodies((prev) => ({
        ...prev,
        [id]: replaceBlocks(Object.hasOwn(prev, id) ? prev[id] : activeTemplate.body, origin, markup),
      }));
    },
    [activeView, activeTemplate, handleChangeDraft]
  );

  /** Fields on the page show what they print: the value, or "[Label]" while empty. */
  const pageChips = useMemo(() => {
    const filled = letterValues(currentValues);
    return {
      field: (name) => ({
        text: renderTemplate(`{{${name}}}`, filled, fieldTypes, fieldLabels),
        empty: fieldTypes[name] !== 'yesno' && !String(filled[name] ?? '').trim(),
        title: fieldLabels[name] || formatLabel(name),
      }),
      label: (name) => fieldLabels[name] || formatLabel(name),
    };
  }, [currentValues, fieldTypes, fieldLabels]);

  const pageFieldMenu = useMemo(
    () => ({
      existing: allVariables,
      defs: fieldDefs,
      library: fieldLibrary,
      onInsert: (def, { saveToLibrary = false, pronoun = false } = {}) => {
        if (pronoun) return;
        if (saveToLibrary) handleSaveLibraryField(def);
        if (activeView !== 'editor') return;
        handleChangeDraft((prev) => {
          const fields = withFieldDef(prev.fields, def);
          return fields === prev.fields ? prev : { ...prev, fields };
        });
      },
    }),
    // handleSaveLibraryField is declared further down and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allVariables, fieldDefs, fieldLibrary, activeView, handleChangeDraft]
  );

  const pageEditing = activeTemplate
    ? {
        key: `${activeView}:${activeTemplate.id}`,
        sourceFor: (origin) => splitBody(bodySource).slice(origin.from, origin.to + 1).join('\n\n'),
        commit: commitPageEdit,
        chips: pageChips,
        fieldMenu: pageFieldMenu,
      }
    : null;

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

      allVariables.forEach((v) => {
        if ((updated[v] === undefined || updated[v] === '') && presets?.[v] !== undefined) {
          updated[v] = presets[v];
          changed = true;
        }
      });

      return changed ? { ...prev, [activeTemplate.id]: updated } : prev;
    });
  }, [activeTemplate?.id, presets, allVariables]);

  // ---- Value editing -------------------------------------------------------
  const handleApplyPresets = useCallback(
    (customPresets = presets) => {
      const updated = { ...(valuesCache[activeTemplate?.id] || {}) };
      let matches = 0;

      allVariables.forEach((varName) => {
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
    [presets, valuesCache, activeTemplate?.id, allVariables, notify]
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
      allVariables.forEach((v) => {
        if (next.values[v] !== undefined) updated[v] = next.values[v];
      });
      setValuesCache((prev) => ({ ...prev, [activeTemplate?.id]: updated }));

      notify(`Switched to ${next.name}`, 'info');
    },
    [presetProfiles.profiles, valuesCache, activeTemplate?.id, allVariables, notify]
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
    const id = activeTemplate.id;
    const before = valuesCache[id];
    const empty = {};
    allVariables.forEach((v) => {
      empty[v] = '';
    });
    setValuesCache((prev) => ({ ...prev, [id]: empty }));
    const hadValues = Object.values(before || {}).some((v) => String(v ?? '').trim());
    notify(
      'Cleared all fields',
      'info',
      hadValues
        ? { label: 'Undo', run: () => setValuesCache((prev) => ({ ...prev, [id]: before })) }
        : null
    );
  }, [allVariables, activeTemplate?.id, valuesCache, notify]);

  const handleFillSampleData = useCallback(() => {
    const sample = {};
    allVariables.forEach((v) => {
      const def = fieldDefs[v];
      if (def?.defaultValue) sample[v] = def.defaultValue;
      else if (def?.type === 'select') sample[v] = def.options[0] || '';
      else if (def?.type === 'yesno') sample[v] = 'yes';
      else if (def?.type === 'number') sample[v] = '3';
      else if (def?.type === 'date') sample[v] = '2026-08-25';
      else if (def?.type === 'time') sample[v] = '11:00';
      else if (v.includes('name')) sample[v] = 'Jordan Taylor';
      else sample[v] = 'Sample Clinical Detail';
    });
    setValuesCache((prev) => ({ ...prev, [activeTemplate.id]: sample }));
    notify('Filled with sample data', 'info');
  }, [activeTemplate, allVariables, fieldDefs, notify]);

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
      const text = markupToPlainText(renderedBody).trim();
      await navigator.clipboard.writeText(text);
      // So quitting can clear it if it is still on the clipboard.
      window.electronAPI?.noteCopied?.(text);
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

  // Asked before the first email of each session, since letters carry
  // clinical details and ordinary email isn't private.
  const emailWarned = useRef(false);
  const attachToMail = useCallback(
    async (filePath) => {
      if (!emailWarned.current) {
        const answer = await ask({
          title: 'Email isn’t secure',
          icon: ShieldAlert,
          message:
            'Ordinary email can be read on its way and copies stay on mail servers. ' +
            'Use your secure portal or encrypted email for client letters when you can, ' +
            'and email only with your client’s agreement.',
          choices: [{ value: 'attach', label: 'Attach to Mail', primary: true }],
        });
        if (answer !== 'attach') return;
        emailWarned.current = true;
      }
      if (!(await window.electronAPI.mailFile(filePath))) notify('Couldn’t open Mail', 'error');
    },
    [ask, notify]
  );

  /** The buttons on a "saved" toast: show the file, and attach it to an email. */
  const savedFileActions = useCallback(
    (filePath, { mail = true } = {}) => {
      const api = window.electronAPI;
      if (!filePath || !api?.revealFile) return null;
      const mac = api.platform === 'darwin';
      const actions = [{ label: mac ? 'Show in Finder' : 'Show in folder', run: () => api.revealFile(filePath) }];
      if (mail && mac) actions.push({ label: 'Attach to Mail', run: () => attachToMail(filePath) });
      return actions;
    },
    [attachToMail]
  );

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
        notify('PDF saved', 'success', savedFileActions(result.filePath));
      }
    } catch (err) {
      console.error('PDF export failed', err);
      notify(`PDF export failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [pages.length, currentValues.client_name, activeTemplate?.title, notify, savedFileActions]);

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

  const doExportWord = useCallback(async () => {
    if (!pages.length) return;
    setIsExporting(true);
    try {
      const filename = buildLetterFilename(
        currentValues.client_name,
        activeTemplate?.title
      ).replace(/\.pdf$/, '.docx');
      const result = await exportDocx({
        filename,
        renderedBody,
        pageCount: pages.length,
        letterhead,
        signature,
        clinician,
        subject: renderedSubject,
        clientName: currentValues.client_name || '',
        letterDate,
        recipient: renderedRecipient,
      });
      if (result.saved) notify('Word document saved', 'success', savedFileActions(result.filePath));
    } catch (err) {
      console.error('Word export failed', err);
      notify(`Word export failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [
    pages.length,
    renderedBody,
    currentValues.client_name,
    activeTemplate?.title,
    letterhead,
    signature,
    clinician,
    renderedSubject,
    renderedRecipient,
    letterDate,
    notify,
    savedFileActions,
  ]);

  const handleExportWord = useCallback(
    () => guardComplete(doExportWord, 'export this letter'),
    [guardComplete, doExportWord]
  );

  // ---- Templates -----------------------------------------------------------
  const handleSaveTemplate = (updated) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    clearDraft(updated.id);
    notify('Template saved');
  };

  /** ⌘S: save the open letter's changes, wherever they were made. */
  const handleSaveShortcut = () => {
    if (draftDirty) handleSaveTemplate({ ...savedTemplate, ...editorDraft });
  };

  const handleSelectTemplate = (id) => {
    setActiveTemplateId(id);
    setCsvRecords([]);
    // The letter being left is the one to come back to.
    if (activeTemplate?.id && activeTemplate.id !== id) {
      setRecentIds((prev) => [activeTemplate.id, ...prev.filter((r) => r !== activeTemplate.id)].slice(0, 6));
    }
  };

  const handleTogglePin = (id) =>
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));

  /** Rename a category on every letter, unsaved changes in the Editor included. */
  const handleRenameCategory = (from, to) => {
    setTemplates((prev) => renameCategory(prev, from, to));
    setTemplateDrafts((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, draft]) => [id, renameCategory([draft], from, to)[0]])
      )
    );
    notify(`Renamed “${from}” to “${to.trim()}”`);
  };

  const categories = useMemo(() => categoriesInUse(templates), [templates]);
  const allCategories = useMemo(() => categoryChoices(templates), [templates]);

  const handleSaveAsNewTemplate = (newTpl, fromId) => {
    setTemplates((prev) => [newTpl, ...prev]);
    // "Save as new" leaves the original as it was saved.
    if (fromId) clearDraft(fromId);
    setActiveTemplateId(newTpl.id);
    notify(`Created "${newTpl.title}"`);
  };

  /** Add a field to My fields, or update the one with its name. */
  const handleSaveLibraryField = useCallback((def) => {
    setFieldLibrary((prev) => {
      const at = prev.findIndex((f) => f.name === def.name);
      const next = at === -1 ? [...prev, def] : prev.map((f, i) => (i === at ? def : f));
      return normaliseFieldLibrary(next);
    });
  }, []);

  /** Throw away unsaved edits to the open template, after asking. */
  const handleDiscardDraft = async () => {
    if (!draftDirty) return;
    const answer = await ask({
      title: 'Discard your changes?',
      message: `Your unsaved changes to “${savedTemplate.title}” will be lost.`,
      choices: [{ value: 'discard', label: 'Discard changes', danger: true }],
    });
    if (answer === 'discard') {
      clearDraft(savedTemplate.id);
      notify('Changes discarded', 'info');
    }
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

  const handleDeleteTemplate = async (id) => {
    const tpl = templates.find((t) => t.id === id);
    const answer = await ask({
      title: 'Delete this letter?',
      message: `“${tpl?.title}” will be removed from your library. This cannot be undone.`,
      choices: [{ value: 'delete', label: 'Delete', danger: true }],
    });
    if (answer !== 'delete') return;

    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    if (activeTemplateId === id) setActiveTemplateId(updated[0]?.id || '');
    // Drop anything typed into the deleted letter along with it.
    const without = (prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    };
    setValuesCache(without);
    setLetterDates(without);
    setLetterSubjects(without);
    clearDraft(id);
    notify('Template deleted', 'info');
  };

  const handleResetTemplates = async () => {
    const answer = await ask({
      title: 'Reset your library?',
      message:
        'Your letters go back to the original clinical defaults. Letters you created, and changes you made to the defaults, are removed.',
      choices: [{ value: 'reset', label: 'Reset library', danger: true }],
    });
    if (answer !== 'reset') return;
    const defaults = resetTemplates();
    setTemplates(defaults);
    setTemplateDrafts({});
    setActiveTemplateId(defaults[0]?.id || '');
    notify('Library reset to defaults', 'info');
  };

  // ---- Backup and restore ---------------------------------------------------
  /** Letters, practices, letterhead, signature and preferences. Never clients. */
  const handleBackup = async () => {
    try {
      const backup = await createBackup({
        templates,
        presetProfiles,
        clinician,
        signature,
        letterhead,
        theme,
        fieldLibrary,
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`Backed up ${plural(templates.length, 'letter')}, your practices, letterhead and signature`);
    } catch (err) {
      notify(`Backup failed: ${err.message}`, 'error');
    }
  };

  /** Add letters from a backup to the library, skipping ones already there. */
  const addLetters = (imported) => {
    const added = lettersToAdd(templates, imported);
    if (!added.length) {
      notify('Every letter in that file is already in your library', 'info');
      return;
    }
    setTemplates((prev) => [...added, ...prev]);
    setActiveTemplateId(added[0].id);
    notify(`Added ${plural(added.length, 'letter')} to your library`);
  };

  const replaceLetters = (imported) => {
    setTemplates(imported);
    setTemplateDrafts({});
    setActiveTemplateId(imported[0].id);
  };

  /**
   * Restore from a backup file, after asking what to restore. Restore used to
   * replace the whole library without asking.
   */
  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let backup;
    try {
      backup = readBackupFile(await file.text());
    } catch (err) {
      notify(`Restore failed: ${err.message}`, 'error');
      return;
    }

    if (backup.kind === 'letters') {
      const count = plural(backup.templates.length, 'letter');
      const answer = await ask({
        title: `Restore ${count}?`,
        message:
          `Add them to your library, or replace your library with them.\n\n` +
          `Replacing removes the ${templates.length} letters you have now.`,
        choices: [
          { value: 'replace', label: 'Replace library', danger: true },
          { value: 'add', label: 'Add to library', primary: true },
        ],
      });
      if (answer === 'add') addLetters(backup.templates);
      if (answer === 'replace') {
        replaceLetters(backup.templates);
        notify(`Replaced your library with ${count}`);
      }
      return;
    }

    const restored = backup.settings;
    const made = backup.createdAt
      ? new Date(backup.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })
      : 'an unknown date';
    const answer = await ask({
      title: 'Restore this backup?',
      message:
        `Made ${made}, with ${plural(restored.templates.length, 'letter')}, ` +
        `${plural(restored.presetProfiles.profiles.length, 'practice')}, and your letterhead, signature and preferences.\n\n` +
        'Restoring everything replaces all of these, and My fields, in LetterBank now. Adding letters only leaves everything else as it is.',
      choices: [
        { value: 'letters', label: 'Add letters only' },
        { value: 'all', label: 'Restore everything', primary: true },
      ],
    });
    if (answer === 'letters') addLetters(restored.templates);
    if (answer !== 'all') return;

    try {
      const [letterheadUrl, signatureUrl] = await Promise.all([
        importImageDataUrl(restored.letterhead.url),
        importImageDataUrl(restored.signature.url),
      ]);
      replaceLetters(restored.templates);
      setPresetProfiles(restored.presetProfiles);
      setClinician(restored.clinician);
      setLetterhead({ ...restored.letterhead, url: letterheadUrl });
      setSignature({ ...restored.signature, url: signatureUrl });
      setTheme(restored.theme);
      setFieldLibrary(restored.fieldLibrary);
      notify('Backup restored');
    } catch (err) {
      notify(`Restore failed: ${err.message}`, 'error');
    }
  };

  // ---- CSV batch -----------------------------------------------------------
  const applyRecord = (idx, records = csvRecords) => {
    setCsvRecordIndex(idx);
    setValuesCache((prev) => ({
      ...prev,
      [activeTemplate.id]: mergeRecordValues(records[idx].values, presets, allVariables),
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
   *
   * Takes the record itself. It used to take an index into the records last
   * loaded with "Review in Quick Fill", while the export named each file from
   * the rows it was handed — so a second CSV exported the first CSV's letters
   * under the second CSV's names, and exporting before any review crashed.
   */
  /** One CSV record's letter: its values, pages and subject, for PDF and Word alike. */
  const recordLetter = useCallback(
    (record) => {
      const rowValues = mergeRecordValues(record.values, presets, allVariables);
      const blocks = renderLetterBlocks(bodySource, rowValues, fieldTypes, fieldLabels, {
        stripClosing: signatureOwnsClosing,
      });
      const recipient = addressLines(renderLetter(recipientSource, rowValues, fieldTypes, fieldLabels));
      return {
        rowValues,
        blocks,
        recipient,
        pages: paginateLetter({ blocks, letterhead, signature, recipient }),
        clientName: rowValues.client_name || '',
        subject: renderLetter(subjectSource, rowValues, fieldTypes, fieldLabels).trim(),
      };
    },
    [
      presets,
      allVariables,
      bodySource,
      letterhead,
      signature,
      signatureOwnsClosing,
      recipientSource,
      subjectSource,
      fieldTypes,
      fieldLabels,
    ]
  );

  const stageRecord = useCallback(
    async (record) => {
      const { pages: recordPages, clientName, subject } = recordLetter(record);
      flushSync(() => {
        setPrintOverride({ pages: recordPages, clientName, subject });
      });
    },
    [recordLetter]
  );

  const buildRecordDocx = useCallback(
    (record) => {
      const { rowValues, pages: recordPages, clientName, subject, recipient } = recordLetter(record);
      const raw = renderLetter(bodySource, rowValues, fieldTypes, fieldLabels);
      return buildDocx({
        renderedBody: signatureOwnsClosing ? stripTrailingClosing(raw) : raw,
        pageCount: recordPages.length,
        letterhead,
        signature,
        clinician,
        subject,
        clientName,
        letterDate,
        recipient,
      });
    },
    [
      recordLetter,
      bodySource,
      fieldTypes,
      fieldLabels,
      signatureOwnsClosing,
      letterhead,
      signature,
      clinician,
      letterDate,
    ]
  );

  const handleBatchExportZip = async (records, { formats, summary, missingFor } = {}) => {
    setIsBatchExporting(true);
    try {
      const result = await batchExportZip({
        records,
        templateTitle: activeTemplate.title,
        formats,
        summary,
        missingFor,
        stageRecord,
        buildRecordDocx,
        onProgress: (current, total, message) =>
          setBatchProgress({ current, total, message }),
      });
      // A cancelled Save dialog leaves the batch open to try again.
      if (!result?.saved) return;
      setOpenModal(null);
      notify(`Exported ${records.length} letters`, 'success', savedFileActions(result.filePath, { mail: false }));
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
    onExportWord: handleExportWord,
    onPrint: handlePrint,
    onSave: handleSaveShortcut,
  });

  // ⌘S / Ctrl+S saves the letter, here and in the browser build. On the
  // desktop the page sees the key first, so the menu's Save doesn't fire too.
  const saveShortcut = useRef(handleSaveShortcut);
  saveShortcut.current = handleSaveShortcut;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      saveShortcut.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const csvBatchInfo =
    csvRecords.length > 0
      ? { currentIndex: csvRecordIndex, total: csvRecords.length }
      : null;

  const stagedPages = printOverride?.pages || pages;
  const stagedClientName =
    printOverride?.clientName ?? (currentValues.client_name || '');
  const stagedSubject = printOverride?.subject ?? renderedSubject;

  return (
    <div className="h-full flex flex-col bg-surface-base text-ink">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenModal={setOpenModal}
        onCopyText={handleCopyText}
        onExportPdf={handleExportPdf}
        onExportWord={handleExportWord}
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
          categories={categories}
          recentIds={recentIds}
          activeTemplateId={activeTemplate?.id}
          onSelectTemplate={handleSelectTemplate}
          onNewTemplate={() => setOpenModal('template')}
          onDuplicateTemplate={handleDuplicateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onTogglePin={handleTogglePin}
          onRenameCategory={handleRenameCategory}
          onResetTemplates={handleResetTemplates}
          onBackup={handleBackup}
          onRestore={handleRestore}
          unsavedTemplateIds={unsavedTemplateIds}
        />

        {activeView === 'fill' ? (
          <QuickFillPanel
            template={activeTemplate}
            hasUnsavedEdits={draftDirty}
            onOpenEditor={() => setActiveView('editor')}
            bodyOverridden={bodyOverridden}
            onResetBody={handleResetBody}
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
            fieldTypes={fieldTypes}
            fieldDefs={fieldDefs}
            subjectSource={subjectSource}
            subjectOverridden={subjectOverridden}
            continuationLine={continuationLine}
            onChangeSubject={handleChangeSubject}
            onResetSubject={handleResetSubject}
          />
        ) : (
          <DocumentEditor
            template={savedTemplate}
            draft={editorDraft}
            isDirty={draftDirty}
            onChangeDraft={handleChangeDraft}
            onSaveTemplate={handleSaveTemplate}
            onSaveAsNew={(tpl) => handleSaveAsNewTemplate(tpl, savedTemplate?.id)}
            onDiscard={handleDiscardDraft}
            fieldLibrary={fieldLibrary}
            onSaveLibraryField={handleSaveLibraryField}
            categories={allCategories}
          />
        )}

        <LetterPreview
          pages={pages}
          letterhead={letterhead}
          signature={signature}
          clinician={clinician}
          clientName={currentValues.client_name || ''}
          subject={renderedSubject}
          letterDate={letterDate}
          editing={pageEditing}
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
        subject={stagedSubject}
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
        fieldLibrary={fieldLibrary}
        onSaveFieldLibrary={setFieldLibrary}
        onNotify={notify}
      />

      <BatchMergeModal
        isOpen={openModal === 'batch'}
        onClose={() => setOpenModal(null)}
        template={activeTemplate}
        variables={allVariables}
        fieldDefs={fieldDefs}
        fieldTypes={fieldTypes}
        fieldsFor={(values) => [
          ...new Set([
            ...letterFieldsInUse(recipientSource, values),
            ...letterFieldsInUse(bodySource, values),
            ...letterFieldsInUse(subjectSource, values),
          ]),
        ]}
        presets={presets}
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
        categories={allCategories}
      />

      <IncompleteFieldsModal
        pending={pendingAction}
        fields={incompleteFields}
        labels={fieldLabels}
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

      {choiceDialog}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export default App;
