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
