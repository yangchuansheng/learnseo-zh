# Issue 17 Final Fix Evidence

## Scope

- Hardened `wrapTutorialTables` so literal `<table>` tags inside HTML comments do not affect table depth or wrapping.
- Kept nested and sibling table wrapping behavior valid.
- Guarded `TutorialDocument` title IDs so a body heading already carrying the TOC level-1 ID keeps that anchor as the single rendered ID.
- Preserved the existing `renderTutorialRecord` third-argument function/object compatibility seam.
- Boundary recorded: this renderer fix intentionally adds no real pilot tutorial record and no previous/next tutorial navigation. Issue 18 owns importer work; issue 14 owns the release gate/runtime acceptance.

## Changed Files

- `src/components/tutorials/route.tsx`
- `src/components/tutorials/TutorialDocument.tsx`
- `scripts/check-tutorial-renderer.mjs`

## Success Criteria

| Criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| Comments containing literal table tags do not affect wrapping | `commentedAndSiblingPreparedHtml` contains one commented table plus two real sibling tables | `npm run tutorials:renderer` | Exit 0; renderer contract prints pass message; assertion counts exactly 2 wrappers and keeps the comment unwrapped | `.omo/evidence/17-final-tutorials-renderer.log` |
| Nested tables remain one wrapped outer table | `nestedPreparedHtml` contains an outer table with an inner table | `npm run tutorials:renderer` | Exit 0; assertion counts exactly 1 wrapper and preserves the inner table inside the outer table | `.omo/evidence/17-final-tutorials-renderer.log` |
| Mislabelled h2-as-level-1 TOC entry cannot duplicate title/body IDs | `mislabelledBodyHeadingRecord` marks `block-code` as TOC level 1 while prepared body keeps `<h2 id="block-code">` | `npm run tutorials:renderer` | Exit 0; assertion counts exactly one `id="block-code"`, no `<h1 id="block-code">`, and the body h2 remains anchored | `.omo/evidence/17-final-tutorials-renderer.log` |
| Renderer/model/SEO contracts still pass | Tutorial renderer, content model, and SEO scripts | `npm run tutorials:model`; `npm run tutorials:seo`; `npm run tutorials:renderer` | All exit 0 with pass messages | `.omo/evidence/17-final-tutorials-model.log`; `.omo/evidence/17-final-tutorials-seo.log`; `.omo/evidence/17-final-tutorials-renderer.log` |
| Project lint/type/build/smoke remain green | Full project validation | `npm run lint`; `npm run typecheck`; `npm run check` | All exit 0; `npm run check` includes data checks, tutorials checks, lint, typecheck, Next build, and smoke test | `.omo/evidence/17-final-lint.log`; `.omo/evidence/17-final-typecheck.log`; `.omo/evidence/17-final-check.log` |
| Diff has no whitespace errors | Working-tree diff after final edits | `sh -c 'git diff --check; status=$?; echo git-diff-check-exit=$status; exit $status'` | Exit 0 and `git-diff-check-exit=0` | `.omo/evidence/17-final-diff-check.log` |
| Post-implementation review completed | Standards and spec review subagents reviewed the latest diff | `issue17_final_standards_review`; `issue17_final_spec_review` | Standards review found no actionable findings; spec review found only this evidence file missing before it was added | This file |

## Review Notes

- Standards review: no actionable findings in the latest diff.
- Spec review: one actionable finding, missing `.omo/evidence/17-final-fix-evidence.md`; resolved by this file.
