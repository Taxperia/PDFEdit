# PDFEdit

**Edit PDFs in your browser. Keep your documents on your device.**

PDFEdit is a browser-based PDF editor for changing existing text, adding text boxes, shapes and images, managing pages, and exporting an edited PDF. Document processing happens locally in the browser, with no file upload service, account, or API key.

[![Checks](https://github.com/Taxperia/PDFEdit/actions/workflows/ci.yml/badge.svg)](https://github.com/Taxperia/PDFEdit/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22.12%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)](LICENSE)

**Status:** 0.1.0 release candidate. See the [release checklist](docs/RELEASE_CHECKLIST.md) for manual validation before a public release.

> **This is not a secure redaction tool.** Text replacements and the eraser cover source content visually. The underlying text or images can remain recoverable in the exported PDF. Do not use these features to permanently remove confidential information.

## Features

- Edit horizontal text lines, move replacements, and adjust font size, weight and color.
- Add multiline text boxes, rectangles, ellipses, lines, PNGs and JPEGs.
- Move, resize, duplicate, delete and reorder added elements.
- Insert blank pages, reorder pages and remove pages.
- Undo and redo up to 100 history steps.
- Zoom, fit to the workspace, and navigate through page thumbnails.
- English by default, with an optional Turkish interface and saved language preference.
- Warn before replacing a document or leaving with changes that have not been exported.
- Embed Noto Sans for exported text, including Turkish characters.

## Quick start

Requires **Node.js 22.12 or newer** and npm. Node.js 22 is the recommended version (`.nvmrc`).

```bash
git clone https://github.com/Taxperia/PDFEdit.git
cd PDFEdit
npm ci
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:5173`. Choose **Open PDF**, drop a PDF into the window, or select **Try the sample PDF**. No environment variables or backend are required. Run the app through an HTTP server; opening `index.html` directly from disk will not work.

## Editing a document

1. Open a PDF and select a page in the **Pages** panel.
2. Click a horizontal source text line and type a replacement. Press Enter or click outside to finish. Drag the replacement to move it.
3. Use the toolbar to add a text box, shape, line or image. Double-click an added text box to edit it again. Adjust properties in the right-hand panel.
4. Use the page controls to insert, reorder or delete pages. Toggle the panel buttons when working on a narrow screen.
5. Choose **Export PDF** and check the downloaded result in a PDF reader. The original file is not overwritten.

Edits exist only in the current tab's memory. There is no autosave, project file, or session recovery. Export regularly. A successful export status means the browser download was started; if you cancel the download, export again. Reopening an exported PDF does not restore its editing history.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Select / text box | `V` / `T` |
| Rectangle / ellipse / line | `R` / `O` / `L` |
| Eraser (visual cover) | `E` |
| Add image | `I` |
| Delete / duplicate selection | `Delete` or `Backspace` / `Ctrl+D` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` or `Ctrl+Shift+Z` |
| Finish editing / clear selection | `Esc` |
| Zoom | `Ctrl` + mouse wheel or toolbar controls |

On macOS, editing shortcuts also accept `Command` in place of `Ctrl`. The ordinary mouse wheel scrolls. **Fit width** uses the currently visible workspace.

## Development

```bash
npm run check
```

This runs TypeScript checks, the test suite and a production build.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Check application, test and configuration types |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Generate the production site in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run gen:sample` | Regenerate `public/sample.pdf` |
| `npm run licenses` | Refresh distributed third-party notices |
| `npm run github:configure` | Apply repository metadata and security settings after publication |

Tests cover rotated and cropped page coordinates, real PDF export and text placement, multilingual text, page order, blank pages, history, export state and concurrent document loading. They do not replace manual browser testing.

The PDF processing libraries are relatively large, so Vite can emit chunk-size warnings. The export module loads on demand to reduce the initial application bundle. See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## Deployment

Build with `npm ci` followed by `npm run build`, then publish the **entire** `dist/` directory to a static HTTP host. Include the PDF worker, fonts, sample PDF and license notices. Serve `.mjs` files with a JavaScript content type. Development and preview servers are for local use.

For GitHub Pages:

1. Set **Settings → Pages → Source** to **GitHub Actions**.
2. Run **Actions → Deploy GitHub Pages → Run workflow**.
3. Open the deployment URL and check sample loading, text editing and PDF export.

The [Pages workflow](.github/workflows/pages.yml) is manual; pushing code runs checks without publishing the site. Vite uses `base: './'` so assets work at both a domain root and a repository subdirectory. See the [publishing guide](docs/PUBLISHING.md) and [Vite deployment documentation](https://vite.dev/guide/static-deploy.html).

## Limitations

- **No OCR:** scanned pages may have no editable source text; you can add text boxes over them.
- **No paragraph reflow:** editing text does not move surrounding content. Replacement text uses Noto Sans rather than preserving every original font.
- **Horizontal source text only:** vertical, upside-down and angled source text is not offered for direct editing. Added elements support placement on pages rotated by 0°, 90°, 180° and 270°, including cropped pages.
- **Visual covers:** patterned backgrounds may not blend cleanly. Hidden source content may still appear in search, copying or extraction.
- **No password workflow, form editing or signature preservation:** do not assume interactive fields or digital signatures survive export.
- **Limited character coverage:** the bundled font does not cover every language, CJK character or emoji.
- **Memory use:** large PDFs, images, high zoom and a long history can consume significant browser memory.
- **Desktop-first:** narrow-screen panel controls are included; full touch and screen-reader compatibility have not been verified.
- **No session recovery or offline installation:** closing or crashing the tab can lose unexported work.

## Privacy and security

Selected PDFs and images are processed in browser memory. The application has no document upload endpoint, analytics integration, or remote font/CDN dependency. Only the language preference is saved in `localStorage`. Application assets, fonts and the optional sample PDF are fetched from the hosting server; the host may maintain its own access logs.

Treat downloaded or untrusted PDFs with care and keep your browser updated. Local processing does not guarantee that every malformed document is safe. See [SECURITY.md](SECURITY.md) for the security model and private vulnerability reporting.

## Project structure

```text
src/components/       Toolbar, page canvas and editing panels
src/i18n/             English and Turkish translations
src/pdf/              PDF loading, text extraction and export
src/store/            Document state, history and change tracking
src/utils/            Coordinates, text layout and color sampling
public/fonts/         Noto Sans fonts and their OFL license
tests/                State and real PDF export regression tests
.github/              Workflows, community templates and repository metadata
docs/                 Architecture, publishing and release checks
```

## Community

- [Contributing](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Support](SUPPORT.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

Original application code is licensed under [PolyForm Noncommercial 1.0.0](LICENSE). Commercial use is restricted; read the complete license for its permitted purposes and conditions. This is source-available software, not an OSI-approved open-source project.

Third-party components retain their own licenses. Noto Sans is distributed under [SIL Open Font License 1.1](public/fonts/OFL.txt). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the generated [runtime license notices](public/THIRD_PARTY_LICENSES.txt).
