# Issue 16 Resource Link Report Ownership Evidence

## Change

- Added manifest-scoped resource link ownership validation in `src/lib/tutorials/model.ts`.
- Added parser fixtures in `scripts/check-tutorial-model.mjs` for full published pair report, alias report ownership, fallback-only empty manifests, empty routes, wrong sourceKey, missing slug owner, preview route, and redirect route.

## Validation

| Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Parser ownership and resource report invariants | `npm run tutorials:model` | Exit 0; `Tutorial content model contract passed.` | `.omo/evidence/16-fix3-evidence.md` |
| SEO production pair/report contract | `npm run tutorials:seo` | Exit 0; `Tutorial SEO production contract passed: URL, metadata, JSON-LD, sitemap, and redirects.` and `Tutorial manifest integration passed: 0 published pair(s), 0 non-indexable route(s).` | `.omo/evidence/16-fix3-evidence.md` |
| Empty pilot contract remains failing | `npm run tutorials:check` | Exit 1; `manifest.json must contain one pilot record` and `0 !== 1` | `.omo/evidence/16-fix3-evidence.md` |
| ESLint | `npm run lint` | Exit 0; `eslint` completed with no findings | `.omo/evidence/16-fix3-evidence.md` |
| TypeScript | `npm run typecheck` | Exit 0; `tsc --noEmit` completed with no findings | `.omo/evidence/16-fix3-evidence.md` |
| Full project regression | `npm run check` | Exit 0; data checks, tutorials model, tutorials SEO, lint, typecheck, Next build, and smoke test passed | `.omo/evidence/16-fix3-evidence.md` |
| Whitespace diff check | `git diff --check` | Exit 0; no output | `.omo/evidence/16-fix3-evidence.md` |
| Standards review | `/code-review` Standards sub-agent | PASS; evidence file is non-empty at `/tmp/learnseo-zh-evidence/issue16fix3-standards-review.txt` with 512 bytes | `/tmp/learnseo-zh-evidence/issue16fix3-standards-review.txt` |
| Spec review | `/code-review` Spec sub-agent | PASS; evidence file is non-empty at `/tmp/issue16fix3-spec-review/REVIEW.md` with 1603 bytes | `/tmp/issue16fix3-spec-review/REVIEW.md` |
