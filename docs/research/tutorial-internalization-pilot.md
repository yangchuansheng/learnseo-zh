# Tutorial Internalization Pilot Inventory

Checked: `2026-08-28T04:46:58Z`  
Repository snapshot: `2026-08-25T08:40:33.099Z` from the generated [English manifest](../../src/components/sites/learningseo-io-071dae18/subpages/generated/manifest.json).

## Decision

Use Google's [Search Engine Optimization (SEO) Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) as the Pilot Tutorial.

It is a public, canonical, first-party HTML guide linked directly from the core `/seo_roadmap/seo-fundamentals/` page. Its article body exercises the shared renderer across three heading levels, paragraphs, lists, links, four meaningful images, two responsive tables, and inline code. The two runners-up cover fewer of those semantics or sit deeper in the roadmap.

## Method and inventory boundary

Observed facts come from the repository snapshot and the three live first-party pages linked below. Inferred classifications are explicitly marked.

1. Selected the 155 English manifest routes whose generated `bodyClass` identifies a `seo_roadmap` page and whose `contentFile` exists.
2. Parsed every generated HTML document and treated the first external HTTP(S) anchor inside each `.resource` card as a resource occurrence.
3. Resolved URLs against `https://learningseo.io`, removed fragments and `utm_*` parameters, and deduplicated exact remaining URLs.
4. Kept resource-card targets separate from author, share, and other surrounding links.
5. Classified resource targets from LearningSEO's visible card type, title, host, and path. These classifications are inference; they are a planning estimate for on-demand review, not a live eligibility guarantee.
6. Live-checked only the selected pilot and two runners-up, following their redirects and inspecting the first-party `.devsite-article-body` DOM.

### Observed link inventory

| Link context | Occurrences | Unique normalized targets |
|---|---:|---:|
| Resource cards | 2,152 | 914 |
| Share controls | 960 | 960 |
| Author/profile links | 319 | 254 |
| Other external links | 114 | 103 |

The 960 share targets carry per-tip payloads and are outside tutorial discovery. The 914 resource targets are the migration inventory.

### Inferred classification of the 914 resource targets

| Classification | Count | Planning rule |
|---|---:|---|
| Likely single-page HTML tutorial | 587 | Guide-like card metadata and an article-shaped path after exclusions below |
| Tool or template | 164 | Tool, extension, sheet, plugin, checklist, template, quiz, simulator, or similar card metadata |
| Multi-page course or academy | 62 | Course metadata, playlist URL, or course/academy path pattern |
| Landing page, feed, event, or other media | 48 | Newsletter, podcast, presentation, event, webinar, or unmatched non-article metadata |
| Video-led or video-hosted | 33 | Video metadata or YouTube/Vimeo host; conservatively excluded even when an HTML wrapper exists |
| Directory or collection | 8 | Resource/website metadata or directory-style title |
| Social post or thread | 8 | LinkedIn, Twitter/X, Threads, or Facebook target |
| PDF | 2 | Direct `.pdf` target |
| Publisher/tutorial homepage | 2 | Root URL left after the format exclusions |
| **Total** | **914** | |

Live availability was not crawled across all 914 targets. All three finalists returned `200 text/html` with matching canonical URLs during the recorded check. Availability, redirects, content type, and extraction boundaries therefore belong in the importer preflight for each on-demand import. Among the finalists, unavailable or blocked count was `0 of 3`.

## Finalists

All DOM counts below are observed inside each live `.devsite-article-body` at `2026-08-28T04:46:58Z`.

| Candidate | LearningSEO source | Live article-body coverage | Decision |
|---|---|---|---|
| [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | Core `/seo_roadmap/seo-fundamentals/` | `h1 1`, `h2 11`, `h3 13`, `p 63`, `ul 6`, `li 17`, `a 54`, `img 4`, `table 2`, `code 16`; updated `2025-12-10 UTC` | **Selected:** broadest representative semantics plus core-roadmap placement |
| [In-depth guide to how Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works) | Core `/seo_roadmap/seo-fundamentals/` | `h1 1`, `h2 5`, `p 18`, `ul 3`, `ol 1`, `li 12`, `a 29`, `code 3`; no images or tables; updated `2025-12-18 UTC` | Runner-up: excellent provenance and simpler extraction, weak media/table coverage |
| [Introduction to structured data markup](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) | `/seo_roadmap/deepen-knowledge/content/structured-data/` and its aggregate pages | `h1 1`, `h2 6`, `h3 1`, `p 16`, `ul 1`, `ol 1`, `li 7`, `a 22`, `img 1`, `table 1`, `code 12`; updated `2025-12-10 UTC` | Runner-up: strong technical semantics, narrower content and deeper roadmap placement |

## Pilot dossier

- Source title: `Search Engine Optimization (SEO) Starter Guide`
- Canonical source: [Google Search Central](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- Publisher: Google Search Central / Google for Developers
- Individual author: none observed in page metadata; store `null` and retain the publisher
- Source card: `Guide` from `Google`, linked from the generated [SEO fundamentals page](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html)
- Live response: `200 text/html`; final URL and canonical both match the source URL
- Source update metadata: `Last updated 2025-12-10 UTC.`
- Source licensing metadata: the page states that general content uses [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and code samples use [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0), subject to Google's [site policies](https://developers.google.com/terms/site-policies)
- Proposed internal slug: `/tutorials/google-seo-starter-guide/` and `/en/tutorials/google-seo-starter-guide/`

## DOM, content, and media risks

1. **Extraction boundary:** Google Developer pages include navigation, article metadata, feedback controls, table of contents, floating actions, and license/footer UI around the content. Import only `.devsite-article-body`; capture title, canonical, publisher, last-updated value, and license metadata separately.
2. **Media localization:** the four article images use relative `/static/search/docs/images/...` URLs, useful alt text, and widths without heights. Resolve against the canonical source, download to repository-owned media, preserve alt/width, calculate or record intrinsic dimensions, and rewrite every `src` locally.
3. **Tables:** both tables are one-row, three-column responsive layouts with `<td>` cells and no `<th>`. Preserve their source semantics and provide horizontal overflow on narrow screens; do not invent headers during import.
4. **Code:** the page contains 16 inline `<code>` elements and no `<pre>` block. The shared template still needs a separate fixture for block code because this pilot cannot prove it.
5. **Embeds:** the page has no iframe or video embed. Supported-embed behavior needs a separate template fixture and allowlist test.
6. **Links and anchors:** preserve meaningful outbound links, normalize relative URLs against the source, retain safe fragment IDs for the generated table of contents, and remove source-shell actions.
7. **Snapshot drift:** record import time, source `Last updated` value, canonical URL, and a content hash so a later refresh can explain what changed.

## Concrete inputs for later tickets

### Shared tutorial page

- Required metadata: locale, title, description, publisher, nullable author, canonical source URL, source update value, imported-at timestamp, content hash, and license/provenance text.
- Required semantic support: `h1`-`h3`, paragraphs, ordered/unordered lists, links, images with local paths and alt text, responsive tables, inline/block code, quotations, and allowlisted embeds.
- Pilot acceptance: both locale routes render the same semantic structure and four local images; English preserves source text; Simplified Chinese is faithful; visible attribution links to the canonical source.

### On-demand importer

- Input: canonical source URL plus destination slug.
- Preflight: follow redirects; require a successful public HTML response; record final URL, canonical, content type, title, publisher/author, update metadata, and license/provenance text.
- Google adapter seed: extract `.devsite-article-body`; exclude all source chrome; resolve relative links/media against the final canonical URL.
- Output: English semantic content, Chinese translation source, downloaded media, metadata, and manifest changes for review.
- Validation: fail on remote article images, unsafe tags/attributes, missing required attribution, locale structure drift, duplicate slug, or a changed canonical host.

## Newly surfaced planning work

- Specify the importer preflight and failure taxonomy for redirects, bot challenges, authentication walls, non-HTML responses, and unavailable pages.
- Add a template-only semantic fixture for block code and supported embeds, the two fidelity requirements the selected pilot does not exercise.
- Treat `587` as an upper-bound migration pool; confirm eligibility during each on-demand import before estimating migration waves.
