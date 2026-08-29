# Issue 17 Review Blocker Fix Evidence

## Scope

- Fixed tutorial locale switching in the shared header via `resolveLocalizedPath`.
- Strengthened the tutorial renderer check so it exercises `loadTutorialHtml` through real content-addressed fixture files for both locales.
- Preserved the existing legacy generated-subpage localized path behavior.

## Success Criteria

### Header tutorial locale mapping

- Scenario: Chinese tutorial header language control maps `/tutorials/semantic-guide/` to `/en/tutorials/semantic-guide/`.
- Scenario: English tutorial header language control maps `/en/tutorials/semantic-guide/` to `/tutorials/semantic-guide/`.
- Scenario: legacy generated page language control still maps `/privacy-policy-terms-of-use/` to `/en/privacy-policy-terms-of-use/`.
- Invocation: `npm run tutorials:renderer`.
- Binary observable: process exit code `0`; log line includes `header language links`.
- Artifact: `.omo/evidence/17-fix-tutorials-renderer.log`.

### Renderer load boundary

- Scenario: English and zh-CN tutorial renders load distinct content-addressed fixture files through `loadTutorialHtml`.
- Scenario: hash mismatch rejects with `hash does not match expected SHA-256`.
- Scenario: missing TOC anchor rejects with `TOC anchor is missing from HTML`.
- Scenario: unsafe TOC anchor rejects with `TOC anchor is unsafe`.
- Invocation: `npm run tutorials:renderer`.
- Binary observable: process exit code `0`; log line includes `locale files, hashes, TOC`.
- Artifact: `.omo/evidence/17-fix-tutorials-renderer.log`.

### Existing tutorial contracts

- Scenario: tutorial model schema and publication rules stay valid.
- Invocation: `npm run tutorials:model`.
- Binary observable: process exit code `0`; log line includes `Tutorial content model contract passed`.
- Artifact: `.omo/evidence/17-fix-tutorials-model.log`.

- Scenario: tutorial URL, metadata, JSON-LD, sitemap, and redirect contracts stay valid.
- Invocation: `npm run tutorials:seo`.
- Binary observable: process exit code `0`; log line includes `Tutorial SEO production contract passed`.
- Artifact: `.omo/evidence/17-fix-tutorials-seo.log`.

### Repository health

- Scenario: ESLint reports no violations for the changed code.
- Invocation: `npm run lint`.
- Binary observable: process exit code `0`.
- Artifact: `.omo/evidence/17-fix-lint.log`.

- Scenario: TypeScript strict checking passes.
- Invocation: `npm run typecheck`.
- Binary observable: process exit code `0`.
- Artifact: `.omo/evidence/17-fix-typecheck.log`.

- Scenario: full project check runs data validation, tutorial contracts, lint, typecheck, Next build, and smoke test.
- Invocation: `npm run check`.
- Binary observable: process exit code `0`; log includes `Compiled successfully` and `LearningSEO production smoke test passed`.
- Artifact: `.omo/evidence/17-fix-check.log`.

- Scenario: patch has no whitespace errors.
- Invocation: `git diff --check`.
- Binary observable: process exit code `0`; log includes `git diff --check passed`.
- Artifact: `.omo/evidence/17-fix-diff-check.log`.
