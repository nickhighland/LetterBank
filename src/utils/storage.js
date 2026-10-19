import { DEFAULT_TEMPLATES } from '../data/defaultTemplates';
import {
  readSetting,
  saveSetting,
  hasFileStore,
  isMigrated,
  finishMigration,
} from './persist';

/**
 * Client details that older versions kept in localStorage: the values typed
 * into every letter, per-letter dates and subjects. LetterBank now keeps no
 * client information once it closes, so these are deleted on first launch and
 * never written again.
 */
const RETIRED_CLIENT_KEYS = [
  'values_cache_v2',
  'letter_dates_v2',
  'letter_subjects_v1',
  'seed_purge_v1',
  'migrated_v1',
];

function deleteRetiredClientData() {
  try {
    RETIRED_CLIENT_KEYS.forEach((key) => {
      localStorage.removeItem(`letterbank_${key}`);
      localStorage.removeItem(`carevault_${key}`);
    });
  } catch {}
}

// Once the desktop app has moved its settings out of localStorage it never
// touches localStorage again, so Chromium has nothing to recreate on disk.
if (!hasFileStore() || !isMigrated()) deleteRetiredClientData();

export const DEFAULT_PRESETS = {
  practice_name: "",
  clinician_name: "",
  clinician_credentials: "",
  license_title: "",
  practice_email: "",
  practice_phone: "",
  practice_website: "",
  telehealth_url: "",
  practice_address: "",
  cancellation_notice_hours: "24",
  session_modality_details: "",
};

export const DEFAULT_CLINICIAN = {
  name: "",
  credentials: "",
  licenseNumber: "",
  licenseState: "",
  title: "",
  practiceName: "",
  phone: "",
  email: "",
  website: "",
  npi: "",
  address: "",
};

export const DEFAULT_SIGNATURE = {
  // A placeholder so the signature block has something to show on a fresh
  // install. Vector, generic, and carries no one's real signature — replace it
  // in Signature block > Signature image.
  url: './signature-placeholder.svg',
  width: 190, // px
  showSignature: true,
  showCredentials: true,
  alignment: "left", // "left" | "center" | "right"
  customBlockText: `Warm regards,

{{signature_image}}

{{clinician_name}}{{clinician_credentials}}
{{license_title}}
{{practice_name}}
{{practice_phone}} • {{practice_email}}`,
};

export const DEFAULT_LETTERHEAD = {
  url: "",
  showLetterhead: false,

  // Fillable area, in px on the 816 x 1056 canvas.
  topMargin: 72,     // standard 0.75" margin
  bottomMargin: 72,   // standard 0.75" margin
  leftMargin: 72,
  rightMargin: 72,
  verticalCenterSinglePage: true,

  // Body typography.
  fontFamily: 'Source Serif 4',   // 'Source Serif 4' | 'Georgia' | 'Times New Roman' | 'Inter'
  fontSize: 13.5,                 // pt
  lineHeight: 1.62,
  bodyAlignment: 'left',          // 'left' | 'justify'
  paragraphSpacing: 0.9,          // em between paragraphs

  // Date line.
  showDate: true,
  dateAlignment: 'right',         // 'left' | 'center' | 'right'
  dateFormat: 'long',             // see DATE_FORMATS in variableParser
  dateSize: 0,                    // pt offset from the body size (0 = match)
  dateSpaceBefore: 0,             // px above the date
  dateSpaceAfter: 14,             // px between the date and the body

  // Continuation header on page 2 and beyond.
  showContinuationHeader: true,
  continuationText: 'RE: {{subject}}',
  continuationRule: true,         // hairline under the header

  // Page numbering.
  showPageNumbers: true,
  pageNumberPosition: 'bottom-right', // 'bottom-left' | 'bottom-center' | 'bottom-right'
  pageNumbersOnSinglePage: false,
};

/**
 * Practice profiles.
 *
 * A clinician who takes clients through more than one platform — Headway,
 * Alma, a private practice — needs a different practice name, contact details
 * and telehealth link per platform, and needs to switch between them without
 * retyping. Each profile is a named set of the same preset keys; exactly one is
 * active, and the active profile's values are what fill a letter.
 */
export function makeProfileId() {
  return `practice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeProfile(name, values = {}) {
  return { id: makeProfileId(), name, values: { ...DEFAULT_PRESETS, ...values } };
}

export function normaliseProfiles(raw) {
  const profiles = (raw?.profiles || [])
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      id: p.id || makeProfileId(),
      name: String(p.name || 'Untitled practice'),
      values: { ...DEFAULT_PRESETS, ...(p.values || {}) },
    }));

  if (profiles.length === 0) profiles.push(makeProfile('My practice'));

  const activeId = profiles.some((p) => p.id === raw?.activeId)
    ? raw.activeId
    : profiles[0].id;

  return { activeId, profiles };
}

/**
 * Load profiles, folding a pre-profiles single preset set into the first
 * profile so an existing install keeps its practice details.
 */
export function loadPresetProfiles() {
  const stored = readSetting('presetProfiles');
  if (stored) return normaliseProfiles(stored);

  const legacy = readSetting('presets');
  if (legacy && typeof legacy === 'object') {
    const values = { ...DEFAULT_PRESETS, ...legacy };
    const name = values.practice_name?.trim() || 'My practice';
    return normaliseProfiles({ profiles: [makeProfile(name, values)] });
  }
  return normaliseProfiles(null);
}

export const savePresetProfiles = (state) => saveSetting('presetProfiles', state);

/**
 * The saved library plus any default template added since it was saved.
 * Templates without an id or a body are dropped, so one damaged entry cannot
 * take the whole app down.
 */
export function normaliseTemplates(list) {
  if (!Array.isArray(list)) return null;
  const valid = list.filter(
    (t) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.body === 'string'
  );
  return valid.length ? valid : null;
}

export function loadTemplates() {
  const parsed = normaliseTemplates(readSetting('templates'));
  if (!parsed) return DEFAULT_TEMPLATES;
  const existingIds = new Set(parsed.map((t) => t.id));
  const newDefaults = DEFAULT_TEMPLATES.filter((t) => !existingIds.has(t.id));
  return [...parsed, ...newDefaults];
}

export const saveTemplates = (templates) => saveSetting('templates', templates);

export function resetTemplates() {
  saveTemplates(DEFAULT_TEMPLATES);
  return DEFAULT_TEMPLATES;
}

export function loadClinician() {
  const stored = readSetting('clinician');
  return stored && typeof stored === 'object' ? { ...DEFAULT_CLINICIAN, ...stored } : DEFAULT_CLINICIAN;
}

export const saveClinician = (clinician) => saveSetting('clinician', clinician);

export function loadSignature() {
  const stored = readSetting('signature');
  return stored && typeof stored === 'object' ? { ...DEFAULT_SIGNATURE, ...stored } : DEFAULT_SIGNATURE;
}

export const saveSignature = (sig) => saveSetting('signature', sig);

/**
 * Fill in any missing letterhead field from the defaults.
 *
 * Call sites used to re-default inline — `letterhead.fontSize || 13.5`,
 * `|| 1.62`, `|| 'Source Serif 4'` — in four different files. That meant the
 * real default in DEFAULT_LETTERHEAD could be changed and silently have no
 * effect, and the fallbacks could drift apart from each other.
 */
export function resolveLetterhead(letterhead) {
  return { ...DEFAULT_LETTERHEAD, ...letterhead };
}

/**
 * Earlier builds defaulted the page 2 header to the client's name alone. An
 * install still on that untouched default moves to the subject line; a header
 * the clinician wrote themselves is left as it is.
 */
const LEGACY_CONTINUATION_TEXT = 'Re: {{client_name}}';

export function loadLetterhead() {
  const stored = readSetting('letterhead');
  if (!stored || typeof stored !== 'object') return DEFAULT_LETTERHEAD;
  const next = { ...stored };
  if (next.continuationText === LEGACY_CONTINUATION_TEXT) {
    next.continuationText = DEFAULT_LETTERHEAD.continuationText;
  }
  return { ...DEFAULT_LETTERHEAD, ...next };
}

export const saveLetterhead = (lh) => saveSetting('letterhead', lh);

export function loadTheme() {
  return readSetting('theme') || 'system';
}

export const saveTheme = (theme) => saveSetting('theme', theme);

export function loadActiveTemplateId() {
  return readSetting('activeTemplateId') || '';
}

export function saveActiveTemplateId(id) {
  if (id) saveSetting('activeTemplateId', id);
}

/**
 * Carry an existing install's settings from localStorage to the data folder,
 * once. localStorage is emptied only after every setting has reached the disk;
 * if anything fails, the next launch tries again from the same data.
 */
async function migrateToFileStore() {
  const settings = {
    templates: loadTemplates(),
    presetProfiles: loadPresetProfiles(),
    clinician: loadClinician(),
    signature: loadSignature(),
    letterhead: loadLetterhead(),
    theme: loadTheme(),
    activeTemplateId: loadActiveTemplateId(),
  };
  const results = await Promise.all(
    Object.entries(settings).map(([key, value]) => saveSetting(key, value))
  );
  if (results.every(Boolean)) await finishMigration();
}

if (hasFileStore() && !isMigrated()) {
  // After the module graph settles, so nothing else is mid-import.
  setTimeout(() => {
    migrateToFileStore().catch((err) => console.error('LetterBank: migration failed', err));
  }, 0);
}
