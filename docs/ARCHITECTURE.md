# Architecture

PDFEdit is a static React/TypeScript application built with Vite. There is no application server or document upload service.

## Document flow

1. A local PDF is read into a byte array. PDF.js receives a copy so its worker cannot detach the source buffer needed for export.
2. PDF.js provides page dimensions and viewport transforms, renders canvases and thumbnails, and extracts horizontal source text lines.
3. Zustand stores page metadata, overlay elements, selection, zoom, document revisions and a bounded undo/redo history.
4. SVG overlays draw edits above the rendered page. An interaction layer handles selection, movement, resizing and drawing; inline inputs handle text entry.
5. The lazily loaded export module copies pages using pdf-lib, embeds fonts/images and draws overlays into a new PDF.

## Coordinates

Editor geometry uses PDF-point viewport coordinates with a top-left origin. The store records the inverse of the scale-one PDF.js transform to map editing coordinates back into PDF user space. This includes page rotation and CropBox offsets. Canvas backing resolution can differ from CSS size on high-density displays; color sampling uses the effective pixel scale.

## Changes and history

History snapshots contain page metadata, elements and the document revision. Export records the revision of the exported snapshot. Undoing or redoing across that revision updates the unexported-change state. History is capped at 100 steps and is not persisted.

Asynchronous document loads have request identifiers. A stale load cannot replace a newer document; replaced or abandoned PDF.js documents are destroyed. Failed loads retain the active document and its edits.

## Trust and limitations

PDFs and images are untrusted parser inputs. React renders user text as text nodes; the editor does not interpret document text as application code. Local processing does not eliminate parser or browser vulnerabilities.

Text replacement is an opaque cover plus replacement text, rather than removal of PDF operators. The eraser is another cover. These operations are not secure redaction, and source content can remain extractable. Forms, digital signatures, password workflows, OCR, paragraph reflow and session recovery are outside the current implementation.

## Deployment

Vite emits a static site with relative asset paths. The PDF.js worker and fonts are bundled/served from the same deployment. Original application and third-party license notices are included in the output. See [PUBLISHING.md](PUBLISHING.md).
