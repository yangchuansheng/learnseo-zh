# SEO Fundamentals Source-Specific Normalization and Attribution Decisions

- Ticket: [Define source-specific normalization and attribution decisions](https://github.com/yangchuansheng/learnseo-zh/issues/22)
- Inventory baseline: [Issue #20 source tutorial inventory](./wayfinder-seo-fundamentals-inventory.md)
- Release baseline: [Issue #21 release gates](./tutorial-internalization-release-gates.md)
- Contract owners: [internalization specification](./tutorial-internalization-spec.md), [lifecycle](./tutorial-internalization-lifecycle.md), and [Pilot acceptance](./tutorial-internalization-acceptance.md)
- Checked: `2026-08-31` using live HTTP, rendered-page, and owning-terms evidence recorded in the inventory

This artifact closes the source-specific decision boundary for the seven SEO
Fundamentals cards classified by the inventory. It defines the body boundary,
navigation treatment, media and interactive normalization, attribution record,
failure disposition, and exact card outcome for each source. The importer,
manifest model, renderer, and release gates remain the implementation owners;
this artifact supplies the source profile each future collection must satisfy.

## Decision vocabulary

| Decision | Meaning | Card behavior | Tutorial behavior |
| --- | --- | --- | --- |
| `eligible-direct` | Public, continuous, topic-closed single-page body with canonical and license evidence. | Convert after the normal bilingual review. | Use the existing single-page importer and publish only after every release gate passes. |
| `rights-gated` | A single-page body can be bounded, with reuse rights or asset ownership requiring written evidence. | Keep the source URL external while rights review is pending. | Stage a draft after canonical and rights evidence; publish after `provenance` and `media-integrity` pass. |
| `manual-series` | A source presents an index plus child chapters or another multi-page boundary. | Keep the index card external. | Create one independently qualified record per approved child chapter; preserve chapter links and series context. |
| `external-collection` | The current destination is a resource hub or collection grid. | Keep the collection URL external. | Select an individual article through a separate inventory decision. |
| `external-course` | The current destination is a course application with lesson state, video delivery, enrollment, or certificate behavior. | Keep the course URL external. | Treat each future public lesson as a separate qualification candidate; retain the course as a course link. |

Every preview state (`draft`, `review`, or `stale`) keeps its resource-card
occurrence external. A card converts to a bilingual tutorial route only after
the corresponding source record reaches `published`.

## Shared normalization contract

### Source identity and canonical normalization

Collection records keep all four URL values so a redirect remains auditable:

| Field | Required value |
| --- | --- |
| `requestedUrl` | URL present in the LearningSEO resource card at collection time. |
| `finalUrl` | URL returned by the bounded HTTPS redirect chain. |
| `canonicalUrl` | HTTPS canonical link emitted by the final page and approved by review. |
| `sourceKey` | `normalizeSourceKey(canonicalUrl)`, with lowercase host, default HTTPS port removed, fragment/tracking parameters removed, sorted meaningful query parameters, and normalized trailing slash. |

The manifest source record stores `title`, `provider`, nullable `author`,
`canonicalUrl`, `sourcePath`, `requestedUrl`, `finalUrl`, `contentType`, and
`license`. The snapshot stores `pageCanonicalUrl`, `canonicalMatched`,
`sourceUpdatedAt`, `capturedAt`, `sourceContentHash`, `contentHash`, and
`history`. `contentMetrics`, TOC entries, and the ordered media manifest remain
part of the candidate record.

A card redirect whose final canonical differs from the requested card URL
requires an explicit source rebind record. The lifecycle document specifies the
future `rebind-tutorial-source.mjs` operation; the current repository has no
such command, so Ahrefs, ContentKing, and Semrush retain their original card
occurrence plus redirect evidence until an operator records the rebind or
external disposition. A title, host similarity, or path shape supplies review
context and never merges source keys.

### Body boundary and navigation

The existing importer extracts one explicit body root (`.devsite-article-body`,
then `article`, then `main`) and removes source shell navigation, feedback,
enrollment, and footer controls from imported content. A source profile must
record the selector and the observed body metrics before translation.

- In-page links retain their `href` fragment and matching heading `id`.
- Links to another source page retain their absolute source URL and remain
  ordinary outbound links inside the body. Resource-card conversion applies to
  card occurrences and never rewrites tutorial-body links.
- A multi-page index, chapter list, hub grid, or course lesson list stays a
  navigation surface. Each approved child page receives its own canonical,
  source key, snapshot, slug, rights evidence, and bilingual review.
- Source-shell links, search controls, feedback controls, account controls, and
  tracking-only links stay outside the body. A source link that explains an
  omitted interactive surface remains visible as an outbound CTA.

### Supported semantic blocks

The model and sanitizer currently support `h1`–`h6`, `p`, `ul`, `ol`, `li`,
`a`, `table`, `code`, `pre`, `blockquote`, `img`, `figure`, `figcaption`, and
`iframe`. The renderer wraps tables for narrow viewports. Heading IDs and
levels, semantic tag order, numeric facts, links, and media identity remain
equal across the English and Simplified Chinese pair.

| Surface | Faithful normalization | Attribution and evidence |
| --- | --- | --- |
| Multi-page navigation | Keep the current page body and its chapter links together only when the body is continuous and canonical on one URL. Preserve in-page anchors. Create separate records for child pages, then link them as a reviewed series. | Capture visible TOC/child URLs, page canonical, each child canonical, source title, provider, and series/index context. |
| Course lessons | Keep lesson counts, titles, and course navigation in an external course card. Lesson playback, worksheets, enrollment, account state, and certificate flow remain external application behavior. | Capture course landing URL, current title/instructor, lesson count, access requirement, and terms evidence. A future lesson import needs its own page evidence and rights decision. |
| Interactive embeds | Preserve an HTTPS iframe only when its host is in the existing allowlist (`embeds.beehiiv.com`, `player.vimeo.com`, `www.youtube.com`, `www.youtube-nocookie.com`, `youtube.com`), with source URL, title, and accessibility evidence. Keep the embed remote. | Record provider, embed URL, title, capture date, and media rights evidence. Shell utility iframes and tracking frames stay outside the body. |
| Tables | Preserve `table`, `thead`, `tbody`, `tr`, `th`, and `td` semantics plus `scope`, `colspan`, and `rowspan`. Keep table text and order in both locales; use the renderer's table wrapper. | Record table count in `contentMetrics`; review table data, caption/context, and any third-party source credit. A JS-only table requires manual review or external disposition. |
| Code | Preserve inline `code` and block `pre`/`code` text, order, and meaningful whitespace. Treat executable behavior as source text and exclude runnable scripts. | Record the code license separately from prose. Google pages link Apache 2.0 for code samples; other code samples require source-owner evidence. |
| Images | Download HTTPS image bytes only when content type, size, source URL, alt text, and rights are verified. Store a content-addressed local path, SHA-256, alt text, dimensions when supplied, and stable order. Exclude shell, tracking, CTA-only, and unresolved third-party assets from the body. | Keep image source URL, owner/license evidence, alt review, and media hash in the handoff. Missing alt, active SVG, unsupported type, or unresolved ownership produces `unsupported-media`. |
| Third-party media | Preserve a reviewed outbound link or allowlisted remote embed with its original provider and URL. Keep third-party rights separate from the page prose license. | Capture provider/owner, URL, license or permission evidence, and the decision to link, embed, localize, or omit. A page-level license never grants rights to separately owned media. |

### Interactive and unsupported structures

The source profile explicitly classifies structures outside the current model.
Dangerous markup (`script`, `style`, `object`, `embed`, `base`, `meta`, `link`,
and `form`) fails sanitizer preflight with `unsafe-markup`. Form controls and
application widgets (`input`, `select`, `textarea`, client-side quiz/certificate
flows, account gates, paid-trial controls, and JS-only content) have no faithful
static representation in the current tutorial model. Their exact treatment is
an external CTA or a manual source decision with the original URL retained.

| Unsupported or risky structure | Required disposition |
| --- | --- |
| `script`, `style`, `object`, `embed`, `base`, `meta`, `link`, `form`, event attributes, `srcdoc`, or executable URL | Fail with `unsafe-markup`; keep the candidate out of publication and retain the preflight report. |
| `input`, `select`, `textarea`, quiz, certificate, newsletter, account, paid-trial, or JS-only application behavior | Classify as `unsupported-interaction`; retain a source CTA or keep the card external. Static explanatory text needs a separate rights and editorial decision. |
| Iframe outside the allowlist, missing source URL, or inaccessible title | Fail with `unsupported-media`; retain a source link or move the source to manual/external handling. |
| Remote image, data image, active SVG, missing alt, invalid type, size limit, or unresolved owner | Fail with `unsupported-media`; omit the asset only through a reviewed source-specific disposition. |
| Missing/changed canonical, cross-host redirect, or unverifiable final page | Fail with `canonical-mismatch`; preserve requested/final evidence and create an explicit rebind or external decision. |
| HTTP authentication, bot challenge, unavailable response, or non-HTML response | Fail with `authentication`, `bot-challenge`, `unavailable`, or `non-html`; retain the card external and preserve the response evidence. |
| No explicit continuous body root, collection grid, multi-page series, or course application | Fail with `extraction-failure` or classify as `manual-series`, `external-collection`, or `external-course` according to the source profile. |

### Attribution and publisher-context evidence

Each candidate must preserve evidence sufficient to answer who published the
page, who authored or reviewed the text, which URL was captured, and which rights
cover each asset. The visible renderer uses `source.author` and falls back to
`source.provider`; the attribution block links `source.canonicalUrl`, shows the
source path, update/capture value, and license text or URL. Structured data uses
the same author/provider identity and `isBasedOn` canonical.

The current model has one nullable `author` field and one `provider` field. A
page with contributors, reviewers, or a corporate copyright holder stores the
primary visible byline in `author`, the publishing organization in `provider`,
and the complete role list in the source evidence/review handoff. This keeps the
rendered author label truthful while retaining contributor and reviewer context
for audit. A missing personal byline uses the named publisher/provider as the
author fallback.

The provenance handoff must include:

1. visible page title, byline, contributor/reviewer roles, publisher, and
   copyright/footer context;
2. requested, final, canonical, and source-path values plus redirect evidence;
3. HTTP status, `Content-Type`, canonical match, source update signal, capture
   timestamp, source/content/media hashes, and observed `contentMetrics`;
4. page terms/license URL, applicable code license, per-image/per-embed owner
   and permission evidence, and a statement of modifications;
5. body selector, shell/interactive elements removed, navigation treatment,
   omitted assets, and the exact failure/disposition code when applicable.

Google's [Site Policies](https://developers.google.com/terms/site-policies)
describe the documentation reuse notice, attribution, modified-work notice, and
separate treatment for images, audio, video, and external links. The [CC BY 4.0
deed](https://creativecommons.org/licenses/by/4.0/) supplies the attribution,
license-link, and changes-notice requirements. These links support the Google
profiles below; the other profiles cite their owning terms directly.

## Source-specific decisions

### 1. In-Depth Guide to How Google Search Works

- Source evidence: [Google Search Central — In-Depth Guide to How Google Search Works](https://developers.google.com/search/docs/fundamentals/how-search-works), [Google Site Policies](https://developers.google.com/terms/site-policies), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- Observed boundary: `200 text/html`, `Last-Modified: 2025-12-18`, canonical and final URL match the card URL, one `.devsite-article-body`; observed `h1 1`, `h2 5`, `p 18`, `ul 3`, `ol 1`, `li 12`, `a 29`, `code 3`.
- Normalization: Extract `.devsite-article-body`; remove Google navigation, feedback, and footer shell; preserve one H1, heading IDs, paragraphs, lists, links, and inline code. Proposed slug: `google-search-works`.
- Navigation: Preserve in-page fragments and body links as source links. Child documentation linked from the body remains an outbound link and receives an independent decision when it appears as a card.
- Interactive: Body evidence shows `iframe 0`, `video 0`, and `audio 0`; shell controls stay outside the body. The static article remains within the current importer boundary.
- Tables and code: Body evidence shows `table 0`; retain the three inline code elements and record Apache 2.0 code attribution separately from prose.
- Images and third-party media: Body evidence shows `img 0`; the page-level CC BY notice does not change separate terms for linked media. The candidate media manifest is empty after shell removal.
- Attribution evidence: Store provider/author fallback `Google Search Central / Google for Developers`, canonical URL, source path, `Last-Modified`, capture timestamp, CC BY 4.0 policy link, and Apache 2.0 code link. Preserve the Google publisher context in both locale attribution blocks.
- Exact disposition: **eligible for direct import** (`eligible-direct`, P1). Collect as `google-search-works`; publish only after bilingual, provenance, security, metadata, and resource-card gates pass.

### 2. Google Search Essentials

- Source evidence: [Google Search Central — Google Search Essentials](https://developers.google.com/search/docs/essentials), [Google Site Policies](https://developers.google.com/terms/site-policies), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- Observed boundary: `200 text/html`, `Last-Modified: 2025-12-10`, canonical and final URL match the card URL, one `.devsite-article-body`; observed `h1 1`, `h2 3`, `p 7`, `ul 2`, `li 10`, `a 14`.
- Normalization: Extract `.devsite-article-body`; remove source search, feedback, and policy shell; preserve the technical requirements, spam-policy, and best-practice sections as one body. Proposed slug: `google-search-essentials`.
- Navigation: Preserve in-page fragments and linked policy references. The page has no child-page navigation required for topic completion.
- Interactive: Body evidence shows `iframe 0`, `video 0`, and `audio 0`; source-shell controls stay outside the imported content.
- Tables and code: Body evidence shows `table 0`; preserve any inline code discovered by collection and attach Apache 2.0 evidence to code samples.
- Images and third-party media: Body evidence shows `img 0`; retain separate ownership evidence for any linked external image, audio, video, or document.
- Attribution evidence: Store provider/author fallback `Google Search Central / Google for Developers`, canonical URL, source path, `Last-Modified`, capture timestamp, CC BY 4.0 policy link, and Apache 2.0 code link. Keep the publisher context visible in both locale pages.
- Exact disposition: **eligible for direct import** (`eligible-direct`, P1). Collect as `google-search-essentials` after `google-search-works`; publish only after the full release gate set passes.

### 3. The Beginner's Guide to SEO (Moz)

- Source evidence: [Moz — Beginner's Guide to SEO](https://moz.com/beginners-guide-to-seo), [Moz Terms of Use](https://moz.com/terms-of-use), and the [LearningSEO card](https://moz.com/beginners-guide-to-seo).
- Observed boundary: plain importer-user-agent GET returned `200 text/html`, card canonical matched, and inventory evidence recorded `Last-Modified: 2026-08-25`; a Chrome-like request received a Cloudflare `403` bot challenge. The page exposes `guides-chapter`/`.article-body`, an introduction, and ten visible TOC entries: introduction plus nine chapter URLs.
- Normalization: Treat the index/introduction as a series surface. Keep the index shell and chapter links external. Each child chapter needs its own body selector, canonical, source update value, media manifest, rights review, and slug.
- Navigation: Preserve the ten-entry TOC as external chapter navigation. A future approved child record links to sibling chapters through their source URLs; the importer never flattens all chapters into one HTML file.
- Interactive: Current body evidence shows `iframe 0`, `video 0`, and `audio 0`; browser challenge handling remains a preflight condition. Challenge HTML stays outside the source body.
- Tables and code: The captured body metrics show no table or code surface requiring normalization; each child chapter must record its own table/code counts before collection.
- Images and third-party media: Captured body metrics include `img 3`, including CTA/outline assets. Audit each child asset owner, alt text, and rights; unresolved assets remain external or produce `unsupported-media`.
- Attribution evidence: JSON-LD identifies Moz as author/copyright holder and reports `dateModified: 2025-12-02`; the footer identifies SEOMoz, Inc. and all-rights-reserved context. Preserve Moz as provider/author context and retain the terms URL, challenge result, requested/final/canonical URLs, and series TOC evidence.
- Exact disposition: **manual series handling** (`manual-series`, P3). Keep the index card external. Create child tutorials only after independent qualification, rights review, and a later series decision.

### 4. SEO Basics: Beginner's Guide to SEO Success (Ahrefs)

- Source evidence: [Ahrefs — current SEO Basics page](https://ahrefs.com/seo/seo-basics), [card URL and redirect origin](https://ahrefs.com/blog/seo-basics/), and [Ahrefs Terms of Service](https://ahrefs.com/legal/terms).
- Observed boundary: card URL returned `301` to `https://ahrefs.com/seo/seo-basics`; final response `200 text/html`; final canonical is the current SEO Guide path. Rendered main metrics were `h1 1`, `h2 7`, `h3 28`, `h4 8`, `p 130`, `ul 7`, `ol 1`, `li 34`, `a 241`; the page has four in-page section anchors. The captured HTML exposes no reliable published/modified date, so source-update evidence remains open and blocks publication.
- Normalization: Run an explicit canonical rebind from the card URL to `https://ahrefs.com/seo/seo-basics` before collection. Extract the current single article body and propose slug `ahrefs-seo-basics`; keep surrounding Ahrefs Guide chapters outside this record.
- Navigation: Preserve the four in-page fragments and their heading IDs. Keep links to other guide chapters as ordinary external links; a chapter card receives a separate inventory entry.
- Interactive: One hidden utility iframe appeared in the browser shell; exclude it from the body. A future body iframe needs allowlist, title, provider, and rights evidence.
- Tables and code: Preserve semantic tables and inline/block code when present in the approved body. Review data sources and code ownership under the Ahrefs terms before translation.
- Images and third-party media: Raw HTML contained `49` images including shell assets; browser evidence exposed no content video/audio and one shell iframe. Build a per-asset list, localize only approved images, preserve alt/hash/order, and keep unresolved third-party assets as links or external media.
- Attribution evidence: Visible roles are Joshua Hardwick (author), Sam Oh and Louise Linehan (contributors), and Ryan Law (reviewer). Store Joshua Hardwick in `source.author`, Ahrefs in `source.provider`, and the complete role list in review evidence. Ahrefs Terms sections 12.1–12.7 provide the rights boundary and written-consent evidence requirement.
- Exact disposition: **after rights approval** (`rights-gated`, P2). Complete canonical rebind evidence, written text/media permission, and per-asset review before staging; keep the card external while any item remains open.

### 5. The Beginner's Guide to SEO (ContentKing)

- Source evidence: [original ContentKing card URL](https://www.contentkingapp.com/academy/seo-guide/), [current Conductor Technical SEO hub](https://www.conductor.com/academy/technical-seo-hub/), and [Conductor Terms of Use](https://www.conductor.com/legal/terms-of-use/).
- Observed boundary: card URL returned `301` to the Conductor URL; final response `200 text/html`; final canonical is the Conductor hub. Current page title is `Technical SEO articles`; rendered metrics were `h1 1`, `h2 1`, `p 1`, `ul 2`, `li 19`, `a 46`, `img 30`. A reliable source update value was not exposed in the captured hub evidence; the external disposition preserves this limitation.
- Normalization: Treat the destination as a collection grid with filters and article cards. Preserve the external hub URL and redirect/canonical evidence; select an individual article only through a new source inventory decision.
- Navigation: Keep the hub's card grid and category navigation external. Individual Conductor article links remain external until each article has its own body and rights decision.
- Interactive: The raw page contains one Google Tag Manager iframe and filter behavior; both belong to the collection shell and stay outside an imported tutorial body.
- Tables and code: The collection has no continuous tutorial body or normalized table/code surface. An individual article requires fresh table/code metrics and sanitizer review.
- Images and third-party media: The `30` images represent shell/card assets and the hub has no continuous article media boundary. Keep card thumbnails and tracking media external; review selected article assets separately.
- Attribution evidence: Conductor Terms cover text, images, video, audio, and arrangement as protected site content and require permission for copying or republishing. The current footer reports `© Conductor 2026. All Rights Reserved`; preserve ContentKing origin, Conductor destination, redirect chain, canonical, publisher, and terms evidence.
- Exact disposition: **External resource-center disposition** (`external-collection`). Keep the resource card external and point it at the current Conductor hub after editorial link review. A hub record never becomes a single-page tutorial.

### 6. The Complete SEO Guide for Beginners (Mangools)

- Source evidence: [Mangools — The Complete SEO Guide for Beginners](https://mangools.com/blog/learn-seo/), [Mangools Terms & Conditions](https://mangools.com/conditions), and the page's visible author/update metadata.
- Observed boundary: `200 text/html`, canonical equals the card URL, `robots` is `index, follow`; the page identifies Vlado Pavlik, `datePublished: 2026-05-14`, `dateModified: 2026-05-19`, and roughly 130 minutes. One `.mg-post-content` contains eight chapter bodies and in-page navigation; observed metrics were `h1 8`, `h2 35`, `h3 107`, `h4 29`, `p 702`, `ul 68`, `ol 5`, `li 280`, `blockquote 4`.
- Normalization: The eight chapter bodies form one continuous canonical article. Keep the article title as the single route `h1`; demote the seven additional chapter `h1` labels to `h2` in the normalized body, preserving each label's text, `id`, order, and TOC mapping. Record this source-to-output heading map in review evidence, then preserve paragraphs, lists, quotes, tables, code, and approved media in one candidate with proposed slug `mangools-complete-seo-guide`.
- Navigation: Preserve the eight in-page chapter links and their fragments. Keep unrelated product links as outbound source links. The article's quiz/certificate endpoints remain separate application surfaces.
- Interactive: Body evidence includes `mangools-quiz` and `mangools-certificate` forms with `85` inputs. Forms, answer state, certificate generation, newsletter, and product behavior are unsupported; retain reviewed external CTAs or static explanatory text only after a separate editorial/rights decision. The YouTube iframe is eligible for remote allowlist review.
- Tables and code: Preserve semantic tables and inline/block code after rights review, source-data review, and accessibility validation. Store table/code metrics and source credits in the candidate handoff.
- Images and third-party media: The body contains `80` images and one YouTube embed at `https://www.youtube.com/embed/wTwnFcWUM3k?feature=oembed`. Localize approved images with alt/hash/order evidence; keep the YouTube player remote with title/provider/rights evidence; omit unresolved diagrams through an explicit review decision.
- Attribution evidence: Visible metadata credits Vlado Pavlik. Store Vlado Pavlik in `source.author`, Mangools in `source.provider`, both update dates, canonical URL, source path, capture/hash evidence, and Mangools terms. The terms assign page text/graphics and third-party components to their respective owners and require prior written consent for reuse.
- Exact disposition: **after manual body/media and rights review** (`rights-gated`, P2). Stage one single-page candidate only after form/CTA treatment, YouTube and image rights, table/code review, and written reuse permission are recorded; keep the card external while any item remains open.

### 7. SEO Fundamentals Course with Greg Gifford (Semrush)

- Source evidence: [original Semrush course card URL](https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/), [current Semrush SEO Essentials course](https://www.semrush.com/academy/courses/seo-essentials-with-semrush/), and [Semrush Website Terms of Use](https://www.semrush.com/company/legal/website-terms-of-use/).
- Observed boundary: card URL returned `308` to the current course URL; final response `200 text/html`; canonical is the current course URL. The current title/instructors differ from the card label; the landing page has `h1 1`, `h2 8`, `h3 20`, `p 94`, `img 3`, and a 20-item structure with one video lesson per item. A reliable course update value was not exposed in the captured landing-page evidence; the external disposition preserves this limitation.
- Normalization: Keep the course landing page as an external course surface. Preserve the current title, instructor set, lesson count, enrollment/certificate context, and redirect evidence in card metadata; never turn the lesson list into one tutorial body. Proposed card target is the current course URL after editorial review.
- Navigation: Keep all lesson navigation, onboarding, account/tool walkthroughs, and paid-trial CTAs external. A future public lesson receives its own URL/canonical/body/rights decision.
- Interactive: The initial HTML has no content iframe/video/audio; the course application supplies lesson playback, worksheets, enrollment, and certificate behavior. These application surfaces remain external.
- Tables and code: The course landing page has no imported table/code body boundary. Any lesson table or code sample requires a separate lesson-level review and license record.
- Images and third-party media: The three landing-page images remain external course assets. Lesson media and worksheets require separate access and rights evidence; no course media is localized into a single-page tutorial candidate.
- Attribution evidence: Preserve the old card title, current title, current instructors (Kyle Byers and Rita Cidre), Semrush provider, final/canonical URL, 20-lesson evidence, and terms link. Semrush terms protect text, images, audio, video, and other content and restrict copying, translation, mirroring, and publication without authorization.
- Exact disposition: **External course disposition** (`external-course`). Keep the card external and update its display target/title after editorial review. A single-page import would omit course application state and remains outside the current tutorial contract.

## Release and implementation handoff

The following checks bind this artifact to the existing implementation:

1. `npm run tutorials:source-decisions` validates this seven-section decision
   artifact, source URLs, evidence links, required provenance vocabulary, and
   exact dispositions.
2. `npm run tutorials:inventory` remains the #20 card/redirect/live-evidence
   baseline. A source decision update changes both artifacts in one review.
3. `npm run tutorials:collect` and `npm run tutorials:import` enforce the
   current HTTPS, canonical, body-root, sanitizer, local-image, iframe-host,
   heading, hash, and bilingual handoff rules. The current adapter is
   `google-devsite`; non-Google profiles require source-specific review before
   collection.
4. `npm run tutorials:release-gates` enforces `provenance`, `media-integrity`,
   `accessibility`, `security-sanitization`, `metadata`, and
   `resource-card-conversion` for candidates. `runtime-routes` remains a
   runtime release check.
5. `npm run check` runs the source-decision checker with the repository-wide
   data, tutorial, type, lint, build, and smoke checks.

The exact card partition after this decision is: Google Search Works and Google
Search Essentials are `eligible-direct`; Ahrefs and Mangools are `rights-gated`;
Moz is `manual-series`; ContentKing is `external-collection`; and Semrush is
`external-course`. This partition is the source-specific input for the migration
waves in Issue #21: official Google first, rights-reviewed single pages second,
manual or external surfaces third.
