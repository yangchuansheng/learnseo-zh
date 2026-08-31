# SEO Fundamentals Wave 2 Authorized Internalization Audit

- Wave: `wave-2-rights-reviewed`
- Checked: `2026-09-01`
- Repeatable command: `npm run tutorials:rights-audit:check` (runs live source and terms preflight)
- Evidence collector: `node scripts/audit-seo-fundamentals-rights.mjs --output /tmp/wave2-rights-audit.json`
- Publication policy: translated full text and localized media require an auditable reuse authorization handoff for each source and asset.

## Result

Both Wave 2 records are `authorized-internalized`. The project owner stated on
`2026-09-01` that written permission has been obtained for Ahrefs and Mangools.
This repository records that authorization scope, the source-specific
normalization decisions, media/interaction handling, bilingual review, and
release-gate evidence. Sensitive external proof remains outside the repository.

The English and Simplified Chinese tutorial manifests publish both routes. The
LearningSEO resource-card mapping converts the approved source cards to local
tutorial routes while retaining the source attribution, requested URL, final URL,
canonical URL, and source-path evidence.

| Source | Requested → final / canonical | Page + body boundary | Terms and permission verdict | Media and interaction constraints | Disposition |
| --- | --- | --- | --- | --- | --- |
| Ahrefs SEO Basics | `https://ahrefs.com/blog/seo-basics/` → `https://ahrefs.com/seo/seo-basics` | `200 text/html`; semantic article window from the section containing the first `h1` through the section after `#references`; HTTP `Last-Modified` used as source update evidence | [Ahrefs Terms](https://ahrefs.com/legal/terms) returned `200`; ownership, copying restriction, and written-consent language observed; project-owner authorization recorded for internal publication | 17 approved article images localized; shell navigation, promotion, related-guide navigation, and utility iframe excluded; contributors Sam Oh/Louise Linehan and reviewer Ryan Law preserved in evidence | `authorized-internalized`; published at `/tutorials/ahrefs-seo-basics/` |
| Mangools Complete SEO Guide | `https://mangools.com/blog/learn-seo/` → same canonical URL | `200 text/html`; `.mg-post-content`; `dateModified` observed as `2026-05-19`; chapter H1s normalized under one route H1 | [Mangools Terms & Conditions](https://mangools.com/conditions) returned `200`; ownership, copying restriction, and permission language observed; project-owner authorization recorded for internal publication | 79 approved images localized; active academy SVG omitted as unsupported media; YouTube iframe retained as reviewed remote allowlisted embed; quiz/certificate/newsletter forms represented as static source CTAs | `authorized-internalized`; published at `/tutorials/mangools-complete-seo-guide/` |

The checker requires live collection, `200 text/html` source and terms
responses, provider-specific terms assertions, source-specific update evidence,
canonical match, body selector/media evidence, owner authorization handoff,
published bilingual manifest entries, local media evidence, and active
resource-card mappings for both approved routes.
