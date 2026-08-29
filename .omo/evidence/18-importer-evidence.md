# Issue 18 Tutorial Importer Evidence

## Scope

Implemented an on-demand tutorial importer prototype for the selected Pilot URL.
The workflow creates reviewable draft English and zh-CN tutorial records, local
media, content-addressed HTML, provenance metadata, manifest updates, a shared
generation marker, and a durable import journal. It keeps translation explicit:
`tutorials:import` requires a UTF-8 `--translation` file and fails without it.

## Commands

```sh
npm run tutorials:collect -- \
  --url https://developers.google.com/search/docs/fundamentals/seo-starter-guide \
  --source-path /seo_roadmap/seo-fundamentals/ \
  --slug google-seo-starter-guide \
  --output temp/seo-starter.snapshot.json

npm run tutorials:import -- \
  --input temp/seo-starter.snapshot.json \
  --translation temp/seo-starter.zh-CN.html
```

Offline fixture mode:

```sh
npm run tutorials:collect -- \
  --url https://developers.google.com/search/docs/fundamentals/seo-starter-guide \
  --source-path /seo_roadmap/seo-fundamentals/ \
  --slug google-seo-starter-guide \
  --fixture scripts/fixtures/tutorial-importer/google-devsite.html \
  --output <tmp>/snapshot.json
```

## Failure Codes

- `redirect-loop`
- `bot-challenge`
- `authentication`
- `non-html`
- `unavailable`
- `canonical-mismatch`
- `extraction-failure`
- `unsafe-markup`
- `unsupported-media`
- `translation-missing`
- `snapshot-invalid`
- `manifest-invalid`
- `duplicate-slug`
- `duplicate-source`

## Evidence Matrix

| Criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| CLI contract | Fixture collect and import use explicit `--url`, `--source-path`, `--slug`, `--output`, `--input`, `--translation`; import writes draft records only. | `npm run tutorials:collect ... --fixture ... --output <tmp>/snapshot.json` then `npm run tutorials:import ... --content-root <tmp>/content-root --public-root <tmp>/public` | PASS: both manifests contain one `draft` route and matching generation marker. | `.omo/evidence/18-cli-fixture.log` |
| Google adapter/preflight | Fixture uses `.devsite-article-body`, relative link, and relative image. | `npm run tutorials:importer` | PASS: snapshot canonical/sourceKey match the Pilot URL; relative href/img are absolute in the snapshot; media provenance is captured. | `.omo/evidence/18-tutorials-importer.log` |
| Failure taxonomy | Missing translation, unsafe source/translation markup, unsupported media, canonical mismatch, bot challenge, authentication, non-html, duplicate slug, and atomic rollback paths. | `npm run tutorials:importer` | PASS: each scenario throws the expected importer error code. | `.omo/evidence/18-tutorials-importer.log` |
| Sanitizer/model validation | Sanitized EN/zh-CN HTML uses model-supported tags/attrs, safe URLs, local image paths, allowlisted embeds, matching headings/order/metrics, and no English fallback into zh-CN. | `npm run tutorials:importer` | PASS: model validators accept both locale records and HTML; zh-CN title/description are extracted from the translation HTML. | `.omo/evidence/18-tutorials-importer.log` |
| Local media | Fixture image is copied to `public/sites/learningseo-io-071dae18/tutorials/<slug>/<sha>.svg` and manifest hash matches file bytes. | `npm run tutorials:importer` | PASS: local media path, sha256, alt, width, sourceUrl, and content-addressed filename are verified. | `.omo/evidence/18-tutorials-importer.log` |
| Atomic draft import | Successful import writes content, media, manifest pair, import-generation marker, and committed journal; failed validation preserves existing manifest bytes. | `npm run tutorials:importer` | PASS: committed journal exists; idempotent re-import keeps version/history/generation stable; unsupported-media failure leaves manifest files byte-identical. | `.omo/evidence/18-tutorials-importer.log` |
| Existing tutorial contracts | Importer coexists with current model, SEO, renderer, data, build, and smoke contracts. | `npm run tutorials:model`; `npm run tutorials:seo`; `npm run tutorials:renderer`; `npm run check` | PASS: all commands exit 0; `npm run check` includes `tutorials:importer`. | `.omo/evidence/18-tutorials-model.log`, `.omo/evidence/18-tutorials-seo.log`, `.omo/evidence/18-tutorials-renderer.log`, `.omo/evidence/18-check.log` |
| Lifecycle contract | Shared lifecycle acceptance contract remains executable offline. | `npm run tutorials:check -- --contract` | PASS: lifecycle acceptance contract exits 0. | `.omo/evidence/18-tutorials-check-contract.log` |
| Release gate boundary | Current repo has empty tutorial manifests, while #18 produces draft candidates pending translation review and publication. | `npm run tutorials:check` | EXPECTED BLOCKED: release gate exits 1 because `src/content/tutorials/manifest.json` has no Pilot record. | `.omo/evidence/18-tutorials-check-release-gate.log` |
| Whitespace hygiene | Final staged diff whitespace check. | `git diff --cached --check` | PASS: no whitespace errors. | `.omo/evidence/18-diff-check.log` |

## Review Notes

Standards review initially found that `tutorials:importer` was outside
`npm run check`, a test-only failure switch was exposed through the production
CLI, and staging helpers duplicated write boilerplate. The final diff fixes all
three: `npm run check` runs importer tests, the production CLI has no simulated
failure option, and staged file writes share one helper.

Spec review initially found idempotency drift, partial transaction evidence,
missing DNS checks on redirect targets, and zh-CN metadata using source English.
The final diff fixes them with unchanged-hash idempotency, lock/journal/marker
write evidence, DNS validation per redirect hop, and zh-CN title/description
derived from the explicit translation HTML.

The standalone recovery command remains a lifecycle follow-up. This importer
prototype records enough journal and generation data for review and recovery
work without creating a publication shortcut.
