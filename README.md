# LetterBank

Clinical form letters and document generator for mental health practices.
Drafts, fills, and batch-generates letters on your own letterhead, with native
PDF export, Word export, and print.

## Getting started

```bash
npm install
npm run dev          # web app at http://localhost:5173
npm run electron:dev # desktop app
npm run electron:build   # packaged macOS build
npm test                 # unit tests
```

Releases are built by GitHub Actions when a version tag is pushed; see
[SIGNING.md](SIGNING.md), which also covers code signing and notarization.

## Setting up your practice

The app ships with **no practice details, letterhead, or signature** — nothing
identifying is stored in this repository. Add your own on first run:

| What | Where |
| --- | --- |
| Practice name, clinician, licence, contact | **Presets** |
| Letterhead artwork, margins, typography | **Letterhead** → Document setup |
| Signature image and sign-off block | **Signature** |

Settings, templates, letterhead and signature are saved as files in the app's
data folder (`~/Library/Application Support/LetterBank/LetterBank Data`).
Images are kept at full size, with no storage limit. Nothing is sent anywhere
or written into this project.

**Client details are never saved.** What you type into a letter lives only in
memory and is erased when LetterBank closes. On quit the app also empties its
browser storage and clears a copied letter from the clipboard, and on launch it
deletes any client details an older version saved.

`.gitignore` blocks `letterhead*` and `*signature*` image files so a real
letterhead or signature cannot be committed by accident. The bundled
`signature-placeholder.svg` is a generic sample, not anyone's signature.

## Finding letters

Pin the letters you use most (the pin on a letter's card) and they stay at the
top of the list; the letters you opened recently this session follow. A
letter's **Category** is any name you like: choose one in the Editor or type a
new one, and double-click a category in the sidebar to rename it on every
letter at once.

| Shortcut | |
| --- | --- |
| ⌘N | New letter |
| ⇧⌘N | New letter with AI |
| ⌘S | Save the letter's changes |
| ⌘E | Export PDF |
| ⌘⇧E | Export Word document |
| ⌘P | Print |

## Writing letters

`{{double_braces}}` become fillable fields in Quick Fill. In the Editor,
**right-click** the body or subject (or press **Field**) to insert one: pick a
field already in the letter, a common one, or **Custom field…** with a name and
a type. Date fields open a date picker in Quick Fill and print as prose
("October 18, 2026"); Time fields open a time picker.

**Pronouns** are set once per letter. In the Editor, right-click where the
word goes, choose **Pronouns** and pick the form; tick **Capitalised** to
start a sentence. Quick Fill then shows one Pronouns choice (she/her, he/him
or they/them) and fills every pronoun in the letter from it:

| Form | Placeholder | Example |
| --- | --- | --- |
| Subject | `{{They}}` | "She has demonstrated excellent progress." |
| Object | `{{them}}` | "It has been a pleasure working with him." |
| Possessive adjective | `{{Their}}` | "Their performance has improved." |
| Possessive pronoun | `{{theirs}}` | "The responsibility is hers." |
| Reflexive | `{{themselves}}` | "He completed the assignment himself." |

`{{they_are}}`, `{{they_were}}` and `{{they_have}}` keep the verb in
agreement: "she is", "they are".

The Pronouns choice covers the whole letter, and any single pronoun can still
be set on its own: open **Each pronoun** under it in Quick Fill and pick
another set for the one that refers to someone else (a parent, say), or for a
client who uses more than one set, like she/they. Like every client detail,
those choices are erased when LetterBank closes.

Each letter's **Subject** can be reworded in Quick Fill without touching the
template. Page 2 onward carries it in the header — "RE: Medical Leave for Jane
Doe" — set in Document setup as `RE: {{subject}}`.

A letter that is mailed can have a **Recipient address** (in the Editor), made
of fields like `{{client_name}}` and `{{client_address}}`. It prints under the
date, or, with **Place addresses for a #10 window envelope** on in Settings ›
Letterhead, 2¼″ down and about 1″ in, where the window shows it when the
letter is folded in three.

The letter is written in a word-processor style editor: bold, italic,
underline, alignment, lists, indent and page breaks from the toolbar or the
usual shortcuts (the **?** button lists them). Fields and optional wording
show as chips. The preview is editable too: click any paragraph on the page to
change it there. In the Editor that changes the template; in Quick Fill it
changes that one letter, is never saved, and is erased when LetterBank closes.

Letters are still stored as plain text with lightweight markup, so backups,
CSV merge and Word export read them as before:

```
**bold**   *italic*   __underline__
- bullet   1. number   > indent
[center] [right] [justify]
---pagebreak---
[[if telehealth]] … [[else]] … [[end]]
```

## Writing letters with AI

Press **AI** above the letter list (or **File › New Letter with AI…**, ⇧⌘N),
describe the letter, and the AI writes it: who it's to, what it says, and a
field for every name, date and other detail, with pronoun placeholders
wherever it talks about the client. Look it over, ask for changes ("make it
shorter", "mention the next appointment"), then **Add to my letters** and fill
it in like any other. In the Editor, **Rewrite with AI** changes the open
letter instead; the result is an unsaved change you can save or discard.

Choose who writes in **Settings › AI writer**:

| Service | What it needs |
| --- | --- |
| Claude, ChatGPT, Gemini | An API key from Anthropic, OpenAI or Google (the setting links to where to get one) |
| DeepSeek, GLM (Z.ai), Kimi (Moonshot), Qwen (Alibaba Cloud), MiniMax, Mistral, Grok (xAI) | An API key from that company. GLM, Kimi, Qwen and MiniMax also ask which **Region** your account is on: International or Mainland China |
| OpenRouter | An OpenRouter key, then any of its models, written as `company/model` |
| Ollama | Ollama running on this Mac, and a model pulled (`ollama pull llama3.3`) |
| Open WebUI | Its address and an API key (Open WebUI › Settings › Account) |
| Other server | An OpenAI-compatible address, such as LM Studio's `http://localhost:1234/v1`, or an online service's address and key |

**Load models** lists what the service offers and checks the key and address
at the same time. Each service starts with a suggested model; new models come
out often, so if one is turned down, Load models shows the current names.

OpenRouter passes each request to a company that runs the chosen model.
LetterBank asks it to use only companies that don't keep or train on what
they're sent, so a model no such company runs can't be used.

What the AI receives is your description and, when rewriting, the letter's
wording and the names of its fields. It never receives what you type into
Quick Fill, and no practice details beyond the names of the fields that hold
them. Online services run on their companies' servers, so describe
the letter, not the client: before anything that looks like a client's details
(a name typed into Quick Fill, a date of birth, a phone number or email) is
sent off this Mac, LetterBank asks first. A model on your own Mac keeps
everything here.

API keys are kept in the macOS keychain, never in settings or backups, and
are never shown again once saved. After an update macOS may ask once whether
LetterBank can use its saved key; choose **Always Allow**.

## Export

PDF and print both render the same document through Chromium's own print
engine, so the output is real vector text — selectable, searchable, and sharp
at any zoom. No rasterisation, and no network calls: fonts are self-hosted and
everything runs locally.

**Word** exports an editable `.docx` with the same letterhead, margins,
typography, date, signature and page 2 header. Word lays out the text itself,
so its page breaks can differ slightly from the preview; page breaks you
add are kept.

Once a letter is saved, **Show in Finder** opens its folder and **Attach to
Mail** starts a new Mail message with it attached. The first time in each
session, LetterBank reminds you that ordinary email isn't secure.

CSV mail merge generates a letter per row, as PDF, Word or both, in one ZIP
with an optional `summary.csv` listing each letter and any fields left empty.
Batch export requires the desktop app.
