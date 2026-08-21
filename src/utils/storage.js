import { DEFAULT_TEMPLATES } from '../data/defaultTemplates';

const STORAGE_KEYS = {
  TEMPLATES: 'letterbank_templates_v2',
  PRESETS: 'letterbank_presets_v2',
  CLINICIAN: 'letterbank_clinician_v2',
  SIGNATURE: 'letterbank_signature_v2',
  LETTERHEAD: 'letterbank_letterhead_v2',
  THEME: 'letterbank_theme_v2',
  ACTIVE_TEMPLATE_ID: 'letterbank_active_template_id_v2',
  VALUES_CACHE: 'letterbank_values_cache_v2',
  LETTER_DATES: 'letterbank_letter_dates_v2',
  SEED_PURGE: 'letterbank_seed_purge_v1',
};

/**
 * Carry settings across the CareVault -> LetterBank rename.
 *
 * The storage keys are part of the brand, so they were renamed too. Without
 * this, the rename would silently look like a factory reset: templates,
 * presets, signature and letterhead all still in the browser under the old
 * keys and never read again. Copies only when the new key is absent, so it
 * cannot clobber newer data, and runs once.
 */
function migrateLegacyKeys() {
  try {
    if (localStorage.getItem('letterbank_migrated_v1')) return;
    let moved = 0;
    Object.values(STORAGE_KEYS).forEach((key) => {
      const legacy = key.replace(/^letterbank_/, 'carevault_');
      if (legacy === key) return;
      const old = localStorage.getItem(legacy);
      if (old !== null && localStorage.getItem(key) === null) {
        localStorage.setItem(key, old);
        moved += 1;
      }
    });
    localStorage.setItem('letterbank_migrated_v1', String(Date.now()));
    if (moved) console.info(`LetterBank: carried over ${moved} saved settings.`);
  } catch (e) {
    console.error('Error migrating legacy storage keys', e);
  }
}

migrateLegacyKeys();

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
  continuationText: 'Re: {{client_name}}',
  continuationRule: true,         // hairline under the header

  // Page numbering.
  showPageNumbers: true,
  pageNumberPosition: 'bottom-right', // 'bottom-left' | 'bottom-center' | 'bottom-right'
  pageNumbersOnSinglePage: false,
};

export function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRESETS);
    if (raw) return { ...DEFAULT_PRESETS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Error loading presets', e);
  }
  return DEFAULT_PRESETS;
}

export function savePresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
  } catch (e) {
    console.error('Error saving presets', e);
  }
}

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingIds = new Set(parsed.map((t) => t.id));
        const newDefaults = DEFAULT_TEMPLATES.filter((t) => !existingIds.has(t.id));
        return [...parsed, ...newDefaults];
      }
    }
  } catch (e) {
    console.error('Error loading templates from localStorage', e);
  }
  return DEFAULT_TEMPLATES;
}

export function saveTemplates(templates) {
  try {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  } catch (e) {
    console.error('Error saving templates to localStorage', e);
  }
}

export function resetTemplates() {
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(DEFAULT_TEMPLATES));
  return DEFAULT_TEMPLATES;
}

export function loadClinician() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLINICIAN);
    if (raw) return { ...DEFAULT_CLINICIAN, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Error loading clinician data', e);
  }
  return DEFAULT_CLINICIAN;
}

export function saveClinician(clinician) {
  try {
    localStorage.setItem(STORAGE_KEYS.CLINICIAN, JSON.stringify(clinician));
  } catch (e) {
    console.error('Error saving clinician data', e);
  }
}

export function loadSignature() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIGNATURE);
    if (raw) return { ...DEFAULT_SIGNATURE, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Error loading signature data', e);
  }
  return DEFAULT_SIGNATURE;
}

export function saveSignature(sig) {
  try {
    localStorage.setItem(STORAGE_KEYS.SIGNATURE, JSON.stringify(sig));
  } catch (e) {
    console.error('Error saving signature data', e);
  }
}

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

export function loadLetterhead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LETTERHEAD);
    if (raw) return { ...DEFAULT_LETTERHEAD, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Error loading letterhead settings', e);
  }
  return DEFAULT_LETTERHEAD;
}

export function saveLetterhead(lh) {
  try {
    localStorage.setItem(STORAGE_KEYS.LETTERHEAD, JSON.stringify(lh));
  } catch (e) {
    console.error('Error saving letterhead settings', e);
  }
}

export function loadTheme() {
  try {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'system'; // Default to Day/Light Mode!
  } catch (e) {
    return 'light';
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    console.error('Error saving theme', e);
  }
}

export function loadActiveTemplateId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TEMPLATE_ID) || '';
  } catch (e) {
    return '';
  }
}

export function saveActiveTemplateId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_TEMPLATE_ID, id);
  } catch (e) {
    console.error('Error saving active template id', e);
  }
}

/**
 * Per-letter date overrides, keyed by template id.
 *
 * Kept out of the values cache because a CSV merge replaces a letter's values
 * wholesale, which would wipe a date the clinician had set by hand. An absent
 * entry means "use today".
 */
export function loadLetterDates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LETTER_DATES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveLetterDates(dates) {
  try {
    localStorage.setItem(STORAGE_KEYS.LETTER_DATES, JSON.stringify(dates));
  } catch (e) {
    console.error('Error saving letter dates', e);
  }
}

/**
 * One-time cleanup of values that earlier builds auto-seeded from the
 * templates' own `defaultValue` entries.
 *
 * Removing the seeding code stopped new letters being pre-filled, but it could
 * not touch what had already been written to localStorage — an existing
 * install still opened the intake letter reading "Dear Alex Morgan," with a
 * fabricated date of birth on other letters. This clears those on first run.
 *
 * A value is only removed when it exactly matches the template default AND no
 * preset covers that field (with a preset present, the old code seeded from
 * the preset, so the value is the clinician's own). Anything typed by hand is
 * left alone. Where the two are indistinguishable, clearing is the safe
 * direction: an empty field is flagged before export, a wrong name is not.
 *
 * Returns the number of values removed.
 */
export function purgeSeededDefaults(templates, presets) {
  try {
    if (localStorage.getItem(STORAGE_KEYS.SEED_PURGE)) return 0;

    const cache = loadValuesCache();
    let removed = 0;

    templates.forEach((tpl) => {
      const values = cache[tpl.id];
      if (!values || !tpl.fields) return;

      tpl.fields.forEach((field) => {
        const seeded = field.defaultValue;
        if (!seeded) return;
        if (presets?.[field.name] !== undefined) return; // came from a preset
        if (values[field.name] === seeded) {
          delete values[field.name];
          removed += 1;
        }
      });
    });

    if (removed > 0) saveValuesCache(cache);
    localStorage.setItem(STORAGE_KEYS.SEED_PURGE, String(Date.now()));
    return removed;
  } catch (e) {
    console.error('Error purging seeded defaults', e);
    return 0;
  }
}

export function loadValuesCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VALUES_CACHE);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveValuesCache(cache) {
  try {
    localStorage.setItem(STORAGE_KEYS.VALUES_CACHE, JSON.stringify(cache));
  } catch (e) {
    console.error('Error saving values cache', e);
  }
}
