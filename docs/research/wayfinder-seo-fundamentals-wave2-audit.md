# SEO Fundamentals Wave 2 Rights-Gate Audit

- Wave: `wave-2-rights-reviewed`
- Checked: `2026-08-31`
- Repeatable command: `npm run tutorials:rights-audit:check` (runs live source and terms preflight)
- Evidence collector: `node scripts/audit-seo-fundamentals-rights.mjs --output /tmp/wave2-rights-audit.json`
- Publication policy: translated full text and localized media require auditable written reuse permission for each source and asset.

## Result

Both Wave 2 records are `rights-gated-external`. The audit keeps both roadmap cards external and leaves `routeSlug` unset: neither source is present in the English or Simplified Chinese tutorial manifests. The generated English and Simplified Chinese roadmap cards link to the source canonical targets, with Ahrefs rebound from its redirect origin.

| Source | Requested → final / canonical | Page + body boundary | Terms and permission verdict | Media and interaction constraints | Disposition |
| --- | --- | --- | --- | --- | --- |
| Ahrefs SEO Basics | `https://ahrefs.com/blog/seo-basics/` → `https://ahrefs.com/seo/seo-basics` | `200 text/html`; semantic article window from the section containing the first `h1` through the section after `#references`; no auditable update date | [Ahrefs Terms](https://ahrefs.com/legal/terms) returned `200`; ownership, copying restriction, and written-consent language observed; no open-license signal and no written republication permission recorded | 17 candidate article images require per-asset rights review; shell navigation, promotion, and related-guide navigation stay excluded | `rights-gated-external`; canonical rebind, update evidence, written text permission, and asset permission remain required |
| Mangools Complete SEO Guide | `https://mangools.com/blog/learn-seo/` → same canonical URL | `200 text/html`; `.mg-post-content`; `dateModified` observed as `2026-05-19` | [Mangools Terms & Conditions](https://mangools.com/conditions) returned `200`; ownership, copying restriction, and permission language observed; no open-license signal and no written republication permission recorded | 80 lazy-loaded images, including 8 without alt text; one titled, allowlisted YouTube iframe still needs rights evidence; quiz/certificate/newsletter forms stay external/static-only | `rights-gated-external`; written text permission, asset permission, CTA treatment, and embed decision remain required |

The checker requires live collection, `200 text/html` source and terms responses, provider-specific terms assertions, source-specific update evidence, canonical match, body selector/media evidence, blocked rights verdicts, active bilingual roadmap-card links resolved from each active manifest, and absent internal routes. It never persists source bodies or media.
