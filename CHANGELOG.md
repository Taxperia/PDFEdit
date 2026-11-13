# Changelog

User-visible changes are recorded here. The current 0.1.0 is a release candidate; a tagged release has not yet been announced.

## [Unreleased]

### Added

- Browser-based PDF text replacement, text boxes, shapes, lines and PNG/JPEG images.
- Page insertion, reordering and deletion; thumbnails, zoom and fit controls.
- Undo/redo and unexported-change warnings.
- English default interface with optional Turkish translations.
- Local PDF export with embedded Noto Sans fonts.
- Regression tests, CI, CodeQL, dependency updates and manual Pages deployment configuration.
- English contribution, support, security, conduct and release documentation.

### Fixed

- Coordinate transforms on rotated and cropped pages.
- Font paths when deployed under a subdirectory.
- Document-loading races, resource disposal and error handling.
- Undo support for element stacking and duplication of replacement text.
- Color sampling on high-density canvases and resizing a line's starting endpoint.

### License

- Original application code uses PolyForm Noncommercial 1.0.0. Third-party components retain their original licenses and notices.
