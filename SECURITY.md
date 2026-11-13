# Security policy

## Supported versions

| Version | Security fixes |
| --- | --- |
| Latest 0.1.x code, including the current release candidate | Best effort |
| Older snapshots or modified deployments | Upgrade or reproduce on the latest code |

This is an early-stage project. There is no guaranteed response time or bug bounty. Automated dependency checks and code scanning are useful signals, not a comprehensive security audit or a guarantee of safety.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/Taxperia/PDFEdit/security/advisories/new). Do not publish exploit details or private documents in a public issue, pull request, screenshot or log.

If the private reporting form is unavailable, use a private contact method listed on the [maintainer's GitHub profile](https://github.com/Taxperia). If no private route is available, open an issue requesting a confidential contact channel **without** disclosing the vulnerability or affected personal data.

Include the affected version/commit, browser and operating system, impact, minimal reproduction, expected behavior and a sanitized or generated sample if needed. Avoid sending your original confidential PDF. Coordinate disclosure with the maintainer while a report is investigated.

## Security model

- PDF.js parses and renders selected PDFs in the browser, using a bundled worker.
- pdf-lib and fontkit build exports locally. Selected files are not sent to a document-processing service.
- The application has no account system or server-side document storage. The language preference is stored in `localStorage`; working documents and edits remain in tab memory.
- The hosting server serves application assets, fonts and the optional sample PDF. Its access logs and transport configuration are controlled by the host.
- PDF and image parsers process untrusted input. Use a current browser and updated dependencies; local processing is not a sandbox guarantee for every malformed file.

## Important limitations

**The eraser and replacement covers are not secure redaction.** Source content can remain recoverable after export. This documented behavior is unsuitable for removing confidential information.

The project does not implement password-protected document editing, signature preservation, form editing, autosave or recovery. Review exported documents before sharing them. Browser extensions, compromised devices and third-party modifications to a hosted copy are outside the application's control.

## Maintainer practices

Keep dependency and workflow updates current, review CodeQL/Dependabot reports, and retain least-privilege workflow permissions. Before releasing a fix, reproduce it with sanitized fixtures and run relevant regression checks. Enable private vulnerability reporting and secret push protection in repository settings; adding this file alone does not enable those features.
