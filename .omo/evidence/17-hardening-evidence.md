# Issue 17 hardening evidence

Repository: `/Users/longnv/.codex/worktrees/4968/learnseo-zh`
Task: Harden issue #17 tutorial renderer/model review findings.

## Success criteria

| Criterion | Scenario | Invocation | Binary observable | Captured artifact |
| --- | --- | --- | --- | --- |
| Balanced table wrapping preserves nested tables and table semantics | `prepareTutorialHtmlForRender()` receives an outer table containing an inner table | `npm run tutorials:renderer` | Exit 0; assertion observes one `data-tutorial-table` wrapper and retained inner `<table>` markup | `.omo/evidence/17-hardening-evidence.md` |
| Responsive table contract remains present | Rendered bilingual tutorial fixture includes table wrapper and responsive overflow classes | `npm run tutorials:renderer` | Exit 0; rendered markup contains `tutorial-table-wrapper`, `overflow-x-auto`, and `min-w-0` | `.omo/evidence/17-hardening-evidence.md` |
| `source.sourcePath` is repository-local and safe for `localHref` | Tutorial model accepts `/seo_roadmap/seo-fundamentals/` and rejects external, protocol-relative, control, traversal, encoded control/traversal, query, and hash paths | `npm run tutorials:model` | Exit 0; focused assertions pass | `.omo/evidence/17-hardening-evidence.md` |
| Renderer metrics assertions are independent | `semantic-fixture.html` validation is compared with explicit expected semantic counts, and fixture records use those expected counts | `npm run tutorials:renderer` | Exit 0; validation metrics equal explicit object for both locales | `.omo/evidence/17-hardening-evidence.md` |
| Real loader coverage and bilingual renderer coverage remain active | Renderer script writes locale fixture files and calls `loadTutorialHtml()` through `renderTutorialRecord()` for `zh-CN` and `en` | `npm run tutorials:renderer` | Exit 0; locale files, hashes, TOC, media, tables, attribution, header language links, and preview metadata pass | `.omo/evidence/17-hardening-evidence.md` |
| TOC validation rejects duplicate, unsafe, missing, and out-of-order anchors | `loadTutorialHtml()` receives fixture records with malformed TOC entries | `npm run tutorials:renderer` | Exit 0; focused rejection assertions pass | `.omo/evidence/17-hardening-evidence.md` |
| SEO contracts remain intact | Tutorial URL, metadata, JSON-LD, sitemap, redirects, and manifest integration run against production modules | `npm run tutorials:seo` | Exit 0; SEO production contract passes | `.omo/evidence/17-hardening-evidence.md` |
| TypeScript, lint, build, smoke, and data checks remain intact | Full project check runs all configured gates | `npm run check` | Exit 0; data, model, SEO, renderer, lint, typecheck, build, and smoke pass | `.omo/evidence/17-hardening-evidence.md` |
| Current diff has no whitespace errors | Working tree diff check runs against all modified files | `git diff --check` | Exit 0; no output | `.omo/evidence/17-hardening-evidence.md` |
| Issue 17 committed range has no whitespace errors | Final tree since issue #17 base is checked after commit | `git diff d75f505..HEAD --check` | Exit 0; no output | `.omo/evidence/17-hardening-evidence.md` |

## Review

`/code-review` was applied with two read-only sub-agents against the WIP diff:

- Standards axis: no hard documented-standard violations; one judgement-call smell found around duplicated schema/runtime source-path policy.
- Follow-up applied: `REPOSITORY_LOCAL_PATH_PATTERN` is now shared by schema and runtime validation.
- Spec axis: no source blocker; it noted that `git diff d75f505..HEAD --check` can only pass after the hardening commit lands and requested this evidence file plus commit.

## Validation log

Focused checks:

```text
npm run tutorials:model
Tutorial content model contract passed.

npm run tutorials:renderer
Tutorial renderer contract passed: locale files, hashes, TOC, media, tables, attribution, header language links, and preview metadata.

npm run tutorials:seo
Tutorial SEO production contract passed: URL, metadata, JSON-LD, sitemap, and redirects.
Tutorial manifest integration passed: 0 published pair(s), 0 non-indexable route(s).
```

Quality gates:

```text
npm run lint
eslint passed.

npm run typecheck
tsc --noEmit passed.

npm run check
Validated 161 routes, 158 content files, 1937 internal links, and 43 local assets.
Validated 161 Chinese routes, 158 translated HTML pages, and 161 localized metadata titles.
Tutorial content model contract passed.
Tutorial SEO production contract passed: URL, metadata, JSON-LD, sitemap, and redirects.
Tutorial renderer contract passed: locale files, hashes, TOC, media, tables, attribution, header language links, and preview metadata.
LearningSEO production smoke test passed.
```

Diff checks:

```text
git diff --check
passed with no output.

git diff d75f505..HEAD --check
passed with no output after the hardening commit.
```

## Contract limitations intentionally retained

- `renderTutorialRecord()` keeps its existing third-argument compatibility seam because existing tests and callers use both object and function forms.
- Table wrapping uses a small tag-depth scanner over already validated tutorial HTML. A full HTML parser remains unnecessary while `validateTutorialHtml()` keeps script/style/dangerous tags and unsupported attributes out of the renderer input.
