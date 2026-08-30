# Tutorial Internalization Lifecycle

This document closes Issue #12 for the tutorial internalization work described in
[`tutorial-internalization-spec.md`](./tutorial-internalization-spec.md). It defines
the source-to-tutorial identity, resource-link conversion, refresh review,
failure recovery, and rollback contract. The importer, renderer, and URL tickets
implement these rules; this document does not expand the eligible source scope.

## Decision

One normalized Source Tutorial canonical URL owns one stable Internal Tutorial
slug. Every resource-card occurrence of that source resolves through the same
identity record. A source snapshot is immutable, a refresh creates a new
version, and a rollback creates another version copied from history. Published
content changes only after the English and Simplified Chinese pair passes review.

The current published pair remains the last known-good release while collection,
translation, validation, or staging work runs. A failed operation leaves the
published pair and its media references untouched.

## 1. Source identity and slug ownership

### Canonical key

The importer derives `sourceKey` from the URL returned by preflight and the
source canonical element:

1. Require `https:` and a public host.
2. Follow redirects, then require the final page canonical to match the
   requested canonical after the comparison rules below.
3. Lowercase the hostname and remove the default HTTPS port.
4. Remove the fragment and tracking query parameters (`utm_*`, `fbclid`, and
   `gclid`); preserve meaningful query parameters in sorted order.
5. Normalize an empty path to `/` and remove trailing slashes from other paths.

The normalized URL remains percent-encoded as supplied by `URL`; path and query
semantics are never guessed. A host change, canonical mismatch, or malformed
URL is a preflight failure. A redirect is evidence for audit metadata and never
reassigns an existing tutorial automatically.

`source.canonicalUrl` stores the approved canonical URL. The raw URL found in a
resource card may retain its fragment and tracking parameters for fallback
display, while its `sourceKey` points at the approved record.

### Stable slug

- New sources receive an explicit slug that satisfies the existing slug
  contract. The recommended pilot slug is `google-seo-starter-guide`.
- A slug is permanently owned by its `source.canonicalUrl`. A later source
  cannot take the slug, even when its title looks similar.
- A duplicate source key reuses the existing record and never creates a second
  tutorial. A duplicate slug with a different source key fails validation.
- A changed canonical creates a new source record and slug after qualification.
  The old record keeps its history and remains addressable for audit and
  rollback.

When a redirect or source edit is confirmed to represent the same learning
resource, an operator runs an explicit rebind operation:

```sh
node scripts/rebind-tutorial-source.mjs \
  --from <old-source-url> \
  --to <new-canonical-url> \
  --slug <new-slug> \
  --reason "<operator reason>"
```

The command preflights the new canonical, verifies that `<new-slug>` is owned by
it, and records a one-way alias from the old `sourceKey` to the new record. The
old record becomes `stale` only after this approval; its slug remains reserved.
Cards using the old key stay external until the new record is published, then
resolve through the approved alias. An alias cannot point to two records or
change a record's canonical URL.

The importer must therefore resolve identity before writing content. Title,
provider, path shape, and host similarity provide review hints only; they never
merge two source keys.

## 2. Lifecycle state machine

The record `status` is the publication state. Every transition writes an audit
entry with operation id, actor, timestamp, previous status, next status, source
key, and snapshot version.

| Current | Event | Guard | Next | Link and index behavior |
| --- | --- | --- | --- | --- |
| absent | qualified import | preflight, English source, Chinese handoff, and schema checks pass | `draft` | external resource links; `noindex,nofollow` |
| `draft` | submit for review | bilingual structure, sanitizer, media, attribution, and metrics checks pass | `review` | external resource links; `noindex,nofollow` |
| `review` | approve | five qualification checks, bilingual section parity, sanitizer/media/attribution checks, reviewer identity, timestamp, and all eleven checklist items are complete | `published` | internal bilingual links; indexable |
| `review` | request changes | reviewer records notes | `draft` | external resource links; `noindex,nofollow` |
| `published` | source/content drift confirmed | new snapshot or canonical audit identifies a change, or operator marks refresh | `stale` | external resource links; `noindex,nofollow` |
| `stale` | refreshed import | same source key, new snapshot, and complete translation handoff | `draft` | external resource links; `noindex,nofollow` |
| any preview state | manual edit or rollback candidate | content is changed or restored from history | `draft` | external resource links; `noindex,nofollow` |

`draft`, `review`, and `stale` remain statically renderable for review. Only
`published` records enter the tutorial index, sitemap, and source-link map.
There is no direct transition from `draft` or `stale` to `published`.

An unsuccessful refresh attempt does not by itself change `published` to
`stale`; it records a failed attempt and keeps the last known-good release.
`stale` means that a source change has been confirmed or an operator has
explicitly marked the record for refresh.

## 3. Import and manual refresh contract

The existing commands form one repeatable workflow:

```sh
npm run tutorials:collect -- \
  --url <canonical-url> \
  --source-path <learningseo-source-path> \
  --slug <slug> \
  --output temp/<slug>.snapshot.json

npm run tutorials:import -- \
  --input temp/<slug>.snapshot.json \
  --translation temp/<slug>.zh-CN.html

npm run tutorials:review -- \
  --slug <slug> \
  --input temp/<slug>.review.json
```

The import operation is idempotent on `(sourceKey, sourceContentHash,
translationContentHash)`. Re-running an unchanged snapshot leaves its version,
history, and links unchanged. A changed source or translation creates the next
snapshot version and appends the former version to `snapshot.history`; source
content is copied by hash, so history remains readable after later imports.

Every refresh is manual and version-checked:

- The review input records the expected snapshot version and source/content
  hashes. A review for an older version fails with `review-version-conflict`.
- The importer carries forward approved Chinese segments whose source segment
  hash is unchanged. Changed or new segments require a new translation handoff;
  English text is never used as a Chinese fallback.
- A changed heading id, block order, or media identity moves the candidate to
  `draft` and requires a fresh review. The current published pair remains
  available until the candidate is approved.
- A changed source canonical follows the explicit rebind flow in Section 1. It
  creates a new source record and slug; it does not refresh the old record under
  a new canonical.
- `npm run tutorials:stale -- --slug <slug>` records an operator-requested
  refresh boundary without altering the current snapshot. The next import must
  use the same source key and a higher snapshot version.
- `review.json` accepts `pending`, `approved`, or `changes-requested`. A
  `pending` decision keeps the candidate in `review` with no publish side
  effect. Approval publishes both locales together; changes requested returns
  the candidate to `draft` and preserves reviewer notes.

The eleven checklist keys are fixed so review evidence remains comparable:
`contentComplete`, `dataPreserved`, `factsPreserved`, `logicPreserved`,
`terminologyCorrect`, `chineseNatural`, `authorVoicePreserved`,
`linksPreserved`, `mediaVerified`, `attributionPresent`, and `seoVerified`.
Each key is a boolean; all eleven must be `true` for `approved`.

The review command is the only path from `review` to `published`. Its guard
requires the five qualification checks, matching bilingual section counts,
sanitized HTML, verified media, visible attribution, and every checklist key.
It rejects a missing reviewer, missing checklist item, mismatched locale section
count, unsafe HTML, remote image, unauthorized iframe, missing attribution, or
unverified content hash.

## 4. Resource-link conversion

### Scope and mapping

Link conversion covers every current LearningSEO resource-card occurrence:

- generated English and Simplified Chinese subpage HTML under `.resource`;
- homepage data only when the source inventory marks the entry as a resource
  card; and
- the source inventory entries that declare a resource-card target.

Root roadmap navigation, author/profile links, share controls, and the Google
Sheets `ResourceBanner` are reported as separate link categories and remain
outside tutorial conversion. New tutorial resource surfaces register in the
same inventory before conversion. The current pilot inventory is the
reconciliation baseline: `2,152` resource-card occurrences and `912` normalized
source keys. An occurrence means one logical resource card shared by the two
locale datasets: each locale renders `2,152` anchors, while the bilingual pair
contains `4,304` rendered anchors. A link conversion report must partition the
logical occurrences (`converted + fallback = 2,152`) and independently verify
the same partition and key order in each locale (`2,152` per locale). An
inventory count change fails the candidate with the observed count for review.

Author/profile, share, navigation, source-attribution, and outbound links inside
the imported tutorial body stay outside this mapping. A converter must report
those categories separately so a missed resource card cannot be hidden by a
large unrelated link count.

At render time, the locale-specific resource renderer:

1. derives the occurrence `sourceKey` using the canonical-key rules;
2. looks up the unique tutorial record for that key;
3. rewrites the href to `/tutorials/<slug>/` for `zh-CN` or
   `/en/tutorials/<slug>/` for `en` only when the record is `published`;
4. appends a meaningful original fragment after validating it against the
   internal heading ids; and
5. preserves the original external href for all other states or failed lookups.

The converter never matches by title, provider, host prefix, or path substring.
It never rewrites a tutorial's own outbound links. A missing map entry is a
permitted external fallback for an unknown or preview key. A missing map entry
for a record declared `published`, a duplicate map entry, or a route with a
different canonical is a validation error for a release candidate.

### Duplicates and source changes

- Multiple cards with the same `sourceKey` all point to one slug and are counted
  as separate occurrences in the conversion report.
- Tracking/query/fragment variants that normalize to the same key share the
  slug. Their useful fragment is retained when the corresponding internal
  heading exists; an unknown fragment keeps the external URL and emits a
  warning for review.
- A newly discovered canonical is external until its record reaches
  `published`; the first successful publication converts every occurrence in
  the next atomic release.
- An explicitly `stale` record, including one marked stale after a confirmed
  canonical change or operator refresh request, removes its internal conversion
  on the next render and exposes the original source URL. The tutorial page
  remains available as a noindex preview for review and rollback.
- A transient preflight or refresh failure leaves a still-`published` record
  and its internal links unchanged; the failure code is recorded for retry.
- An approved rebind adds the old key as an alias of the new record. Alias
  conversion follows the new record's status and never mutates the old record's
  canonical URL.

The conversion report records total resource occurrences, unique source keys,
published conversions, external fallbacks, duplicate occurrences, and unknown
fragments. Acceptance requires `converted + fallback = total` and one slug per
published source key; the pilot report must also match `2,152` logical
occurrences, `4,304` rendered anchors, and `912` normalized keys.

## 5. Atomic writes and failure recovery

Collection, translation, media download, sanitization, manifest generation,
and link conversion run in an operation directory outside the live content
roots. The operation has a unique id and a journal containing the input hashes,
candidate snapshot version, files staged, validation results, and commit phase.

The commit protocol is:

1. Download media and write English/Chinese content under content-addressed
   paths in the operation directory.
2. Build candidate locale manifests and the derived source-link map.
3. Validate every candidate file, hash, locale pair, route, media reference,
   canonical, attribution field, and conversion count.
4. Acquire the tutorial write lock and write a backup of the last committed
   manifest pair and link-map generation.
5. Atomically rename validated candidate files into place, then atomically write
   the commit marker containing one operation id and generation for both
   locales.
6. Remove the journal only after the marker and integrity check succeed. Hash
   named content and media remain immutable; orphaned staged media is cleanup
   work for a later command.

The journal is durable before each rename and records the last completed phase.
The write lock prevents concurrent commits. Keep the last two committed
manifest/link-map backups; content and media remain content-addressed and can
be retained indefinitely for history.

Recovery is explicit and idempotent:

```sh
node scripts/recover-tutorial.mjs --operation <operation-id>
```

Recovery checks the journal, commit marker, generation, and every staged hash.
It completes a commit when all candidate files are valid, restores the previous
backup when a rename stopped part-way, and returns `recovery-conflict` without
changing live files when neither outcome can be proved. Re-running recovery
after either outcome returns the same generation and operation result. The
renderer and `tutorials:check` accept only a matching commit generation; they
never guess between a partial English and Chinese state.

Failures use stable codes: `preflight`, `redirect-loop`, `bot-challenge`,
`authentication`, `non-html`, `unavailable`, `canonical-mismatch`,
`extraction-failure`, `translation-missing`, `unsafe-markup`, `unsupported-media`,
`media-download`, `link-map`, `validation`, `review-version-conflict`, `commit`, and
`recovery-conflict`. The command prints the code and operation id, keeps the
last committed release intact, and leaves the failed candidate available for
diagnosis when its staged files are safe to inspect.

## 6. Published snapshot rollback

Rollback is an audited version copy, never an edit to history:

```sh
node scripts/rollback-tutorial.mjs \
  --slug <slug> \
  --version <history-version> \
  --reason "<operator reason>"
```

The command stages a candidate beside the live release:

1. requires an existing record and a target version older than the active
   snapshot;
2. verifies the historical English and Chinese content hashes, media files,
   source key, heading ids, locale structure, and sanitizer result;
3. creates `currentVersion + 1` by copying the target pair and records
   `rollbackOf: <history-version>` in the snapshot audit history;
4. writes the candidate with review decision/checklist set to pending and
   candidate status `draft` while leaving the live `published` record and its
   `activeVersion` pointer unchanged; and
5. commits the candidate through the same atomic protocol as an import. The
   candidate is promoted, the previous active version is appended to
   `snapshot.history`, and both locale manifests switch together only after
   review approval.

The old published version remains the live last-known-good release until the
rollback candidate passes review. The candidate has a noindex preview route;
resource cards continue using the stable internal slug for the live release.
Approval publishes both locale routes and keeps all mapped occurrences on that
slug. A release pointer or equivalent generation marker makes the live/candidate
split explicit in the #16 schema.

Rollback rejects missing history files, mismatched hashes, incomplete locale
pairs, changed canonical host, unsafe markup, and a target equal to the active
version. A failed rollback changes no live manifest, content, media reference,
status, activeVersion pointer, or resource link.

## 7. Required audit evidence

Each import, refresh, stale mark, review, publish, recovery, and rollback keeps:

- operation id and actor;
- source key, requested URL, final URL, and canonical-match result;
- previous and next status;
- previous, candidate, and published snapshot versions;
- source, English, and Chinese content hashes;
- translation and checklist decision;
- resource occurrence/conversion report; and
- failure code or rollback reason when applicable.

The evidence is sufficient to answer which source generated a route, why a link
was converted or left external, which content was live at publication time, and
how a rollback was reviewed.

## Acceptance matrix

| Scenario | Expected evidence |
| --- | --- |
| Same source appears in several cards | One normalized source key, one slug, every occurrence counted and converted after publication |
| Pilot inventory reconciliation | Exactly `2,152` logical resource cards (`4,304` bilingual anchors) and `914` normalized keys are partitioned in both locale datasets; any drift is reported |
| Tracking or fragment variants | Same key; useful validated fragment retained; unknown fragment remains external with warning |
| Unchanged refresh | Idempotent result; snapshot version and link map unchanged |
| Source body changes | New version in `draft`/`stale` flow; old published pair and links remain safe until approval |
| Canonical host changes | `canonical-mismatch`; old slug stays owned by the old source |
| Missing translation or unsafe media | Stable failure code; no live file changes |
| Crash during commit | Generation mismatch detected; backup restored or verified commit completed |
| Approved refresh | Both locale manifests switch together; every published occurrence maps to the same slug |
| Rollback to a valid history version | New incrementing version with `rollbackOf`, pending review, and unchanged history files |
| Rollback validation failure | Current published release, media, status, and resource links remain intact |

## Handoff

- #16 owns the exact manifest/schema representation of generation, audit
  history, and source aliases while preserving this behavior.
- #18 owns collector/importer failure codes, staging, sanitizer checks, and
  command implementation.
- #15 owns locale route, canonical, robots, and sitemap output for the states
  above.
- #14 owns executable acceptance tests for duplicate links, refresh drift,
  partial commit recovery, and rollback.
