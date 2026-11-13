# Release checklist

Use this checklist before tagging or announcing a release. Passing automated checks does not verify browser appearance or every PDF format.

## Automated validation

- [ ] Install dependencies from the lockfile with `npm ci`.
- [ ] Run `npm run check`: application/test/configuration types, regression tests and a production build.
- [ ] Run `npm audit` and review outstanding advisories.
- [ ] Confirm third-party and font notices are included in `dist/`.
- [ ] Confirm GitHub Checks and CodeQL have completed; investigate failures or alerts.

Regression coverage includes 0°/90°/180°/270° page transforms, nonzero CropBox offsets, real PDF export with multilingual text, page ordering, blank page sizes, history, stacking, text duplication, export state and document-loading races.

## Manual browser validation

- [ ] Run `npm run preview` after building and check the welcome screen.
- [ ] Open the English sample; edit source text, including Turkish characters, and reopen the inline editor.
- [ ] Add a multiline text box; check alignment, bold text and double-click editing.
- [ ] Add PNG/JPEG images and shapes; move and resize them.
- [ ] Exercise undo/redo, stacking, duplication and page insert/reorder/delete.
- [ ] Export and open the result in another PDF reader; compare text, shapes, images and page order.
- [ ] Try another file and reload the tab with unexported changes; cancelling must preserve the document.
- [ ] Check errors for corrupt/password-protected PDFs, unsupported files and corrupt images.
- [ ] Check English defaults, Turkish switching and persistence of the selected language.
- [ ] Check keyboard focus, narrow screens, zoom, horizontal scrolling and panel toggles.
- [ ] Repeat sample loading, font loading, worker loading and export on the deployed subdirectory URL.

Manual browser validation remains required for the initial release candidate.

## Publication

- [ ] Review the staged file list; exclude credentials, local caches and personal documents.
- [ ] Confirm the repository is public and its English description/topics match `.github/repository.json`.
- [ ] Confirm private vulnerability reporting, Dependabot alerts and secret push protection are enabled.
- [ ] Check links in README, Security, Contributing and issue templates.
- [ ] Confirm the PolyForm Noncommercial license and third-party notices are present.
- [ ] Update package version and changelog only when preparing the actual release.
- [ ] Push and verify the resulting GitHub Actions runs.
- [ ] If publishing the website, configure Pages and manually run its deployment workflow.

## Known future work

Autosave/session recovery, OCR, broader font coverage and complete accessibility/touch validation are not implemented. Secure redaction requires removing PDF content and cannot be provided by visual covers alone.
