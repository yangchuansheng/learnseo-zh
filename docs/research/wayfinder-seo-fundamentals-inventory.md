# SEO Fundamentals Source Tutorial Inventory

- Ticket: [Inventory and classify SEO Fundamentals Source Tutorials](https://github.com/yangchuansheng/learnseo-zh/issues/20)
- Checked: `2026-08-31` (live HTTP and rendered-page checks)
- Local card source: [SEO Fundamentals generated HTML](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L43)
- Scope: the seven remaining cards on `/seo_roadmap/seo-fundamentals/`; the Google SEO Starter Guide card at lines 49–52 already has a published internal pair.

## Decision

Use this migration order:

1. **In-Depth Guide to How Google Search Works** — direct single-page Google documentation, stable canonical, compact body, CC BY 4.0.
2. **Google Search Essentials** — direct single-page Google documentation, stable canonical, compact body, CC BY 4.0.
3. **SEO Basics: Beginner’s Guide to SEO Success (Ahrefs)** — import after an explicit canonical rebind and written rights review.
4. **The Complete SEO Guide for Beginners (Mangools)** — import the article body after a manual interactive/media review and written rights review.
5. **The Beginner’s Guide to SEO (Moz)** — treat as a multi-page series; audit and migrate child chapters as separate records when the series decision is approved.
6. **The Beginner’s Guide to SEO (ContentKing)** — retain as an external resource-center link; the source now resolves to a Conductor hub.
7. **SEO Fundamentals Course with Greg Gifford (Semrush)** — retain as an external course link; the source now resolves to a 20-lesson video course.

The importer’s canonical rule requires an explicit rebind when a card URL redirects to a different canonical path. Full-text and media reuse for the non-Google sources requires source permission or a documented license decision. The published renderer can keep these cards external while review is open.

The source-specific body, navigation, media, attribution, and exact disposition rules are recorded in the [Issue #22 decision artifact](./wayfinder-seo-fundamentals-source-decisions.md).

## Eligibility and evidence method

The local tutorial contract requires a public HTML response, a continuous topic-closed body, a single-page boundary, and a verified canonical. I recorded the final response, `Content-Type`, redirect chain, canonical element, source update signal, visible content root, and media/embed surface for each card. Counts below are observed from the source body when a stable body root exists; raw-response counts are labelled explicitly and include source shell elements.

Google’s own [Site Policies](https://developers.google.com/terms/site-policies) state that pages carrying the notice are generally reusable under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) with attribution, while images, audio, video, and external linked media can have separate terms. The current tutorial model’s attribution and media checks should remain part of every import review.

## Per-source findings

### 1. In-Depth Guide to How Google Search Works

- Card: [local card, lines 43–46](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L43)
- Source: [Google Search Central — In-Depth Guide to How Google Search Works](https://developers.google.com/search/docs/fundamentals/how-search-works)
- HTTP/content: `200 text/html`; `Last-Modified: 2025-12-18`; final URL equals the card URL; canonical element equals `https://developers.google.com/search/docs/fundamentals/how-search-works`.
- Topology: one `.devsite-article-body` with a complete guide covering crawling, indexing, and serving results. Observed body metrics: `h1 1`, `h2 5`, `p 18`, `ul 3`, `ol 1`, `li 12`, `a 29`, `code 3`.
- Media/embed: article body has `img 0`, `table 0`, `iframe 0`, `video 0`, `audio 0`; the response shell contains navigation and feedback controls that belong outside the imported body.
- Attribution/license: page footer links [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [Apache 2.0 for code samples](https://www.apache.org/licenses/LICENSE-2.0), and [Google Developers Site Policies](https://developers.google.com/terms/site-policies). No individual author is presented; use Google Search Central / Google for Developers as the provider/author fallback.
- Recommendation: **P1, eligible for direct import**. Proposed slug: `google-search-works`. Preserve the source update value and the Google attribution block.
- Open uncertainty: Google’s linked references can change independently; run the standard link and canonical preflight immediately before collection.

### 2. Google Search Essentials

- Card: [local card, lines 55–58](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L55)
- Source: [Google Search Central — Google Search Essentials](https://developers.google.com/search/docs/essentials)
- HTTP/content: `200 text/html`; `Last-Modified: 2025-12-10`; final URL equals the card URL; canonical element equals `https://developers.google.com/search/docs/essentials`.
- Topology: one `.devsite-article-body` containing technical requirements, spam policies, and key best practices. Observed body metrics: `h1 1`, `h2 3`, `p 7`, `ul 2`, `li 10`, `a 14`; no child-page navigation is required to complete the page.
- Media/embed: article body has `img 0`, `table 0`, `iframe 0`, `video 0`, `audio 0`; source-shell search and feedback UI stays outside the body.
- Attribution/license: page footer links [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [Apache 2.0 for code samples](https://www.apache.org/licenses/LICENSE-2.0), and [Google Developers Site Policies](https://developers.google.com/terms/site-policies). Use Google Search Central / Google for Developers as the provider/author fallback.
- Recommendation: **P1, eligible for direct import**. Proposed slug: `google-search-essentials`. Import after `google-search-works` so the two official fundamentals pages form a coherent first wave.
- Open uncertainty: Google can update the linked Search Essentials policies and best-practice references; store the source update date and content hash on collection.

### 3. The Beginner’s Guide to SEO (Moz)

- Card: [local card, lines 61–64](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L61)
- Source: [Moz — Beginner’s Guide to SEO](https://moz.com/beginners-guide-to-seo)
- HTTP/content: plain GET returned `200 text/html`; `Last-Modified: 2026-08-25`; canonical equals the card URL; a Chrome-like browser request received a Cloudflare `403` challenge, so collector preflight must retain a bot-challenge result when it occurs.
- Topology: the page uses `guides-chapter`/`.article-body` and acts as an introduction plus series index. Its visible TOC has 10 entries: Introduction plus nine chapter URLs (`quick-start-guide`, `why-search-engine-marketing-is-necessary`, `how-search-engines-operate`, `keyword-research`, `on-page-seo`, `technical-seo`, `growing-popularity-and-links`, `measuring-and-tracking-success`, and `seo-glossary`). The card target therefore represents a multi-page guide boundary.
- Media/embed: the captured `.article-body` has `h2 3`, `h3 2`, `h5 17`, `p 33`, `ol 1`, `li 7`, `a 16`, `img 3`, and `iframe/video/audio 0`. The images include CTA/outline assets; each child chapter needs its own asset and attribution audit.
- Attribution/license: the page’s JSON-LD identifies Moz as author/copyright holder and reports `dateModified: 2025-12-02`. The [Moz Terms of Use](https://moz.com/terms-of-use) describes Moz Content as protected intellectual property owned by Moz and reserves rights; the page footer reports `SEOMoz, Inc. ... All rights reserved`.
- Recommendation: **P3, manual series handling**. Keep the index card external while the project decides whether each child chapter becomes a separate tutorial record. A single-page importer should not flatten the chapter series into one record.
- Open uncertainties: browser challenge behavior varies by user agent; child-page canonical/update/media/licensing evidence remains to be collected; Moz’s current rights terms provide no permissive full-text reuse notice.

### 4. SEO Basics: Beginner’s Guide to SEO Success (Ahrefs)

- Card: [local card, lines 67–70](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L67)
- Source: [Ahrefs — current SEO Basics page](https://ahrefs.com/seo/seo-basics); card URL [redirects here](https://ahrefs.com/blog/seo-basics/).
- HTTP/content: card URL returned `301` to `https://ahrefs.com/seo/seo-basics`; final response was `200 text/html`; final canonical is `https://ahrefs.com/seo/seo-basics`. The final canonical differs from the card URL, so the importer’s explicit rebind flow is required.
- Topology: the final page is a single current SEO Basics article with four in-page section anchors (`#seo-guide-tracked-section-0` through `#seo-guide-tracked-section-3`). The surrounding Ahrefs SEO Guide links other chapters as separate URLs; those chapters sit outside this card’s single-page boundary. The rendered main content observed `h1 1`, `h2 7`, `h3 28`, `h4 8`, `p 130`, `ul 7`, `ol 1`, `li 34`, `a 241`.
- Media/embed: the raw response contains `49` `<img>` elements including page shell assets and no literal content `iframe`, `video`, or `audio` tags. A browser run exposed one hidden utility iframe from the page shell; treat it as shell and exclude it from the imported body. Image ownership and remote asset URLs require per-asset review.
- Attribution/license: the page identifies Joshua Hardwick as author, Sam Oh and Louise Linehan as contributors, and Ryan Law as reviewer in the visible article header. The [Ahrefs Terms of Service](https://ahrefs.com/legal/terms) sections 12.1–12.7 reserve Ahrefs and third-party intellectual-property rights and require express written consent for copying, publishing, or derivative use beyond the granted service access.
- Recommendation: **P2 after rights approval**. Rebind the source identity to `https://ahrefs.com/seo/seo-basics`, then use a proposed slug `ahrefs-seo-basics`. Import the current page as one article after written reuse permission and image review are recorded.
- Open uncertainties: the final page did not expose a reliable published/modified date in the captured HTML; Ahrefs can change the page structure and chapter topology; the source’s image and third-party reference rights need separate evidence.

### 5. The Beginner’s Guide to SEO (ContentKing)

- Card: [local card, lines 73–76](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L73)
- Source: [card URL](https://www.contentkingapp.com/academy/seo-guide/); current destination [Conductor Technical SEO Resources](https://www.conductor.com/academy/technical-seo-hub/).
- HTTP/content: card URL returned `301` to `https://www.conductor.com/academy/technical-seo-hub/`; final response was `200 text/html`; final canonical is the Conductor hub URL. The original ContentKing URL no longer owns the canonical page.
- Topology: current page title is **Technical SEO articles**. It exposes category filters and a grid of many article cards, with no continuous single-guide body. Rendered main metrics were `h1 1`, `h2 1`, `p 1`, `ul 2`, `ol 1`, `li 19`, `a 46`, `img 30`.
- Media/embed: the raw response has 30 page-card and shell images plus one Google Tag Manager iframe. The current destination has no continuous tutorial body from which to extract source media.
- Attribution/license: the [Conductor Terms of Use](https://www.conductor.com/legal/terms-of-use/) state that the website’s text, images, video, audio, and arrangement are protected company/licensor content; copying, modifying, republishing, or commercial use requires permission. The current page footer identifies `© Conductor 2026. All Rights Reserved`.
- Recommendation: **External resource-center disposition**. Keep this card external or update its display target to the current Conductor hub. Select a specific Conductor article as a new resource only after a separate card-level review; the hub itself is a collection surface.
- Open uncertainties: Conductor can change or remove the hub’s article grid; ownership continuity from ContentKing to Conductor should be recorded if the card metadata is updated.

### 6. The Complete SEO Guide for Beginners (Mangools)

- Card: [local card, lines 79–82](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L79)
- Source: [Mangools — The Complete SEO Guide for Beginners](https://mangools.com/blog/learn-seo/)
- HTTP/content: `200 text/html`; canonical equals the card URL; `robots` is `index, follow`; JSON-LD and visible metadata identify author Vlado Pavlik, `datePublished: 2026-05-14`, `dateModified: 2026-05-19`, and approximately 130 minutes reading time.
- Topology: one long public article at a stable canonical with eight chapter bodies and in-page navigation. The `.mg-post-content` body observed `h1 8`, `h2 35`, `h3 107`, `h4 29`, `p 702`, `ul 68`, `ol 5`, `li 280`, and `blockquote 4`; the chapter sequence is continuous on this URL.
- Media/embed: `.mg-post-content` contains `80` images and one YouTube iframe (`https://www.youtube.com/embed/wTwnFcWUM3k?feature=oembed`). It also contains `mangools-quiz` and `mangools-certificate` forms with 85 inputs. These quiz, certificate, newsletter, and product surfaces need explicit extraction rules; the YouTube embed requires allowlist and media attribution review.
- Attribution/license: the [Mangools Terms & Conditions](https://mangools.com/conditions) identify text, databases, graphics, and related components as Mangools or third-party intellectual property, reserve all ungranted rights, prohibit copying/derivative use, and require prior written consent for IP use. The article visibly credits Vlado Pavlik; preserve author and source attribution.
- Recommendation: **P2 after manual body/media and rights review**. Proposed slug: `mangools-complete-seo-guide`. Import the continuous guide body as one candidate only after deciding whether the quiz/certificate remain external links or become static explanatory blocks; keep the YouTube player allowlisted or retain a source link.
- Open uncertainties: many diagrams may include third-party data or screenshots; the source page’s interactive scripts and certificate behavior need a browser capture before translation; the page can change quickly because its update date is recent.

### 7. SEO Fundamentals Course with Greg Gifford (Semrush)

- Card: [local card, lines 85–88](../../src/components/sites/learningseo-io-071dae18/subpages/generated/content/5403f1ab90285065f3dfa1f5989103658265ad192132de9f64f993a8273c0044.html#L85)
- Source: [card URL](https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/); current destination [Semrush SEO Essentials with Semrush](https://www.semrush.com/academy/courses/seo-essentials-with-semrush/).
- HTTP/content: card URL returned `308` to the current course URL; final response was `200 text/html`; final canonical is the current course URL. The title and instructor set changed from the card’s old Greg Gifford label to the current Semrush Academy course.
- Topology: current page is an Academy course landing page with enrollment, certificate, and a 20-item course structure. Each listed item is one video lesson; the page includes onboarding/account/tool walkthroughs and paid-trial CTAs. Rendered main metrics were `h1 1`, `h2 8`, `h3 20`, `p 94`, and `img 3`.
- Media/embed: the initial HTML has three images and no content iframe, video, or audio element. Video playback is supplied by the course application, so lesson media, worksheets, and certificate assets stay outside the single-page extraction surface.
- Attribution/license: the [Semrush Website Terms of Use](https://www.semrush.com/company/legal/website-terms-of-use/) protect the site’s text, images, graphics, audio, video, and other content and restrict copying, modifying, translating, mirroring, or publishing without authorization or written approval. The current page footer reports Semrush copyright and all rights reserved.
- Recommendation: **External course disposition**. Keep the card external and update its title/target to the current course after editorial review. A single-page tutorial import would lose the video lesson boundary, enrollment state, certificate flow, and course application behavior.
- Open uncertainties: lesson playback may require JavaScript or an account; worksheets and certificate assets need separate access/rights checks; Semrush may revise the course curriculum independently of the card.

## Cross-source follow-up

- Run importer preflight again at execution time for all seven URLs and preserve redirect, canonical, content-type, and bot-challenge evidence.
- Execute the two Google imports first; their body roots and CC BY attribution provide the lowest-risk second migration wave after the published Starter Guide.
- Create explicit source rebind records for Ahrefs, ContentKing, and Semrush before any card target changes. Ahrefs can become a tutorial candidate after rebind; ContentKing and Semrush remain collection/course surfaces.
- Obtain rights decisions for Moz, Ahrefs, Mangools, Conductor, and Semrush text/media before storing full copied bodies. Keep unresolved cards external while the decision is open.
- Keep quiz, certificate, account, newsletter, paid-trial, and video application behavior outside the single-page renderer unless a later decision ticket expands the supported surface.
