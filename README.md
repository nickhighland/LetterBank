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
```

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

## Writing letters

`{{double_braces}}` become fillable fields in Quick Fill. In the Editor,
**right-click** the body or subject (or press **Field**) to insert one: pick a
field already in the letter, a common one, or **Custom field…** with a name and
a type. Date fields open a date picker in Quick Fill and print as prose
("October 18, 2026"); Time fields open a time picker.

Each letter's **Subject** can be reworded in Quick Fill without touching the
template. Page 2 onward carries it in the header — "RE: Medical Leave for Jane
Doe" — set in Document setup as `RE: {{subject}}`.

The body supports
lightweight formatting — the **?** button in the editor toolbar lists it all:

```
**bold**   *italic*   __underline__
- bullet   1. number   > indent
[center] [right] [justify]
---pagebreak---
```

## Export

PDF and print both render the same document through Chromium's own print
engine, so the output is real vector text — selectable, searchable, and sharp
at any zoom. No rasterisation, and no network calls: fonts are self-hosted and
everything runs locally.

**Word** exports an editable `.docx` with the same letterhead, margins,
typography, date, signature and page 2 header. Word lays out the text itself,
so its page breaks can differ slightly from the preview; explicit
`---pagebreak---` breaks are kept.

CSV mail merge generates a letter per row; batch ZIP export requires the
desktop app.
