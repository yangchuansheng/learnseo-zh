# Pilot Tutorial Acceptance Contract

本文件关闭 Issue #14。它把
[`tutorial-internalization-spec.md`](./tutorial-internalization-spec.md) 的
Pilot Tutorial 验收条件固定为可观察证据、硬失败条件和可重复命令。发布动作
必须同时满足所有门禁；任一硬失败条件出现时，候选版本保持在预览状态，当前已
发布版本继续提供服务。

## 1. Fixed pilot inputs

| Item | Contract value |
| --- | --- |
| Source title | `Search Engine Optimization (SEO) Starter Guide` |
| Source canonical | `https://developers.google.com/search/docs/fundamentals/seo-starter-guide` |
| Source path | `/seo_roadmap/seo-fundamentals/` |
| Publisher | `Google Search Central / Google for Developers` |
| Internal slug | `google-seo-starter-guide` |
| Chinese route | `/tutorials/google-seo-starter-guide/` |
| English route | `/en/tutorials/google-seo-starter-guide/` |
| Source update value | `2025-12-10 UTC` (captured evidence) |
| Source article root | `.devsite-article-body` |

The captured DOM evidence is recorded in
[`tutorial-internalization-pilot.md`](./tutorial-internalization-pilot.md). The
source update value is audit evidence; a later source update creates a refresh
candidate and does not rewrite this baseline.

## 2. Release gate

The gate runs against the candidate manifest pair and their content-addressed
files. Every check produces a named evidence item. A release passes when every
item is `pass` and both locale records point at the same source canonical,
snapshot version, content structure, media identity, and commit generation.

The executable gate is:

```sh
npm run tutorials:check
```

The command is deterministic and offline for repository artifacts. A runtime
check can additionally use `BASE_URL` to verify rendered routes at desktop,
tablet, and mobile widths:

```sh
BASE_URL=http://127.0.0.1:3107 npm run tutorials:check -- --runtime
```

The lifecycle contract tests are included in the same command. They use small
isolated candidate records and assert the public operation evidence required by
duplicate-link mapping, refresh drift, interrupted commit recovery, and
rollback. They never write live content roots.

## 3. Evidence matrix

| Gate | Pass evidence | Hard failure |
| --- | --- | --- |
| Source-content coverage | Both locale records contain the fixed slug, canonical, source path, positive snapshot version, source/content hashes, and the English body has exactly `h1:1`, `h2:11`, `h3:13`, `p:63`, `ul:6`, `li:17`, `a:54`, `img:4`, `table:2`, `code:16`. English content hash and content-addressed filename agree. | Missing metadata or body root; source hash mismatch; route/slug drift; any locked semantic count changes; source-shell markup appears in the body. |
| Media integrity | Four distinct pilot images appear in each locale with identical identity/order, non-empty `alt`, preserved width metadata where supplied, local `/sites/learningseo-io-071dae18/tutorials/` paths, and existing files under `public/`. Recorded media hashes match the files. | Remote or data image; missing file/hash/alt; locale media order or identity drift; path traversal; image count drift. |
| Translation fidelity | English text remains source text after the documented shell removal, sanitizer, URL normalization, and local media rewrite. Chinese has Simplified Chinese text, identical semantic tag order, heading IDs, links, media order, section counts, and numeric facts. The eleven review checklist keys are present and `true`: `contentComplete`, `dataPreserved`, `factsPreserved`, `logicPreserved`, `terminologyCorrect`, `chineseNatural`, `authorVoicePreserved`, `linksPreserved`, `mediaVerified`, `attributionPresent`, `seoVerified`. | English fallback in Chinese; missing/extra section; changed heading ID or block order; changed URL/media identity; missing checklist key; any checklist value other than boolean `true`; unreviewed candidate published. |
| Accessibility | Exactly one `h1`; heading hierarchy is navigable; every image has useful `alt`; every link has an `href` and accessible name; every iframe has a title; tables retain table semantics; locale metadata supplies `en` and `zh-CN`. | Missing/empty alternative text or accessible name; heading jump; untitled iframe; interactive element with no keyboard-accessible name; locale mismatch. |
| Responsive rendering | Runtime check renders both routes at 390px, 768px, and 1440px widths with visible title/body, no document horizontal overflow, readable body text, and horizontal overflow supplied by a table wrapper at narrow width. | Route error; clipped/absent body; document overflow; table forces page-wide overflow; mobile or tablet route differs in required semantic structure. |
| Security | Sanitized HTML contains the allowed semantic tags and safe attributes only. URLs use approved protocols. Images are repository-local. Iframes, when present, use HTTPS and the allowlist `embeds.beehiiv.com`, `player.vimeo.com`, `www.youtube.com`, `www.youtube-nocookie.com`, `youtube.com`. | `script`, `style`, `object`, `embed`, `base`, `meta`, event attributes, `srcdoc`, inline style, dangerous URL protocol, remote image, unauthorized iframe, or escaped local path. |
| SEO | Published routes use absolute self-canonical URLs, reciprocal `hreflang=zh-CN`/`en`, `html[lang]`, indexable metadata, source attribution, and TechArticle JSON-LD with `headline`, `description`, `inLanguage`, `dateModified`, `author`, `publisher`, `mainEntityOfPage`, and `isBasedOn`. Published routes enter the sitemap; preview states emit `noindex,nofollow` and stay out of the sitemap. | Canonical/alternate mismatch; missing or malformed JSON-LD; preview indexed; published route absent from sitemap; robots contract drift. |
| Internal navigation | Every published pilot source occurrence maps to one stable slug per locale. The pilot reconciliation report contains `2,152` logical occurrences, `4,304` bilingual rendered anchors, and `914` normalized source keys, with `converted + fallback = total`; duplicate source variants share one key and slug. | Duplicate slug ownership; map count drift; published occurrence without conversion; draft/stale occurrence converted internally; unknown fragment silently retained; tutorial body outbound link rewritten as a resource card. |
| Provenance | Record keeps source title, publisher, nullable author, requested/final/canonical URLs, source path, content type, `canonicalMatched`, source update value, captured-at timestamp, content hashes, and license text. Rendered pages visibly link the canonical source and expose `isBasedOn`. | Missing attribution or source URL; canonical mismatch; unrecorded redirect/final URL; missing source update or snapshot hash; attribution hidden from the rendered page. |
| Build verification | The candidate passes `npm run tutorials:check`, `npm run check:data`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:smoke`. | Any command exits non-zero, reports a browser error, or produces an inconsistent locale pair. |
| Refresh drift | Re-importing the same `(sourceKey, sourceContentHash, translationContentHash)` keeps version, history, media identities, link map, and published generation unchanged. Changed source/body/media creates a higher candidate version in `draft`/`stale`, preserves the published pair and links, records old hashes in history, and requires a new review. Canonical host drift reports `canonical-mismatch`. | In-place mutation of the published pair; version reuse for changed content; English fallback for changed Chinese sections; stale/refresh without audit evidence; canonical change under the old slug. |
| Rollback | A valid historical version creates `currentVersion + 1` with `rollbackOf`, candidate `draft`, review `pending`, intact history hashes, and unchanged active published pointer until approval. Approval switches both locales and link generation together. | Missing/mismatched history files; target equals active version; unsafe content; partial locale switch; active pointer changed before approval; failed rollback mutates live files or links. |

The `source-content`, `media`, `translation`, and `provenance` gates are
content gates. `accessibility`, `responsive`, `security`, and `SEO` are render
and platform gates. `refresh` and `rollback` are lifecycle gates. A green
content gate never waives a failing render or lifecycle gate.

## 4. Lifecycle scenario assertions

The checker records these public outcomes as executable acceptance tests:

1. **Duplicate links:** URL variants that differ only by tracking parameters,
   trailing slash, or a validated fragment normalize to one `sourceKey`; all
   occurrences use the one published slug. An unknown fragment remains an
   external URL and emits a warning.
2. **Refresh drift:** unchanged source and translation hashes are idempotent;
   a changed source hash increments the snapshot version, keeps the old
   published version active, appends the old snapshot to history, and blocks
   publication until review.
3. **Interrupted commit:** a generation mismatch is detected; a verified
   candidate completes atomically or the last backup is restored. Recovery is
   idempotent and leaves mixed English/Chinese generations unpublished.
4. **Rollback:** a valid historical pair stages as a new pending candidate;
   invalid or incomplete history leaves the active pair, media, status, link
   map, and active version unchanged.

Each scenario must retain operation id, actor, source key, previous/next status,
candidate and published versions, hashes, decision/checklist, conversion report,
and failure code or rollback reason when applicable.

## 5. Review and handoff

The reviewer signs the candidate only after the gate output, runtime evidence,
source snapshot, translation checklist, media report, and lifecycle scenario
results are attached to the change. #15 owns route/SEO assertions, #16 owns
manifest/schema fields, #17 owns semantic rendering and responsive assertions,
and #18 owns importer/sanitizer evidence. #14 owns this shared release gate and
the four lifecycle scenario checks.
