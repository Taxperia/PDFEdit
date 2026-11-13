# Contributing to PDFEdit

Bug reports, documentation improvements and focused pull requests are welcome. Please use English for issues, code review and project documentation.

## Before you start

Read the [code of conduct](CODE_OF_CONDUCT.md), [security policy](SECURITY.md) and [license](LICENSE). The application is licensed for noncommercial use; dependencies retain their own licenses. Contributions must be your own work or include compatible permissions and attribution, and are submitted under the project's existing license. No separate CLA is currently used.

For a substantial feature or behavior change, open a feature request first so the scope can be discussed. Report vulnerabilities privately rather than in an issue or pull request.

## Local setup

```bash
git clone https://github.com/Taxperia/PDFEdit.git
cd PDFEdit
npm ci
npm run dev
```

Use Node.js 22.12 or newer. No backend, account, secret or environment file is needed.

## Making a change

1. Create a branch from `main`.
2. Keep the change focused and follow the existing TypeScript/React conventions and `.editorconfig`.
3. Add a regression test for a meaningful bug or behavior change. Avoid tests that only repeat implementation details.
4. Keep both English and Turkish translation keys in sync. English is the default interface.
5. For editing/export changes, compare the preview with an exported PDF, including rotated/cropped pages when relevant.
6. Update documentation when user-visible behavior or limitations change.
7. Run `npm run check` before opening a pull request.

Use fictional or generated test documents. Never attach confidential PDFs, personal data, credentials, or copyrighted samples you cannot redistribute. `public/` files are published with the website.

## Pull requests

Describe the concrete problem, resulting behavior and validation performed. Include screenshots for visual changes when helpful. Clearly identify any manual checks you could not complete. A passing build is not proof that every PDF renders correctly.

Keep `package-lock.json` in sync with dependency changes and review license notices with `npm run licenses`. Do not commit `node_modules/`, `dist/`, caches or environment files.

## Project boundaries

PDFEdit currently uses visual covers for text replacement and erasing. Do not describe these as permanent redaction. Password workflows, OCR, form editing, signature preservation and autosave are not implemented. See [the architecture notes](docs/ARCHITECTURE.md) and [release checklist](docs/RELEASE_CHECKLIST.md).
