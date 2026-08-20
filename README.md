# LetterBank

Clinical form letters and document generator for mental health practices.
Drafts, fills, and batch-generates letters on your own letterhead, with native
PDF export and print.

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

Everything you enter is kept in your browser's local storage on your machine.
It is never sent anywhere and never written into this project.

`.gitignore` blocks `letterhead*` and `*signature*` image files so a real
letterhead or signature cannot be committed by accident. The bundled
`signature-placeholder.svg` is a generic sample, not anyone's signature.

## Writing letters

`{{double_braces}}` become fillable fields in Quick Fill. The body supports
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

CSV mail merge generates a letter per row; batch ZIP export requires the
desktop app.
