# SEO Fundamentals Wave 3 External-Disposition Audit

- Checked: `2026-08-31`
- Live checker: `npm run tutorials:wave3-audit:check`
- Evidence: `.omo/evidence/wave3-external-dispositions.json`

## Dispositions

| Source | Requested URL | Live canonical target | Disposition | Route |
| --- | --- | --- | --- | --- |
| Moz Beginner's Guide | `https://moz.com/beginners-guide-to-seo` | `https://moz.com/beginners-guide-to-seo` | `manual-series` | No index route; qualify one TOC child independently. |
| ContentKing SEO Guide | `https://www.contentkingapp.com/academy/seo-guide/` | `https://www.conductor.com/academy/technical-seo-hub/` | `external-collection` | No route; preserve the current Conductor collection card. |
| Semrush Greg Gifford course | `https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/` | `https://www.semrush.com/academy/courses/seo-essentials-with-semrush/` | `external-course` | No route; preserve the current Semrush course card. |

## Evidence boundary

The live audit records requested, final, and canonical URLs; redirect status and chain; HTML status/type; content hashes; update signals; source-specific topology; and terms assertions. It retains no source body or media. Moz remains a ten-entry series index with `.guides-chapter` and `.article-body`; Conductor remains a filterable article-card grid; Semrush remains a 20-item course application.

The audit checks the English and Simplified Chinese roadmap cards against those canonical targets and current display titles. It also verifies that the Pilot and Wave 1 Google tutorial mappings remain present while Wave 3 owns zero tutorial routes.
