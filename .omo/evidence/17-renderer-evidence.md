# Issue 17 Renderer Evidence

## Scope

Implemented the shared internal tutorial renderer prototype for both `zh-CN` and `en` routes.

## Success Criteria Evidence

| Criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| Shared bilingual renderer | Render fixture records for `zh-CN` and `en` through `renderTutorialRecord()` with one shared `TutorialDocument` | `npm run tutorials:renderer` | Exit 0; output contains `Tutorial renderer contract passed: locales, semantics, TOC, media, tables, attribution, and preview metadata.` | `.omo/evidence/17-renderer-evidence.md` |
| Semantic body coverage | Validate `src/content/tutorials/fixtures/semantic-fixture.html` with `pre`, `blockquote`, `iframe`, h1-h6, media, and table content | `npm run tutorials:renderer` | Exit 0; asserts heading IDs `semantic-fixture`, `block-code`, `supported-embed`, `nested-section`, `deep-topic`, `fine-detail`, `source-note` | `.omo/evidence/17-renderer-evidence.md` |
| TOC anchors | Render TOC from `record.toc` and match safe anchors against validated HTML heading IDs | `npm run tutorials:renderer` | Exit 0; asserts `href="#semantic-fixture"`, `href="#block-code"`, and `href="#fine-detail"` in rendered markup | `.omo/evidence/17-renderer-evidence.md` |
| Media and iframe boundary | Render local image path and allowlisted YouTube-nocookie iframe from the semantic fixture | `npm run tutorials:renderer` | Exit 0; asserts `/sites/learningseo-io-071dae18/tutorials/semantic-diagram.png`, non-empty alt text, iframe title, and `www.youtube-nocookie.com` | `.omo/evidence/17-renderer-evidence.md` |
| Table overflow and responsive contract | Wrap validated tables with `.tutorial-table-wrapper` and assert responsive width/min-width/media classes | `npm run tutorials:renderer` | Exit 0; asserts `tutorial-table-wrapper`, `overflow-x-auto`, `w-[calc(100%-40px)]`, `max-w-[1224px]`, `min-w-0`, image max-width, and iframe width classes | `.omo/evidence/17-renderer-evidence.md` |
| Visible provenance and SEO source linkage | Render canonical source attribution and `TechArticle` JSON-LD through existing SEO helper | `npm run tutorials:renderer` | Exit 0; asserts canonical source href, source path, license, `application/ld+json`, and `isBasedOn` in rendered markup | `.omo/evidence/17-renderer-evidence.md` |
| Preview noindex metadata | Build draft fixture metadata with alternates disabled | `npm run tutorials:renderer` | Exit 0; asserts `robots.index === false` and `robots.follow === false` | `.omo/evidence/17-renderer-evidence.md` |
| Existing model contract | Ensure #16 model/schema/html validation still passes after fixture expansion | `npm run tutorials:model` | Exit 0; output contains `Tutorial content model contract passed.` | `.omo/evidence/17-renderer-evidence.md` |
| Existing SEO contract | Ensure #15 URL/SEO/redirect/sitemap contract still passes | `npm run tutorials:seo` | Exit 0; output contains `Tutorial SEO production contract passed` and `0 published pair(s)` manifest integration | `.omo/evidence/17-renderer-evidence.md` |
| Code quality | ESLint over repository | `npm run lint` | Exit 0 | `.omo/evidence/17-renderer-evidence.md` |
| Types | TypeScript strict check | `npm run typecheck` | Exit 0 | `.omo/evidence/17-renderer-evidence.md` |
| Full repository check | Data checks, tutorial contracts, lint, typecheck, Next build, and smoke test | `npm run check` | Exit 0; build reports Next.js 16.3.0 compiled successfully; smoke test passed | `.omo/evidence/17-renderer-evidence.md` |
| Patch hygiene | Whitespace/conflict marker check on staged diff | `git diff --cached --check` | Exit 0 | `.omo/evidence/17-renderer-evidence.md` |
| Code review | Two-axis review per implement skill | Standards: `/tmp/issue17-standards-review/evidence.txt`; Spec rereview: `/tmp/issue17_spec_rereview_evidence.log` | Standards: 0 hard findings. Spec rereview: h5/h6, fixture reuse, and synthetic slug findings closed; static responsive renderer contract accepted for empty-manifest prototype scope | `.omo/evidence/17-renderer-evidence.md` |

## Notes

The committed tutorial manifests are empty, so this stage records fixture/component evidence for the renderer prototype. Runtime route viewport evidence remains covered by `BASE_URL=http://127.0.0.1:3107 npm run tutorials:check -- --runtime` once a real pilot record exists.
