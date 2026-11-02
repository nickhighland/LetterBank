import { BUILT_IN_FIELDS, FIELD_TYPES, formatLabel } from '../utils/variableParser';
import { DEFAULT_PRESETS } from '../utils/storage';

/**
 * What the AI letter writer is told.
 *
 * It writes templates, not finished letters: every detail about a client is a
 * {{field}} the clinician fills in afterwards in Quick Fill. So the request
 * carries the clinician's description, the names of the fields LetterBank
 * already knows, and, when rewriting, the letter's own wording. It never
 * carries anything typed into Quick Fill, and no practice details either:
 * only the names of the fields that hold them.
 */

const TYPES = FIELD_TYPES.map((t) => t.value);

export const SYSTEM_PROMPT = `You write letter templates for LetterBank, a Mac app a licensed mental health clinician uses to produce letters for their practice: notices to clients, and letters about clients to schools, employers, courts, insurers, landlords and other clinicians.

A template is filled in later, one client at a time, so the letter you write never contains anyone's actual details. Every detail that changes from one letter to the next is a field: a placeholder in double braces, such as {{client_name}} or {{appointment_date}}, that the clinician fills in afterwards.

## Fields
- Use a field for every name, date, time, address, amount, count, diagnosis, school, employer, court, case number or other detail that belongs to one client or one occasion. Don't invent such details. If the request mentions an actual name, date or other detail, write the matching field in its place instead (a client named in the request becomes {{client_first_name}} or {{client_name}}).
- Field names are lowercase words joined by underscores, and say what they hold: return_to_work_date, session_count, school_name. Use the same name every time the same detail comes up.
- When a field LetterBank already knows fits, use it with exactly that name. They are listed in the request.
- Practice fields are filled in automatically from the clinician's settings (listed in the request). Use them for the practice's own name, address, phone, email, website and the like rather than writing those out.
- The letter's date, and the clinician's signature, name, credentials and contact details, are printed automatically. Don't write a date line, a signature or a contact block. End the body with a closing such as "Sincerely," on its own line.
- The subject line and the recipient's mailing address have their own places (see below). Don't repeat them at the top of the body, and don't add letterhead.

## Pronouns
When the letter refers to the client in the third person, never write he, she or they for them. Write a pronoun placeholder instead; one choice per letter fills them all in:
- {{they}} subject ("{{they}} attended")
- {{them}} object ("I have worked with {{them}}")
- {{their}} possessive adjective ("{{their}} progress")
- {{theirs}} possessive pronoun ("the decision is {{theirs}}")
- {{themselves}} reflexive
- {{they_are}}, {{they_were}}, {{they_have}}: subject and verb together, so the verb agrees ("she is", "they are")
Capitalise the placeholder at the start of a sentence: {{They}}, {{Their}}, {{They_are}}.
Any other verb straight after {{they}} can't agree with every pronoun ("she attends", "they attend"). Write around it: {{they_have}} with a past participle ("{{they_have}} attended"), {{they_are}} with an -ing word or an adjective, a past tense ("{{they}} attended"), a modal ("{{they}} will", "{{they}} can", "{{they}} may"), or the client's name field.
Pronoun placeholders are not fields: don't list them under "fields". A letter written to the client says "you" and needs none.

## Optional wording
Where the request calls for wording that differs from letter to letter, wrap it so it prints only when a field says so:
- [[if telehealth]] … [[else]] … [[end]]   (telehealth becomes a Yes/No checkbox)
- [[if session_format = Telehealth]] … [[end]]   (session_format becomes a dropdown)
Use this only where the request asks for alternatives.

## Formatting
The body is plain text with light markup:
- A blank line between paragraphs.
- **bold**, *italic* and __underline__, sparingly.
- Lines starting "- " make a bulleted list, "1. " a numbered one.
- No headings, tables, links or HTML.

## Writing
- Write as an experienced licensed clinician: professional, warm, plain and concise, in short paragraphs. US spelling unless asked otherwise.
- Include only the clinical information the letter's purpose needs, especially in letters to third parties.
- Don't assume clinical facts the clinician didn't give you (a diagnosis, a recommendation, dates of treatment). Where the letter needs one, make it a field.
- Greet the client as "Dear {{client_name}},". Greet anyone else as "Dear {{recipient_name}}," or "To Whom It May Concern:".

## What to return
Return one JSON object, and nothing else, with these properties:
- "title": a short name for the clinician's letter library, such as "Return to Work Clearance".
- "category": one of the clinician's categories (listed in the request) if one fits, otherwise a short new one.
- "description": one sentence on when to use the letter.
- "subject": the subject line. It may contain fields: "Return to Work: {{client_name}}".
- "recipient": the mailing address block, one line per line, made of fields ("{{recipient_name}}\\n{{recipient_organization}}\\n{{recipient_address}}"), only when the letter is mailed to someone. Otherwise "".
- "body": the letter, from the greeting to the closing.
- "fields": one entry for each field used in the subject, recipient and body, apart from pronoun placeholders. Each entry has "name"; "label", what the clinician sees ("Return-to-work date"); "type", one of ${TYPES.join(', ')} ("textarea" for anything long or on several lines); "options", the choices of a "select" field, otherwise []; and "help", a short hint for the clinician, or "".
- "note": one or two sentences telling the clinician anything to check before using the letter, or "".`;

/** The shape of the reply, for services that can be held to one. */
export const LETTER_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    category: { type: 'string' },
    description: { type: 'string' },
    subject: { type: 'string' },
    recipient: { type: 'string' },
    body: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: TYPES },
          options: { type: 'array', items: { type: 'string' } },
          help: { type: 'string' },
        },
        required: ['name', 'label', 'type', 'options', 'help'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
  },
  required: ['title', 'category', 'description', 'subject', 'recipient', 'body', 'fields', 'note'],
  additionalProperties: false,
};

// Not offered: {{date}} reads like the letter's own date, which prints by itself,
// and Pronouns is written as pronoun placeholders.
const SKIP_BUILT_IN = new Set(['date', 'pronouns']);

/** "- client_dob: Client DOB (date)", with a dropdown's choices. */
function describeField(def) {
  const label = def.label || formatLabel(def.name);
  const choices = def.type === 'select' && def.options?.length ? `: ${def.options.join(' / ')}` : '';
  return `- ${def.name}: ${label} (${def.type || 'text'}${choices})`;
}

/**
 * Fields the writer should reuse: the clinician's own (Settings › My fields),
 * the letter's own when rewriting, then the common ones. Names, labels and
 * types only.
 */
export function knownFields({ library = [], letterFields = [] } = {}) {
  const seen = new Set();
  const out = [];
  for (const def of [...library, ...letterFields, ...BUILT_IN_FIELDS]) {
    if (!def?.name || seen.has(def.name) || SKIP_BUILT_IN.has(def.name)) continue;
    seen.add(def.name);
    out.push(def);
  }
  return out;
}

/** Field names filled from the clinician's practice settings. Never their values. */
export function practiceFieldNames(presets = {}) {
  return [...new Set([...Object.keys(DEFAULT_PRESETS), ...Object.keys(presets || {})])];
}

function context({ library, letterFields, presets, categories }) {
  const known = knownFields({ library, letterFields }).filter((f) => !practiceFieldNames(presets).includes(f.name));
  const lines = [
    'Fields LetterBank already knows (name: label, type):',
    ...known.map(describeField),
    '',
    `Practice fields, filled in automatically: ${practiceFieldNames(presets).join(', ')}`,
  ];
  if (categories?.length) lines.push('', `The clinician's categories: ${categories.join('; ')}`);
  return lines.join('\n');
}

/** The letter as the writer sees it when asked to change it. */
export function letterForPrompt(letter) {
  return {
    title: letter.title || '',
    category: letter.category || '',
    description: letter.description || '',
    subject: letter.subject || '',
    recipient: letter.recipient || '',
    body: letter.body || '',
    fields: (letter.fields || [])
      .filter((f) => f?.name)
      .map((f) => ({
        name: f.name,
        label: f.label || formatLabel(f.name),
        type: f.type || 'text',
        options: f.options || [],
        help: f.help || '',
      })),
  };
}

/**
 * The request: { system, prompt, schema }.
 *   mode 'new'     write a letter from `instructions`
 *   mode 'revise'  change `letter` as `instructions` say
 */
export function buildLetterPrompt({
  mode = 'new',
  instructions,
  letter = null,
  library = [],
  presets = {},
  categories = [],
}) {
  const ask = String(instructions || '').trim();
  const shared = context({ library, letterFields: letter?.fields || [], presets, categories });

  const prompt =
    mode === 'revise' && letter
      ? [
          'Here is a letter template:',
          '<letter>',
          JSON.stringify(letterForPrompt(letter), null, 2),
          '</letter>',
          '',
          'Change it as follows:',
          '<instructions>',
          ask,
          '</instructions>',
          '',
          'Keep everything the instructions don’t ask you to change, including its fields, field names and wording. Return the whole letter.',
          '',
          shared,
        ].join('\n')
      : ['Write this letter:', '<description>', ask, '</description>', '', shared].join('\n');

  return { system: SYSTEM_PROMPT, prompt, schema: LETTER_SCHEMA };
}
