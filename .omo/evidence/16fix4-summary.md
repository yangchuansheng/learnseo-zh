# Issue 16 Review Fix Evidence

## Scope

- Fixed alias target validation in `parseTutorialManifest` so aliases may point to existing non-redirect `draft`, `review`, `published`, or `stale` tutorial records.
- Preserved `resourceLinkOwners` conversion ownership for published, non-redirect records only.
- Added model contract coverage for preview alias positives, missing/redirect alias negatives, preview/redirect converted occurrence negatives, and ISO date-time schema/runtime alignment.
- Read local Next.js 16 App Router docs before code changes: `node_modules/next/dist/docs/01-app/index.md`.

## Review

- Spec review: no findings.
- Standards review: flagged one single-use `isAliasTarget` helper; resolved by inlining the non-redirect check before final validation.

## Verification

| Criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| Alias lifecycle guard | `draft`, `review`, and `stale` alias targets parse successfully; missing and redirect targets fail | `npm run tutorials:model` | `Tutorial content model contract passed.` | `.omo/evidence/16fix4-tutorials-model.log` |
| Resource conversion strictness | converted occurrences still require published non-redirect owner; preview and redirect converted cases fail | `npm run tutorials:model` | `Tutorial content model contract passed.` | `.omo/evidence/16fix4-tutorials-model.log` |
| Date-time schema/runtime alignment | parser and schema both reject unsupported fractional ISO date-time values | `npm run tutorials:model` | `Tutorial content model contract passed.` | `.omo/evidence/16fix4-tutorials-model.log` |
| SEO production contract | tutorial URL, metadata, JSON-LD, sitemap, redirects, and manifest integration remain valid | `npm run tutorials:seo` | `Tutorial SEO production contract passed: URL, metadata, JSON-LD, sitemap, and redirects.` | `.omo/evidence/16fix4-tutorials-seo.log` |
| Lint | ESLint accepts changed files and project rules | `npm run lint` | exit code 0 | `.omo/evidence/16fix4-lint.log` |
| Type safety | TypeScript accepts schema helper and parser changes | `npm run typecheck` | exit code 0 | `.omo/evidence/16fix4-typecheck.log` |
| Full project gate | data checks, tutorials model/SEO, lint, typecheck, build, and smoke pass together | `npm run check` | `LearningSEO production smoke test passed.` | `.omo/evidence/16fix4-npm-check.log` |
| Whitespace | Git diff has no whitespace errors | `git diff --check` | `git diff --check passed` | `.omo/evidence/16fix4-diff-check.log` |
