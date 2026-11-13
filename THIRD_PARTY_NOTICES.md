# Third-party notices

The application's PolyForm Noncommercial license does not replace the licenses of its dependencies. This table lists direct runtime dependencies and bundled fonts; transitive components retain their own copyright and license notices.

| Component | License | Upstream |
| --- | --- | --- |
| React and React DOM | MIT | https://github.com/facebook/react |
| Zustand | MIT | https://github.com/pmndrs/zustand |
| pdf-lib | MIT | https://github.com/Hopding/pdf-lib |
| @pdf-lib/fontkit | MIT | https://github.com/Hopding/fontkit |
| PDF.js (pdfjs-dist) | Apache-2.0 | https://github.com/mozilla/pdf.js |
| Noto Sans Regular/Bold 2.015 | SIL OFL-1.1 | https://github.com/notofonts/latin-greek-cyrillic |

Noto Sans copyright: Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic). The complete font license is in `public/fonts/OFL.txt` and must remain with the fonts.

Runtime notices are collected from installed production packages into `public/THIRD_PARTY_LICENSES.txt` and copied into the production site. Optional native canvas packages used by Node.js are not included in the browser build. The fontkit package's own README and embedded distribution notices are preserved because its published package has no root license file.

Run `npm run licenses` after dependency changes. The build also refreshes notices and copies the application license to `public/LICENSE.txt`. Preserve all bundled notices when redistributing the site.
