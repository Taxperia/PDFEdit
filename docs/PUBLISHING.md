# Publishing PDFEdit

The intended repository is **Taxperia/PDFEdit**, with public visibility. The reviewed description, topics and collaboration settings are stored in [.github/repository.json](../.github/repository.json).

## Authenticate

Use a GitHub CLI account authorized to create and administer this repository:

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth status
```

Complete authentication yourself in the browser. Never put a token in the source tree, a commit, an issue, or a chat message. The connected GitHub app and the local `gh` CLI have separate authentication.

## Validate and publish source

```bash
npm ci
npm run check
npm audit
git init -b main
git add .
git diff --cached --stat
git diff --cached --check
git commit -m "Prepare PDFEdit public release candidate"
gh repo create Taxperia/PDFEdit --public --source=. --remote=origin --push
npm run github:configure
```

Skip `git init` if the project is already a repository. If the GitHub repository already exists, confirm it is the intended project and add its remote rather than recreating it. Do not force-push or overwrite another project's history. Git needs a configured author name/email before committing; a GitHub noreply address can be used.

Review the staged files before publishing. `public/` is served to everyone; it must contain only redistributable assets and generated examples. Local tool metadata, caches, dependency folders and build output are excluded by `.gitignore`.

## Description, topics and security

`npm run github:configure` uses the authenticated CLI to:

- apply the English description, topics and collaboration settings from `.github/repository.json`;
- enable private vulnerability reporting, Dependabot alerts/security updates, secret scanning and push protection;
- read settings back and fail if required metadata or protections cannot be confirmed.

It does not create repositories, change visibility or push source. Permissions and account availability may affect security settings; inspect any reported error rather than treating a partial configuration as complete. See [GitHub's private reporting guide](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

The CodeQL workflow scans JavaScript/TypeScript on pushes and pull requests to `main`. Dependabot checks npm and GitHub Actions updates weekly and groups minor/patch version updates. Major version migrations require a separate compatibility review. The version-update restriction does not disable security updates. These configurations take effect after GitHub receives the files. Do not enable a separate default CodeQL setup while the advanced workflow is in use.

## Verify the uploaded repository

```bash
gh repo view Taxperia/PDFEdit --json nameWithOwner,url,isPrivate,description,repositoryTopics
gh run list --repo Taxperia/PDFEdit
```

Confirm public visibility, English metadata, contribution/security links and successful Checks/CodeQL runs. Local test success does not establish that remote workflows passed.

## Optional website deployment

Source publication does not automatically deploy a website. In **Settings → Pages**, choose **GitHub Actions** as the source, then manually run **Deploy GitHub Pages**. The deployment workflow reports the website URL. Complete the browser checks in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), including export on the live subdirectory URL.

No Pages homepage URL should be advertised as a live demo until the deployment has succeeded and the result has been checked.
