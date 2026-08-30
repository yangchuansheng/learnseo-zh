# SEO Fundamentals Migration-Wave, Throughput, and Promotion Decision

- Ticket: [Choose SEO Fundamentals migration waves and throughput](https://github.com/yangchuansheng/learnseo-zh/issues/23)
- Inventory: [Issue #20 source tutorial inventory](./wayfinder-seo-fundamentals-inventory.md)
- Source constraints: [Issue #22 source-specific decisions](./wayfinder-seo-fundamentals-source-decisions.md)
- Release contract: [Issue #21 tutorial release gates](./tutorial-internalization-release-gates.md)
- Lifecycle: [tutorial internalization lifecycle](./tutorial-internalization-lifecycle.md)
- Checked: `2026-08-31`

## Decision

Collection and preflight use at most two in-flight sources. Import, editorial
review, and promotion use one in-flight operation. The current importer has a
global tutorial write lock and commits both locale manifests with one
generation marker, so serial mutation keeps candidate and rollback evidence
unambiguous.

Import creates a `draft` bilingual pair with `noindex,nofollow` and external
resource-card links. Promotion requires the explicit translation handoff,
source-specific dependencies, every release gate, and one ordered editorial
review pass. A wave promotes only when every imported item passes. Promotion
switches both locale manifests, the generation marker, and the resource-link
map to one candidate generation.

Any item or wave failure publishes zero new slugs. Successful staged candidates
remain preview-only with their journals; the failed item is the retry unit.
The active generation, Pilot routes, and resource-link map remain unchanged.
Post-stage commit or runtime failure restores the previous wave generation as
one boundary across both locales and the link map; content-addressed history
remains available for a reviewed rollback candidate.

This is an operator decision and evidence contract. Existing
`tutorials:collect`, `tutorials:import`, `tutorials:review`, and release-gate
commands remain single-source commands. This change adds no bulk migration
runner, automatic translation, or multi-source production writer.

## Throughput evidence and limits

The Pilot evidence records a `37,933`-byte English body and four local images.
On `2026-08-31`, the current collector measured the two official Google pages
as follows; network latency is a sample, not an SLO.

| Collection mode | Elapsed | Evidence |
| --- | ---: | --- |
| Sequential, two Google pages | `4,337 ms` | `how-search-works` `3,230 ms`; `essentials` `1,107 ms` |
| Parallel, two Google pages | `2,948 ms` | `how-search-works` `11,176` HTML bytes; `essentials` `4,823` HTML bytes; `0` media each |

The collector enforces a `15 s` request timeout, a `4 MiB` HTML limit, a
`5`-hop redirect limit, HTTPS/public-DNS checks, and an `8 MiB` per-media limit.
Media is localized one source at a time before the global write lock. These
limits support collection concurrency `2` and import concurrency `1`; higher
mutation concurrency would contend on the same manifest pair.

The larger candidates justify a one-item rights batch. #22 records Ahrefs at
`130` paragraphs and `49` raw images, while Mangools has `702` paragraphs,
`80` images, one YouTube embed, and `85` form inputs. Rights, image ownership,
interactive-surface treatment, and source-update evidence complete before
either candidate enters staging.

## Wave order and batch policy

| Wave | Ordered release units | Batch size | Import concurrency | Review boundary |
| --- | --- | ---: | ---: | --- |
| `wave-0-pilot` | `google-seo-starter-guide` baseline | `1` baseline check | `1` (no import) | Preserve the published Pilot exactly |
| `wave-1-official-google` | `google-search-works` → `google-search-essentials` | `2` | `1` | Review in order; promote both or zero |
| `wave-2-rights-reviewed` | `ahrefs-seo-basics` → `mangools-complete-seo-guide` | `1` | `1` | One rights-approved candidate per boundary |
| `wave-3-manual-or-external` | `moz-beginners-guide` → `contentking-conductor-hub` → `semrush-seo-essentials-course` | `1` | `1` for a qualified Moz child; `0` for external units | One disposition at a time; external units add no route |

Wave 1 groups two compact first-party Google pages with matching canonical
evidence and CC BY attribution. Collection may overlap within the limit, while
import and promotion stay serial. Wave 2 isolates Ahrefs before Mangools so
canonical rebind, written reuse permission, and per-asset review remain
independently auditable. Wave 3 keeps the Moz index external; an approved child
chapter is independently qualified in TOC order. ContentKing remains a
Conductor collection link and Semrush remains a course link.

## Source disposition and dependencies

The JSON contract below is authoritative for
`npm run tutorials:migration-waves`. `sourceId` values identify migration
units; `routeSlug` exists only for a candidate route. Redirect origins remain
in `requestedUrl`, while the approved canonical remains in `canonicalUrl`.

```json
{
  "schemaVersion": 1,
  "checked": "2026-08-31",
  "baseline": {
    "pilotSlug": "google-seo-starter-guide",
    "sourceCanonical": "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
    "resourceOccurrences": 2152,
    "bilingualRenderedAnchors": 4304,
    "normalizedSourceKeys": 912
  },
  "throughput": {
    "collectionConcurrency": 2,
    "importConcurrency": 1,
    "reviewConcurrency": 1,
    "promotionConcurrency": 1,
    "writeLock": "global-tutorial-write-lock",
    "mediaConcurrencyPerSource": 1
  },
  "waves": [
    {"id": "wave-0-pilot", "batchSize": 1, "importConcurrency": 1, "orderedSourceIds": ["google-seo-starter-guide"], "promotionMode": "baseline-preservation"},
    {"id": "wave-1-official-google", "batchSize": 2, "importConcurrency": 1, "orderedSourceIds": ["google-search-works", "google-search-essentials"], "promotionMode": "all-imported-items-or-zero"},
    {"id": "wave-2-rights-reviewed", "batchSize": 1, "importConcurrency": 1, "orderedSourceIds": ["ahrefs-seo-basics", "mangools-complete-seo-guide"], "promotionMode": "one-rights-approved-item-per-boundary"},
    {"id": "wave-3-manual-or-external", "batchSize": 1, "importConcurrency": 1, "orderedSourceIds": ["moz-beginners-guide", "contentking-conductor-hub", "semrush-seo-essentials-course"], "promotionMode": "disposition-only-until-qualified"}
  ],
  "sources": [
    {"sourceId": "google-seo-starter-guide", "waveId": "wave-0-pilot", "provider": "Google", "requestedUrl": "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", "canonicalUrl": "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", "routeSlug": "google-seo-starter-guide", "disposition": "pilot-baseline", "importMode": "published-baseline", "dependencies": ["pilot-content-media-baseline", "pilot-release-gates"]},
    {"sourceId": "google-search-works", "waveId": "wave-1-official-google", "provider": "Google", "requestedUrl": "https://developers.google.com/search/docs/fundamentals/how-search-works", "canonicalUrl": "https://developers.google.com/search/docs/fundamentals/how-search-works", "routeSlug": "google-search-works", "disposition": "eligible-direct", "importMode": "direct", "dependencies": ["google-devsite-body", "source-updated-at", "google-cc-by-4.0", "apache-2.0-code-evidence", "translation-handoff", "all-release-gates"]},
    {"sourceId": "google-search-essentials", "waveId": "wave-1-official-google", "provider": "Google", "requestedUrl": "https://developers.google.com/search/docs/essentials", "canonicalUrl": "https://developers.google.com/search/docs/essentials", "routeSlug": "google-search-essentials", "disposition": "eligible-direct", "importMode": "direct", "dependencies": ["google-devsite-body", "source-updated-at", "google-cc-by-4.0", "apache-2.0-code-evidence", "translation-handoff", "all-release-gates"]},
    {"sourceId": "ahrefs-seo-basics", "waveId": "wave-2-rights-reviewed", "provider": "Ahrefs", "requestedUrl": "https://ahrefs.com/blog/seo-basics/", "canonicalUrl": "https://ahrefs.com/seo/seo-basics", "routeSlug": "ahrefs-seo-basics", "disposition": "rights-gated", "importMode": "rights-gated", "dependencies": ["canonical-rebind", "source-updated-at", "written-text-permission", "per-asset-rights", "interactive-surface-review", "translation-handoff", "all-release-gates"]},
    {"sourceId": "mangools-complete-seo-guide", "waveId": "wave-2-rights-reviewed", "provider": "Mangools", "requestedUrl": "https://mangools.com/blog/learn-seo/", "canonicalUrl": "https://mangools.com/blog/learn-seo/", "routeSlug": "mangools-complete-seo-guide", "disposition": "rights-gated", "importMode": "rights-gated", "dependencies": ["source-updated-at", "written-text-permission", "per-asset-rights", "form-cta-disposition", "youtube-allowlist-rights", "translation-handoff", "all-release-gates"]},
    {"sourceId": "moz-beginners-guide", "waveId": "wave-3-manual-or-external", "provider": "Moz", "requestedUrl": "https://moz.com/beginners-guide-to-seo", "canonicalUrl": "https://moz.com/beginners-guide-to-seo", "routeSlug": null, "disposition": "manual-series", "importMode": "manual-series-child-only", "dependencies": ["series-decision", "bot-challenge-preflight", "child-page-qualification", "per-child-canonical-update-media-rights"]},
    {"sourceId": "contentking-conductor-hub", "waveId": "wave-3-manual-or-external", "provider": "ContentKing/Conductor", "requestedUrl": "https://www.contentkingapp.com/academy/seo-guide/", "canonicalUrl": "https://www.conductor.com/academy/technical-seo-hub/", "routeSlug": null, "disposition": "external-collection", "importMode": "external-only", "dependencies": ["canonical-rebind", "editorial-link-review", "conductor-terms-evidence", "continuous-body-required"]},
    {"sourceId": "semrush-seo-essentials-course", "waveId": "wave-3-manual-or-external", "provider": "Semrush", "requestedUrl": "https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/", "canonicalUrl": "https://www.semrush.com/academy/courses/seo-essentials-with-semrush/", "routeSlug": null, "disposition": "external-course", "importMode": "external-only", "dependencies": ["canonical-rebind", "editorial-link-review", "course-surface-confirmed", "semrush-terms-evidence", "lesson-level-boundary-required"]}
  ],
  "mozChildReviewOrder": ["introduction", "quick-start-guide", "why-search-engine-marketing-is-necessary", "how-search-engines-operate", "keyword-research", "on-page-seo", "technical-seo", "growing-popularity-and-links", "measuring-and-tracking-success", "seo-glossary"],
  "promotionRule": {
    "stagedStatus": "draft",
    "stagedIndexable": false,
    "stagedResourceLinks": "external",
    "reviewDecision": "approved",
    "requiredGateIds": ["bilingual-fidelity", "provenance", "media-integrity", "accessibility", "security-sanitization", "metadata", "resource-card-conversion", "runtime-routes", "rollback-readiness"],
    "allImportedItemsMustPass": true,
    "atomicLocalePair": true,
    "generationUnit": ["manifest.json", "manifest.en.json", "import-generation.json", "resource-link-map"],
    "onSuccess": {"publishedSlugs": "all-imported-items", "activeGeneration": "candidateGeneration", "resourceLinks": "published-slugs-only"},
    "onFailure": {"publishedSlugs": [], "activeGeneration": "previousGeneration", "resourceLinks": "previousGeneration"}
  },
  "partialWaveFailure": {"publishNewSlugs": 0, "activeGeneration": "previousGeneration", "pilotBaselinePreserved": true, "successfulCandidates": "retain-staged-preview", "failedCandidate": "retain-journal-and-failure-code", "retryUnit": "failed-source-only-after-correction", "resourceLinkMap": "previousGeneration"},
  "rollbackRule": {"boundary": "wave-candidate-generation", "restoreTarget": "previousGeneration", "restoreUnit": ["manifest.json", "manifest.en.json", "import-generation.json", "resource-link-map"], "activePointerBeforeApproval": "unchanged", "preserve": ["routes-published-before-wave", "content-addressed-history", "source-identities-and-aliases"]}
}
```

## Staged import, review, and promotion runbook

For each ordered source unit:

1. Run preflight/collection and retain requested, final, canonical, update,
   media, rights, and failure evidence.
2. Provide the explicit UTF-8 Simplified Chinese handoff, then run
   `npm run tutorials:import`; accept only a bilingual `draft` pair with
   matching semantic structure, hashes, and generation evidence.
3. Run offline release gates and complete source-specific dependencies. Review
   one item at a time in wave order; record all eleven editorial checks and the
   five qualification checks.
4. After every imported item passes and runtime evidence is available, write a
   release record with previous/candidate generations, per-item gates, Pilot
   hashes/routes, and the resource conversion report. Promote the full pair
   atomically.

An individual draft, pending review, unresolved rights item, failed preflight,
or runtime failure keeps its route in preview and its card external. A partial
wave never converts a successful sibling into a published route. Retry the
failed source unit after correction, then rerun its full preflight and review;
the previous generation remains the rollback target.

The checker validates wave order, source dependency mapping, batch and
concurrency limits, Pilot invariants, all-or-zero promotion, partial-wave
failure isolation, and rollback boundaries. It does not contact sources or
write content.
