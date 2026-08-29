# Issue 17 TOC Fix Evidence

Recorded at: 2026-08-29T18:51:09Z
Base: e90bfe7

## Scope

- Strengthened tutorial HTML validation so every allowed element `id` is unique, preventing ambiguous heading and body anchors.
- Preserved `headingIds` and added `headingEntries` for exact TOC-to-heading level validation.
- Updated tutorial route TOC validation to reject missing, duplicated, out-of-order, and level-mismatched TOC entries before `TutorialDocument` renders.
- Preserved the current `TutorialDocument` rendered-body heading guard and `renderTutorialRecord` options seam.
- Boundary: pilot data and adjacent tutorial navigation remain out of scope for this fix because issues #18 and #14 own those release concerns.

## Success Criteria

| Criterion | Scenario | Invocation | Observable | Artifact |
| --- | --- | --- | --- | --- |
| Duplicate ids are rejected by the model | `h1#x` plus `h2#x`, and `h1#x` plus `p#x` | `npm run tutorials:model` | `Tutorial content model contract passed.` | `.omo/evidence/17-toc-fix-tutorials-model.log` |
| Heading level mapping is exposed | semantic fixture returns `headingEntries` with h1-h6 levels | `npm run tutorials:model` | `Tutorial content model contract passed.` | `.omo/evidence/17-toc-fix-tutorials-model.log` |
| TOC level mismatch fails before render | TOC level 1 entry targets fixture `h2#block-code` | `npm run tutorials:renderer` | `Tutorial renderer contract passed...` | `.omo/evidence/17-toc-fix-tutorials-renderer.log` |
| Existing tutorial SEO contract still holds | tutorial metadata, sitemap, JSON-LD, redirects | `npm run tutorials:seo` | `Tutorial SEO production contract passed...` | `.omo/evidence/17-toc-fix-tutorials-seo.log` |
| Repo lint contract holds | ESLint over repo | `npm run lint` | exit code 0 | `.omo/evidence/17-toc-fix-lint.log` |
| TypeScript contract holds | strict TypeScript project check | `npm run typecheck` | exit code 0 | `.omo/evidence/17-toc-fix-typecheck.log` |
| Full project contract holds | data checks, tutorials checks, lint, typecheck, build, smoke | `npm run check` | `LearningSEO production smoke test passed.` | `.omo/evidence/17-toc-fix-check.log` |
| Diff hygiene holds | accumulated issue #17 diff from `d75f505` | `git diff d75f505..HEAD --check` | `passed with exit code 0` | `.omo/evidence/17-toc-fix-diff-check.log` |

## Code Review

- Standards review noted the work needed a commit and flagged duplicated fixture heading expectations as a low-severity judgement call.
- Spec review found a P1 gap where a non-heading element could reuse a heading id and make a TOC anchor ambiguous.
- Resolution: `validateTutorialHtml` now rejects duplicate ids across all allowed tags with an `id` attribute, and regression checks cover both heading-heading and heading-body duplicates.
