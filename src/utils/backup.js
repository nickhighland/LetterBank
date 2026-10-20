import { imageUrlToDataUrl } from './persist';
import { normaliseFieldLibrary } from './fieldDefs';
import {
  normaliseTemplates,
  normaliseProfiles,
  DEFAULT_CLINICIAN,
  DEFAULT_SIGNATURE,
  DEFAULT_LETTERHEAD,
} from './storage';

/**
 * A backup file: the clinician's letters, practices, letterhead, signature
 * and preferences, with images inside it at full size. Client details are
 * never settings, so a backup cannot contain them.
 *
 * Older versions backed up the letters alone, as a bare JSON list; those
 * files still restore.
 */

export const BACKUP_FORMAT = 'letterbank-backup';
export const BACKUP_VERSION = 1;

/** The settings a backup carries. */
export const BACKUP_KEYS = [
  'templates',
  'presetProfiles',
  'clinician',
  'signature',
  'letterhead',
  'theme',
  'fieldLibrary',
];

const IMAGE_KEYS = new Set(['signature', 'letterhead']);
const THEMES = new Set(['light', 'dark', 'system']);

/** Build a backup from the current settings. Images are embedded as data URLs. */
export async function createBackup(settings, { appVersion } = {}) {
  const out = {};
  for (const key of BACKUP_KEYS) {
    let value = settings[key];
    if (value === undefined) continue;
    if (IMAGE_KEYS.has(key) && value?.url) {
      value = { ...value, url: await imageUrlToDataUrl(value.url) };
    }
    out[key] = value;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    ...(appVersion ? { appVersion } : {}),
    settings: out,
  };
}

const notABackup = () => new Error('That file is not a LetterBank backup');

const objectOr = (value, fallback) =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...fallback, ...value } : fallback;

/**
 * What a chosen file holds:
 *   { kind: 'letters', templates }               an older letters-only backup
 *   { kind: 'full', settings, createdAt }        a full backup, every value checked
 * Throws with a message for the clinician when the file is neither.
 */
export function readBackupFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw notABackup();
  }

  if (Array.isArray(parsed)) {
    const templates = normaliseTemplates(parsed);
    if (!templates) throw new Error('That file has no letters in it');
    return { kind: 'letters', templates };
  }

  if (parsed?.format !== BACKUP_FORMAT || !parsed.settings || typeof parsed.settings !== 'object') {
    throw notABackup();
  }
  if (Number(parsed.version) > BACKUP_VERSION) {
    throw new Error('This backup is from a newer version of LetterBank. Update LetterBank, then restore it.');
  }

  const raw = parsed.settings;
  const templates = normaliseTemplates(raw.templates);
  if (!templates) throw new Error('That backup has no letters in it');

  return {
    kind: 'full',
    createdAt: parsed.createdAt || null,
    settings: {
      templates,
      presetProfiles: normaliseProfiles(raw.presetProfiles),
      clinician: objectOr(raw.clinician, DEFAULT_CLINICIAN),
      signature: objectOr(raw.signature, DEFAULT_SIGNATURE),
      letterhead: objectOr(raw.letterhead, DEFAULT_LETTERHEAD),
      theme: THEMES.has(raw.theme) ? raw.theme : 'system',
      fieldLibrary: normaliseFieldLibrary(raw.fieldLibrary),
    },
  };
}

/** "LetterBank Backup 2026-10-19.json" */
export const backupFileName = (date = new Date()) =>
  `LetterBank Backup ${date.toISOString().slice(0, 10)}.json`;

const letterContent = (t) =>
  JSON.stringify([
    t.title || '',
    t.category || '',
    t.subject || '',
    t.body || '',
    t.description || '',
    t.fields || [],
    t.recipient || '',
  ]);

/**
 * The letters from `imported` worth adding to `existing`. A letter the library
 * already has word for word is skipped; one that shares an id with a different
 * letter comes in as a copy with its own id, so nothing is overwritten.
 */
export function lettersToAdd(existing, imported, makeId = (i) => `custom-${Date.now()}-${i}`) {
  const ids = new Set(existing.map((t) => t.id));
  const contents = new Set(existing.map(letterContent));
  const added = [];
  imported.forEach((tpl, i) => {
    if (contents.has(letterContent(tpl))) return;
    const entry = ids.has(tpl.id) ? { ...tpl, id: makeId(i), isCustom: true } : tpl;
    ids.add(entry.id);
    contents.add(letterContent(entry));
    added.push(entry);
  });
  return added;
}
