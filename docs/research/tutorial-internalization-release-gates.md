# SEO Fundamentals Tutorial Release Gates

This document closes Issue #21. It extends the fixed Pilot acceptance contract
in [`tutorial-internalization-acceptance.md`](./tutorial-internalization-acceptance.md)
and applies the lifecycle rules in
[`tutorial-internalization-lifecycle.md`](./tutorial-internalization-lifecycle.md)
to every SEO Fundamentals tutorial and every migration wave. The published
`google-seo-starter-guide` pair remains the release baseline while a candidate
or wave is collected, reviewed, staged, or recovered.

## Decision

Publication is an atomic bilingual release. A tutorial is publishable only
when its English and Simplified Chinese records pass every tutorial gate below.
A wave is publishable only when every tutorial in that wave passes, both locale
manifests share one generation, the resource-card report is partitioned, and
the Pilot baseline remains intact. A failing tutorial or operation keeps the
candidate in preview and leaves the last published generation serving traffic.

The minimum artifact preflight is:

```sh
npm run tutorials:check
```

`tutorials:check` runs the Pilot baseline checker and the generalized release
gate checker. The generalized checker can run independently with
`npm run tutorials:release-gates`. A production promotion records a passing
runtime gate with:

```sh
BASE_URL=http://127.0.0.1:3107 npm run tutorials:release-gates -- --runtime
```

`--contract` runs the offline wave and lifecycle fixtures without writing live
content. Artifact-only preflight may report `runtime-routes` as `deferred`; a
release evidence record requires `pass` for every gate.

## Per-tutorial gate

Every candidate tutorial pair receives one result for each gate. All results
must be `pass` before its review can promote `review` to `published`.

| Gate ID | Minimum pass evidence | Blocking failure |
| --- | --- | --- |
| `bilingual-fidelity` | English and Simplified Chinese content files match their recorded hashes; source and translation sections are positive and equal; semantic tag order, heading IDs/levels, link order, media order, and numeric/source facts are preserved; the review checklist has all eleven keys set to `true`. | Missing translation, English fallback, changed section/order/ID/link/media identity, hash mismatch, or incomplete checklist. |
| `provenance` | Source title, provider, nullable author, requested URL, final URL, canonical URL, source path, `text/html` content type, canonical-match result, source update value, capture timestamp, source/content hashes, and license/attribution evidence are recorded. | Missing source identity, redirect/final URL, update/hash evidence, canonical verification, or license/attribution. |
| `media-integrity` | Every referenced image has one manifest entry, a repository-local path under `/sites/learningseo-io-071dae18/tutorials/`, useful alt text, and a matching file SHA-256; both locales expose the same media identity and order. Allowlisted iframe identity is preserved when present. | Remote/data image, missing file/hash/alt, path escape, locale media drift, or unauthorized/missing embed evidence. |
| `accessibility` | Sanitized content has one navigable `h1`, a non-jumping heading hierarchy, named links, alt text for images, titled iframes, and semantic table rows/cells. Locale metadata is `en`/`zh-CN`. | Missing accessible name, heading jump, untitled iframe, missing alternative text, or locale mismatch. |
| `security-sanitization` | Content contains only the tutorial semantic tag and attribute allowlists; URL protocols are approved; image paths remain local; iframe hosts remain on the existing allowlist. | Executable/style/form/source-document markup, event or deferred-media attributes, dangerous URL protocol, path traversal, remote image, or unapproved iframe. |
| `metadata` | Manifest metadata is complete; published records are indexable and previews are noindex; locale route paths, source attribution, `TechArticle` JSON-LD, `isBasedOn`, `dateModified`, and reciprocal locale metadata are derivable from the record. | Missing/invalid title or description, indexability drift, malformed structured data, missing source attribution, or locale route mismatch. |
| `resource-card-conversion` | The report contains every logical resource-card occurrence, one normalized source key per duplicate group, `converted + fallback = total`, bilingual rendered count `total * 2`, and one published slug per converted key. Draft/stale records stay external; unknown fragments stay external with a warning. | Occurrence/key/count drift, duplicate slug ownership, converted preview source, silently retained unknown fragment, or unpartitioned report. |
| `runtime-routes` | At 390px, 768px, and 1440px, both locale routes return successfully with the expected `lang`, title/body, canonical, alternates, robots, structured data, source attribution, table overflow behavior, and no document-wide horizontal overflow. | Route error, missing metadata/body, browser error, page overflow, missing table wrapper, or locale structure drift. |
| `rollback-readiness` | Active English/Chinese records share version, hashes, media identity, and generation; historical content files and hashes remain verifiable; refresh candidates stay preview-only; operation/generation recovery and rollback fixtures prove an unchanged active pointer until approval. | Missing/inconsistent history, unverifiable hash/file, mixed generation, active-pointer mutation before approval, or failed recovery changing live content/links. |

The offline checker enforces the eight artifact gates from repository artifacts.
`runtime-routes` is opt-in because it needs a running server. The
`rollback-readiness` fixture covers the operation boundary even when a tutorial
has no historical version yet; the Pilot's published pair remains the known-good
rollback target.

## Per-wave gate

Wave membership follows the #20 source inventory. The wave boundary is a
release boundary. Collection can run in parallel while validation, review, and
promotion remain pair-atomic.

| Wave | Scope | Required evidence before promotion |
| --- | --- | --- |
| `wave-0-pilot` | Existing `google-seo-starter-guide` baseline. | All per-tutorial gates, exact Pilot content/media/link reconciliation, and the four lifecycle fixtures pass. |
| `wave-1-official-google` | `google-search-works`, then `google-search-essentials`. | All per-tutorial gates for every candidate, Google source/license evidence, one bilingual generation, complete resource-card conversion report, and unchanged Pilot hashes/routes. |
| `wave-2-rights-reviewed` | Rights-approved single-page candidates such as Ahrefs or Mangools. | All per-tutorial gates plus written reuse decision, per-asset media decision, interactive-surface disposition, and canonical rebind evidence where required. |
| `wave-3-manual-or-external` | Moz multi-page chapters and collection/course surfaces. | Per-source disposition evidence. External/manual items remain external until each child tutorial independently satisfies the full tutorial gate. |

For each wave, the release evidence records `waveId`, ordered slugs, source
keys, previous and candidate generations, per-tutorial gate results, baseline
hashes/routes, resource conversion report, operation id, actor, and failure or
rollback reason. A wave passes only when every listed slug passes. A partial
wave failure publishes zero new slugs, preserves the previous generation and
link map, and leaves successful staged candidates available for diagnosis or a
later retry.

## Pilot baseline

The exact Pilot evidence remains owned by
[`tutorial-internalization-acceptance.md`](./tutorial-internalization-acceptance.md)
and `scripts/check-learningseo-tutorial-pilot.mjs`. The current baseline is one
published bilingual pair, source canonical
`https://developers.google.com/search/docs/fundamentals/seo-starter-guide`,
`2,152` logical resource-card occurrences, `4,304` bilingual rendered anchors,
and `912` normalized source keys. A new wave may change the report's converted
and fallback partition, while these baseline totals stay fixed unless a new
inventory decision is reviewed.

## Evidence handoff

The release record attaches the following artifacts:

1. source preflight/snapshot and license or rights evidence;
2. English and Simplified Chinese content hashes plus translation checklist;
3. media manifest, local file hashes, alt-text review, and embed decisions;
4. manifest pair, generation marker, metadata/SEO output, and resource-card
   conversion report;
5. `npm run tutorials:check` output and, for a runtime release, the
   `BASE_URL=... npm run tutorials:release-gates -- --runtime` output; and
6. operation journal/recovery result and rollback readiness evidence.

These artifacts answer which source produced a route, which content generation
was live, why each card converted or stayed external, and whether a failed
promotion left the published Pilot and its links untouched.
